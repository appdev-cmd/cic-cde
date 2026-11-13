import { call, selectedProject } from "./bridge";
import type { CoordinationIssue, IssueAttachment } from "./types";

const evidenceBucket = "cde-issue-evidence";
export const issueAttachmentLimit = 25;
export const issueImageAccept = ".png,.jpg,.jpeg";
export const issueFileAccept = issueImageAccept + ",.pdf,.txt,.docx,.xlsx";
export const issueImageType = (name: string) =>
  /\.png$/i.test(name) ? "image/png" : /\.jpe?g$/i.test(name) ? "image/jpeg" : undefined;

export type PendingIssueFile = { file: File; id: string; uploadedPath?: string };

export function issueFiles(files: File[], imagesOnly: boolean, slots: number): PendingIssueFile[] {
  if (files.length > slots) throw new Error("Mỗi vấn đề có tối đa 25 tệp đính kèm.");
  return files.map((file) => {
    const allowed = issueImageType(file.name) || (!imagesOnly && /\.(pdf|txt|docx|xlsx)$/i.test(file.name));
    if (!allowed || !file.size || file.size > 20_000_000 || file.name.length > 200 || /[/\\]/.test(file.name)) {
      throw new Error(imagesOnly ? "Chọn ảnh PNG hoặc JPEG, tối đa 20 MB mỗi ảnh."
        : "Chọn PDF, ảnh PNG/JPEG, TXT, DOCX hoặc XLSX, tối đa 20 MB mỗi tệp.");
    }
    return { file, id: crypto.randomUUID() };
  });
}

export async function attachIssueFile(
  issueId: number, entry: PendingIssueFile, cloud: boolean, signal: AbortSignal,
  attach: (payload: Record<string, unknown>) => Promise<void>, progress: (percent: number) => void,
) {
  const { file, id } = entry;
  if (!cloud) {
    const content = await new Promise<string>((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(String(reader.result).split(",", 2)[1]);
      reader.onerror = () => reject(new Error("Không đọc được ảnh đã chọn."));
      reader.readAsDataURL(file);
    });
    signal.throwIfAborted();
    await attach({ issueId, attachmentId: id, filename: file.name, content });
    return;
  }
  const { supabase, uploadCloudFile } = await import("./cloud");
  const { data: { session } } = await supabase.auth.getSession();
  if (!session) throw new Error("Hãy đăng nhập lại.");
  const path = [selectedProject, issueId, session.user.id, id + "." + file.name.split(".").pop()!.toLowerCase()].join("/");
  if (entry.uploadedPath !== path) {
    try {
      await uploadCloudFile(evidenceBucket, path, file, signal, (sent, total) => progress(Math.floor(sent / total * 100)));
    } catch (error) {
      signal.throwIfAborted();
      // The object can be present if the upload succeeded before the connection dropped.
      const existing = await supabase.storage.from(evidenceBucket).createSignedUrl(path, 60);
      if (existing.error) throw error;
    }
    entry.uploadedPath = path;
  }
  signal.throwIfAborted();
  await attach({ issueId, path, filename: file.name });
}

export async function getIssueFile(issue: CoordinationIssue, item: IssueAttachment, cloud: boolean) {
  const type = issueImageType(item.filename) ?? "application/octet-stream";
  if (cloud) {
    const { supabase } = await import("./cloud");
    const { data, error } = await supabase.storage.from(evidenceBucket).download(item.path);
    if (error) throw new Error(error.message);
    return data.slice(0, data.size, type);
  }
  const content = await call<string>("issues.attachment.get", { issueId: issue.id, attachmentId: item.id });
  const bytes = Uint8Array.from(atob(content), (character) => character.charCodeAt(0));
  return new Blob([bytes], { type });
}
