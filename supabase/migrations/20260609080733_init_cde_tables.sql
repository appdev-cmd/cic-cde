-- CDE CIC — Initial schema (Milestone 2, US-BE-001)
-- Lược đồ PostgreSQL cho toàn bộ thực thể nghiệp vụ + RLS + seed.
-- PK dùng uuid; cột `code` giữ mã nghiệp vụ (ISO 19650, RFI, mã tài sản...).

-- ============================================================
-- PROFILES (mở rộng auth.users)
-- ============================================================
create table if not exists public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  full_name text,
  role text not null default 'Architect',
  created_at timestamptz not null default now()
);

-- Tự tạo profile khi có user mới
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  insert into public.profiles (id, full_name, role)
  values (new.id, coalesce(new.raw_user_meta_data->>'full_name', new.email), 'Architect')
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ============================================================
-- PROJECTS
-- ============================================================
create table if not exists public.projects (
  id text primary key,
  name text not null,
  location text,
  status text,
  client text,
  description text,
  documents_count integer default 0,
  approval_percent numeric default 0,
  spending_actual numeric default 0,
  clashes_count integer default 0,
  progress integer default 0,
  start_date text,
  created_at timestamptz not null default now(),
  created_by uuid references auth.users (id) on delete set null
);

-- Thành viên dự án (phục vụ RLS theo membership ở Sprint 2)
create table if not exists public.project_members (
  project_id text references public.projects (id) on delete cascade,
  user_id uuid references auth.users (id) on delete cascade,
  role text not null default 'member',
  created_at timestamptz not null default now(),
  primary key (project_id, user_id)
);

-- ============================================================
-- DOCUMENTS (ISO 19650)
-- ============================================================
create table if not exists public.documents (
  id uuid primary key default gen_random_uuid(),
  project_id text references public.projects (id) on delete cascade,
  code text not null,
  name text not null,
  folder text not null default '01_WIP',
  sub_folder text,
  status text not null default 'S0 - WIP',
  suitability_code text,
  revision text default 'P01',
  version text default 'V1',
  size text,
  creator text,
  classification text,
  volume text,
  file_type text default 'pdf',
  file_url text,
  hash_sha256 text,
  modified_date timestamptz not null default now(),
  created_at timestamptz not null default now(),
  created_by uuid references auth.users (id) on delete set null
);
create index if not exists documents_project_idx on public.documents (project_id);
create index if not exists documents_code_idx on public.documents (code);

-- ============================================================
-- APPROVALS (RFI / Submittal)
-- ============================================================
create table if not exists public.approvals (
  id uuid primary key default gen_random_uuid(),
  project_id text references public.projects (id) on delete cascade,
  code text not null,
  type text,
  deadline text,
  requester text,
  description text,
  file text,
  document_id uuid references public.documents (id) on delete set null,
  created_date date default current_date,
  created_at timestamptz not null default now()
);
create index if not exists approvals_project_idx on public.approvals (project_id);

-- ============================================================
-- CLASHES
-- ============================================================
create table if not exists public.clashes (
  id uuid primary key default gen_random_uuid(),
  project_id text references public.projects (id) on delete cascade,
  code text not null,
  elements text,
  discipline text,
  severity text,
  status text default 'Chưa xử lý',
  description text,
  created_at timestamptz not null default now()
);
create index if not exists clashes_project_idx on public.clashes (project_id);

-- ============================================================
-- ACTIVITIES (nhật ký hoạt động)
-- ============================================================
create table if not exists public.activities (
  id uuid primary key default gen_random_uuid(),
  project_id text references public.projects (id) on delete cascade,
  user_name text,
  action text,
  target text,
  activity_type text default 'system',
  created_at timestamptz not null default now()
);
create index if not exists activities_project_idx on public.activities (project_id);

-- ============================================================
-- BCF TOPICS
-- ============================================================
create table if not exists public.bcf_topics (
  id uuid primary key default gen_random_uuid(),
  project_id text references public.projects (id) on delete cascade,
  title text not null,
  description text,
  status text default 'Open',
  priority text default 'Medium',
  assigned_to text,
  linked_element_guid text,
  linked_element_express_id integer,
  created_at timestamptz not null default now()
);
create index if not exists bcf_project_idx on public.bcf_topics (project_id);

-- ============================================================
-- ASSETS (FM / COBie) + maintenance tickets
-- ============================================================
create table if not exists public.assets (
  id uuid primary key default gen_random_uuid(),
  project_id text references public.projects (id) on delete cascade,
  code text not null,
  name text not null,
  space text,
  type text,
  manufacturer text,
  model text,
  capacity text,
  install_date date,
  warranty_until date,
  maintenance_cycle text,
  status text default 'Hoạt động',
  created_at timestamptz not null default now()
);
create index if not exists assets_project_idx on public.assets (project_id);

