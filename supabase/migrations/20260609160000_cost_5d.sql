-- CDE CIC — Phân hệ 5D: CSDL định mức/đơn giá + bảng dự toán (BOQ)

-- Danh mục định mức/đơn giá (dùng chung, không theo dự án) — TT 12/2021/TT-BXD...
create table if not exists public.cost_norms (
  id uuid primary key default gen_random_uuid(),
  code text not null,              -- mã hiệu định mức (vd AE.11112)
  name text not null,              -- tên công tác
  unit text not null default 'm3', -- đơn vị (m3, m2, kg, công, ca...)
  material_cost numeric default 0, -- đơn giá vật liệu
  labor_cost numeric default 0,    -- đơn giá nhân công
  machine_cost numeric default 0,  -- đơn giá máy thi công
  created_at timestamptz not null default now()
);
create index if not exists cost_norms_code_idx on public.cost_norms (code);

-- Bảng dự toán theo dự án (BOQ) — mỗi dòng = công tác + khối lượng
create table if not exists public.boq_items (
  id uuid primary key default gen_random_uuid(),
  project_id text references public.projects (id) on delete cascade,
  norm_code text,                  -- tham chiếu mã định mức
  name text not null,              -- tên công tác (snapshot)
  unit text not null default 'm3',
  quantity numeric default 0,      -- khối lượng (từ QTO hoặc nhập tay)
  material_unit numeric default 0, -- đơn giá VL (snapshot)
  labor_unit numeric default 0,    -- đơn giá NC (snapshot)
  machine_unit numeric default 0,  -- đơn giá MTC (snapshot)
  ifc_category text,               -- lớp IFC liên kết (nếu lấy KL từ QTO)
  created_at timestamptz not null default now()
);
create index if not exists boq_project_idx on public.boq_items (project_id);

-- RLS: đọc công khai, ghi yêu cầu đăng nhập
do $$
declare t text;
begin
  foreach t in array array['cost_norms','boq_items'] loop
    execute format('alter table public.%I enable row level security;', t);
    execute format('drop policy if exists "read_all_%1$s" on public.%1$I;', t);
    execute format('create policy "read_all_%1$s" on public.%1$I for select using (true);', t);
    execute format('drop policy if exists "write_auth_%1$s" on public.%1$I;', t);
    execute format('create policy "write_auth_%1$s" on public.%1$I for all to authenticated using (true) with check (true);', t);
  end loop;
end $$;

-- Seed vài mã định mức mẫu (đại diện) — bạn import file thật để thay/bổ sung
insert into public.cost_norms (code, name, unit, material_cost, labor_cost, machine_cost) values
  ('AF.11110','Bê tông móng đá 1x2 mác 250','m3', 1150000, 180000, 95000),
  ('AF.12110','Bê tông cột đá 1x2 mác 300','m3', 1280000, 320000, 110000),
  ('AF.13110','Bê tông dầm, sàn đá 1x2 mác 300','m3', 1280000, 290000, 105000),
  ('AE.11112','Xây tường gạch không nung dày <=110mm','m3', 1450000, 410000, 25000),
  ('AK.21110','Trát tường trong, vữa XM mác 75','m2', 38000, 62000, 4000),
  ('AF.61110','Sản xuất lắp dựng cốt thép cột','kg', 18500, 4200, 1200),
  ('BB.12101','Lắp đặt ống nhựa PVC D90','m', 95000, 38000, 0)
on conflict do nothing;
