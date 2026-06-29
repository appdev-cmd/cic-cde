# Kế hoạch phát triển 4 trụ cột lõi — CDE CIC

> Phạm vi: tập trung 4 nhóm tính năng cơ bản phục vụ vận hành & thẩm định thực tế.
> Tài liệu này là **kế hoạch thực thi (implementation plan)**, bổ sung cho kế hoạch
> chiến lược tại `Docs/nghien-cuu-kha-thi/ke-hoach-phat-trien-cde-chi-tiet.md`.
>
> Ngày lập: 2026-06-28 · Trạng thái: Draft chờ duyệt

## 0. Bốn trụ cột & nguyên tắc thứ tự

| # | Trụ cột | Hiện trạng | Vai trò |
| --- | --- | --- | --- |
| TC1 | View BIM | 🟢 Đã mạnh | Gia cố + cấp dữ liệu cho TC2 |
| TC2 | Auto-check quy chuẩn (thẩm định) | 🔴 Chưa có | Giá trị nghiệp vụ cao nhất (xây mới) |
| TC3 | Quản lý hồ sơ tài liệu | 🟢 Tốt | Bổ sung lớp pháp lý (hash, audit, ký số) |
| TC4 | Phân quyền user + đơn vị tham gia | 🟡 Nửa vời | **Nền tảng an toàn — làm trước** |

**Thứ tự thực thi:** `TC4 → TC3 → TC2`, song song gia cố `TC1`.
Lý do: rule-check thẩm định (TC2) chỉ có ý nghĩa pháp lý khi quyền hạn (TC4) và
tính toàn vẹn hồ sơ (TC3) đã chặt chẽ.

---

## TC4 — Phân quyền user & đơn vị tham gia

### Vấn đề hiện tại
- `src/lib/roles.ts` có `canApprove/canPublish/canEdit` nhưng **chỉ chạy ở client** → có thể bị bypass.
- RLS (`20260609120000_tighten_rls_auth.sql`) chỉ phân biệt `anon` vs `authenticated`;
  **mọi user đăng nhập đều GHI được mọi dự án**.
- User tự đổi role ở Settings (`App.tsx` → `updateMyRole`) → tự nâng quyền "Manager".
- Hai mô hình dữ liệu tách rời:
  - `project_organizations` + `project_team` = danh bạ tự do (không gắn tài khoản).
  - `project_members` = liên kết `profiles` ↔ dự án (chưa dùng để chặn quyền).

### Mục tiêu
Phân quyền **thực thi tại tầng dữ liệu (RLS)** theo chuỗi: Đơn vị → Thành viên →
Tài khoản → Role theo từng dự án.

### Công việc
1. **Chuẩn hóa mô hình membership**
   - `project_members(project_id, user_id, role, organization_id)` là nguồn quyền duy nhất.
   - Liên kết `project_team`/`project_organizations` với `project_members` (thành viên có
     tài khoản thì trỏ `user_id`; chưa có thì vẫn là danh bạ).
   - Migration mới: thêm FK `organization_id`, chỉ mục, backfill dữ liệu cũ.
2. **Hàm RLS helper (SQL)**
   - `fn_project_role(project_id) returns text` — đọc role của `auth.uid()` trong dự án.
   - `fn_is_member(project_id) returns boolean`.
3. **Policy RLS theo role** (thay policy "authenticated full")
   - `documents`/`approvals`/`clashes`/`activities`/`viewpoints`/`bcf_*`:
     - SELECT: thành viên dự án.
     - INSERT/UPDATE WIP: `Author`+ trong dự án.
     - UPDATE trạng thái duyệt (Gate 1/2): `Checker/Approver/Manager`.
     - Publish/Archive: `Approver/Manager`.
   - Storage `cde-files`: ghi/xóa chỉ thành viên dự án tương ứng.
4. **Khóa tự đổi role**
   - Bỏ/ẩn selector role trong `App.tsx` Settings cho user thường.
   - Chỉ `Manager/Admin` gán role qua màn Team (`updateMemberRole`).
5. **UI Team gắn quyền thật**
   - `TeamTab`: mời thành viên (email) → tạo `project_members` có `user_id`; chọn đơn vị + role.
   - Hiển thị rõ ai có quyền duyệt/publish.

### Schema (migration mới)
```sql
alter table public.project_members
  add column if not exists organization_id uuid references public.project_organizations(id);

create or replace function public.fn_project_role(p_project text)
returns text language sql stable as $$
  select role from public.project_members
  where project_id = p_project and user_id = auth.uid() limit 1;
$$;
```

