const url = Deno.env.get("SUPABASE_URL")!;
const publicKey = Deno.env.get("SUPABASE_ANON_KEY")!;
const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const headers = {
  "Content-Type": "application/json",
  "Cache-Control": "no-store",
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, apikey, content-type, x-client-info",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

async function upstream(path: string, key: string, method: string, body?: unknown, authorization = `Bearer ${key}`) {
  const response = await fetch(`${url}${path}`, {
    method,
    headers: { apikey: key, Authorization: authorization, "Content-Type": "application/json" },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  if (!response.ok) throw new Error(`Provider rejected operation (${response.status})`);
  return response.json();
}

Deno.serve(async (request: Request) => {
  if (request.method === "OPTIONS") return new Response(null, { status: 204, headers });
  if (request.method !== "POST") return new Response(null, { status: 405, headers });
  let createdId: string | undefined;
  try {
    const raw = await request.text();
    if (raw.length > 4096) throw new Error("Body too large");
    const input = JSON.parse(raw);
    const action = input.action;
    const username = String(input.username || "").trim().toLowerCase();
    const password = String(input.password || "");
    if (!/^[a-z0-9._-]{3,64}$/.test(username) || password.length < 12 || password.length > 128) {
      throw new Error("Invalid credentials");
    }
    const identity = { email: `${username}@pilot.cde.cic.com.vn`, password };
    const manage = (step: string, payload: Record<string, unknown>) =>
      upstream("/rest/v1/rpc/cde_manage_account", serviceKey, "POST", { action: step, payload });
    let actor: string | undefined;
    if (action === "create") {
      const authorization = request.headers.get("authorization");
      if (!authorization?.startsWith("Bearer ")) throw new Error("Missing authorization");
      const profile = await upstream("/rest/v1/rpc/cde_api", publicKey, "POST", { operation: "profile" }, authorization);
      if (!profile.siteAdmin || !["admin", "member"].includes(input.role)) throw new Error("Forbidden");
      actor = profile.id;
    } else if (action === "bootstrap" || action === "join") {
      if (!/^[a-f0-9]{64}$/.test(String(input.token || ""))) throw new Error("Invalid code");
      await manage(`${action}.prepare`, { token: input.token });
    } else {
      throw new Error("Unknown action");
    }

    const created = await upstream("/auth/v1/admin/users", serviceKey, "POST", { ...identity, email_confirm: true });
    createdId = created.id;
    const profile = await manage(`${action}.commit`, {
      userId: createdId,
      username,
      actor,
      role: input.role,
      organization: input.organization,
      token: input.token,
    });
    createdId = undefined;
    if (action !== "join") return new Response(JSON.stringify({ user: profile }), { headers });
    const session = await upstream("/auth/v1/token?grant_type=password", publicKey, "POST", identity);
    return new Response(JSON.stringify({ user: profile, session: { access_token: session.access_token, refresh_token: session.refresh_token } }), { headers });
  } catch {
    if (createdId) {
      await upstream(`/auth/v1/admin/users/${createdId}`, serviceKey, "DELETE").catch(() => undefined);
    }
    return new Response(JSON.stringify({ error: "Không thể tạo tài khoản hoặc nhận lời mời. Kiểm tra mã mời, tên đăng nhập và mật khẩu." }), { status: 400, headers });
  }
});
