# CDE CIC — Development Roadmap (Lean Team)

Mô hình: AI-Conductor (Product owner + Claude). Backend: Supabase-first
(decision `Docs/decisions/0010-supabase-backend-mvp.md`).

Trạng thái hiện tại: Frontend prototype hoàn chỉnh (~6,800 dòng) với BIM viewer
thật, nhưng nhiều tính năng còn mock và toàn bộ dữ liệu nằm trong `localStorage`.
Supabase đã link nhưng chưa wiring.

**Quyết định thứ tự (2026-06-09):** Hoàn thiện FRONTEND trước (biến mock thành
thật ở mức client-side), SAU ĐÓ mới làm backend/database. Lý do: xác nhận đầy đủ
nghiệp vụ & UX trước khi bỏ công sức dựng backend.

Kết quả audit frontend chi tiết: xem phần "Audit" cuối file này.

---

## Milestone 1 — Hoàn thiện Frontend (client-side) ✅ CODE-COMPLETE

Mục tiêu: Biến các tính năng mock thành thật ở mức client-side, không phụ thuộc
backend. Tương ứng Phân hệ 1, 2, 3 (cốt lõi) + 6 (FM).

### Sprint 1 — Móng & AI thật ✅

- [x] Sửa lỗi typecheck `import.meta.env` (`src/vite-env.d.ts`) — `npm run lint` xanh.
- [x] **AI Assistant thật (Gemini)**: `src/lib/ai/gemini.ts`, DashboardTab chat +
      nút "Phân tích với AI" trong Viewer. Key lấy từ dự án qlda-ddcn-ht.
- [x] Fallback ngoại tuyến khi thiếu key. Đã verify gọi API thật.

### Sprint 2 — QTO bóc tách khối lượng từ IFC ✅

- [x] `extractQto()` đọc `Qto_*BaseQuantities` qua quan hệ IsDefinedBy (recursive).
- [x] Bảng QTO theo loại cấu kiện + export CSV.
- [x] Verified headless qua web-ifc trên file Duplex thật (422.05 m²).

### Sprint 3 — BCF export/import .bcfzip ✅

- [x] `src/lib/bcf/bcf.ts`: export/import BCF 2.1 qua jszip.
- [x] Nút Nhập/Xuất trong panel BCF của ViewerTab.
- [x] Verified zip round-trip headless (PASS).

### Sprint 4 — Workflow tài liệu đầy đủ ✅

- [x] Hoàn thiện 4 trạng thái: thêm Archive (S3), Gate 1 & Gate 2 rõ ràng.
- [x] Bump revision P→C01 khi xuất bản.

### Sprint 5 — Tab FM/COBie (Phân hệ 6) ✅

- [x] Tab FM: thiết bị theo COBie (Space/Type/Component).
- [x] QR code (qrcode.react), trang chi tiết thiết bị.
- [x] Phiếu bảo trì PM/CM với luồng trạng thái.

### Sprint 6 — Polish + Suitability codes ✅

- [x] Chuông thông báo (Bell): dropdown hoạt động gần đây thật.
- [x] Ô Search global: lọc tài liệu xuyên thư mục, tự chuyển tab Tài liệu.
- [x] Nút zoom header: điều khiển zoom viewer thật (lift viewerRef).
- [x] Suitability codes ISO 19650 (S0..S4/D1/D2/A1/B1/CR) + editor dropdown.

### Còn lại của Milestone 1

- [ ] Verify toàn bộ trên trình duyệt (Chrome MCP đang mất kết nối) — cần click test thực tế.

---

## Milestone 2 — Nền tảng Dữ liệu thật (Supabase) ⬅️ ĐANG LÀM

- [x] Schema PostgreSQL 10 bảng + RLS + seed (US-BE-001), áp lên project thật.
- [x] Lớp data-access `src/lib/api/` (projects, documents, clashes, approvals, activities, storage).
- [x] Supabase Storage: upload file thật + SHA-256, document upload persist vào Storage+DB.
- [x] App nạp projects + dữ liệu theo dự án từ Supabase (thay localStorage init).
- [x] **Auth**: Supabase email/password + login gate + đăng xuất + profile
      (US-BE-003, decision 0011). Autoconfirm bật cho pilot.
- [x] **RLS siết**: anon chỉ ĐỌC, GHI yêu cầu đăng nhập. Verify anon-write BỊ CHẶN ✅.
- [x] Write-through đầy đủ: documents, approvals, clashes, activities, BCF, FM. ✅
- [x] FM + BCF nạp dữ liệu từ Supabase (seed assets + bcf_topics).
- [x] Document upload → Storage thật + tạo row DB + hash SHA-256.
- [x] **Realtime activity log** (Supabase Realtime trên bảng activities). ✅
- [ ] Viewer load IFC từ Storage URL (đã có publicUrl, cần test browser).
- [ ] Verify toàn bộ trên trình duyệt (Chrome MCP đang mất kết nối).
- [ ] (Production) siết RLS theo project_members + tắt autoconfirm + VNeID SSO.

## Milestone 3 — Nâng cao 5D & GeoBIM thật

- 5D: CSDL định mức BXD (TT 12/2021), mapping engine QTO ↔ đơn giá.
- GeoBIM: 3D Tiles streaming thật (pipeline server), Cesium viewer.

## Milestone 4+ — Tự chủ hạ tầng (Giai đoạn 2, khi có vốn)

- Migrate Supabase → hạ tầng nội địa (Viettel/VNPT), QCVN 12.
- VNeID SSO + Keycloak. Go + Python services. Xem decision 0006, 0010.

---

## Audit Frontend (2026-06-09)

**Thật & hoạt động:** BIM Viewer đầy đủ (load IFC, spatial tree, lọc lớp,
clipping, đo, isolate, ghost, camera, properties); validate ISO 19650 (regex 7
trường); Gantt 4D + S-curve EVA + 4D link sang viewer; GeoBIM Leaflet +
VN2000→WGS84; Dashboard KPI; phê duyệt/clash; dark mode; project list.

**Mock/giả lập:** AI Assistant (if/else hardcoded, KHÔNG gọi Gemini dù deps đã
có); upload file (progress giả); 3D Tiles streaming (URL ảo, count hardcode);
import Primavera (mock); BCF (chỉ state, không export/import); 5D (chưa có định
mức/QTO); nút "Phân tích với AI" (stub).

**Thiếu hẳn:** FM/COBie (Phân hệ 6); workflow Gate 2 (Published/Archived); QTO
thật từ IFC; search/notifications chức năng; lỗi typecheck `import.meta.env`.

---

## Nguyên tắc làm việc

- Mỗi Sprint = một hoặc vài story trong `Docs/stories/`, theo harness task loop.
- `npm run lint` phải xanh trước khi đóng mỗi story.
- Quyết định kiến trúc/auth/data → ghi `Docs/decisions/` + harness CLI.
- Dữ liệu pilot trên Supabase là dữ liệu thử nghiệm, KHÔNG phải dữ liệu mật
  (chưa đạt QCVN 12 — xem decision 0010).
