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
  };
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
  if (error) console.error('updateDocument error:', error.message);
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
  return mapDocument(data);
}
