-- ============================================================
-- Migration: Bảng elements (lưu thuộc tính cấu kiện) — bản sửa (P2.4)
-- Date: 2026-06-28
-- Lý do: migration 20260626000000 không áp được do FK sai kiểu
--   (project_id uuid REFERENCES projects(id) trong khi projects.id là TEXT;
--    document_id uuid trong khi viewer dùng MÃ ISO 19650 dạng text).
--   Tạo lại bảng với kiểu TEXT khớp app: document_id = mã ISO, project_id = text.
-- ============================================================

create table if not exists public.elements (
  id          uuid primary key default gen_random_uuid(),
  project_id  text,
  document_id text not null,     -- mã ISO 19650 của tài liệu/mô hình (khớp viewer modelId)
  express_id  integer not null,
  global_id   text,
  name        text,
  category    text,
  properties  jsonb not null default '{}'::jsonb,
  created_at  timestamptz not null default now()
);
create unique index if not exists idx_elements_doc_express on public.elements (document_id, express_id);
create index if not exists idx_elements_project on public.elements (project_id);
create index if not exists idx_elements_props on public.elements using gin (properties);

alter table public.elements enable row level security;
drop policy if exists "read_all_elements" on public.elements;
create policy "read_all_elements" on public.elements for select using (true);
drop policy if exists "write_auth_elements" on public.elements;
create policy "write_auth_elements" on public.elements for all to authenticated using (true) with check (true);
