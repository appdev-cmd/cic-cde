import { supabase } from '../supabase';

export interface CostNorm {
  id: string;
  code: string;
  name: string;
  unit: string;
  materialCost: number;
  laborCost: number;
  machineCost: number;
}

export interface BoqItem {
  id: string;
  normCode?: string;
  name: string;
  unit: string;
  quantity: number;
  materialUnit: number;
  laborUnit: number;
  machineUnit: number;
  ifcCategory?: string;
}

const mapNorm = (r: any): CostNorm => ({
  id: r.id, code: r.code, name: r.name, unit: r.unit ?? 'm3',
  materialCost: Number(r.material_cost ?? 0), laborCost: Number(r.labor_cost ?? 0), machineCost: Number(r.machine_cost ?? 0),
});

const mapBoq = (r: any): BoqItem => ({
  id: r.id, normCode: r.norm_code ?? undefined, name: r.name, unit: r.unit ?? 'm3',
  quantity: Number(r.quantity ?? 0),
  materialUnit: Number(r.material_unit ?? 0), laborUnit: Number(r.labor_unit ?? 0), machineUnit: Number(r.machine_unit ?? 0),
  ifcCategory: r.ifc_category ?? undefined,
});

export async function fetchNorms(): Promise<CostNorm[]> {
  const { data, error } = await supabase.from('cost_norms').select('*').order('code');
  if (error) throw error;
  return (data ?? []).map(mapNorm);
}

/** Nạp hàng loạt định mức (từ import file). */
export async function importNorms(rows: Omit<CostNorm, 'id'>[]): Promise<number> {
  if (rows.length === 0) return 0;
  const payload = rows.map(r => ({
    code: r.code, name: r.name, unit: r.unit,
    material_cost: r.materialCost, labor_cost: r.laborCost, machine_cost: r.machineCost,
  }));
  const { error, count } = await supabase.from('cost_norms').insert(payload, { count: 'exact' });
  if (error) throw error;
  return count ?? rows.length;
}

export async function deleteNorm(id: string): Promise<void> {
  const { error } = await supabase.from('cost_norms').delete().eq('id', id);
  if (error) console.error('deleteNorm error:', error.message);
}

export async function fetchBoq(projectId: string): Promise<BoqItem[]> {
  const { data, error } = await supabase.from('boq_items').select('*').eq('project_id', projectId)
    .order('created_at', { ascending: true });
  if (error) throw error;
  return (data ?? []).map(mapBoq);
}

export async function addBoqItem(projectId: string, item: {
  normCode?: string; name: string; unit: string; quantity: number;
  materialUnit: number; laborUnit: number; machineUnit: number; ifcCategory?: string;
}): Promise<BoqItem | null> {
  const { data, error } = await supabase.from('boq_items').insert({
    project_id: projectId, norm_code: item.normCode ?? null, name: item.name, unit: item.unit,
    quantity: item.quantity, material_unit: item.materialUnit, labor_unit: item.laborUnit,
    machine_unit: item.machineUnit, ifc_category: item.ifcCategory ?? null,
  }).select().single();
  if (error) { console.error('addBoqItem error:', error.message); return null; }
  return mapBoq(data);
}

export async function updateBoqQuantity(id: string, quantity: number): Promise<void> {
  const { error } = await supabase.from('boq_items').update({ quantity }).eq('id', id);
  if (error) console.error('updateBoqQuantity error:', error.message);
}

/** Cập nhật đơn giá tổng (lưu vào material_unit, NC/MTC = 0 ở chế độ đơn giá gộp). */
export async function updateBoqUnitPrice(id: string, unitPrice: number): Promise<void> {
  const { error } = await supabase.from('boq_items')
    .update({ material_unit: unitPrice, labor_unit: 0, machine_unit: 0 }).eq('id', id);
  if (error) console.error('updateBoqUnitPrice error:', error.message);
}

/** Tìm định mức theo mã hoặc tên (giới hạn số kết quả). */
export async function searchNorms(query: string, limit = 50): Promise<CostNorm[]> {
  const q = query.trim();
  let req = supabase.from('cost_norms').select('*').order('code').limit(limit);
  if (q) req = req.or(`code.ilike.%${q}%,name.ilike.%${q}%`);
  const { data, error } = await req;
  if (error) throw error;
  return (data ?? []).map(mapNorm);
}

export async function deleteBoqItem(id: string): Promise<void> {
  const { error } = await supabase.from('boq_items').delete().eq('id', id);
  if (error) console.error('deleteBoqItem error:', error.message);
}

/** Thành tiền 1 dòng BOQ */
export const boqLineTotal = (i: BoqItem): number =>
  i.quantity * (i.materialUnit + i.laborUnit + i.machineUnit);
