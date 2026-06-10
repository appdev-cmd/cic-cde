-- CDE CIC — Lịch sử phiên bản tài liệu (#4 ISO 19650)
create table if not exists public.document_versions (
  id uuid primary key default gen_random_uuid(),
  project_id text references public.projects (id) on delete cascade,
  code text not null,              -- mã tài liệu (ISO 19650)
  revision text,
  version text,
  status text,
  folder text,
  file_url text,
  size text,
  hash_sha256 text,
  change_type text default 'update', -- upload | status | revision | rename
  changed_by text,
  created_at timestamptz not null default now()
);
create index if not exists docver_project_code_idx on public.document_versions (project_id, code);

alter table public.document_versions enable row level security;
drop policy if exists "read_all_document_versions" on public.document_versions;
create policy "read_all_document_versions" on public.document_versions for select using (true);
drop policy if exists "write_auth_document_versions" on public.document_versions;
create policy "write_auth_document_versions" on public.document_versions for all to authenticated using (true) with check (true);
