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
    lat: row.lat ?? undefined,
    lng: row.lng ?? undefined,
    province: row.province ?? undefined,
    tilesUrl: row.tiles_url ?? undefined,
    projectGroup: row.project_group ?? undefined,
    buildingGrade: row.building_grade ?? undefined,
    coverImage: row.cover_image ?? undefined,
  };
}

export async function updateProjectLocation(id: string, lat: number, lng: number, province?: string): Promise<void> {
  const { error } = await supabase.from('projects').update({ lat, lng, province: province ?? null }).eq('id', id);
  if (error) console.error('updateProjectLocation error:', error.message);
}

export async function updateProjectCover(id: string, coverImageUrl: string): Promise<void> {
  const { error } = await supabase.from('projects').update({ cover_image: coverImageUrl }).eq('id', id);
  if (error) throw error;
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

export async function createProject(project: Omit<ProjectItem, 'documentsCount' | 'approvalPercent' | 'spendingActual' | 'clashesCount'>): Promise<ProjectItem> {
  const { data, error } = await supabase
    .from('projects')
    .insert({
      id: project.id,
      name: project.name,
      location: project.location,
      status: project.status,
      client: project.client,
      description: project.description,
      progress: project.progress,
      start_date: project.startDate,
      lat: project.lat,
      lng: project.lng,
      province: project.province,
      tiles_url: project.tilesUrl,
      project_group: project.projectGroup,
      building_grade: project.buildingGrade,
      cover_image: project.coverImage,
      documents_count: 0,
      approval_percent: 0,
      spending_actual: 0,
      clashes_count: 0
    })
    .select()
    .single();

  if (error) throw error;
  return mapProject(data);
}

export async function updateProject(id: string, project: Partial<ProjectItem>): Promise<ProjectItem> {
  const dbPatch: Record<string, any> = {};
  if (project.name !== undefined) dbPatch.name = project.name;
  if (project.location !== undefined) dbPatch.location = project.location;
  if (project.status !== undefined) dbPatch.status = project.status;
  if (project.client !== undefined) dbPatch.client = project.client;
  if (project.description !== undefined) dbPatch.description = project.description;
  if (project.progress !== undefined) dbPatch.progress = project.progress;
  if (project.startDate !== undefined) dbPatch.start_date = project.startDate;
  if (project.lat !== undefined) dbPatch.lat = project.lat;
  if (project.lng !== undefined) dbPatch.lng = project.lng;
  if (project.province !== undefined) dbPatch.province = project.province;
  if (project.tilesUrl !== undefined) dbPatch.tiles_url = project.tilesUrl;
  if (project.projectGroup !== undefined) dbPatch.project_group = project.projectGroup;
  if (project.buildingGrade !== undefined) dbPatch.building_grade = project.buildingGrade;
  if (project.coverImage !== undefined) dbPatch.cover_image = project.coverImage;

  const { data, error } = await supabase
    .from('projects')
    .update(dbPatch)
    .eq('id', id)
    .select()
    .single();

  if (error) throw error;
  return mapProject(data);
}

