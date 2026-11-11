import { suggestDocument } from "./vertex.ts";

const headers = {
  "Content-Type": "application/json",
  "Cache-Control": "no-store",
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, apikey, content-type, x-client-info",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};
const recentRequests = new Map<string, number[]>();

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), { headers, status });
}

function text(value: unknown, max: number) {
  return typeof value === "string" ? value.replace(/\s+/g, " ").trim().slice(0, max) : "";
}

Deno.serve(async (request: Request) => {
  if (request.method === "OPTIONS") return new Response(null, { headers, status: 204 });
  if (request.method !== "POST") return json({ error: "Phương thức không hỗ trợ." }, 405);
  const authorization = request.headers.get("authorization") || "";
  if (!/^Bearer\s+\S+$/i.test(authorization)) return json({ error: "Vui lòng đăng nhập." }, 401);

  let input;
  try {
    if (Number(request.headers.get("content-length")) > 4096) return json({ error: "Metadata quá dài." }, 413);
    const body = await request.text();
    if (body.length > 4096) return json({ error: "Metadata quá dài." }, 413);
    input = JSON.parse(body);
  } catch {
    return json({ error: "Metadata không hợp lệ." }, 400);
  }
  const projectId = text(input?.projectId, 40);
  const fileName = text(input?.fileName, 240);
  if (!projectId || !fileName) return json({ error: "Cần tên file và dự án." }, 400);

  try {
    // The CDE RPC checks both the live session and membership of the requested project.
    const access = await fetch(`${Deno.env.get("SUPABASE_URL")}/rest/v1/rpc/cde_api`, {
      method: "POST",
      headers: {
        apikey: Deno.env.get("SUPABASE_ANON_KEY") || "",
        Authorization: authorization,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ operation: "projects.current", project_id: projectId, payload: { projectId } }),
      signal: AbortSignal.timeout(4000),
    });
    if (access.status === 401 || access.status === 403) {
      return json({ error: "Phiên đăng nhập hoặc quyền dự án không hợp lệ." }, access.status);
    }
    if (!access.ok) throw new Error(`CDE authorization HTTP ${access.status}`);
    const member = await access.json();
    if (!member.id || !["admin", "reviewer", "member"].includes(member.role)) {
      return json({ error: "Bạn không có quyền đăng ký hồ sơ trong dự án này." }, 403);
    }
    const cutoff = Date.now() - 60_000;
    for (const [id, times] of recentRequests) {
      if (times[times.length - 1] < cutoff) recentRequests.delete(id);
    }
    const times = (recentRequests.get(member.id) || []).filter((time) => time >= cutoff);
    if (times.length >= 10) return json({ error: "Hãy thử gợi ý lại sau ít phút." }, 429);
    recentRequests.set(member.id, [...times, Date.now()]);

    const discipline = text(input.discipline, 5);
    return json(await suggestDocument({
      fileName,
      project: text(input.project, 160),
      description: text(input.description, 160),
      discipline: ["ARC", "STR", "MEP", "OTHER"].includes(discipline) ? discipline : "",
    }));
  } catch (error) {
    // Never log the input metadata, upstream response body or access token.
    const message = error instanceof Error ? error.message : "";
    const status = /^(?:Vertex (?:OAuth|inference)|CDE authorization) HTTP \d{3}$/.test(message)
      ? message : "Document suggestion failed";
    console.warn(status);
    return json({ error: "Vertex AI tạm thời không trả được gợi ý." }, 503);
  }
});
