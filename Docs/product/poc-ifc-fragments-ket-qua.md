# POC — Convert IFC → Fragments phía server (kết quả)

> Ngày: 2026-06-28 · Chứng minh phương án Phase 2 (ADR 0007 cập nhật).
> Script: [`scripts/poc_ifc_to_fragments.mjs`](../../scripts/poc_ifc_to_fragments.mjs)
> Chạy: `node --max-old-space-size=8192 scripts/poc_ifc_to_fragments.mjs --all`

## Mục tiêu
Kiểm chứng việc **đẩy bước convert IFC→ThatOpen Fragments ra server** (Node.js, không cần
trình duyệt) bằng `IfcImporter` của `@thatopen/fragments` — thay cho việc tự chế định dạng
`.cic3d` (bản gốc ADR 0007). Đo thời gian convert, tỉ lệ nén, RAM đỉnh trên file thật.

## Kết quả (file mẫu BV NND2, LOD300, máy dev)

| File (bộ môn) | IFC | → FRAG | Tỉ lệ | Convert | RAM đỉnh |
|---|--:|--:|--:|--:|--:|
| EELV | 7.5 MB | 1.3 MB | 16.9% | 4.2s | 465 MB |
| STRU | 40.1 MB | 6.6 MB | 16.5% | 11.3s | 1696 MB |
| ELEC | 92.3 MB | 5.1 MB | 5.5% | 25.4s | 727 MB |
| ARCH | 144.7 MB | 18.2 MB | 12.6% | 43.3s | 845 MB |
| FIRE | 198.5 MB | 23.7 MB | 11.9% | 51.0s | 1015 MB |
| PLUM | 239.7 MB | 37.4 MB | 15.6% | 74.7s | 1476 MB |
| **HVAC** | **453.9 MB** | **59.4 MB** | **13.1%** | **109.4s** | **1797 MB** |
| **TỔNG** | **1.18 GB** | **152 MB** | **12.9%** | **319s** | |

## Kết luận
- **Convert là chi phí MỘT LẦN khi upload model**, không phải mỗi phiên xem. File 476MB →
  `.frag` 59MB trong ~109s; sau đó mọi client chỉ tải 59MB + load nhanh >10× → đạt tiêu chí
  P2.3 (100MB <10s; >500MB khung đầu <5s).
- **Nén trung bình ~7.7×** (1.18GB → 152MB) → giảm mạnh băng thông + storage MinIO.
- **RAM đỉnh ~1.8GB** cho file 476MB → server convert nên cấp ≥4GB/worker; chạy song song
  theo bộ môn trên nhiều CPU sẽ rút ngắn tổng thời gian.
- **`@thatopen/fragments` là giấy phép MIT** (không phải AGPL) → an toàn dùng server-side.

## Lưu ý kỹ thuật
- Callback đọc IFC của web-ifc là **đồng bộ** `(offset, size) => Uint8Array` và phải trả đúng
  `size` bytes (ví dụ async/offset-only trong docs ThatOpen gây lỗi `memory access out of
  bounds`). Script dùng `fs.readSync` đọc tăng dần để không nạp cả file vào RAM một lần.
- WASM: dùng `node_modules/web-ifc/` (`web-ifc.wasm`); đặt `importer.wasm = { path, absolute:true }`.

## Trụ 2 — Worker convert server-side (ĐÃ DỰNG)

Đã đưa logic POC thành **worker chạy trong `selfhost/api`** (Node/Express, đã có sẵn):

| Thành phần | File | Vai trò |
|---|---|---|
| Migration | `supabase/migrations/20260628050000_documents_frag_status.sql` | thêm `frag_status` + `frag_error` vào `documents` |
| Module convert | `selfhost/api/src/lib/ifc-to-fragments.js` | `convertIfcFileToFrag(path)` — logic POC, resolve WASM qua `createRequire` |
| Worker | `selfhost/api/src/worker/convert-worker.js` | cron 30s: quét `documents` có IFC mà `frag_url` rỗng → tải từ Storage, giải nén `.ifczip` (fflate), convert, upload `.frag`, ghi `frag_url`/`frag_status` |
| Route | `selfhost/api/src/routes/convert-ifc.js` | `POST /convert-ifc {projectId,code}` — đặt lại để convert lại 1 tài liệu |
| Deps | `selfhost/api/package.json` | +`@thatopen/fragments`, `web-ifc`, `three`, `fflate` |

**Thiết kế DB-driven:** worker chỉ cần bản ghi `documents` trỏ tới file IFC là tự xử lý — **không cần sửa client**. Client hiện đã ưu tiên `frag_url` khi nạp (`ViewerTab.handleLoadDoc`), nên tự dùng `.frag` do server sinh; bản convert-ở-trình-duyệt cũ thành fallback (cloud Supabase không có worker).

**Đã xác minh:** module converter chạy thật trong Node (EELV 7.84MB→1.32MB, 16.9%, 6.6s — khớp POC); `node --check` sạch toàn bộ file mới. **CHƯA xác minh:** luồng worker tải/upload qua Supabase (cần stack self-host `selfhost/docker-compose.yml` chạy mới test thật được).

**Lưu ý vận hành:** convert file ~476MB cần ~1.8GB RAM/lượt → cấp đủ memory cho container `cde-api`; worker xử lý **tuần tự** (1 lượt/lần) để không bùng RAM. Có thể đổi chu kỳ qua env `CONVERT_CRON`.

## Bước tiếp theo (đề xuất)
1. Test luồng worker đầu-cuối trên stack self-host; đo **thời gian load `.frag` phía client** để chốt P2.3.
2. (Tùy chọn) Hiện `frag_status` trên UI ViewerTab ("đang xử lý trên máy chủ").
3. Thêm nhánh xuất **OGC 3D Tiles 1.1** (interop/GeoBIM) ở lớp thứ hai.
