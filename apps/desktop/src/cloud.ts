import { createClient } from "@supabase/supabase-js";
import type { DocumentDraft } from "./documentMetadata";

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
    project_id: localStorage.getItem("ciccde.project") || "demo-project",
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
    headers: { Authorization: `Bearer ${session.access_token}`, "X-CIC-Project": localStorage.getItem("ciccde.project") || "demo-project" },
  });
  if (!response.ok) {
    const body = await response.json().catch(() => ({}));
    throw new Error(body.error || "Worker không hoàn tất tác vụ. Hãy thử lại.");
  }
}

export async function uploadCloudIfc(file: File) {
  if (!file.name.toLowerCase().endsWith(".ifc") || file.size > 100 * 1024 * 1024) {
    throw new Error("Chọn file IFC tối đa 100 MB");
  }
  const project = localStorage.getItem("ciccde.project") || "demo-project";
  const path = `${project}/uploads/${crypto.randomUUID()}.ifc`;
  const { error } = await supabase.storage.from("cde-files").upload(path, file, { upsert: false, contentType: "application/octet-stream" });
  if (error) throw new Error(error.message);
  return cloudRpc<{ jobId: string }>("jobs.create", { kind: "import", path, name: file.name });
}

export async function suggestCloudDocument(
  input: { fileName: string; project: string; description: string; discipline: string },
  signal: AbortSignal,
) {
  const { data, error } = await supabase.functions.invoke<Pick<DocumentDraft, "title" | "discipline">>(
    "cde-document-ai",
    { body: { ...input, projectId: localStorage.getItem("ciccde.project") || "demo-project" }, signal },
  );
  if (error || !data) throw new Error("Không lấy được gợi ý Vertex AI");
  return data;
}