create table if not exists public.maintenance_tickets (
  id uuid primary key default gen_random_uuid(),
  asset_id uuid references public.assets (id) on delete cascade,
  code text not null,
  ticket_type text default 'CM',
  title text,
  status text default 'Mới',
  ticket_date date default current_date,
  technician text,
  created_at timestamptz not null default now()
);
create index if not exists tickets_asset_idx on public.maintenance_tickets (asset_id);

-- ============================================================
-- ROW LEVEL SECURITY
-- Sprint 1 (pilot): authenticated đọc/ghi; anon chỉ đọc (để app chạy trước khi
-- wiring Auth). Sẽ siết theo project_members ở Sprint 2 (US-BE-002).
-- ============================================================
do $$
declare t text;
begin
  foreach t in array array[
    'profiles','projects','project_members','documents','approvals',
    'clashes','activities','bcf_topics','assets','maintenance_tickets'
  ]
  loop
    execute format('alter table public.%I enable row level security;', t);
    execute format('drop policy if exists "read_all_%1$s" on public.%1$I;', t);
    execute format('create policy "read_all_%1$s" on public.%1$I for select using (true);', t);
    execute format('drop policy if exists "write_auth_%1$s" on public.%1$I;', t);
    execute format('create policy "write_auth_%1$s" on public.%1$I for all to authenticated using (true) with check (true);', t);
  end loop;
end $$;

-- ============================================================
-- SEED — 4 dự án mẫu
-- ============================================================
insert into public.projects (id, name, location, status, client, description, documents_count, approval_percent, spending_actual, clashes_count, progress, start_date)
values
  ('fpt-arch','FPT Arch Tower','Khu công nghệ cao Hòa Lạc, Hà Nội','Thi công','FPT Group','Tháp văn phòng tích hợp trung tâm nghiên cứu AI.',1248,84,82.1,5,72,'01/2025'),
  ('complex-a','Dự án Tòa nhà Complex A','Quận 1, TP. Hồ Chí Minh','Thi công ngầm','Complex Land','Tòa nhà hỗn hợp 45 tầng với 5 tầng hầm.',512,76,45.0,12,35,'08/2025'),
  ('fpt-uni','FPT University Campus','Khu công nghệ cao Hòa Lạc, Hà Nội','Đang hoàn thiện','FPT Education','Giảng đường H4, H5 kiến trúc xanh.',840,90,120.0,3,92,'03/2024'),
  ('vp-hang-a','Tòa nhà VP Hạng A - Quận 1','Quận 1, TP. Hồ Chí Minh','Chuẩn bị','Vanguard Holdings','Văn phòng Hạng A đạt LEED Gold.',320,92,10.4,0,8,'12/2025')
on conflict (id) do nothing;

-- Seed một vài tài liệu & clash mẫu cho dự án fpt-arch
insert into public.documents (project_id, code, name, folder, sub_folder, status, suitability_code, revision, version, size, creator, classification, volume, file_type, file_url)
values
  ('fpt-arch','PRJ-ARC-Z01-ZZ-M3-A-0001','Mặt bằng Tầng 1 - Cập nhật MEP','02_SHARED','Bản vẽ thiết kế','S1 - SHARED','S1','P02.01','V3','1.4 MB','ARC Studio','EF_20_10','Z01 - Zone 1','pdf',null),
  ('fpt-arch','PRJ-STR-Z01-ZZ-M3-S-0023','Chi tiết cấu tạo cột C1','01_WIP','Bản vẽ thiết kế','S0 - WIP','S0','P01','V1','2.1 MB','STR Studio','EF_20_10','Z01 - Zone 1','pdf',null),
  ('fpt-arch','PRJ-ALL-Z00-ZZ-M3-W-0001','Mô hình Liên kết Kiến trúc - Kết cấu','02_SHARED','Mô hình phối hợp','S1 - SHARED','S1','P02','V2','3.5 MB','BIM Team','EF_55_20','Z00 - All Zones','ifc','https://thatopen.github.io/engine_ui-components/resources/small.ifc')
on conflict do nothing;

insert into public.clashes (project_id, code, elements, discipline, severity, status, description)
values
  ('fpt-arch','CL-01','Dầm trục 3-C với Ống gió tầng 2','ST-MEP','Cao','Chưa xử lý','Ống cấp khí tươi chính xuyên qua dầm kết cấu trục C.'),
  ('fpt-arch','CL-02','Cột bê tông tầng 1 với Cáp cứu hỏa','ST-MEP','Cao','Chưa xử lý','Đường cáp động lực phòng cháy đi xuyên khối thép chờ cột.')
on conflict do nothing;
