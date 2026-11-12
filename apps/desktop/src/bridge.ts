/// <reference types="vite/client" />
import type { Workspace } from "./types";
import { routeProjectId } from "./projectRoute";
export const desktop = "__TAURI_INTERNALS__" in window;
export const cloudEnabled = Boolean(import.meta.env.VITE_SUPABASE_URL);
export const remoteDesktop =
  desktop && localStorage.getItem("ciccde.remote") === "pilot";
export const API = remoteDesktop
  ? (import.meta.env.VITE_CDE_REMOTE_API || "http://127.0.0.1:18420/api")
  : (import.meta.env.VITE_QABIM_API_BASE ?? "http://127.0.0.1:4318");
export const localDesktop = desktop && !remoteDesktop;
export const MAX_IFC_BYTES = 500_000_000;
export const selectedProject =
  routeProjectId ?? (localStorage.getItem("ciccde.project") || "demo-project");
let bearer = "";
window.addEventListener("ciccde-token", (event) => {
  bearer = (event as CustomEvent<string>).detail;
});
export function setSessionToken(token: string) {
  bearer = token;
}
export function sessionHeaders(): Record<string, string> {
  return {
    ...(remoteDesktop || API === "/api"
      ? { "X-CIC-Project": selectedProject }
      : {}),
    ...(bearer ? { Authorization: "Bearer " + bearer } : {}),
  };
}
export async function authRequest(
  path: string,
  input?: Record<string, unknown>,
) {
  if (cloudEnabled && !localDesktop) {
    return (await import("./cloud")).cloudAuth(path, input);
  }
  const response = await fetch(API + "/auth/" + path, {
    method: input ? "POST" : "GET",
    credentials: "include",
    headers: {
      ...sessionHeaders(),
      ...(input ? { "Content-Type": "application/json" } : {}),
    },
    body: input ? JSON.stringify(input) : undefined,
  });
  const body = await response.json();
  if (!response.ok) throw new Error(body.error || "Phiên đăng nhập đã hết hạn");
  return body;
}
export async function call<T>(
  operation: string,
  input: Record<string, unknown> = {},
): Promise<T> {
  if (localDesktop) {
    const { invoke } = await import("@tauri-apps/api/core");
    return invoke<T>("application_call", { operation, input });
  }
  if (cloudEnabled) {
    const cloud = await import("./cloud");
    if (operation === "users.create") return cloud.cloudCreateUser(input) as Promise<T>;
    if (operation === "projects.accounts.create") return cloud.cloudCreateUser(input, true) as Promise<T>;
    if (operation === "projects.delete") return cloud.deleteCloudProject(input) as Promise<T>;
    if (operation === "checks.run") {
      const job = await cloud.cloudRpc<{ jobId: string }>("jobs.create", { kind: "checks", ...input, requestId: crypto.randomUUID() });
      let processingError: unknown;
      const processing = cloud.startCloudJob(API, job.jobId).catch((error) => { processingError = error; });
      const result = await waitImport(job.jobId, new AbortController().signal, () => {}, () => processingError);
      await processing;
      return result as T;
    }
    return cloud.cloudRpc<T>(operation, input);
  }
  const response = await fetch(`${API}/rpc`, {
    method: "POST",
    credentials: "include",
    headers: { "Content-Type": "application/json", ...sessionHeaders() },
    body: JSON.stringify({ operation, input }),
  });
  const body = await response.json();
  if (response.status === 401)
    window.dispatchEvent(new Event("ciccde-expired"));
  if (!response.ok || body.error)
    throw new Error(body.error || "Core unavailable");
  return body.result;
}
let workspaceRequest: ReturnType<typeof requestWorkspace> | undefined;

export function loadWorkspace(registeredOnly = false) {
  if (registeredOnly) return requestRegisteredWorkspace();
  workspaceRequest ??= requestWorkspace().finally(() => {
    workspaceRequest = undefined;
  });
  return workspaceRequest;
}

async function requestRegisteredWorkspace() {
  const [ids, data] = await Promise.all([
    cloudEnabled && !localDesktop ? call<string[]>("documents.modelIds") : call<{ modelId: string }[]>("documents.list").then((docs) => docs.map((d) => d.modelId)),
    call<Workspace>("workspace.get"),
  ]);
  const modelIds = new Set(ids);
  const models = data.models.filter((model) => modelIds.has(model.id));
  const elements = data.elements.filter((element) => modelIds.has(element.modelId));
  const elementIds = new Set(elements.map((element) => element.id));
  const findings = data.findings.filter(({ a, b }) => elementIds.has(a) && elementIds.has(b));
  return { data: { ...data, models, elements, findings }, connected: true };
}

