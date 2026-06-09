import { supabase } from '../supabase';
import type { ProjectItem } from '../../components/project/ProjectList';

// Map hàng DB (snake_case) -> kiểu app (camelCase)
function mapProject(row: any): ProjectItem {
  return {
    id: row.id,
    name: row.name,
    location: row.location ?? '',
    status: row.status ?? 'Chuẩn bị',
    documentsCount: row.documents_count ?? 0,
    approvalPercent: row.approval_percent ?? 0,
    spendingActual: Number(row.spending_actual ?? 0),
    clashesCount: row.clashes_count ?? 0,
    progress: row.progress ?? 0,
    startDate: row.start_date ?? '',
    client: row.client ?? '',
    description: row.description ?? '',
  };
}

export async function fetchProjects(): Promise<ProjectItem[]> {
  const { data, error } = await supabase.from('projects').select('*').order('created_at', { ascending: true });
  if (error) throw error;
  return (data ?? []).map(mapProject);
}

export async function fetchProject(id: string): Promise<ProjectItem | null> {
  const { data, error } = await supabase.from('projects').select('*').eq('id', id).maybeSingle();
  if (error) throw error;
  return data ? mapProject(data) : null;
}
