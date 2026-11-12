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

class ProviderError extends Error {
  constructor(readonly status: number, readonly code: string) {
    super("Provider rejected operation");
  }
}

function reply(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers });
}

async function upstream(path: string, key: string, method: string, body?: unknown, authorization = `Bearer ${key}`) {
  const response = await fetch(`${url}${path}`, {
    method,
    headers: { apikey: key, Authorization: authorization, "Content-Type": "application/json" },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  if (!response.ok) {
    const error = await response.json().catch(() => ({}));
    throw new ProviderError(response.status, error?.code ?? error?.error_code ?? "");
  }
  if (response.status === 204) return null;
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
    const username = typeof input.username === "string" ? input.username.trim().toLowerCase() : "";
    const password = typeof input.password === "string" ? input.password : "";
    const shortUsername = /^[a-z0-9._-]{3,64}$/.test(username);
    const emailUsername = (action === "create" || action === "project.create") && username.length <= 80 &&
      /^[a-z0-9][a-z0-9._+-]*@[a-z0-9-]+(?:\.[a-z0-9-]+)+$/.test(username);
    if ((!shortUsername && !emailUsername) || password.length < 12 || password.length > 128) {
      return reply({ error: "Nhập tên đăng nhập hợp lệ và mật khẩu từ 12 đến 128 ký tự." }, 400);
    }
    const identity = {
      email: emailUsername ? username : `${username}@pilot.cde.cic.com.vn`,
      password,
    };
    const manage = (step: string, payload: Record<string, unknown>) =>
      upstream("/rest/v1/rpc/cde_manage_account", serviceKey, "POST", { action: step, payload });
    const payload = {
      username,
      role: input.role,
      organization: typeof input.organization === "string" ? input.organization.trim() : "",
      projectId: input.projectId,
      isoRole: input.isoRole,
      token: input.token,
    };
    let actor: string | undefined;
    if (action === "create" || action === "project.create") {
      const authorization = request.headers.get("authorization");
      if (!authorization?.startsWith("Bearer ")) return reply({ error: "Vui lòng đăng nhập lại." }, 401);
      const profile = await upstream("/rest/v1/rpc/cde_api", publicKey, "POST", { operation: "profile" }, authorization);
      if (!profile.siteAdmin) return reply({ error: "Bạn cần quyền quản trị hệ thống để tạo tài khoản." }, 403);
      if (!payload.organization || payload.organization.length > 120) {
        return reply({ error: "Nhập tên đơn vị từ 1 đến 120 ký tự." }, 400);
      }
      actor = profile.id;
      if (action === "project.create") await manage("project.create.prepare", { ...payload, actor });
      else if (!["admin", "member"].includes(input.role)) {
        return reply({ error: "Quyền hệ thống không hợp lệ." }, 400);
      }
    } else if (action === "bootstrap" || action === "join") {
      if (!/^[a-f0-9]{64}$/.test(String(input.token || ""))) throw new Error("Invalid code");
      await manage(`${action}.prepare`, { token: input.token });
    } else {
      throw new Error("Unknown action");
    }

    const created = await upstream("/auth/v1/admin/users", serviceKey, "POST", { ...identity, email_confirm: true });
    createdId = created.id;
    const profile = await manage(`${action}.commit`, {
      ...payload,
      userId: createdId,
      actor,
    });
    createdId = undefined;
    if (action !== "join") return reply({ user: profile });
    const session = await upstream("/auth/v1/token?grant_type=password", publicKey, "POST", identity)
      .catch(() => null);
    return reply({
      user: profile,
      session: session && { access_token: session.access_token, refresh_token: session.refresh_token },
    });
  } catch (failure) {
    if (createdId) {
      await upstream(`/auth/v1/admin/users/${createdId}`, serviceKey, "DELETE").catch(() => undefined);
    }
    if (failure instanceof ProviderError) {
      if (["email_exists", "user_already_exists", "23505"].includes(failure.code)) {
        return reply({ error: "Email hoặc tên đăng nhập đã được sử dụng." }, 409);
      }
      if (failure.code === "weak_password") {
        return reply({ error: "Mật khẩu chưa đáp ứng yêu cầu bảo mật." }, 400);
      }
      if (failure.code === "28000" || failure.status === 401) {
        return reply({ error: "Phiên đã hết hạn. Vui lòng đăng nhập lại." }, 401);
      }
    }
    return reply({ error: "Không thể tạo tài khoản hoặc nhận lời mời. Hãy kiểm tra thông tin và quyền tham gia dự án." }, 400);
  }
});
