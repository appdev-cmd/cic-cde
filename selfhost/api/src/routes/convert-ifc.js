// POST /convert-ifc  { projectId, code }
// Đặt lại trạng thái để worker convert lại tài liệu IFC (vd sau khi cập nhật file).
// Worker (convert-worker) sẽ tự nhặt ở lượt quét kế tiếp.

import { createClient } from "@supabase/supabase-js";

let _supabase = null;
function service() {
  if (_supabase) return _supabase;
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return null;
  _supabase = createClient(url, key, { auth: { persistSession: false } });
  return _supabase;
}

export async function convertIfcHandler(req, res) {
  try {
    const { projectId, code } = req.body || {};
    if (!projectId || !code) {
      return res.status(400).json({ error: "Thiếu projectId/code" });
    }
    const supabase = service();
    if (!supabase) {
      return res.status(503).json({ error: "Worker convert chưa cấu hình" });
    }
    const { error } = await supabase
      .from("documents")
      .update({ frag_url: null, frag_status: "pending", frag_error: null })
      .eq("project_id", projectId)
      .eq("code", code);
    if (error) return res.status(500).json({ error: error.message });

    res.status(202).json({ status: "queued", code });
  } catch (err) {
    console.error("[convert-ifc] Error:", err.message);
    res.status(500).json({ error: "Trigger convert thất bại" });
  }
}
