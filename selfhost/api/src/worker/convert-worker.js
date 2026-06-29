// Trụ 2 — Worker convert IFC -> Fragments (DB-driven).
// Quét bảng `documents`: IFC đã upload (file_url) nhưng chưa có frag_url -> convert nền,
// upload .frag lên Storage, ghi frag_url để client nạp nhanh (không phải parse IFC trên trình duyệt).
//
// Không cần client gọi: chỉ cần có bản ghi documents trỏ tới file IFC là worker tự xử lý.

import { createClient } from "@supabase/supabase-js";
import cron from "node-cron";
import { unzipSync } from "fflate";
import { writeFileSync, unlinkSync, mkdtempSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { convertIfcFileToFrag } from "../lib/ifc-to-fragments.js";

const BUCKET = "cde-files";
const STORAGE_MARKER = "/storage/v1/object/public/cde-files/";
const isIfc = (url = "") => /\.ifc(zip)?(\?|$)/i.test(url);

/** Lấy storage path từ public URL (giống deleteDocument ở client). */
function storagePathFromUrl(fileUrl) {
  const idx = fileUrl.indexOf(STORAGE_MARKER);
  if (idx === -1) return null;
  return decodeURIComponent(fileUrl.slice(idx + STORAGE_MARKER.length));
}

/** Nếu buffer là .ifczip/.zip (header 'PK') thì giải nén lấy entry .ifc đầu tiên. */
function extractIfcBytes(buf) {
  const isZip = buf[0] === 0x50 && buf[1] === 0x4b; // 'PK'
  if (!isZip) return buf;
  const files = unzipSync(buf);
  const entry = Object.keys(files).find((p) => /\.ifc$/i.test(p));
  if (!entry) throw new Error("Không tìm thấy .ifc bên trong file nén");
  return Buffer.from(files[entry]);
}

/** Xử lý đúng MỘT tài liệu IFC đang chờ. Trả true nếu có việc đã xử lý. */
async function processOne(supabase) {
  // Tìm ứng viên: chưa có frag, có file, chưa lỗi/đang chạy.
  const { data: rows, error } = await supabase
    .from("documents")
    .select("id, project_id, code, name, file_url, file_type, frag_status")
    .is("frag_url", null)
    .not("file_url", "is", null)
    .or("frag_status.is.null,frag_status.eq.pending")
    .limit(10);
  if (error) {
    console.error("[convert-worker] query lỗi:", error.message);
    return false;
  }
  const doc = (rows || []).find(
    (r) => r.file_type === "ifc" || isIfc(r.file_url)
  );
  if (!doc) return false;

  // Khóa mềm: đánh dấu processing (1 worker nên không tranh chấp).
  await supabase
    .from("documents")
    .update({ frag_status: "processing", frag_error: null })
    .eq("id", doc.id);

  console.log(`[convert-worker] ▶ convert ${doc.code} (${doc.name})`);
  let tmpFile = null;
  try {
    const path = storagePathFromUrl(doc.file_url);
    if (!path) throw new Error("file_url không thuộc bucket cde-files");

    const { data: blob, error: dlErr } = await supabase.storage
      .from(BUCKET)
      .download(path);
    if (dlErr) throw new Error("tải IFC lỗi: " + dlErr.message);

    const raw = Buffer.from(await blob.arrayBuffer());
    const ifcBytes = extractIfcBytes(raw);

    const dir = mkdtempSync(join(tmpdir(), "cic-ifc-"));
    tmpFile = join(dir, "model.ifc");
    writeFileSync(tmpFile, ifcBytes);

    const { bytes, ifcSize, fragSize, ms } = await convertIfcFileToFrag(tmpFile);

    const fragPath = `frags/${doc.project_id}/${doc.code}.frag`;
    const { error: upErr } = await supabase.storage
      .from(BUCKET)
      .upload(fragPath, Buffer.from(bytes), {
        upsert: true,
        cacheControl: "3600",
        contentType: "application/octet-stream",
      });
    if (upErr) throw new Error("upload .frag lỗi: " + upErr.message);

    const fragUrl = supabase.storage.from(BUCKET).getPublicUrl(fragPath).data
      .publicUrl;

    await supabase
      .from("documents")
      .update({ frag_url: fragUrl, frag_status: "ready", frag_error: null })
      .eq("id", doc.id);

    const ratio = ((fragSize / ifcSize) * 100).toFixed(1);
    console.log(
      `[convert-worker] ✔ ${doc.code}: ${(ifcSize / 1e6).toFixed(1)}MB → ` +
        `${(fragSize / 1e6).toFixed(1)}MB (${ratio}%) trong ${(ms / 1000).toFixed(1)}s`
    );
    return true;
  } catch (err) {
    const msg = err?.message || String(err);
    console.error(`[convert-worker] ✘ ${doc.code}: ${msg}`);
    await supabase
      .from("documents")
      .update({ frag_status: "error", frag_error: msg.slice(0, 500) })
      .eq("id", doc.id);
    return true; // đã "xử lý" (dù lỗi) — tiếp tục document khác ở vòng sau
  } finally {
    if (tmpFile) {
      try {
        unlinkSync(tmpFile);
      } catch {}
    }
  }
}

/** Khởi động worker: chạy định kỳ, không chồng lượt (mỗi lượt xử lý đến khi hết việc). */
export function startConvertWorker() {
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    console.warn(
      "[convert-worker] Thiếu SUPABASE_URL/SERVICE_ROLE_KEY — worker convert TẮT."
    );
    return;
  }
  const supabase = createClient(url, key, {
    auth: { persistSession: false },
  });

  let running = false;
  const tick = async () => {
    if (running) return;
    running = true;
    try {
      // Xử lý liên tục đến khi hết việc trong lượt này.
      let did = true;
      while (did) did = await processOne(supabase);
    } catch (e) {
      console.error("[convert-worker] tick lỗi:", e?.message || e);
    } finally {
      running = false;
    }
  };

  // Mỗi 30s; có thể đổi qua CONVERT_CRON.
  cron.schedule(process.env.CONVERT_CRON || "*/30 * * * * *", tick);
  console.log("[convert-worker] đã bật (quét documents mỗi 30s).");
  tick(); // chạy ngay khi khởi động
}
