import { supabase } from '../supabase';
import type { ClashItem, ActivityItem, ApprovalItem } from '../../types';

// ---------------- Clashes ----------------
function mapClash(row: any): ClashItem {
  return {
    id: row.code,
    elements: row.elements ?? '',
    discipline: row.discipline ?? '',
    severity: row.severity ?? 'Trung bình',
    status: row.status ?? 'Chưa xử lý',
    description: row.description ?? '',
  };
}

export async function fetchClashes(projectId: string): Promise<ClashItem[]> {
  const { data, error } = await supabase.from('clashes').select('*').eq('project_id', projectId);
  if (error) throw error;
  return (data ?? []).map(mapClash);
}

export async function updateClashStatus(projectId: string, code: string, status: string): Promise<void> {
  const { error } = await supabase.from('clashes').update({ status }).eq('project_id', projectId).eq('code', code);
  if (error) console.error('updateClashStatus error:', error.message);
}

// ---------------- Approvals ----------------
function mapApproval(row: any): ApprovalItem {
  return {
    id: row.code,
    type: row.type ?? '',
    deadline: row.deadline ?? '',
    requester: row.requester ?? '',
    description: row.description ?? '',
    file: row.file ?? '',
    createdDate: row.created_date ?? '',
    documentId: row.document_code ?? undefined,
  };
}

export async function fetchApprovals(projectId: string): Promise<ApprovalItem[]> {
  const { data, error } = await supabase.from('approvals').select('*').eq('project_id', projectId)
    .order('created_at', { ascending: false });
  if (error) throw error;
  return (data ?? []).map(mapApproval);
}

export async function createApproval(projectId: string, a: ApprovalItem): Promise<void> {
  const { error } = await supabase.from('approvals').insert({
    project_id: projectId,
    code: a.id,
    type: a.type,
    deadline: a.deadline,
    requester: a.requester,
    description: a.description,
    file: a.file,
    document_code: a.documentId ?? null,
    created_date: a.createdDate || new Date().toISOString().split('T')[0],
  });
  if (error) console.error('createApproval error:', error.message);
}

export async function deleteApproval(projectId: string, code: string): Promise<void> {
  const { error } = await supabase.from('approvals').delete().eq('project_id', projectId).eq('code', code);
  if (error) console.error('deleteApproval error:', error.message);
}

// ---------------- Activities ----------------
function timeLabel(iso: string): string {
  const d = new Date(iso);
  if (isNaN(d.getTime())) return iso;
  return d.toLocaleString('vi-VN', { hour: '2-digit', minute: '2-digit', day: '2-digit', month: '2-digit' });
}

function mapActivity(row: any): ActivityItem {
  return {
    id: row.id,
    user: row.user_name ?? 'Hệ thống',
    action: row.action ?? '',
    target: row.target ?? '',
    time: timeLabel(row.created_at),
    type: row.activity_type ?? 'system',
  };
}

export async function fetchActivities(projectId: string): Promise<ActivityItem[]> {
  const { data, error } = await supabase.from('activities').select('*').eq('project_id', projectId)
    .order('created_at', { ascending: false }).limit(50);
  if (error) throw error;
  return (data ?? []).map(mapActivity);
}

// ---------------- BCF topics (Vấn đề / Issue) ----------------
export interface BcfTopicRow {
  id: string;
  title: string;
  description: string;
  status: string;
  priority: string;
  topicType: string;
  assignedTo: string;
  author?: string;
  dueDate?: string;
  labels?: string[];
  linkedElementGuid?: string;
  linkedElementExpressId?: number;
  camera?: { position: number[]; target: number[] };
  hiddenModels?: string[];
  screenshot?: string;
  createdDate: string;
}

export async function fetchBcfTopics(projectId: string): Promise<BcfTopicRow[]> {
  const { data, error } = await supabase.from('bcf_topics').select('*').eq('project_id', projectId)
    .order('created_at', { ascending: true });
  if (error) throw error;
  return (data ?? []).map((r: any) => ({
    id: r.id,
    title: r.title,
    description: r.description ?? '',
    status: r.status ?? 'Open',
    priority: r.priority ?? 'Medium',
    topicType: r.topic_type ?? 'Clash',
    assignedTo: r.assigned_to ?? '',
    author: r.author ?? undefined,
    dueDate: r.due_date ?? undefined,
    labels: r.labels ?? undefined,
    linkedElementGuid: r.linked_element_guid ?? undefined,
    linkedElementExpressId: r.linked_element_express_id ?? undefined,
    camera: r.camera ?? undefined,
    hiddenModels: r.hidden_models ?? undefined,
    screenshot: r.screenshot ?? undefined,
    createdDate: (r.created_at ?? '').split('T')[0],
  }));
}

