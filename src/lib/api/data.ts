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

// ---------------- BCF topics ----------------
export interface BcfTopicRow {
  id: string;
  title: string;
  description: string;
  status: string;
  priority: string;
  assignedTo: string;
  linkedElementGuid?: string;
  linkedElementExpressId?: number;
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
    assignedTo: r.assigned_to ?? '',
    linkedElementGuid: r.linked_element_guid ?? undefined,
    linkedElementExpressId: r.linked_element_express_id ?? undefined,
    createdDate: (r.created_at ?? '').split('T')[0],
  }));
}

export async function createBcfTopic(projectId: string, t: {
  title: string; description: string; status: string; priority: string; assignedTo: string;
  linkedElementGuid?: string; linkedElementExpressId?: number;
}): Promise<string | null> {
  const { data, error } = await supabase.from('bcf_topics').insert({
    project_id: projectId,
    title: t.title,
    description: t.description,
    status: t.status,
    priority: t.priority,
    assigned_to: t.assignedTo,
    linked_element_guid: t.linkedElementGuid ?? null,
    linked_element_express_id: t.linkedElementExpressId ?? null,
  }).select('id').single();
  if (error) { console.error('createBcfTopic error:', error.message); return null; }
  return data.id;
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
