import { createClient } from "@supabase/supabase-js";
import { MAX_IFC_BYTES, selectedProject } from "./bridge";
import type { DocumentDraft, DocumentMetadataInput } from "./documentMetadata";

export const supabase = createClient(
  import.meta.env.VITE_SUPABASE_URL,
  import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
  { auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: false } },
);

supabase.auth.onAuthStateChange((_event, session) => {
  window.dispatchEvent(new CustomEvent("ciccde-token", { detail: session?.access_token || "" }));
});

function email(username: string) {
  const normalized = username.trim().toLowerCase();
  return normalized.includes("@") ? normalized : `${normalized}@pilot.cde.cic.com.vn`;
}

export async function cloudRpc<T>(operation: string, payload: Record<string, unknown> = {}): Promise<T> {
  const { data, error } = await supabase.rpc("cde_api", {
    operation,
    payload,
    project_id: selectedProject,
  });
  if (error) {
    if (error.code === "28000") window.dispatchEvent(new Event("ciccde-expired"));
    throw new Error(error.message);
  }
  return data as T;
}

export async function cloudAuth(path: string, input: Record<string, unknown> = {}) {
  if (path === "logout") {
    const { error } = await supabase.auth.signOut();
    if (error) throw error;
    return { ok: true };
  }
  if (path === "login") {
    const { error } = await supabase.auth.signInWithPassword({
      email: email(String(input.username || "")),
      password: String(input.password || ""),
    });
    if (error) throw new Error("Tên đăng nhập hoặc mật khẩu không đúng");
  }
  if (path === "join") {
    const { data, error } = await supabase.functions.invoke("cde-accounts", {
      body: { action: "join", ...input },
    });
    if (error || data?.error) throw new Error(data?.error || "Không thể nhận lời mời");
    const result = await supabase.auth.setSession(data.session);
    if (result.error) throw result.error;
  }
  const { data: { session } } = await supabase.auth.getSession();
  if (!session) return { user: null, required: true };
  return { user: await cloudRpc("profile"), required: true, token: session.access_token };
}

export async function cloudCreateUser(input: Record<string, unknown>) {
  const { data, error } = await supabase.functions.invoke("cde-accounts", {
    body: { action: "create", ...input },
  });
  if (error || data?.error) throw new Error(data?.error || "Không thể tạo tài khoản");
  return data;
}

export async function startCloudJob(api: string, jobId: string) {
  const { data: { session } } = await supabase.auth.getSession();
  if (!session) throw new Error("Vui lòng đăng nhập lại");
  const response = await fetch(`${api}/process/${encodeURIComponent(jobId)}`, {
    method: "POST",
    headers: { Authorization: `Bearer ${session.access_token}`, "X-CIC-Project": selectedProject },
  });
  if (!response.ok) {
    const body = await response.json().catch(() => ({}));
    throw new Error(body.error || "Worker không hoàn tất tác vụ. Hãy thử lại.");
  }
}

export async function uploadCloudIfc(
  file: File,
  signal: AbortSignal,
  onProgress: (uploaded: number, total: number) => void,
) {
  if (!file.name.toLowerCase().endsWith(".ifc") || !file.size || file.size > MAX_IFC_BYTES) {
    throw new Error("Chọn file IFC tối đa 500 MB.");
  }
  const path = `${selectedProject}/uploads/${crypto.randomUUID()}.ifc`;
  await uploadCloudFile("cde-files", path, file, signal, onProgress);
  return cloudRpc<{ jobId: string }>("jobs.create", { kind: "import", path, name: file.name });
}

export async function uploadCloudFile(
  bucket: string,
  path: string,
  file: File,
  signal: AbortSignal,
  onProgress: (uploaded: number, total: number) => void,
) {
  const { Upload } = await import("tus-js-client");
  const { data: { session } } = await supabase.auth.getSession();
  if (!session) throw new Error("Vui lòng đăng nhập lại.");
  signal.throwIfAborted();
  const endpoint = new URL(import.meta.env.VITE_SUPABASE_URL);
  if (endpoint.hostname.endsWith(".supabase.co")) {
    endpoint.hostname = endpoint.hostname.replace(/\.supabase\.co$/, ".storage.supabase.co");
  }
  endpoint.pathname = "/storage/v1/upload/resumable";
  await new Promise<void>((resolve, reject) => {
    function finish(error?: unknown) {
      signal.removeEventListener("abort", abort);
      if (error) reject(error);
      else resolve();
    }
    function abort() {
      void upload.abort();
      finish(signal.reason);
    }
    const upload = new Upload(file, {
      endpoint: endpoint.href,
      headers: { Authorization: `Bearer ${session.access_token}` },
      retryDelays: [0, 1000, 3000, 5000, 10000],
      chunkSize: 6 * 1024 * 1024,
      storeFingerprintForResuming: false,
      metadata: { bucketName: bucket, objectName: path, contentType: "application/octet-stream" },
      onError: finish,
      onSuccess: () => finish(),
      onProgress,
    });
    signal.addEventListener("abort", abort, { once: true });
    upload.start();
  });
}

export async function suggestCloudDocuments(
  files: DocumentMetadataInput[],
  signal: AbortSignal,
) {
  const { data, error } = await supabase.functions.invoke<{ suggestions: (DocumentDraft | null)[] }>(
    "cde-document-ai",
    { body: { files, projectId: selectedProject }, signal },
  );
  if (error || !Array.isArray(data?.suggestions)) throw new Error("Không lấy được gợi ý Vertex AI");
  return data.suggestions;
}
