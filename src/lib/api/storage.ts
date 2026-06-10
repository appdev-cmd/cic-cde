import { supabase } from '../supabase';
import JSZip from 'jszip';

const BUCKET = 'cde-files';

/**
 * Nén file IFC thô (.ifc) thành .ifczip để tiết kiệm dung lượng/băng thông.
 * File đã là .ifczip/.zip hoặc không phải .ifc thì giữ nguyên.
 */
export async function compressIfcToZip(file: File): Promise<File> {
  if (!/\.ifc$/i.test(file.name)) return file;
  const zip = new JSZip();
  zip.file(file.name, await file.arrayBuffer());
  const blob = await zip.generateAsync({ type: 'blob', compression: 'DEFLATE', compressionOptions: { level: 6 } });
  return new File([blob], file.name.replace(/\.ifc$/i, '.ifczip'), { type: 'application/zip' });
}

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

/** Tải ảnh (data URL) lên Storage và trả về URL công khai. Dùng cho ảnh đại diện. */
export async function uploadDataUrl(dataUrl: string, path: string): Promise<string> {
  const res = await fetch(dataUrl);
  const blob = await res.blob();
  const { error } = await supabase.storage.from(BUCKET).upload(path, blob, {
    cacheControl: '3600', upsert: true, contentType: blob.type || 'image/png',
  });
  if (error) throw error;
  return supabase.storage.from(BUCKET).getPublicUrl(path).data.publicUrl;
}

/** Tải một ArrayBuffer (vd .frag) lên Storage và trả URL công khai. */
export async function uploadArrayBuffer(buffer: ArrayBuffer | Uint8Array, path: string): Promise<string> {
  const blob = new Blob([buffer], { type: 'application/octet-stream' });
  const { error } = await supabase.storage.from(BUCKET).upload(path, blob, { cacheControl: '3600', upsert: true });
  if (error) throw error;
  return supabase.storage.from(BUCKET).getPublicUrl(path).data.publicUrl;
}

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
