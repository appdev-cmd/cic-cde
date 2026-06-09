# US-BE-001 Supabase Schema & Data-Access Layer

## Status

in_progress

## Lane

high-risk

## Product Contract

Thiết lập lược đồ cơ sở dữ liệu PostgreSQL trên Supabase cho toàn bộ thực thể
của CDE CIC (projects, documents, approvals, clashes, activities, profiles,
project_members, bcf_topics, assets, maintenance_tickets), bật Row Level
Security, và tạo lớp truy cập dữ liệu phía client. Đây là nền tảng để thay thế
localStorage ở các sprint sau.

## Relevant Product Docs

- `Docs/ROADMAP.md` (Milestone 2)
- `Docs/decisions/0010-supabase-backend-mvp.md`
- `Docs/product/document-management.md`

## Acceptance Criteria

1. Migration tạo đầy đủ bảng, áp thành công lên project Supabase đã link.
2. RLS bật trên mọi bảng nghiệp vụ.
3. Seed dữ liệu mẫu (4 dự án + tài liệu/clash mẫu) chạy được.
4. Lớp `src/lib/api/` truy vấn được dữ liệu (đọc) từ Supabase.
5. `npm run lint` + `npm run build` xanh.

## Design Notes

- PK dùng uuid (gen_random_uuid) + cột `code` cho mã nghiệp vụ (ISO 19650, RFI...).
- `project_members` phục vụ RLS theo thành viên dự án.
- `profiles` tự tạo qua trigger khi có user mới (auth.users).
- RLS giai đoạn Sprint 1: cho authenticated đọc/ghi rộng (pilot); siết theo
  project_members ở Sprint 2 khi Auth được wiring.
- Áp migration qua `pg` (pooler URL + SUPABASE_DB_PASSWORD trong .env).

## Validation

| Layer | Expected proof |
| --- | --- |
| Unit | |
| Integration | Query thật trả về seed data |
| E2E | |
| Platform | lint + build xanh; migration áp thành công |

## Harness Delta

Tuân theo decision 0010. Có thể bổ sung decision về RLS model ở Sprint 2.

## Evidence

- Đang làm.