export async function createBcfTopic(projectId: string, t: {
  title: string; description: string; status: string; priority: string; topicType?: string; assignedTo: string;
  author?: string; dueDate?: string; labels?: string[];
  linkedElementGuid?: string; linkedElementExpressId?: number;
  camera?: { position: number[]; target: number[] }; hiddenModels?: string[]; screenshot?: string;
}): Promise<string | null> {
  const { data, error } = await supabase.from('bcf_topics').insert({
    project_id: projectId,
    title: t.title,
    description: t.description,
    status: t.status,
    priority: t.priority,
    topic_type: t.topicType ?? 'Clash',
    assigned_to: t.assignedTo,
    author: t.author ?? null,
    due_date: t.dueDate ?? null,
    labels: t.labels ?? null,
    linked_element_guid: t.linkedElementGuid ?? null,
    linked_element_express_id: t.linkedElementExpressId ?? null,
    camera: t.camera ?? null,
    hidden_models: t.hiddenModels ?? null,
    screenshot: t.screenshot ?? null,
  }).select('id').single();
  if (error) { console.error('createBcfTopic error:', error.message); return null; }
  return data.id;
}

export async function updateBcfStatus(id: string, status: string): Promise<void> {
  const { error } = await supabase.from('bcf_topics').update({ status }).eq('id', id);
  if (error) console.error('updateBcfStatus error:', error.message);
}

// Cập nhật nhiều trường của vấn đề (trạng thái/ưu tiên/giao việc/hạn/nhãn...)
export async function updateBcfTopic(id: string, patch: {
  status?: string; priority?: string; assignedTo?: string; dueDate?: string | null;
  labels?: string[]; title?: string; description?: string; topicType?: string;
}): Promise<void> {
  const dbPatch: Record<string, any> = {};
  if (patch.status !== undefined) dbPatch.status = patch.status;
  if (patch.priority !== undefined) dbPatch.priority = patch.priority;
  if (patch.assignedTo !== undefined) dbPatch.assigned_to = patch.assignedTo;
  if (patch.dueDate !== undefined) dbPatch.due_date = patch.dueDate;
  if (patch.labels !== undefined) dbPatch.labels = patch.labels;
  if (patch.title !== undefined) dbPatch.title = patch.title;
  if (patch.description !== undefined) dbPatch.description = patch.description;
  if (patch.topicType !== undefined) dbPatch.topic_type = patch.topicType;
  if (Object.keys(dbPatch).length === 0) return;
  const { error } = await supabase.from('bcf_topics').update(dbPatch).eq('id', id);
  if (error) console.error('updateBcfTopic error:', error.message);
}

export async function deleteBcfTopic(id: string): Promise<void> {
  const { error } = await supabase.from('bcf_topics').delete().eq('id', id);
  if (error) console.error('deleteBcfTopic error:', error.message);
}

// ---------------- BCF comments (trao đổi/nhật ký vấn đề) ----------------
export interface BcfComment {
  id: string;
  topicId: string;
  author: string;
  body: string;
  commentType: 'comment' | 'status' | 'assign' | 'priority' | 'system';
  createdAt: string;
}

const mapComment = (r: any): BcfComment => ({
  id: r.id, topicId: r.topic_id, author: r.author ?? '', body: r.body ?? '',
  commentType: (r.comment_type ?? 'comment'), createdAt: r.created_at,
});

export async function fetchBcfComments(topicId: string): Promise<BcfComment[]> {
  const { data, error } = await supabase.from('bcf_comments').select('*')
    .eq('topic_id', topicId).order('created_at', { ascending: true });
  if (error) { console.error('fetchBcfComments error:', error.message); return []; }
  return (data ?? []).map(mapComment);
}

export async function addBcfComment(
  topicId: string, projectId: string, author: string, body: string,
  commentType: BcfComment['commentType'] = 'comment'
): Promise<BcfComment | null> {
  const { data, error } = await supabase.from('bcf_comments').insert({
    topic_id: topicId, project_id: projectId, author, body, comment_type: commentType,
  }).select().single();
  if (error) { console.error('addBcfComment error:', error.message); return null; }
  return mapComment(data);
}

// Đếm số bình luận cho nhiều vấn đề (badge trên danh sách)
export async function countBcfComments(projectId: string): Promise<Record<string, number>> {
  const { data, error } = await supabase.from('bcf_comments').select('topic_id').eq('project_id', projectId);
  if (error) { console.error('countBcfComments error:', error.message); return {}; }
  const counts: Record<string, number> = {};
  for (const r of (data ?? [])) counts[(r as any).topic_id] = (counts[(r as any).topic_id] ?? 0) + 1;
  return counts;
}

