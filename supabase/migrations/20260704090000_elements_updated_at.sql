-- ============================================================
-- Migration: Bổ sung updated_at cho bảng elements (P2.4 — hoàn thiện)
-- Date: 2026-07-04
-- Bảng elements (tạo ở 20260628040000_elements_fix.sql) là kho lưu thuộc tính
-- cấu kiện (Pset) độc lập với việc nạp mô hình. Bổ sung updated_at để biết
-- bản ghi được làm mới lần cuối khi nào (upsert lại khi người dùng chọn lại
-- cấu kiện sau khi mô hình có phiên bản mới).
-- ============================================================

alter table public.elements
  add column if not exists updated_at timestamptz not null default now();

-- Truy vấn tra cứu chính: theo (document_id, express_id) — đã có unique index
-- idx_elements_doc_express. Thêm index theo project + thời điểm cập nhật để
-- phục vụ dọn dẹp/cache-invalidation sau này.
create index if not exists idx_elements_project_updated
  on public.elements (project_id, updated_at desc);
