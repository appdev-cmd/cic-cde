import { supabase } from '../supabase';
import type { DocumentItem } from '../../types';

// Lưu ý: app dùng `id` như mã ISO 19650 (code). DB tách uuid (id) và code.
// Lớp này map app.id <- db.code để giữ hành vi frontend hiện tại; uuid thật
// trả kèm ở `dbId` để phục vụ thao tác ghi sau này.
export interface DocumentRecord extends DocumentItem {
  dbId: string; // uuid thật trong DB
}

function mapDocument(row: any): DocumentRecord {
  return {
    dbId: row.id,
    id: row.code,
    name: row.name,
    folder: row.folder,
    subFolder: row.sub_folder ?? undefined,
    status: row.status,
    revision: row.revision ?? '',
    version: row.version ?? '',
    modifiedDate: row.modified_date ?? row.created_at,
    size: row.size ?? '',
    creator: row.creator ?? '',
    classification: row.classification ?? '',
    volume: row.volume ?? '',
    fileType: row.file_type ?? 'other',
    fileUrl: row.file_url ?? undefined,
    suitabilityCode: row.suitability_code ?? undefined,
    fragUrl: row.frag_url ?? undefined,
  };
}

// Cập nhật URL file .frag sau khi chuyển đổi (cache nạp nhanh)
export async function setDocumentFrag(projectId: string, code: string, fragUrl: string): Promise<void> {
  const { error } = await supabase.from('documents').update({ frag_url: fragUrl }).eq('project_id', projectId).eq('code', code);
  if (error) console.error('setDocumentFrag error:', error.message);
}

export async function fetchDocuments(projectId: string): Promise<DocumentRecord[]> {
  const { data, error } = await supabase
    .from('documents')
    .select('*')
    .eq('project_id', projectId)
    .order('modified_date', { ascending: false });
  if (error) throw error;
  return (data ?? []).map(mapDocument);
}

// Xóa tài liệu: xóa file trên Storage (nếu có) + xóa bản ghi DB
export async function deleteDocument(doc: { dbId?: string; id: string; fileUrl?: string }, projectId: string): Promise<void> {
  // Xóa file Storage nếu fileUrl trỏ tới bucket cde-files
  if (doc.fileUrl) {
    const marker = '/storage/v1/object/public/cde-files/';
    const idx = doc.fileUrl.indexOf(marker);
    if (idx !== -1) {
      const path = decodeURIComponent(doc.fileUrl.slice(idx + marker.length));
      const { error: se } = await supabase.storage.from('cde-files').remove([path]);
      if (se) console.error('deleteDocument storage error:', se.message);
    }
  }
  const q = supabase.from('documents').delete();
  const { error } = doc.dbId
    ? await q.eq('id', doc.dbId)
    : await q.eq('project_id', projectId).eq('code', doc.id);
  if (error) throw error;
}

export interface NewDocumentInput {
  projectId: string;
  code: string;
  name: string;
  folder: DocumentItem['folder'];
  subFolder?: string;
  status: DocumentItem['status'];
  suitabilityCode?: string;
  revision?: string;
  version?: string;
  size?: string;
  creator?: string;
  classification?: string;
  volume?: string;
  fileType: DocumentItem['fileType'];
  fileUrl?: string;
  hashSha256?: string;
}

// ----- Lịch sử phiên bản tài liệu (#4 ISO 19650) -----
export interface DocumentVersion {
  id: string;
  code: string;
  revision: string;
  version: string;
  status: string;
  folder: string;
  fileUrl?: string;
  size?: string;
  changeType: string;
  changedBy?: string;
  createdAt: string;
}

// Tạo bản ghi phiên bản từ 1 hàng documents (snapshot)
async function snapshotVersion(row: any, changeType: string): Promise<void> {
  if (!row) return;
  const { error } = await supabase.from('document_versions').insert({
    project_id: row.project_id, code: row.code, revision: row.revision, version: row.version,
    status: row.status, folder: row.folder, file_url: row.file_url, size: row.size,
    hash_sha256: row.hash_sha256, change_type: changeType, changed_by: 'BIM Manager (Bạn)',
  });
  if (error) console.error('snapshotVersion error:', error.message);
}

export async function fetchDocumentVersions(projectId: string, code: string): Promise<DocumentVersion[]> {
  const { data, error } = await supabase.from('document_versions').select('*')
    .eq('project_id', projectId).eq('code', code).order('created_at', { ascending: false });
  if (error) throw error;
  return (data ?? []).map((r: any) => ({
    id: r.id, code: r.code, revision: r.revision ?? '', version: r.version ?? '',
    status: r.status ?? '', folder: r.folder ?? '', fileUrl: r.file_url ?? undefined,
    size: r.size ?? undefined, changeType: r.change_type ?? 'update',
    changedBy: r.changed_by ?? undefined, createdAt: r.created_at,
  }));
}

// Cập nhật bản ghi tài liệu theo uuid (dbId) hoặc theo project_id+code (fallback)
export async function updateDocument(
  doc: { dbId?: string; id: string },
  projectId: string,
  patch: {
    code?: string; name?: string; folder?: string; subFolder?: string; status?: string;
    suitabilityCode?: string; revision?: string; version?: string; fileUrl?: string;
  }
): Promise<void> {
  const dbPatch: Record<string, any> = { modified_date: new Date().toISOString() };
  if (patch.code !== undefined) dbPatch.code = patch.code;
  if (patch.name !== undefined) dbPatch.name = patch.name;
  if (patch.folder !== undefined) dbPatch.folder = patch.folder;
  if (patch.subFolder !== undefined) dbPatch.sub_folder = patch.subFolder;
  if (patch.status !== undefined) dbPatch.status = patch.status;
  if (patch.suitabilityCode !== undefined) dbPatch.suitability_code = patch.suitabilityCode;
  if (patch.revision !== undefined) dbPatch.revision = patch.revision;
  if (patch.version !== undefined) dbPatch.version = patch.version;
  if (patch.fileUrl !== undefined) dbPatch.file_url = patch.fileUrl;

  const q = supabase.from('documents').update(dbPatch);
  const { error } = doc.dbId
    ? await q.eq('id', doc.dbId)
    : await q.eq('project_id', projectId).eq('code', doc.id);
  if (error) { console.error('updateDocument error:', error.message); return; }

  // Lưu phiên bản khi có thay đổi quan trọng (trạng thái/revision/đổi mã/thư mục)
  if (patch.status !== undefined || patch.revision !== undefined || patch.code !== undefined || patch.folder !== undefined) {
    const codeAfter = patch.code ?? doc.id;
    const { data: row } = await supabase.from('documents').select('*')
      .eq('project_id', projectId).eq('code', codeAfter).maybeSingle();
    const changeType = patch.code ? 'rename' : patch.revision ? 'revision' : patch.status ? 'status' : 'update';
    await snapshotVersion(row, changeType);
  }
}

export async function createDocument(input: NewDocumentInput): Promise<DocumentRecord> {
  const { data, error } = await supabase.from('documents').insert({
    project_id: input.projectId,
    code: input.code,
    name: input.name,
    folder: input.folder,
    sub_folder: input.subFolder,
    status: input.status,
    suitability_code: input.suitabilityCode,
    revision: input.revision ?? 'P01',
    version: input.version ?? 'V1',
    size: input.size,
    creator: input.creator,
    classification: input.classification,
    volume: input.volume,
    file_type: input.fileType,
    file_url: input.fileUrl,
    hash_sha256: input.hashSha256,
  }).select().single();
  if (error) throw error;
  await snapshotVersion(data, 'upload'); // phiên bản đầu tiên
  return mapDocument(data);
}
