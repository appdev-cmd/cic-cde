-- CDE CIC — Bảng Viewpoints (góc nhìn đã lưu) cho điều phối BIM
create table if not exists public.viewpoints (
  id uuid primary key default gen_random_uuid(),
  project_id text references public.projects (id) on delete cascade,
  name text not null,
  camera jsonb not null,          -- {position:[x,y,z], target:[x,y,z]}
  hidden_models jsonb,            -- mảng id model đang ẩn
  recentered boolean default false,
  screenshot text,                -- data URL (tùy chọn)
  created_by_name text,
  created_at timestamptz not null default now()
);
create index if not exists viewpoints_project_idx on public.viewpoints (project_id);

alter table public.viewpoints enable row level security;
drop policy if exists "read_all_viewpoints" on public.viewpoints;
create policy "read_all_viewpoints" on public.viewpoints for select using (true);
drop policy if exists "write_auth_viewpoints" on public.viewpoints;
create policy "write_auth_viewpoints" on public.viewpoints for all to authenticated using (true) with check (true);
