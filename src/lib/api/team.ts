import { supabase } from '../supabase';

export interface ProjectOrg {
  id: string; name: string; role?: string; discipline?: string; contactPerson?: string; contactEmail?: string;
}
export interface TeamMember {
  id: string; name: string; email?: string; role: string; organization?: string; discipline?: string;
}

const mapOrg = (r: any): ProjectOrg => ({
  id: r.id, name: r.name, role: r.role ?? undefined, discipline: r.discipline ?? undefined,
  contactPerson: r.contact_person ?? undefined, contactEmail: r.contact_email ?? undefined,
});
const mapMember = (r: any): TeamMember => ({
  id: r.id, name: r.name, email: r.email ?? undefined, role: r.role ?? 'Author',
  organization: r.organization ?? undefined, discipline: r.discipline ?? undefined,
});

export async function fetchOrgs(projectId: string): Promise<ProjectOrg[]> {
  const { data, error } = await supabase.from('project_organizations').select('*').eq('project_id', projectId).order('created_at');
  if (error) throw error;
  return (data ?? []).map(mapOrg);
}
export async function addOrg(projectId: string, o: Omit<ProjectOrg, 'id'>): Promise<ProjectOrg | null> {
  const { data, error } = await supabase.from('project_organizations').insert({
    project_id: projectId, name: o.name, role: o.role, discipline: o.discipline,
    contact_person: o.contactPerson, contact_email: o.contactEmail,
  }).select().single();
  if (error) { console.error('addOrg error:', error.message); return null; }
  return mapOrg(data);
}
export async function deleteOrg(id: string): Promise<void> {
  const { error } = await supabase.from('project_organizations').delete().eq('id', id);
  if (error) console.error('deleteOrg error:', error.message);
}

export async function fetchMembers(projectId: string): Promise<TeamMember[]> {
  const { data, error } = await supabase.from('project_team').select('*').eq('project_id', projectId).order('created_at');
  if (error) throw error;
  return (data ?? []).map(mapMember);
}
export async function addMember(projectId: string, m: Omit<TeamMember, 'id'>): Promise<TeamMember | null> {
  const { data, error } = await supabase.from('project_team').insert({
    project_id: projectId, name: m.name, email: m.email, role: m.role,
    organization: m.organization, discipline: m.discipline,
  }).select().single();
  if (error) { console.error('addMember error:', error.message); return null; }
  return mapMember(data);
}
export async function deleteMember(id: string): Promise<void> {
  const { error } = await supabase.from('project_team').delete().eq('id', id);
  if (error) console.error('deleteMember error:', error.message);
}

// ============================================================
// Phân quyền tài khoản (project_members ↔ profiles) — nguồn quyền per-project.
// Khác với project_team (danh bạ tự do): đây là tài khoản thật + vai trò RBAC.
// ============================================================
export interface AccountMember {
  userId: string; fullName: string; email?: string; role: string;
}
export interface AppProfile {
  id: string; fullName: string; email?: string; role: string;
}

/** Danh sách tài khoản đã được gán quyền trong dự án (ghép project_members + profiles). */
export async function fetchAccountMembers(projectId: string): Promise<AccountMember[]> {
  const { data: pm, error } = await supabase
    .from('project_members').select('user_id, role').eq('project_id', projectId);
  if (error) throw error;
  const rows = pm ?? [];
  if (rows.length === 0) return [];
  const ids = rows.map((r: any) => r.user_id);
  const { data: profs } = await supabase.from('profiles').select('id, full_name, email').in('id', ids);
  const byId = new Map((profs ?? []).map((p: any) => [p.id, p]));
  return rows.map((r: any) => ({
    userId: r.user_id,
    role: r.role ?? 'Viewer',
    fullName: byId.get(r.user_id)?.full_name ?? '(không rõ)',
    email: byId.get(r.user_id)?.email ?? undefined,
  }));
}

/** Toàn bộ tài khoản trong hệ thống — để admin chọn người thêm vào dự án. */
export async function fetchAllProfiles(): Promise<AppProfile[]> {
  const { data, error } = await supabase.from('profiles').select('id, full_name, email, role').order('full_name');
  if (error) throw error;
  return (data ?? []).map((p: any) => ({ id: p.id, fullName: p.full_name ?? '', email: p.email ?? undefined, role: p.role ?? 'Architect' }));
}

/** Thêm/cập nhật vai trò một tài khoản trong dự án (admin/Manager mới được — RLS chặn). */
export async function upsertAccountMember(projectId: string, userId: string, role: string): Promise<void> {
  const { error } = await supabase
    .from('project_members')
    .upsert({ project_id: projectId, user_id: userId, role }, { onConflict: 'project_id,user_id' });
  if (error) throw error;
}

/** Gỡ một tài khoản khỏi dự án. */
export async function removeAccountMember(projectId: string, userId: string): Promise<void> {
  const { error } = await supabase.from('project_members').delete().eq('project_id', projectId).eq('user_id', userId);
  if (error) throw error;
}
