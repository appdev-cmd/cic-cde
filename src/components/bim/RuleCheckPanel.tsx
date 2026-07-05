// Panel "Kiểm tra" (tab phải ViewerTab) — chạy bộ quy tắc kiểm tra mô hình server-side.
// Chọn bộ quy tắc (preset theo QCVN/tiêu chuẩn hoặc tự tạo) + mô hình IFC → tạo check_run
// → worker Python xử lý → hiện kết quả nhóm theo rule, bay tới vi phạm, tạo BCF.
import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  ShieldCheck, Play, RefreshCw, ChevronDown, ChevronRight, Plus,
  AlertTriangle, CheckCircle2, Crosshair, FileWarning, Loader2, Trash2,
} from 'lucide-react';
import {
  fetchRuleSets, fetchRules, fetchCheckRuns, fetchCheckResults,
  createCheckRun, subscribeCheckRun, deleteRuleSet,
  type RuleSet, type Rule, type CheckRun, type CheckResult,
} from '../../lib/api/ruleCheck';
import { RuleFormModal } from './RuleFormModal';
import type { DocumentItem } from '../../types';

interface RuleCheckPanelProps {
  projectId?: string;
  documents: DocumentItem[];
  currentUserName?: string;
  getModelCategories?: () => { modelId: string; modelName: string; categories: string[] }[];
  onFocusViolation: (v: CheckResult) => void;
  onCreateBcf: (v: CheckResult, ruleName: string) => Promise<void> | void;
}

const SEVERITY_STYLE: Record<string, string> = {
  critical: 'bg-error text-on-error',
  high: 'bg-error/15 text-error',
  medium: 'bg-warning/15 text-warning',
  low: 'bg-surface-container text-on-surface-variant',
};
const SEVERITY_LABEL: Record<string, string> = {
  critical: 'Nghiêm trọng', high: 'Cao', medium: 'TB', low: 'Thấp',
};

const RUN_STATUS_LABEL: Record<string, string> = {
  pending: 'Chờ xử lý', processing: 'Đang chạy', done: 'Hoàn thành', error: 'Lỗi',
};

