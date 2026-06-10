-- CDE CIC — Đơn vị & Thành viên tham gia dự án

-- Đơn vị (tổ chức) tham gia
create table if not exists public.project_organizations (
  id uuid primary key default gen_random_uuid(),
  project_id text references public.projects (id) on delete cascade,
  name text not null,
  role text,            -- vai trò đơn vị: Chủ đầu tư / Tư vấn thiết kế / Nhà thầu / Tư vấn giám sát / BIM
  discipline text,      -- bộ môn phụ trách
  contact_person text,
  contact_email text,
  created_at timestamptz not null default now()
);
create index if not exists proj_org_idx on public.project_organizations (project_id);

-- Thành viên (nhân sự) tham gia — danh bạ tự do (không bắt buộc có tài khoản)
create table if not exists public.project_team (
  id uuid primary key default gen_random_uuid(),
  project_id text references public.projects (id) on delete cascade,
  name text not null,
  email text,
  role text default 'Author',   -- vai trò CDE
  organization text,            -- đơn vị
  discipline text,
  created_at timestamptz not null default now()
);
create index if not exists proj_team_idx on public.project_team (project_id);

do $$
declare t text;
begin
  foreach t in array array['project_organizations','project_team'] loop
    execute format('alter table public.%I enable row level security;', t);
    execute format('drop policy if exists "read_all_%1$s" on public.%1$I;', t);
    execute format('create policy "read_all_%1$s" on public.%1$I for select using (true);', t);
    execute format('drop policy if exists "write_auth_%1$s" on public.%1$I;', t);
    execute format('create policy "write_auth_%1$s" on public.%1$I for all to authenticated using (true) with check (true);', t);
  end loop;
end $$;

-- Seed cho fpt-arch
insert into public.project_organizations (project_id, name, role, discipline, contact_person) values
  ('fpt-arch','FPT Group','Chủ đầu tư','—','Ban QLDA FPT'),
  ('fpt-arch','ARC Studio','Tư vấn thiết kế','Kiến trúc','KTS. Lê Minh Hoàng'),
  ('fpt-arch','STR Studio','Tư vấn thiết kế','Kết cấu','KS. Nguyễn Văn Hải'),
  ('fpt-arch','MEP Studio','Tư vấn thiết kế','MEP','KS. Vũ Quốc Huy'),
  ('fpt-arch','CIC BIM Team','Điều phối BIM','Phối hợp','BIM Manager')
on conflict do nothing;

insert into public.project_team (project_id, name, email, role, organization, discipline) values
  ('fpt-arch','Lê Minh Hoàng','hoang.lm@arc.vn','Author','ARC Studio','Kiến trúc'),
  ('fpt-arch','Nguyễn Văn Hải','hai.nv@str.vn','Checker','STR Studio','Kết cấu'),
  ('fpt-arch','Vũ Quốc Huy','huy.vq@mep.vn','Author','MEP Studio','MEP'),
  ('fpt-arch','Trần Thu Thảo','thao.tt@cic.vn','Approver','CIC BIM Team','Phối hợp')
on conflict do nothing;