// ---------------- Assets (FM) ----------------
export interface MaintenanceTicketRow {
  id: string;
  code: string;
  type: string;
  title: string;
  status: string;
  date: string;
  technician?: string;
}
export interface AssetRow {
  id: string; code: string; name: string; space: string; type: string;
  manufacturer: string; model: string; capacity: string; installDate: string;
  warrantyUntil: string; maintenanceCycle: string; status: string;
  tickets: MaintenanceTicketRow[];
}

export async function fetchAssets(projectId: string): Promise<AssetRow[]> {
  const { data: assets, error } = await supabase.from('assets').select('*').eq('project_id', projectId)
    .order('created_at', { ascending: true });
  if (error) throw error;
  const ids = (assets ?? []).map((a: any) => a.id);
  let ticketsByAsset: Record<string, MaintenanceTicketRow[]> = {};
  if (ids.length) {
    const { data: tickets } = await supabase.from('maintenance_tickets').select('*').in('asset_id', ids)
      .order('created_at', { ascending: false });
    for (const t of tickets ?? []) {
      (ticketsByAsset[t.asset_id] ??= []).push({
        id: t.id, code: t.code, type: t.ticket_type, title: t.title,
        status: t.status, date: t.ticket_date, technician: t.technician ?? undefined,
      });
    }
  }
  return (assets ?? []).map((a: any) => ({
    id: a.id, code: a.code, name: a.name, space: a.space ?? '', type: a.type ?? '',
    manufacturer: a.manufacturer ?? '', model: a.model ?? '', capacity: a.capacity ?? '',
    installDate: a.install_date ?? '', warrantyUntil: a.warranty_until ?? '',
    maintenanceCycle: a.maintenance_cycle ?? '', status: a.status ?? 'Hoạt động',
    tickets: ticketsByAsset[a.id] ?? [],
  }));
}

export async function createTicket(assetId: string, t: {
  code: string; type: string; title: string; status: string; date: string;
}): Promise<void> {
  const { error } = await supabase.from('maintenance_tickets').insert({
    asset_id: assetId, code: t.code, ticket_type: t.type, title: t.title,
    status: t.status, ticket_date: t.date,
  });
  if (error) console.error('createTicket error:', error.message);
}

export async function updateTicketStatus(ticketId: string, status: string): Promise<void> {
  const { error } = await supabase.from('maintenance_tickets').update({ status }).eq('id', ticketId);
  if (error) console.error('updateTicketStatus error:', error.message);
}

// ---------------- Viewpoints (góc nhìn) ----------------
export interface Viewpoint {
  id: string;
  name: string;
  camera: { position: number[]; target: number[] };
  hiddenModels: string[];
  recentered: boolean;
  screenshot?: string;
  createdByName?: string;
  createdAt: string;
}

export async function fetchViewpoints(projectId: string): Promise<Viewpoint[]> {
  const { data, error } = await supabase.from('viewpoints').select('*').eq('project_id', projectId)
    .order('created_at', { ascending: false });
  if (error) throw error;
  return (data ?? []).map((r: any) => ({
    id: r.id,
    name: r.name,
    camera: r.camera,
    hiddenModels: r.hidden_models ?? [],
    recentered: r.recentered ?? false,
    screenshot: r.screenshot ?? undefined,
    createdByName: r.created_by_name ?? undefined,
    createdAt: r.created_at,
  }));
}

export async function createViewpoint(projectId: string, vp: {
  name: string; camera: { position: number[]; target: number[] };
  hiddenModels: string[]; recentered: boolean; screenshot?: string; createdByName?: string;
}): Promise<Viewpoint | null> {
  const { data, error } = await supabase.from('viewpoints').insert({
    project_id: projectId,
    name: vp.name,
    camera: vp.camera,
    hidden_models: vp.hiddenModels,
    recentered: vp.recentered,
    screenshot: vp.screenshot ?? null,
    created_by_name: vp.createdByName ?? null,
  }).select().single();
  if (error) { console.error('createViewpoint error:', error.message); return null; }
  return {
    id: data.id, name: data.name, camera: data.camera,
    hiddenModels: data.hidden_models ?? [], recentered: data.recentered ?? false,
    screenshot: data.screenshot ?? undefined, createdByName: data.created_by_name ?? undefined,
    createdAt: data.created_at,
  };
}

export async function deleteViewpoint(id: string): Promise<void> {
  const { error } = await supabase.from('viewpoints').delete().eq('id', id);
  if (error) console.error('deleteViewpoint error:', error.message);
}

export async function logActivity(
  projectId: string,
  user: string,
  action: string,
  target: string,
  type: ActivityItem['type'] = 'system'
): Promise<void> {
  const { error } = await supabase.from('activities').insert({
    project_id: projectId,
    user_name: user,
    action,
    target,
    activity_type: type,
  });
  if (error) console.error('logActivity error:', error.message);
}