### Acceptance criteria
- User không phải thành viên dự án → không đọc/ghi được dữ liệu dự án (kiểm thử trực tiếp REST).
- `Author` không UPDATE được trạng thái `S1→S2` (RLS chặn, không chỉ UI).
- User thường không tự đổi được role của mình.
- Mỗi thành viên hiển thị đúng: đơn vị + role + quyền.

---

## TC3 — Quản lý hồ sơ tài liệu (lớp pháp lý)

### Hiện trạng
Đã tốt: WIP/Shared/Published/Archive, version (`document_versions`), suitability codes
(gồm `S3 - Phù hợp để thẩm định/bình duyệt`), CRUD qua `src/lib/api/documents.ts`.

### Công việc bổ sung
1. **SHA-256 chống giả mạo**
   - Tính hash khi upload (Web Crypto `crypto.subtle.digest`), lưu cột `file_hash`.
   - Hiển thị hash + nút "kiểm tra toàn vẹn" ở chi tiết tài liệu.
2. **Audit log bất biến (append-only)**
   - Bảng `audit_log(project_id, actor, action, entity, entity_id, hash_before, hash_after, at)`.
   - RLS: chỉ INSERT (không UPDATE/DELETE); trigger ghi tự động khi chuyển Gate/publish.
   - Màn xem lịch sử kiểm toán theo tài liệu/dự án.
3. **Chữ ký số (giai đoạn sau)**
   - Nhúng chữ ký số PDF (USB Token / ký số đám mây) tại bước publish; lưu chứng thư.

### Schema
```sql
alter table public.documents add column if not exists file_hash text;

create table if not exists public.audit_log (
  id uuid primary key default gen_random_uuid(),
  project_id text references public.projects(id) on delete cascade,
  actor text, action text, entity text, entity_id text,
  hash_before text, hash_after text,
  at timestamptz not null default now()
);
-- RLS: insert-only cho thành viên; cấm update/delete.
```

### Acceptance criteria
- Mỗi file upload có SHA-256; đổi file → hash đổi → cảnh báo.
- Mọi lần publish/chuyển Gate ghi 1 dòng audit không sửa/xóa được.
- Xuất được nhật ký kiểm toán (CSV/PDF) phục vụ thanh tra.

---

## TC2 — Auto-check quy chuẩn phục vụ thẩm định (xây mới)

### Ý tưởng
Bộ **rule engine khai báo** chạy trên thuộc tính cấu kiện BIM (đã trích được trong
viewer: `extractItemProperties`, `extractQto` tại `BimViewer.tsx`) đối chiếu với
checklist QCVN/TCVN + checklist thẩm định NĐ 217/2026 (đã có trong module Legal Documents).

### Kiến trúc
1. **Mô hình rule (JSON khai báo)** — versioned, lưu DB:
   ```jsonc
   {
     "id": "QCVN06-exit-width",
     "title": "Chiều rộng cửa thoát hiểm",
     "source": "QCVN 06:2022/BXD",
     "clause": "3.2.x",
     "appliesTo": { "ifcType": "IFCDOOR", "pset": "Pset_DoorCommon", "where": "IsExternal=true" },
     "assert": { "property": "Width", "op": ">=", "value": 1200, "unit": "mm" },
     "severity": "fail"
   }
   ```
2. **Engine client-side trước** (tận dụng viewer, không cần backend Python ngay):
   - Duyệt cấu kiện đang load → áp rule → kết quả `pass | warning | fail` + express IDs vi phạm.
   - Bộ rule khởi điểm (5–10 rule): chiều rộng cửa/cửa thoát hiểm, chiều cao tầng,
     đủ định danh cấu kiện (Name/Type/Material), khoảng cách PCCC cơ bản, level/storey hợp lệ.
3. **Báo cáo thẩm định**
   - Bảng kết quả theo điều khoản (source/clause), số cấu kiện đạt/không đạt.
   - Click dòng vi phạm → highlight cấu kiện trong viewer (đã có `highlightElements`).
   - Xuất PDF báo cáo (sản phẩm nộp hội đồng thẩm định).
4. **Giai đoạn 2 (server Python)**: rule hình học phức tạp (khoảng cách 3D, đường thoát
   nạn, diện tích) qua IfcOpenShell — nối vào kiến trúc Phân hệ 3 (B2G) của plan chiến lược.

