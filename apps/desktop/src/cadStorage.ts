import { selectedProject } from "./bridge";
import { supabase, uploadCloudFile } from "./cloud";
import { cadFolderNames, liveCadFolder, type CadFolder } from "./cadFolderTree";

const bucket = "cde-cad";
const maxBytes = 25_000_000;
const maxPathBytes = 1024;
const folderPrefix = "folders";
const folderIdPrefix = "by-folder";
const encodedSegment = /^[A-Za-z0-9_-]{1,340}$/;
const objectNamePattern = /^[0-9a-f-]{36}_([A-Za-z0-9_-]{1,340})\.(dwg|dxf)$/;
const storage = supabase.storage.from(bucket);

export type CadDrawing = {
  key: string;
  name: string;
  format: "dwg" | "dxf";
  folders: string[];
  folderId?: string;
  bytes: number;
  createdAt: string;
};

export type CadFolderChange =
  | { operation: "create"; name: string; parentId: string | null }
  | { operation: "rename"; id: string; expectedRevision: number; name: string }
  | { operation: "move"; id: string; expectedRevision: number; parentId: string | null }
  | { operation: "remove"; id: string; expectedRevision: number };

type FolderCatalog = { folders: CadFolder[]; aliases: Record<string, string> };

async function folderRpc<T>(operation: string, payload: Record<string, unknown>, signal?: AbortSignal) {
  const request = supabase.rpc("cde_cad_folders", { project_id: selectedProject, operation, payload });
  const { data, error } = await (signal ? request.abortSignal(signal) : request);
  if (error) {
    if (error.code === "28000") window.dispatchEvent(new Event("ciccde-expired"));
    throw new Error(error.message);
  }
  return data as T;
}

export function changeCadFolder({ operation, ...payload }: CadFolderChange) {
  return folderRpc<{ id: string }>(operation, payload);
}

export function cadDrawingPath(drawing: CadDrawing) {
  return [...drawing.folders, drawing.name].join("/");
}

export function cadFormat(name: string) {
  const extension = /\.(dwg|dxf)$/i.exec(name)?.[1]?.toLowerCase();
  return extension === "dwg" || extension === "dxf" ? extension : undefined;
}

function decodeSegment(encoded: string) {
  if (!encodedSegment.test(encoded)) throw new Error("Invalid CAD path segment");
  const binary = atob(encoded.replace(/-/g, "+").replace(/_/g, "/"));
  const value = new TextDecoder("utf-8", { fatal: true, ignoreBOM: true })
    .decode(Uint8Array.from(binary, (char) => char.charCodeAt(0)));
  if (!validSegment(value)) throw new Error("Invalid CAD path segment");
  return value;
}

function validSegment(value: string) {
  return value !== "" && value !== "." && value !== ".." && !/[\/\\\u0000]/.test(value);
}

