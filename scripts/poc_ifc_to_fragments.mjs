// POC — Convert IFC -> ThatOpen Fragments (.frag) phía SERVER (Node.js)
//
// Mục tiêu: chứng minh phương án Phase 2 trong ADR 0007 (cập nhật 2026-06-28):
//   đẩy bước convert IFC->Fragments ra server thay vì làm trong trình duyệt.
// Đo: thời gian convert, kích thước .frag vs IFC (tỉ lệ nén), RAM đỉnh.
//
// Dùng:
//   node scripts/poc_ifc_to_fragments.mjs <file.ifc> [file2.ifc ...]
//   node scripts/poc_ifc_to_fragments.mjs --all     # quét thư mục IFC mẫu
//
// readCallback (đọc tăng dần 64KB) để không nạp cả file 476MB vào RAM cùng lúc.

import { IfcImporter } from "@thatopen/fragments";
import { stat, writeFile, readdir } from "node:fs/promises";
import { openSync, readSync, closeSync } from "node:fs";
import { resolve, basename, join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, "..");
const SAMPLE_DIR = join(
  ROOT,
  "resources/25120-BVNND2_TrinhThamDinh-LOD300/IFC",
);
// Thư mục WASM của web-ifc (bản node). IfcImporter cần web-ifc.wasm tại đây.
const WASM_DIR = join(ROOT, "node_modules/web-ifc/") + "/";
const OUT_DIR =
  process.env.FRAG_OUT_DIR ||
  join(ROOT, "scripts", ".poc-out");

const fmtMB = (b) => (b / 1024 / 1024).toFixed(1) + " MB";
const fmtS = (ms) => (ms / 1000).toFixed(1) + "s";

async function convertOne(ifcPath) {
  const abs = resolve(ifcPath);
  const { size: ifcSize } = await stat(abs);
  const name = basename(abs);

  const importer = new IfcImporter();
  importer.wasm = { path: WASM_DIR, absolute: true };
  // Giữ đủ thuộc tính + quan hệ để panel Pset/QTO hoạt động (giống client hiện tại).
  importer.includeUniqueAttributes = true;
  importer.includeRelationNames = true;

  // web-ifc gọi callback ĐỒNG BỘ: (offset, size) => Uint8Array, phải trả đúng `size` bytes.
  const fd = openSync(abs, "r");
  let scratch = Buffer.allocUnsafe(64 * 1024); // tái dùng, tự lớn theo `size`

  const t0 = performance.now();
  let fragBytes;
  try {
    fragBytes = await importer.process({
      readFromCallback: true,
      readCallback: (offset, size) => {
        if (size > scratch.length) scratch = Buffer.allocUnsafe(size);
        const bytesRead = readSync(fd, scratch, 0, size, offset);
        // copy ra mảng riêng vì scratch sẽ bị ghi đè ở lần gọi sau
        return new Uint8Array(scratch.subarray(0, bytesRead));
      },
    });
  } finally {
    closeSync(fd);
  }
  const elapsed = performance.now() - t0;

  const outPath = join(OUT_DIR, name.replace(/\.ifc$/i, "") + ".frag");
  await writeFile(outPath, fragBytes);

  const ratio = ((fragBytes.byteLength / ifcSize) * 100).toFixed(1);
  const peakRss = process.memoryUsage().rss;
  return {
    name,
    ifcSize,
    fragSize: fragBytes.byteLength,
    ratio,
    elapsed,
    peakRss,
    outPath,
  };
}

async function resolveTargets() {
  const args = process.argv.slice(2);
  if (args.includes("--all")) {
    const files = await readdir(SAMPLE_DIR);
    return files
      .filter((f) => /\.ifc$/i.test(f))
      .map((f) => join(SAMPLE_DIR, f))
      // nhỏ -> lớn để thấy file lớn fail sớm nếu có
      .sort();
  }
  if (args.length) return args;
  console.error(
    "Cần truyền file .ifc hoặc --all. Vd: node scripts/poc_ifc_to_fragments.mjs --all",
  );
  process.exit(1);
}

async function main() {
  const { mkdir } = await import("node:fs/promises");
  await mkdir(OUT_DIR, { recursive: true });

  const targets = await resolveTargets();
  console.log(`POC IFC->Fragments | ${targets.length} file | out: ${OUT_DIR}\n`);
  console.log(
    "file".padEnd(34),
    "IFC".padStart(9),
    "FRAG".padStart(9),
    "tỉ lệ".padStart(7),
    "thời gian".padStart(10),
    "RSS đỉnh".padStart(10),
  );
  console.log("-".repeat(84));

  const results = [];
  for (const t of targets) {
    try {
      const r = await convertOne(t);
      results.push(r);
      console.log(
        r.name.padEnd(34),
        fmtMB(r.ifcSize).padStart(9),
        fmtMB(r.fragSize).padStart(9),
        (r.ratio + "%").padStart(7),
        fmtS(r.elapsed).padStart(10),
        fmtMB(r.peakRss).padStart(10),
      );
    } catch (err) {
      console.log(
        basename(t).padEnd(34),
        "LỖI:".padStart(9),
        (err?.message || String(err)).slice(0, 60),
      );
    }
  }

  if (results.length) {
    const totIfc = results.reduce((s, r) => s + r.ifcSize, 0);
    const totFrag = results.reduce((s, r) => s + r.fragSize, 0);
    const totT = results.reduce((s, r) => s + r.elapsed, 0);
    console.log("-".repeat(84));
    console.log(
      "TỔNG".padEnd(34),
      fmtMB(totIfc).padStart(9),
      fmtMB(totFrag).padStart(9),
      (((totFrag / totIfc) * 100).toFixed(1) + "%").padStart(7),
      fmtS(totT).padStart(10),
    );
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