### Schema
```sql
create table if not exists public.compliance_rules (
  id text primary key, title text, source text, clause text,
  definition jsonb not null, enabled boolean default true,
  version int default 1, updated_at timestamptz default now()
);
create table if not exists public.compliance_runs (
  id uuid primary key default gen_random_uuid(),
  project_id text references public.projects(id) on delete cascade,
  document_id text, ruleset_version int,
  summary jsonb,           -- {pass, warn, fail}
  created_by text, created_at timestamptz default now()
);
create table if not exists public.compliance_results (
  id uuid primary key default gen_random_uuid(),
  run_id uuid references public.compliance_runs(id) on delete cascade,
  rule_id text, status text,           -- pass|warning|fail
  express_ids int[], detail jsonb
);
```

### Acceptance criteria
- Nạp 1 mô hình IFC → chạy bộ rule khởi điểm → ra bảng đạt/không đạt theo điều khoản.
- Click vi phạm → cấu kiện được highlight trong viewer.
- Xuất được báo cáo thẩm định PDF có trích dẫn QCVN/TCVN.
- Rule khai báo qua JSON, thêm rule mới **không cần sửa code engine**.

---

## TC1 — View BIM (gia cố)

### Hiện trạng
🟢 `BimViewer.tsx` đã có: Fragments, clash detection, QTO, measurement, clipping,
isolate/hide, highlight, BCF (`IssuesPanel.tsx`, `lib/bcf/bcf.ts`).

### Công việc
1. Xác nhận **federation đa mô hình** (ghép IFC nhiều bộ môn cùng hệ tọa độ) hoạt động ổn.
2. Test hiệu năng file lớn (>100MB) + cache `.frag` (`document_frag`).
3. **Đảm bảo viewer cấp đủ thuộc tính** (Pset đầy đủ) cho rule engine TC2 — đây là phụ thuộc cứng.
4. (Sau) Pipeline streaming `.cic3d` — theo plan chiến lược, ngoài phạm vi đợt này.

### Acceptance criteria
- Ghép ≥2 mô hình bộ môn, bật/tắt từng mô hình.
- Engine TC2 đọc được Pset cần thiết từ cấu kiện đã load.

---

## Lộ trình & cột mốc

| Đợt | Nội dung | Ra mắt được gì | Trạng thái |
| --- | --- | --- | --- |
| **Đợt 1** | TC4 (RLS phân quyền + Team/đơn vị) | Pilot an toàn cho nhiều đơn vị | ✅ Code xong (chờ áp DB) |
| **Đợt 2** | TC3 (SHA-256 + audit log) | Hồ sơ đủ tin cậy pháp lý | ✅ Code xong (chờ áp DB) |
| **Đợt 3** | TC2 (rule engine + báo cáo thẩm định) + TC1 gia cố | Demo thẩm định tự động end-to-end | ⏳ Chờ tài liệu số hóa rule |
| **Đợt 4** | TC2 server Python + chữ ký số | Sẵn sàng tích hợp B2G | ⏳ |

> **Tiến độ 2026-06-28:** TC4 (Phase 1+2) và TC3 đã **áp lên Supabase production**
> (`shiqfawlgeintqsibqmk`) + kiểm chứng. TC1: federation đa mô hình + cache .frag
> đã có sẵn từ trước; bổ sung **trích Pset** (`extractPsets` trong BimViewer →
> panel thuộc tính hiển thị nhóm "Pset · …") làm nền cho TC2 — `tsc` + `vite build`
> sạch. Bộ rule khởi điểm cho TC2 tại `Docs/product/rules-kiem-tra-quy-chuan.md`
> (chờ chuyên gia rà soát ánh xạ BIM). Còn lại của TC1: QA hiệu năng file lớn (thủ công).
>
> **3 migration cần áp theo thứ tự:**
> `20260628000000_rbac_enforce` → `20260628010000_profiles_email_members_rbac` → `20260628020000_audit_log`.
> Trước khi áp: đặt 1 tài khoản super-admin (`profiles.role='Manager'`) trực tiếp trên DB.

## Phụ thuộc & rủi ro
- **TC2 phụ thuộc TC1**: chất lượng Pset trong IFC quyết định độ chính xác rule-check.
  Cần chuẩn hóa yêu cầu mô hình đầu vào (EIR/BEP) cho đơn vị thiết kế.
- **TC4 thay đổi RLS diện rộng** → cần bộ test REST kiểm chứng quyền trước khi áp production.
- Dữ liệu QCVN/TCVN cho rule cần chuyên gia nghiệp vụ rà soát (không tự suy diễn số liệu).

## Đề xuất bắt đầu
Khởi động **Đợt 1 (TC4)**: viết migration RLS + helper, cập nhật `roles.ts`/`TeamTab`,
kèm bộ test REST kiểm chứng quyền.
