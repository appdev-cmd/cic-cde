import { supabase } from '../supabase';

export interface DeliveryTask {
  id: string;
  title: string;
  discipline?: string;
  format?: string;
  milestone?: string;
  dueDate?: string;
  assignee?: string;
  status: string;
  linkedDocCode?: string;
}

const map = (r: any): DeliveryTask => ({
  id: r.id, title: r.title, discipline: r.discipline ?? undefined, format: r.format ?? undefined,
  milestone: r.milestone ?? undefined, dueDate: r.due_date ?? undefined, assignee: r.assignee ?? undefined,
  status: r.status ?? 'Chưa bắt đầu', linkedDocCode: r.linked_doc_code ?? undefined,
});

export async function fetchTasks(projectId: string): Promise<DeliveryTask[]> {
  const { data, error } = await supabase.from('delivery_tasks').select('*')
    .eq('project_id', projectId).order('due_date', { ascending: true });
  if (error) throw error;
  return (data ?? []).map(map);
}

export async function addTask(projectId: string, t: Omit<DeliveryTask, 'id'>): Promise<DeliveryTask | null> {
  const { data, error } = await supabase.from('delivery_tasks').insert({
    project_id: projectId, title: t.title, discipline: t.discipline, format: t.format,
    milestone: t.milestone, due_date: t.dueDate || null, assignee: t.assignee, status: t.status,
    linked_doc_code: t.linkedDocCode,
  }).select().single();
  if (error) { console.error('addTask error:', error.message); return null; }
  return map(data);
}

export async function updateTaskStatus(id: string, status: string): Promise<void> {
  const { error } = await supabase.from('delivery_tasks').update({ status }).eq('id', id);
  if (error) console.error('updateTaskStatus error:', error.message);
}

export async function deleteTask(id: string): Promise<void> {
  const { error } = await supabase.from('delivery_tasks').delete().eq('id', id);
  if (error) console.error('deleteTask error:', error.message);
}
