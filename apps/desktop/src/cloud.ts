import { createClient } from "@supabase/supabase-js";
import { MAX_IFC_BYTES, selectedProject } from "./bridge";
import type { DocumentDraft, DocumentMetadataInput } from "./documentMetadata";
import type { DocumentVersion } from "./Cde";
import type { CadAlignmentValues, ProjectCadAlignment } from "./cadAlignment";

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

export async function requestPasswordReset(address: string, redirectTo: string) {
  const { error } = await supabase.auth.resetPasswordForEmail(email(address), { redirectTo });
  // Keep the response the same for unknown and existing addresses.
  if (error && !["user_not_found", "email_address_not_authorized", "over_email_send_rate_limit"].includes(error.code ?? "")) {
    throw new Error("Chưa thể gửi yêu cầu đặt lại mật khẩu. Vui lòng thử lại sau.");
  }
}

export async function updatePassword(
  password: string,
  currentPassword?: string,
  auth = supabase.auth,
) {
  const { error } = await auth.updateUser({
    password,
    ...(currentPassword ? { current_password: currentPassword } : {}),
  });
  if (!error) return;
  if (error.code === "current_password_mismatch") throw new Error("Mật khẩu hiện tại không đúng.");
  if (error.code === "same_password") throw new Error("Hãy chọn mật khẩu khác mật khẩu hiện tại.");
  if (error.code === "weak_password") throw new Error("Mật khẩu mới chưa đủ mạnh. Hãy chọn mật khẩu khác.");
  if (error.status === 401 || error.code === "session_not_found") {
    throw new Error("Phiên đã hết hạn. Hãy đăng nhập hoặc yêu cầu liên kết mới.");
  }
  if (error.code === "reauthentication_needed") {
    throw new Error("Hãy đăng xuất, đăng nhập lại rồi đổi mật khẩu.");
  }
  throw new Error("Chưa thể cập nhật mật khẩu. Vui lòng thử lại.");
}

export async function changePassword(password: string, currentPassword: string) {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user?.email) throw new Error("Phiên đã hết hạn. Hãy đăng nhập lại.");

  // Reauthenticate even if this project does not enforce current_password.
  const { error } = await supabase.auth.signInWithPassword({
    email: user.email,
    password: currentPassword,
  });
  if (error?.code === "invalid_credentials") throw new Error("Mật khẩu hiện tại không đúng.");
  if (error) throw new Error("Chưa thể xác minh mật khẩu hiện tại. Vui lòng thử lại.");
  await updatePassword(password, currentPassword);
}

export async function openPasswordRecovery(accessToken: string, refreshToken: string) {
  // The email session must never replace a workspace session in this browser.
  const { auth } = createClient(
    import.meta.env.VITE_SUPABASE_URL,
    import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
    { auth: {
      storageKey: "ciccde-password-recovery",
      persistSession: false,
      autoRefreshToken: false,
      detectSessionInUrl: false,
    } },
  );
  const { error: verificationError } = await auth.getUser(accessToken);
  if (verificationError) throw new Error("Liên kết đã hết hạn hoặc không hợp lệ.");
  const { data, error } = await auth.setSession({
    access_token: accessToken,
    refresh_token: refreshToken,
  });
  if (error || !data.session) throw new Error("Liên kết đã hết hạn hoặc không hợp lệ.");
  return async (password: string) => {
    await updatePassword(password, undefined, auth);
    await auth.signOut({ scope: "local" });
  };
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

export async function deleteDocumentDraft(id: number): Promise<DocumentVersion[]> {
  const { data, error } = await supabase.rpc("cde_delete_document_draft", {
    project_id: selectedProject,
    document_id: id,
  });
  if (error) throw new Error(error.code === "42501" ? "Bạn cần quyền quản trị dự án để xóa hồ sơ." : error.message);
  return data;
}

async function cadAlignmentRpc<T>(
  operation: "list" | "save",
  payload: Record<string, unknown>,
  signal?: AbortSignal,
): Promise<T> {
  const request = supabase.rpc("cde_cad_alignments", { project_id: selectedProject, operation, payload });
  const { data, error } = await (signal ? request.abortSignal(signal) : request);
  if (error) {
    if (error.code === "28000") window.dispatchEvent(new Event("ciccde-expired"));
    throw error;
  }
  return data as T;
}

export function listProjectCadAlignments(signal?: AbortSignal) {
  return cadAlignmentRpc<ProjectCadAlignment[]>("list", {}, signal);
}

export function saveProjectCadAlignment(floor: string, expectedRevision: number, alignment: CadAlignmentValues | null) {
  return cadAlignmentRpc<ProjectCadAlignment>("save", { floor, expectedRevision, alignment });
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
