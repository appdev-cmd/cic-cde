// API layer cho Rule Engine kiểm tra mô hình (rule_sets / rules / check_runs / check_results).
// Worker Python (scripts/rule-check-worker) xử lý hàng đợi check_runs.
import { supabase } from '../supabase';

// ---- Kiểu dữ liệu (mirror shape jsonb `params` — nguồn sự thật duy nhất) ----

export interface PropertyFilter {
  pset: string;
  name: string;
  op: 'eq' | 'neq' | 'contains' | 'gt' | 'lt' | 'exists';
  value?: string | number;
}

export interface ElementGroup {
  categories: string[];              // ví dụ ['IFCPIPESEGMENT']
  propertyFilters: PropertyFilter[];
}

export interface RuleParams {
  groupA: ElementGroup;
  groupB: ElementGroup;
  condition: 'intersect' | 'min_distance';
  tolerance?: number;    // clash: độ xuyên tối thiểu (m) để tính vi phạm
  minDistance?: number;  // clearance: khoảng cách tối thiểu (m)
}

export type RuleSeverity = 'low' | 'medium' | 'high' | 'critical';

export interface RuleSet {
  id: string;
  projectId?: string;
  name: string;
  description?: string;
  standardRef?: string;
  isPreset: boolean;
  createdBy?: string;
  createdAt: string;
}

export interface Rule {
  id: string;
  ruleSetId: string;
  name: string;
  ruleType: 'clash' | 'clearance';
  params: RuleParams;
  severity: RuleSeverity;
  enabled: boolean;
  sortOrder: number;
}

export type CheckRunStatus = 'pending' | 'processing' | 'done' | 'error';

export interface CheckRun {
  id: string;
  projectId: string;
  ruleSetId?: string;
  documentCodes: string[];
  status: CheckRunStatus;
  progress: number;
  errorMessage?: string;
  summary?: {
    violations?: number;
    passes?: number;
    skipped?: number;
    byRule?: Record<string, { violations: number; checked: number }>;
    modelBboxes?: Record<string, number[][]>;
  };
  requestedBy?: string;
  createdAt: string;
  startedAt?: string;
  finishedAt?: string;
}

export interface ElemRef {
  docCode: string;
  guid: string;
  expressId: number;
  name: string;
  category: string;
}

export interface CheckResult {
  id: string;
  runId: string;
  ruleId?: string;
  status: 'violation' | 'pass';
  elementA: ElemRef;
  elementB?: ElemRef;
  measuredValue?: number; // mét
  position?: number[];    // [x,y,z] world
  details?: Record<string, any>;
}

// ---- Mappers (snake → camel, theo style documents.ts) ----

const mapRuleSet = (r: any): RuleSet => ({
  id: r.id,
  projectId: r.project_id ?? undefined,
  name: r.name,
  description: r.description ?? undefined,
  standardRef: r.standard_ref ?? undefined,
  isPreset: !!r.is_preset,
  createdBy: r.created_by ?? undefined,
  createdAt: r.created_at,
});

const mapRule = (r: any): Rule => ({
  id: r.id,
  ruleSetId: r.rule_set_id,
  name: r.name,
  ruleType: r.rule_type,
  params: r.params ?? {},
  severity: r.severity ?? 'medium',
  enabled: r.enabled ?? true,
  sortOrder: r.sort_order ?? 0,
});

const mapElemRef = (e: any): ElemRef => ({
  docCode: e?.doc_code ?? '',
  guid: e?.guid ?? '',
  expressId: e?.express_id ?? 0,
  name: e?.name ?? '',
  category: e?.category ?? '',
});

const mapCheckRun = (r: any): CheckRun => ({
  id: r.id,
  projectId: r.project_id,
  ruleSetId: r.rule_set_id ?? undefined,
  documentCodes: r.document_codes ?? [],
  status: r.status,
  progress: r.progress ?? 0,
  errorMessage: r.error_message ?? undefined,
  summary: r.summary ?? undefined,
  requestedBy: r.requested_by ?? undefined,
  createdAt: r.created_at,
  startedAt: r.started_at ?? undefined,
  finishedAt: r.finished_at ?? undefined,
});

const mapCheckResult = (r: any): CheckResult => ({
  id: r.id,
  runId: r.run_id,
  ruleId: r.rule_id ?? undefined,
  status: r.status,
  elementA: mapElemRef(r.element_a),
  elementB: r.element_b ? mapElemRef(r.element_b) : undefined,
  measuredValue: r.measured_value ?? undefined,
  position: r.position ?? undefined,
  details: r.details ?? undefined,
});

// ---- Rule sets & rules ----

/** Preset toàn cục + rule sets riêng của dự án. */
export async function fetchRuleSets(projectId: string): Promise<RuleSet[]> {
  const { data, error } = await supabase
    .from('rule_sets')
    .select('*')
    .or(`is_preset.eq.true,project_id.eq.${JSON.stringify(projectId)}`)
    .order('is_preset', { ascending: false })
    .order('created_at', { ascending: true });
  if (error) { console.error('fetchRuleSets:', error.message); return []; }
  return (data ?? []).map(mapRuleSet);
}