export function RuleCheckPanel({
  projectId, documents, currentUserName, getModelCategories, onFocusViolation, onCreateBcf,
}: RuleCheckPanelProps) {
  const [ruleSets, setRuleSets] = useState<RuleSet[]>([]);
  const [selectedSetId, setSelectedSetId] = useState('');
  const [rules, setRules] = useState<Rule[]>([]);
  const [rulesExpanded, setRulesExpanded] = useState(false);

  const [selectedDocCodes, setSelectedDocCodes] = useState<Set<string>>(new Set());
  const [runs, setRuns] = useState<CheckRun[]>([]);
  const [activeRun, setActiveRun] = useState<CheckRun | null>(null);
  const [results, setResults] = useState<CheckResult[] | null>(null);
  const [resultsRunId, setResultsRunId] = useState('');
  const [loadingResults, setLoadingResults] = useState(false);
  const [starting, setStarting] = useState(false);
  const [formOpen, setFormOpen] = useState(false);
  const unsubRef = useRef<(() => void) | null>(null);

  // Mô hình IFC có tệp trên storage — điều kiện để worker xử lý được
  const ifcDocs = documents.filter(d => d.fileType === 'ifc' && !!d.fileUrl);

  const selectedSet = ruleSets.find(s => s.id === selectedSetId);

  const loadRuleSets = useCallback(async () => {
    if (!projectId) return;
    const sets = await fetchRuleSets(projectId);
    setRuleSets(sets);
    if (sets.length && !sets.some(s => s.id === selectedSetId)) {
      setSelectedSetId(sets[0].id);
    }
  }, [projectId, selectedSetId]);

  useEffect(() => { loadRuleSets(); }, [projectId]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (!selectedSetId) { setRules([]); return; }
    fetchRules(selectedSetId).then(setRules);
  }, [selectedSetId]);

  useEffect(() => {
    if (!projectId) return;
    fetchCheckRuns(projectId).then(setRuns);
    return () => { unsubRef.current?.(); };
  }, [projectId]);

  const toggleDoc = (code: string) => {
    setSelectedDocCodes(prev => {
      const n = new Set(prev);
      n.has(code) ? n.delete(code) : n.add(code);
      return n;
    });
  };

  const watchRun = useCallback((runId: string) => {
    unsubRef.current?.();
    unsubRef.current = subscribeCheckRun(runId, (run) => {
      setActiveRun(run);
      setRuns(prev => prev.map(r => r.id === run.id ? run : r));
      if (run.status === 'done') {
        unsubRef.current?.();
        loadResults(run.id);
      } else if (run.status === 'error') {
        unsubRef.current?.();
      }
    });
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const handleRun = async () => {
    if (!projectId || !selectedSetId) return;
    if (selectedDocCodes.size === 0) { alert('Chọn ít nhất 1 mô hình IFC để kiểm tra.'); return; }
    setStarting(true);
    try {
      const run = await createCheckRun(projectId, selectedSetId, Array.from(selectedDocCodes), currentUserName);
      if (!run) { alert('Không tạo được lượt kiểm tra.'); return; }
      setRuns(prev => [run, ...prev]);
      setActiveRun(run);
      setResults(null);
      setResultsRunId('');
      watchRun(run.id);
    } finally {
      setStarting(false);
    }
  };

  const loadResults = async (runId: string) => {
    setLoadingResults(true);
    setResultsRunId(runId);
    try {
      setResults(await fetchCheckResults(runId));
    } finally {
      setLoadingResults(false);
    }
  };

  const handleSelectRun = (run: CheckRun) => {
    setActiveRun(run);
    if (run.status === 'done') loadResults(run.id);
    else if (run.status === 'pending' || run.status === 'processing') watchRun(run.id);
  };

  const handleDeleteCustomSet = async (set: RuleSet) => {
    if (set.isPreset) return;
    if (!confirm(`Xóa bộ quy tắc "${set.name}"?`)) return;
    await deleteRuleSet(set.id);
    await loadRuleSets();
  };

  // Nhóm kết quả theo rule
  const resultsByRule: { rule?: Rule; items: CheckResult[] }[] = [];
  if (results) {
    const map = new Map<string, CheckResult[]>();
    for (const r of results) {
      const k = r.ruleId ?? '?';
      (map.get(k) ?? map.set(k, []).get(k)!).push(r);
    }
    for (const [ruleId, items] of map) {
      resultsByRule.push({ rule: rules.find(r => r.id === ruleId), items });
    }
  }

  const fmtTime = (iso?: string) => iso ? new Date(iso).toLocaleString('vi-VN', { hour: '2-digit', minute: '2-digit', day: '2-digit', month: '2-digit' }) : '';

  return (
    <div className="flex-1 flex flex-col min-h-0">
      <div className="p-4 border-b border-outline-variant bg-surface-container-low/20 shrink-0">
        <div className="flex items-center gap-2">
          <ShieldCheck size={16} className="text-primary" />
          <h2 className="font-semibold text-[14px] text-on-surface">Kiểm tra mô hình theo quy tắc</h2>
        </div>
        <p className="text-[11px] text-on-surface-variant mt-0.5">
          Chạy trên máy chủ (IfcOpenShell) — chính xác mức hình học thật.
        </p>
      </div>

      <div className="flex-1 overflow-y-auto custom-scrollbar p-4 space-y-4">
        {/* 1. Bộ quy tắc */}
        <div>
          <div className="flex items-center justify-between mb-1.5">
            <label className="text-[10px] font-bold text-outline uppercase tracking-wider">Bộ quy tắc</label>
            <button
              onClick={() => setFormOpen(true)}
              className="flex items-center gap-1 text-[11px] font-bold text-primary hover:underline"
              title="Tạo quy tắc riêng cho dự án"
            >
              <Plus size={12} /> Quy tắc riêng
            </button>
          </div>
          <select
            value={selectedSetId}
            onChange={e => setSelectedSetId(e.target.value)}
            className="w-full text-[12px] bg-surface border border-outline-variant/60 rounded-lg px-2.5 py-2 text-on-surface focus:border-primary focus:ring-1 focus:ring-primary outline-none"
          >
            {ruleSets.map(s => (
              <option key={s.id} value={s.id}>{s.isPreset ? '📋 ' : '⚙️ '}{s.name}</option>
            ))}
          </select>
          {selectedSet && (
            <div className="mt-1.5">
              {selectedSet.standardRef && (
                <div className="text-[10.5px] font-bold text-primary">{selectedSet.standardRef}</div>
              )}
              <p className="text-[10.5px] text-on-surface-variant leading-snug">{selectedSet.description}</p>
              {selectedSet.isPreset && (
                <p className="text-[10px] text-warning mt-0.5 flex items-start gap-1">
                  <AlertTriangle size={10} className="mt-0.5 shrink-0" />
                  Giá trị ngưỡng mang tính tham khảo — cần kiểm chứng theo văn bản gốc.
                </p>
              )}
              {!selectedSet.isPreset && (
                <button
                  onClick={() => handleDeleteCustomSet(selectedSet)}
                  className="text-[10px] text-error hover:underline flex items-center gap-1 mt-0.5"
                >
                  <Trash2 size={10} /> Xóa bộ quy tắc này
                </button>
              )}
            </div>
          )}
          {/* Danh sách rules trong bộ */}
          <button
            onClick={() => setRulesExpanded(!rulesExpanded)}
            className="mt-1.5 flex items-center gap-1 text-[11px] text-on-surface-variant hover:text-on-surface"
          >
            {rulesExpanded ? <ChevronDown size={12} /> : <ChevronRight size={12} />}
            {rules.length} quy tắc trong bộ
          </button>
          {rulesExpanded && (
            <div className="mt-1 space-y-1">
              {rules.map(r => (
                <div key={r.id} className="flex items-center gap-2 text-[11px] p-1.5 bg-surface rounded border border-outline-variant/30">
                  <span className={`px-1.5 py-0.5 rounded text-[9px] font-bold shrink-0 ${SEVERITY_STYLE[r.severity]}`}>
                    {SEVERITY_LABEL[r.severity]}
                  </span>
                  <span className="text-on-surface leading-tight">{r.name}</span>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* 2. Mô hình cần kiểm */}
        <div>
          <label className="text-[10px] font-bold text-outline uppercase tracking-wider">Mô hình IFC ({ifcDocs.length})</label>
          {ifcDocs.length === 0 ? (
            <p className="text-[11px] text-on-surface-variant mt-1">Dự án chưa có tài liệu IFC nào có tệp trên hệ thống.</p>
          ) : (
            <div className="mt-1.5 space-y-1 max-h-40 overflow-y-auto custom-scrollbar">
              {ifcDocs.map(d => (
                <label key={d.id} className="flex items-center gap-2 text-[11px] p-1.5 bg-surface rounded border border-outline-variant/30 cursor-pointer hover:border-primary/40">
                  <input
                    type="checkbox"
                    checked={selectedDocCodes.has(d.id)}
                    onChange={() => toggleDoc(d.id)}
                    className="w-3.5 h-3.5 accent-[var(--md-sys-color-primary,#2563eb)]"
                  />
                  <span className="font-mono text-on-surface truncate" title={d.id}>{d.id}</span>
                </label>
              ))}
            </div>
          )}
        </div>

        {/* 3. Nút chạy */}
        <button
          onClick={handleRun}
          disabled={starting || !selectedSetId || selectedDocCodes.size === 0}
          className="w-full flex items-center justify-center gap-2 bg-primary text-on-primary py-2.5 rounded-xl font-bold text-[12.5px] hover:bg-primary/95 disabled:opacity-40 disabled:cursor-not-allowed"
        >
          {starting ? <Loader2 size={14} className="animate-spin" /> : <Play size={14} />}
          Chạy kiểm tra
        </button>

        {/* 4. Run đang theo dõi */}
        {activeRun && (activeRun.status === 'pending' || activeRun.status === 'processing') && (
          <div className="p-3 bg-primary/5 border border-primary/20 rounded-lg">
            <div className="flex items-center gap-2 text-[11.5px] font-bold text-primary">
              <RefreshCw size={12} className="animate-spin" />
              {RUN_STATUS_LABEL[activeRun.status]}... {activeRun.progress}%
            </div>
            <div className="mt-1.5 h-1.5 bg-surface-container rounded-full overflow-hidden">
              <div className="h-full bg-primary rounded-full transition-all duration-500" style={{ width: `${activeRun.progress}%` }} />
            </div>
            <p className="text-[10px] text-on-surface-variant mt-1">
              Worker đang xử lý trên máy chủ — bạn có thể tiếp tục làm việc khác.
            </p>
          </div>
        )}
        {activeRun?.status === 'error' && (
          <div className="p-3 bg-error/5 border border-error/20 rounded-lg text-[11px] text-error">
            <b>Lỗi:</b> {activeRun.errorMessage}
          </div>
        )}

        {/* 5. Lịch sử run */}
        {runs.length > 0 && (
          <div>
            <label className="text-[10px] font-bold text-outline uppercase tracking-wider">Lịch sử kiểm tra</label>
            <div className="mt-1.5 space-y-1 max-h-36 overflow-y-auto custom-scrollbar">
              {runs.slice(0, 10).map(r => (
                <button
                  key={r.id}
                  onClick={() => handleSelectRun(r)}
                  className={`w-full flex items-center gap-2 text-[11px] p-2 rounded border text-left ${
                    resultsRunId === r.id || activeRun?.id === r.id
                      ? 'border-primary bg-primary/5' : 'border-outline-variant/30 bg-surface hover:border-primary/40'
                  }`}
                >
                  {r.status === 'done'
                    ? (r.summary?.violations ? <FileWarning size={12} className="text-error shrink-0" /> : <CheckCircle2 size={12} className="text-success shrink-0" />)
                    : r.status === 'error'
                      ? <AlertTriangle size={12} className="text-error shrink-0" />
                      : <RefreshCw size={12} className="text-primary animate-spin shrink-0" />}
                  <span className="flex-1 min-w-0">
                    <span className="block text-on-surface truncate">{fmtTime(r.createdAt)} · {r.documentCodes.length} mô hình</span>
                    <span className="block text-on-surface-variant text-[10px]">
                      {RUN_STATUS_LABEL[r.status]}
                      {r.status === 'done' && r.summary && ` · ${r.summary.violations ?? 0} vi phạm`}
                    </span>
                  </span>
                </button>
              ))}
            </div>
          </div>
        )}

        {/* 6. Kết quả */}
        {loadingResults && (
          <div className="flex items-center gap-2 text-[11px] text-on-surface-variant">
            <Loader2 size={12} className="animate-spin" /> Đang tải kết quả...
          </div>
        )}
        {results && !loadingResults && (
          <div>
            <label className="text-[10px] font-bold text-outline uppercase tracking-wider">
              Kết quả — {results.length} vi phạm
            </label>
            {results.length === 0 && (
              <div className="mt-1.5 p-3 bg-success/5 border border-success/20 rounded-lg text-[11.5px] text-success flex items-center gap-2">
                <CheckCircle2 size={14} /> Không phát hiện vi phạm nào.
              </div>
            )}
            <div className="mt-1.5 space-y-2">
              {resultsByRule.map(({ rule, items }) => (
                <ViolationGroup
                  key={rule?.id ?? 'unknown'}
                  rule={rule}
                  items={items}
                  onFocus={onFocusViolation}
                  onCreateBcf={onCreateBcf}
                />
              ))}
            </div>
          </div>
        )}
      </div>

      {formOpen && projectId && (
        <RuleFormModal
          projectId={projectId}
          getModelCategories={getModelCategories}
          onClose={() => setFormOpen(false)}
          onSaved={async (newSetId) => {
            setFormOpen(false);
            await loadRuleSets();
            setSelectedSetId(newSetId);
          }}
        />
      )}
    </div>
  );
}

interface ViolationGroupProps {
  rule?: Rule;
  items: CheckResult[];
  onFocus: (v: CheckResult) => void;
  onCreateBcf: (v: CheckResult, ruleName: string) => Promise<void> | void;
}

const ViolationGroup: React.FC<ViolationGroupProps> = ({ rule, items, onFocus, onCreateBcf }) => {
  const [open, setOpen] = useState(true);
  const [bcfBusy, setBcfBusy] = useState<string | null>(null);
  const ruleName = rule?.name ?? 'Quy tắc không xác định';

  return (
    <div className="border border-outline-variant/40 rounded-lg overflow-hidden">
      <button
        onClick={() => setOpen(!open)}
        className="w-full flex items-center gap-2 p-2 bg-surface-container-low text-left"
      >
        {open ? <ChevronDown size={12} className="shrink-0 text-on-surface-variant" /> : <ChevronRight size={12} className="shrink-0 text-on-surface-variant" />}
        <span className="flex-1 text-[11px] font-bold text-on-surface leading-tight">{ruleName}</span>
        <span className="shrink-0 text-[10px] font-bold px-1.5 py-0.5 rounded-full bg-error/10 text-error">{items.length}</span>
      </button>
      {open && (
        <div className="divide-y divide-outline-variant/20">
          {items.slice(0, 100).map(v => (
            <div key={v.id} className="p-2 bg-surface text-[10.5px]">
              <div className="text-on-surface leading-snug">
                <span className="font-semibold">{v.elementA.name || v.elementA.category}</span>
                {v.elementB && <> ↔ <span className="font-semibold">{v.elementB.name || v.elementB.category}</span></>}
              </div>
              <div className="text-on-surface-variant mt-0.5">
                {v.details?.rule_type === 'clearance'
                  ? `Khoảng cách: ${v.measuredValue}m`
                  : `Độ xuyên: ${v.measuredValue}m`}
                {' · '}{v.elementA.docCode}{v.elementB && v.elementB.docCode !== v.elementA.docCode ? ` / ${v.elementB.docCode}` : ''}
              </div>
              <div className="flex gap-1.5 mt-1">
                <button
                  onClick={() => onFocus(v)}
                  className="flex items-center gap-1 px-2 py-1 rounded bg-primary/10 text-primary font-bold text-[10px] hover:bg-primary/20"
                >
                  <Crosshair size={10} /> Xem trên mô hình
                </button>
                <button
                  disabled={bcfBusy === v.id}
                  onClick={async () => {
                    setBcfBusy(v.id);
                    try { await onCreateBcf(v, ruleName); } finally { setBcfBusy(null); }
                  }}
                  className="flex items-center gap-1 px-2 py-1 rounded bg-surface-container text-on-surface-variant font-bold text-[10px] hover:text-on-surface disabled:opacity-50"
                >
                  {bcfBusy === v.id ? <Loader2 size={10} className="animate-spin" /> : <Plus size={10} />} Tạo BCF
                </button>
              </div>
            </div>
          ))}
          {items.length > 100 && (
            <div className="p-2 text-[10px] text-on-surface-variant">... và {items.length - 100} vi phạm khác</div>
          )}
        </div>
      )}
    </div>
  );
};
