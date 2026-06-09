import { supabase } from '../supabase';

const BUCKET = 'cde-files';

/** Tính SHA-256 của file (toàn vẹn dữ liệu — theo báo cáo mục 3.6.3). */
export async function sha256(file: File): Promise<string> {
  const buf = await file.arrayBuffer();
  const hash = await crypto.subtle.digest('SHA-256', buf);
  return Array.from(new Uint8Array(hash)).map(b => b.toString(16).padStart(2, '0')).join('');
}

export interface UploadResult {
  path: string;
  publicUrl: string;
  hash: string;
  sizeLabel: string;
}

const sizeLabel = (bytes: number): string =>
  bytes < 1024 * 1024
    ? `${(bytes / 1024).toFixed(0)} KB`
    : `${(bytes / 1024 / 1024).toFixed(1)} MB`;

/** Tải file lên Supabase Storage (bucket cde-files) và trả về URL công khai + hash. */
export async function uploadFile(file: File, projectId: string): Promise<UploadResult> {
  const safeName = file.name.replace(/[^\w.\-]/g, '_');
  const path = `${projectId}/${Date.now()}_${safeName}`;
  const { error } = await supabase.storage.from(BUCKET).upload(path, file, {
    cacheControl: '3600',
    upsert: false,
  });
  if (error) throw error;
  const { data } = supabase.storage.from(BUCKET).getPublicUrl(path);
  const hash = await sha256(file);
  return { path, publicUrl: data.publicUrl, hash, sizeLabel: sizeLabel(file.size) };
}
