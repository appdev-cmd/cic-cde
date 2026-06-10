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
