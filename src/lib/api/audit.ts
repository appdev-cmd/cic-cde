import { supabase } from '../supabase';

// Nhật ký kiểm toán bất biến (append-only). Ghi tự động qua trigger DB;
// lớp này chỉ đọc để hiển thị phục vụ thanh tra.
export interface AuditEntry {
  id: string;
  projectId?: string;
  actorName?: string;
  action: string;
  entity?: string;
  entityId?: string;
  detail?: Record<string, any>;
  hashAfter?: string;
  at: string;
}

const ACTION_LABEL: Record<string, string> = {
  document_created: 'Tạo tài liệu',
  document_status_changed: 'Đổi trạng thái tài liệu',
};
export const auditActionLabel = (a: string) => ACTION_LABEL[a] ?? a;

export async function fetchAuditLog(projectId: string, limit = 100): Promise<AuditEntry[]> {
  const { data, error } = await supabase
    .from('audit_log')
    .select('*')
    .eq('project_id', projectId)
    .order('at', { ascending: false })
    .limit(limit);
  if (error) throw error;
  return (data ?? []).map((r: any) => ({
    id: r.id,
    projectId: r.project_id ?? undefined,
    actorName: r.actor_name ?? undefined,
    action: r.action,
    entity: r.entity ?? undefined,
    entityId: r.entity_id ?? undefined,
    detail: r.detail ?? undefined,
    hashAfter: r.hash_after ?? undefined,
    at: r.at,
  }));
}