export async function fetchRules(ruleSetId: string): Promise<Rule[]> {
  const { data, error } = await supabase
    .from('rules')
    .select('*')
    .eq('rule_set_id', ruleSetId)
    .order('sort_order', { ascending: true });
  if (error) { console.error('fetchRules:', error.message); return []; }
  return (data ?? []).map(mapRule);
}

export async function createRuleSet(projectId: string, name: string, description?: string, createdBy?: string): Promise<RuleSet | null> {
  const { data, error } = await supabase
    .from('rule_sets')
    .insert({ project_id: projectId, name, description, is_preset: false, created_by: createdBy })
    .select()
    .single();
  if (error) { console.error('createRuleSet:', error.message); return null; }
  return mapRuleSet(data);
}

export async function createRule(input: {
  ruleSetId: string; name: string; ruleType: 'clash' | 'clearance';
  params: RuleParams; severity: RuleSeverity; sortOrder?: number;
}): Promise<Rule | null> {
  const { data, error } = await supabase
    .from('rules')
    .insert({
      rule_set_id: input.ruleSetId, name: input.name, rule_type: input.ruleType,
      params: input.params, severity: input.severity, sort_order: input.sortOrder ?? 0,
    })
    .select()
    .single();
  if (error) { console.error('createRule:', error.message); return null; }
  return mapRule(data);
}

export async function updateRule(id: string, patch: Partial<{
  name: string; params: RuleParams; severity: RuleSeverity; enabled: boolean;
}>): Promise<boolean> {
  const dbPatch: Record<string, any> = {};
  if (patch.name !== undefined) dbPatch.name = patch.name;
  if (patch.params !== undefined) dbPatch.params = patch.params;
  if (patch.severity !== undefined) dbPatch.severity = patch.severity;
  if (patch.enabled !== undefined) dbPatch.enabled = patch.enabled;
  const { error } = await supabase.from('rules').update(dbPatch).eq('id', id);
  if (error) { console.error('updateRule:', error.message); return false; }
  return true;
}

export async function deleteRule(id: string): Promise<boolean> {
  const { error } = await supabase.from('rules').delete().eq('id', id);
  if (error) { console.error('deleteRule:', error.message); return false; }
  return true;
}

export async function deleteRuleSet(id: string): Promise<boolean> {
  const { error } = await supabase.from('rule_sets').delete().eq('id', id).eq('is_preset', false);
  if (error) { console.error('deleteRuleSet:', error.message); return false; }
  return true;
}

// ---- Check runs & results ----

export async function createCheckRun(
  projectId: string, ruleSetId: string, documentCodes: string[], requestedBy?: string,
): Promise<CheckRun | null> {
  const { data, error } = await supabase
    .from('check_runs')
    .insert({ project_id: projectId, rule_set_id: ruleSetId, document_codes: documentCodes, requested_by: requestedBy })
    .select()
    .single();
  if (error) { console.error('createCheckRun:', error.message); return null; }
  return mapCheckRun(data);
}

export async function fetchCheckRuns(projectId: string, limit = 20): Promise<CheckRun[]> {
  const { data, error } = await supabase
    .from('check_runs')
    .select('*')
    .eq('project_id', projectId)
    .order('created_at', { ascending: false })
    .limit(limit);
  if (error) { console.error('fetchCheckRuns:', error.message); return []; }
  return (data ?? []).map(mapCheckRun);
}

export async function fetchCheckResults(runId: string, onlyViolations = true): Promise<CheckResult[]> {
  let q = supabase.from('check_results').select('*').eq('run_id', runId);
  if (onlyViolations) q = q.eq('status', 'violation');
  const { data, error } = await q.order('created_at', { ascending: true }).limit(5000);
  if (error) { console.error('fetchCheckResults:', error.message); return []; }
  return (data ?? []).map(mapCheckResult);
}

/**
 * Theo dõi tiến độ một run: realtime (postgres_changes) + fallback poll 3s.
 * Trả về hàm hủy đăng ký.
 */
export function subscribeCheckRun(runId: string, cb: (run: CheckRun) => void): () => void {
  let stopped = false;

  const channel = supabase
    .channel(`check_run_${runId}`)
    .on('postgres_changes',
      { event: 'UPDATE', schema: 'public', table: 'check_runs', filter: `id=eq.${runId}` },
      (payload) => { if (!stopped && payload.new) cb(mapCheckRun(payload.new)); })
    .subscribe();

  // Fallback poll — phòng khi realtime không hoạt động
  const poll = setInterval(async () => {
    if (stopped) return;
    const { data } = await supabase.from('check_runs').select('*').eq('id', runId).single();
    if (data && !stopped) {
      const run = mapCheckRun(data);
      cb(run);
      if (run.status === 'done' || run.status === 'error') {
        clearInterval(poll);
      }
    }
  }, 3000);

  return () => {
    stopped = true;
    clearInterval(poll);
    supabase.removeChannel(channel);
  };
}
