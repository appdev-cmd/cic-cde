// Convert IFC -> ThatOpen Fragments (.frag) phía server (Node).
// Dùng chung logic đã chứng minh ở scripts/poc_ifc_to_fragments.mjs.
//
// web-ifc gọi callback ĐỒNG BỘ (offset, size) => Uint8Array và phải trả đúng `size`
// bytes — đọc tăng dần bằng fs.readSync để không nạp cả file lớn (>400MB) vào RAM.

import { IfcImporter } from "@thatopen/fragments";
import { openSync, readSync, closeSync, statSync } from "node:fs";
import { dirname } from "node:path";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
// Thư mục chứa web-ifc.wasm (đi kèm package web-ifc) — robust theo mọi cwd/container.
const WASM_DIR = dirname(require.resolve("web-ifc")) + "/";

/**
 * Convert một file .ifc trên đĩa thành bytes .frag.
 * @param {string} ifcPath đường dẫn tới file .ifc (đã giải nén nếu trước đó là .ifczip)
 * @returns {Promise<{ bytes: Uint8Array, ifcSize: number, fragSize: number, ms: number }>}
 */
export async function convertIfcFileToFrag(ifcPath) {
  const ifcSize = statSync(ifcPath).size;

  const importer = new IfcImporter();
  importer.wasm = { path: WASM_DIR, absolute: true };
  // Giữ đủ thuộc tính + quan hệ để panel Pset/QTO ở client hoạt động.
  importer.includeUniqueAttributes = true;
  importer.includeRelationNames = true;

  const fd = openSync(ifcPath, "r");
  let scratch = Buffer.allocUnsafe(64 * 1024);

  const t0 = Date.now();
  let bytes;
  try {
    bytes = await importer.process({
      readFromCallback: true,
      readCallback: (offset, size) => {
        if (size > scratch.length) scratch = Buffer.allocUnsafe(size);
        const bytesRead = readSync(fd, scratch, 0, size, offset);
        return new Uint8Array(scratch.subarray(0, bytesRead));
      },
    });
  } finally {
    closeSync(fd);
  }

  return { bytes, ifcSize, fragSize: bytes.byteLength, ms: Date.now() - t0 };
}
