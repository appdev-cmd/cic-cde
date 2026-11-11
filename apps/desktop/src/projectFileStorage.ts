import { selectedProject } from "./bridge";
import { supabase, uploadCloudFile } from "./cloud";

export const fileCategories = {
  EIR: "EIR",
  BEP: "BEP",
  STANDARD: "Tiêu chuẩn và quy trình",
  MINUTES: "Biên bản",
  REPORT: "Báo cáo",
  OTHER: "Tài liệu khác",
} as const;
export type FileCategory = keyof typeof fileCategories;

export const documentExtensions = ["pdf", "doc", "docx", "xls", "xlsx", "ppt", "pptx", "txt", "csv", "zip", "png", "jpg", "jpeg"];
const storage = supabase.storage.from("cde-documents");
const objectName = /^([0-9a-f-]{36})_(EIR|BEP|STANDARD|MINUTES|REPORT|OTHER)_([A-Za-z0-9_-]{1,340})\.([a-z0-9]+)$/;

export type ProjectFile = {
  key: string;
  name: string;
  category: FileCategory;
  extension: string;
  bytes: number;
  createdAt: string;
};

export async function listProjectFiles(signal: AbortSignal) {
  const files: ProjectFile[] = [];
  const pageSize = 100;
  for (let offset = 0; ; offset += pageSize) {
    signal.throwIfAborted();
    const { data, error } = await storage.list(selectedProject, {
      limit: pageSize, offset, sortBy: { column: "name", order: "asc" },
    });
    signal.throwIfAborted();
    if (error) throw error;
    for (const item of data) {
      const parts = objectName.exec(item.name);
      if (!item.id || !parts || !item.created_at) continue;
      try {
        const decoded = atob(parts[3].replace(/-/g, "+").replace(/_/g, "/"));
        const name = new TextDecoder("utf-8", { fatal: true })
          .decode(Uint8Array.from(decoded, (char) => char.charCodeAt(0)));
        files.push({
          key: item.name, name, category: parts[2] as FileCategory, extension: parts[4],
          bytes: Number(item.metadata?.size) || 0, createdAt: item.created_at,
        });
      } catch {
        // Ignore keys that cannot be decoded as filenames.
      }
    }
    if (data.length < pageSize) return files;
  }
}

export async function uploadProjectFile(file: File, category: FileCategory, signal: AbortSignal, onProgress: (uploaded: number) => void) {
  const extension = file.name.split(".").pop()?.toLowerCase() ?? "";
  if (!file.name.includes(".") || !documentExtensions.includes(extension)) {
    throw new Error("Định dạng tài liệu chưa được hỗ trợ.");
  }
  if (!file.size || file.size > 50_000_000) throw new Error("Tài liệu phải có dữ liệu và tối đa 50 MB.");
  const bytes = new TextEncoder().encode(file.name);
  if (bytes.length > 255) throw new Error("Tên tài liệu quá dài. Hãy rút ngắn tên file.");
  const encoded = btoa(String.fromCharCode(...bytes)).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
  const key = `${crypto.randomUUID()}_${category}_${encoded}.${extension}`;
  await uploadCloudFile("cde-documents", `${selectedProject}/${key}`, file, signal, onProgress);
  return { key, name: file.name, category, extension, bytes: file.size, createdAt: new Date().toISOString() };
}

export async function downloadProjectFile(file: ProjectFile) {
  const { data, error } = await storage.createSignedUrl(`${selectedProject}/${file.key}`, 60, { download: file.name });
  if (error) throw error;
  const link = document.createElement("a");
  link.href = data.signedUrl;
  link.click();
}

export async function deleteProjectFile(file: ProjectFile) {
  const { data, error } = await storage.remove([`${selectedProject}/${file.key}`]);
  if (error) throw error;
  if (!data?.length) throw new Error("Không thể xóa tài liệu. Hãy tải lại danh sách và kiểm tra quyền quản trị dự án.");
}