function encodeSegment(value: string) {
  const bytes = new TextEncoder().encode(value);
  if (!validSegment(value)) throw new Error("Tên thư mục hoặc tên file CAD không hợp lệ.");
  if (bytes.length > 255) throw new Error("Tên thư mục hoặc tên file quá dài.");
  return btoa(String.fromCharCode(...bytes)).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

export async function listCadWorkspace(signal: AbortSignal) {
  const prefix = selectedProject + "/";
  const drawings: CadDrawing[] = [];
  let cursor: string | undefined;
  for (;;) {
    signal.throwIfAborted();
    const { data, error } = await storage.listV2({ prefix, limit: 250, cursor, with_delimiter: false }, { signal });
    if (error) throw error;
    for (const object of data.objects) {
      const path = object.key ?? object.name;
      if (!path.startsWith(prefix) || !object.id || !object.created_at) continue;
      const key = path.slice(prefix.length);
      const segments = key.split("/");
      const parts = objectNamePattern.exec(segments.pop() ?? "");
      const legacy = segments[0] === folderPrefix && segments.length > 1;
      const storedFolder = segments[0] === folderIdPrefix && segments.length === 2;
      if (!parts || (segments.length && !legacy && !storedFolder)) continue;
      try {
        drawings.push({
          key,
          name: decodeSegment(parts[1]),
          format: parts[2] === "dwg" ? "dwg" : "dxf",
          folders: legacy ? segments.slice(1).map(decodeSegment) : [],
          folderId: storedFolder ? segments[1] : undefined,
          bytes: Number(object.metadata?.size) || 0,
          createdAt: object.created_at,
        });
      } catch {
        // Skip objects with a malformed encoded path.
      }
    }
    if (!data.hasNext) break;
    if (!data.nextCursor || data.nextCursor === cursor) throw new Error("Không thể tải trang tiếp theo của danh sách CAD.");
    cursor = data.nextCursor;
  }
  const catalog = await folderRpc<FolderCatalog>("list", {}, signal);
  const folderIndex = new Map(catalog.folders.map((folder) => [folder.id, folder]));
  for (const drawing of drawings) {
    const prefix = drawing.key.slice(0, drawing.key.lastIndexOf("/"));
    const sourceId = drawing.folderId ?? (drawing.folders.length ? catalog.aliases[prefix] : undefined);
    if (!sourceId) continue;
    const folder = liveCadFolder(folderIndex, sourceId);
    drawing.folderId = folder?.id;
    drawing.folders = folder ? cadFolderNames(folderIndex, folder.id) : [];
  }
  return {
    drawings: drawings.sort((first, second) => second.createdAt.localeCompare(first.createdAt)),
    folders: catalog.folders.filter((folder) => !folder.removed),
  };
}

export async function uploadCadDrawing(
  file: File,
  signal: AbortSignal,
  onProgress: (uploaded: number, total: number) => void,
  folderCache: Map<string, Promise<string>>,
  destination?: { id: string; path: string[] },
): Promise<CadDrawing> {
  const extension = cadFormat(file.name);
  if (!extension) throw new Error("Chọn bản vẽ DWG hoặc DXF.");
  if (!file.size || file.size > maxBytes) throw new Error("Bản vẽ phải có dữ liệu và tối đa 25 MB.");
  const relative = file.webkitRelativePath ? file.webkitRelativePath.split("/") : [file.name];
  if (relative.pop() !== file.name) throw new Error("Đường dẫn bản vẽ không hợp lệ.");
  const filename = `${crypto.randomUUID()}_${encodeSegment(file.name)}.${extension}`;
  let folderId = destination?.id;
  if (relative.length) {
    const cacheKey = JSON.stringify([folderId, ...relative]);
    let pending = folderCache.get(cacheKey);
    if (!pending) {
      pending = folderRpc<{ id: string }>("ensure", { path: relative, parentId: folderId }, signal).then(({ id }) => id);
      folderCache.set(cacheKey, pending);
    }
    folderId = await pending;
  }
  const key = folderId ? `${folderIdPrefix}/${folderId}/${filename}` : filename;
  const path = `${selectedProject}/${key}`;
  if (new TextEncoder().encode(path).length > maxPathBytes) throw new Error("Đường dẫn quá dài. Hãy rút ngắn tên hoặc giảm số cấp thư mục.");
  await uploadCloudFile(bucket, path, file, signal, onProgress);
  return {
    key, name: file.name, folders: [...(destination?.path ?? []), ...relative], folderId,
    format: extension, bytes: file.size, createdAt: new Date().toISOString(),
  };
}

export async function downloadCadDrawing(drawing: CadDrawing, signal: AbortSignal) {
  const { data, error } = await storage.download(`${selectedProject}/${drawing.key}`, {}, { signal });
  if (error) throw error;
  if (!data.size || data.size > maxBytes) throw new Error("Bản vẽ phải có dữ liệu và tối đa 25 MB.");
  return data;
}

export async function deleteCadDrawing(drawing: CadDrawing) {
  const path = `${selectedProject}/${drawing.key}`;
  const { data, error } = await storage.remove([path]);
  if (error) throw error;
  if (!data?.length) {
    throw new Error("Không thể xóa bản vẽ. Hãy tải lại danh sách và kiểm tra quyền quản trị dự án.");
  }
}
