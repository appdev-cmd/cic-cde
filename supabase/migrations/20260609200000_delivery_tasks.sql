-- CDE CIC — #7 Kế hoạch bàn giao thông tin (MIDP/TIDP) + nhiệm vụ (To-do)
create table if not exists public.delivery_tasks (
  id uuid primary key default gen_random_uuid(),
  project_id text references public.projects (id) on delete cascade,
  title text not null,             -- tên sản phẩm/thông tin cần bàn giao
  discipline text,                 -- bộ môn
  format text,                     -- định dạng (IFC/PDF/DWG/COBie...)
  milestone text,                  -- mốc bàn giao
  due_date date,                   -- thời hạn
  assignee text,                   -- người phụ trách
  status text default 'Chưa bắt đầu', -- Chưa bắt đầu | Đang làm | Hoàn thành
  linked_doc_code text,            -- liên kết tài liệu (mã ISO 19650)
  created_at timestamptz not null default now()
);
create index if not exists deltask_project_idx on public.delivery_tasks (project_id);

alter table public.delivery_tasks enable row level security;
drop policy if exists "read_all_delivery_tasks" on public.delivery_tasks;
create policy "read_all_delivery_tasks" on public.delivery_tasks for select using (true);
drop policy if exists "write_auth_delivery_tasks" on public.delivery_tasks;
create policy "write_auth_delivery_tasks" on public.delivery_tasks for all to authenticated using (true) with check (true);

-- Seed vài nhiệm vụ mẫu cho fpt-arch
insert into public.delivery_tasks (project_id, title, discipline, format, milestone, due_date, assignee, status) values
  ('fpt-arch','Mô hình kiến trúc LOD300','Kiến trúc','IFC','Thiết kế kỹ thuật','2026-07-15','ARC Studio','Đang làm'),
  ('fpt-arch','Mô hình kết cấu LOD300','Kết cấu','IFC','Thiết kế kỹ thuật','2026-07-20','STR Studio','Chưa bắt đầu'),
  ('fpt-arch','Bản vẽ phối hợp MEP','MEP','PDF','Phối hợp','2026-06-30','MEP Studio','Đang làm'),
  ('fpt-arch','Dữ liệu vận hành COBie','Phối hợp','COBie','Bàn giao','2026-09-01','BIM Team','Chưa bắt đầu')
on conflict do nothing;
