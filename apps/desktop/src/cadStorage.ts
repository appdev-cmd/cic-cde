import { selectedProject } from "./bridge";
import { supabase, uploadCloudFile } from "./cloud";

const bucket = "cde-cad";
const maxBytes = 25_000_000;
const objectNamePattern = /^[0-9a-f-]{36}_([A-Za-z0-9_-]{1,340})\.(dwg|dxf)$/;
const storage = supabase.storage.from(bucket);

export type CadDrawing = {
  key: string;
  name: string;
  format: "dwg" | "dxf";
  bytes: number;
  createdAt: string;
};

function drawingName(encoded: string) {
  const binary = atob(encoded.replace(/-/g, "+").replace(/_/g, "/"));
  return new TextDecoder("utf-8", { fatal: true }).decode(Uint8Array.from(binary, (char) => char.charCodeAt(0)));
}

export async function listCadDrawings(signal: AbortSignal): Promise<CadDrawing[]> {
  const pageSize = 100;
  const drawings: CadDrawing[] = [];
  for (let offset = 0; ; offset += pageSize) {
    signal.throwIfAborted();
    const { data, error } = await storage.list(selectedProject, {
      limit: pageSize, offset, sortBy: { column: "name", order: "asc" },
    });
    signal.throwIfAborted();
    if (error) throw error;
    for (const object of data) {
      const parts = objectNamePattern.exec(object.name);
      if (!object.id || !parts || !object.created_at) continue;
      try {
        drawings.push({
          key: object.name,
          name: drawingName(parts[1]),
          format: parts[2] === "dwg" ? "dwg" : "dxf",
          bytes: Number(object.metadata?.size) || 0,
          createdAt: object.created_at,
        });
      } catch {
        // Skip objects with a malformed encoded filename.
      }
    }
    if (data.length < pageSize) break;
  }
  return drawings.sort((first, second) => second.createdAt.localeCompare(first.createdAt));
}

export async function uploadCadDrawing(
  file: File,
  signal: AbortSignal,
  onProgress: (uploaded: number, total: number) => void,
): Promise<CadDrawing> {
  const extension = /\.(dwg|dxf)$/i.exec(file.name)?.[1]?.toLowerCase();
  if (extension !== "dwg" && extension !== "dxf") throw new Error("Chọn bản vẽ DWG hoặc DXF.");
  if (!file.size || file.size > maxBytes) throw new Error("Bản vẽ phải có dữ liệu và tối đa 25 MB.");
  const nameBytes = new TextEncoder().encode(file.name);
  if (nameBytes.length > 255) throw new Error("Tên bản vẽ quá dài. Hãy rút ngắn tên file.");
  const encoded = btoa(String.fromCharCode(...nameBytes)).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
  const key = `${crypto.randomUUID()}_${encoded}.${extension}`;
  await uploadCloudFile(bucket, `${selectedProject}/${key}`, file, signal, onProgress);
  return { key, name: file.name, format: extension, bytes: file.size, createdAt: new Date().toISOString() };
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