async function requestWorkspace(): Promise<{
  data: Workspace;
  connected: boolean;
}> {
  try {
    return { data: await call<Workspace>("workspace.get"), connected: true };
  } catch (error) {
    if (cloudEnabled && !localDesktop) throw error;
    if (remoteDesktop || API === "/api")
      throw new Error(
        "Không kết nối được CIC CDE. Hãy đăng nhập lại hoặc kiểm tra VPN.",
      );
    const response = await fetch("/demo.json");
    if (!response.ok) throw new Error("Không tải được dữ liệu mẫu");
    return { data: await response.json(), connected: false };
  }
}
export type ImportResult = {
  model: Workspace["models"][number];
  elements: Workspace["elements"];
  coverage?: { failed: unknown[] };
};
export type ImportPhase = { label: string; cancellable: boolean };
export async function waitImport(
  jobId: string,
  signal: AbortSignal,
  progress: (phase: ImportPhase) => void,
  processingError?: () => unknown,
): Promise<ImportResult> {
  type ImportJob = {
    phase: string;
    cancellable: boolean;
    result?: ImportResult;
    error?: string;
    stale?: boolean;
    updatedAt?: string;
  };
  let processingSince: number | undefined;
  for (;;) {
    const job = signal.aborted
      ? await call<ImportJob>("jobs.cancel", { jobId })
      : await call<ImportJob>("jobs.get", { jobId });
    if (job.phase === "completed") return job.result!;
    if (job.phase === "cancelled") throw new Error("Đã hủy tải mô hình");
    if (job.phase === "failed") throw new Error(job.error);
    if (job.stale) throw new Error("Worker đã ngừng cập nhật. Mở Tác vụ cloud để tiếp tục cùng tác vụ.");
    if (job.phase === "queued" && job.updatedAt && Date.now() - Date.parse(job.updatedAt) > 330_000) {
      throw new Error("Tác vụ chưa được worker nhận. Mở Tác vụ cloud và chọn tiếp tục.");
    }
    if (processingError?.()) throw new Error("Kết nối worker bị gián đoạn. Tác vụ đã được lưu; mở Tác vụ cloud để xem trạng thái hoặc tiếp tục.");
    if (job.phase === "running") processingSince ??= Date.now();
    const elapsed = processingSince === undefined ? 0 : Math.floor((Date.now() - processingSince) / 1000);
    progress({
      label:
        job.phase === "queued"
          ? "Đang chờ worker..."
          : job.phase === "committing"
            ? "Đang lưu mô hình..."
            : `IfcOpenShell đang xử lý hình học${elapsed >= 5 ? ` · ${elapsed} giây` : "…"}`,
      cancellable: job.cancellable,
    });
    await new Promise((resolve) => setTimeout(resolve, cloudEnabled ? 1000 : 150));
  }
}
export async function importIfc(
  file: File,
  signal: AbortSignal,
  progress: (phase: ImportPhase) => void,
) {
  if (!/\.ifc$/i.test(file.name) || !file.size || file.size > MAX_IFC_BYTES) {
    throw new Error("Chọn file IFC tối đa 500 MB.");
  }
  if (cloudEnabled && !localDesktop) {
    const cloud = await import("./cloud");
    if (signal.aborted) throw new Error("Đã hủy tải mô hình");
    progress({ label: "Đang tải IFC lên Supabase Storage...", cancellable: true });
    const job = await cloud.uploadCloudIfc(file, signal, (uploaded, total) =>
      progress({ label: `Đang tải IFC · ${Math.floor(100 * uploaded / total)}%`, cancellable: true }),
    );
    let processingError: unknown;
    if (!signal.aborted) {
      void cloud.startCloudJob(API, job.jobId).catch((error) => { processingError = error; });
    }
    return waitImport(job.jobId, signal, progress, () => processingError);
  }
  const form = new FormData();
  form.append("job", file);
  progress({ label: "Đang gửi file IFC...", cancellable: true });
  // Do not abort this request: its response owns the job ID needed to cancel the worker.
  const response = await fetch(`${API}/import`, {
    method: "POST",
    body: form,
    credentials: "include",
    headers: sessionHeaders(),
  });
  const body = await response.json();
  if (!response.ok || body.error)
    throw new Error(body.error || "Import failed");
  return waitImport(body.result.jobId, signal, progress);
}
