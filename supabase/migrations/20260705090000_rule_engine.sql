-- ============================================================
-- Migration: Rule Engine kiểm tra mô hình (clash + clearance)
-- Date: 2026-07-05
-- Mục tiêu: Bộ rules mẫu theo tiêu chuẩn/quy chuẩn (preset, seed dữ liệu)
--   + rules riêng theo dự án (form no-code). Worker Python (scripts/rule-check-worker)
--   poll bảng check_runs theo pattern của converter-worker, ghi check_results.
-- Ghi chú: giá trị ngưỡng trong presets là THAM KHẢO — cần kiểm chứng theo văn bản gốc.
-- ============================================================

-- ---- 1. Bộ quy tắc (rule set) ----
create table if not exists public.rule_sets (
  id uuid primary key default gen_random_uuid(),
  project_id text references public.projects(id) on delete cascade, -- NULL = preset toàn cục
  name varchar(255) not null,
  description text,
  standard_ref varchar(120),          -- ví dụ 'QCVN 06:2022/BXD'
  is_preset boolean not null default false,
  created_by varchar(255),
  created_at timestamptz not null default timezone('utc', now())
);

-- ---- 2. Quy tắc ----
create table if not exists public.rules (
  id uuid primary key default gen_random_uuid(),
  rule_set_id uuid not null references public.rule_sets(id) on delete cascade,
  name varchar(255) not null,
  rule_type varchar(20) not null check (rule_type in ('clash','clearance')),
  -- params: {groupA:{categories[],propertyFilters[]}, groupB:{...}, condition, tolerance, minDistance}
  params jsonb not null default '{}'::jsonb,
  severity varchar(10) not null default 'medium' check (severity in ('low','medium','high','critical')),
  enabled boolean not null default true,
  sort_order integer not null default 0,
  created_at timestamptz not null default timezone('utc', now())
);
create index if not exists idx_rules_set on public.rules(rule_set_id);

-- ---- 3. Lượt chạy kiểm tra (hàng đợi cho worker) ----
create table if not exists public.check_runs (
  id uuid primary key default gen_random_uuid(),
  project_id text not null references public.projects(id) on delete cascade,
  rule_set_id uuid references public.rule_sets(id) on delete set null,
  document_codes text[] not null,     -- mã tài liệu (documents.code) của các mô hình cần kiểm
  status varchar(20) not null default 'pending'
    check (status in ('pending','processing','done','error')),
  progress integer not null default 0,          -- 0..100
  error_message text,
  summary jsonb,                                -- {violations, passes, skipped, byRule, modelBboxes}
  requested_by varchar(255),
  created_at timestamptz not null default timezone('utc', now()),
  started_at timestamptz,
  finished_at timestamptz
);
create index if not exists idx_check_runs_status on public.check_runs(status);
create index if not exists idx_check_runs_project on public.check_runs(project_id, created_at desc);

-- ---- 4. Kết quả kiểm tra ----
create table if not exists public.check_results (
  id uuid primary key default gen_random_uuid(),
  run_id uuid not null references public.check_runs(id) on delete cascade,
  rule_id uuid references public.rules(id) on delete set null,
  status varchar(12) not null default 'violation' check (status in ('violation','pass')),
  element_a jsonb not null,           -- {doc_code, guid, express_id, name, category}
  element_b jsonb,
  measured_value double precision,    -- độ xuyên (clash) hoặc khoảng cách nhỏ nhất (clearance), mét
  position double precision[],        -- [x,y,z] tọa độ world, mét
  details jsonb,
  created_at timestamptz not null default timezone('utc', now())
);
create index if not exists idx_check_results_run on public.check_results(run_id);

-- ---- RLS (đồng bộ chính sách MVP hiện hành: đọc mở, ghi authenticated + anon) ----
alter table public.rule_sets enable row level security;
alter table public.rules enable row level security;
alter table public.check_runs enable row level security;
alter table public.check_results enable row level security;

create policy "read_all_rule_sets" on public.rule_sets for select using (true);
create policy "write_auth_rule_sets" on public.rule_sets for all to authenticated using (true) with check (true);
create policy "write_anon_rule_sets" on public.rule_sets for all to anon using (true) with check (true);

create policy "read_all_rules" on public.rules for select using (true);
create policy "write_auth_rules" on public.rules for all to authenticated using (true) with check (true);
create policy "write_anon_rules" on public.rules for all to anon using (true) with check (true);

create policy "read_all_check_runs" on public.check_runs for select using (true);
create policy "write_auth_check_runs" on public.check_runs for all to authenticated using (true) with check (true);
create policy "write_anon_check_runs" on public.check_runs for all to anon using (true) with check (true);

create policy "read_all_check_results" on public.check_results for select using (true);
create policy "write_auth_check_results" on public.check_results for all to authenticated using (true) with check (true);
create policy "write_anon_check_results" on public.check_results for all to anon using (true) with check (true);

-- Realtime cho tiến độ run
do $$ begin
  alter publication supabase_realtime add table public.check_runs;
exception when duplicate_object then null; end $$;

-- ============================================================
-- SEED: 3 bộ quy tắc mẫu (preset) — giá trị THAM KHẢO
-- ============================================================

-- Preset 1: QCVN 06 — Khoảng cách an toàn PCCC
with rs as (
  insert into public.rule_sets (name, description, standard_ref, is_preset, created_by)
  values (
    'QCVN 06:2022/BXD — Khoảng cách an toàn PCCC',
    'Bộ quy tắc kiểm tra khoảng cách tối thiểu phục vụ an toàn cháy: lối thoát nạn, chiều cao thông thủy cầu thang, khoảng hở hệ thống chữa cháy. (Giá trị tham khảo — cần kiểm chứng theo văn bản gốc)',
    'QCVN 06:2022/BXD', true, 'CDE CIC'
  ) returning id
)
insert into public.rules (rule_set_id, name, rule_type, params, severity, sort_order)
select rs.id, r.name, r.rule_type, r.params::jsonb, r.severity, r.sort_order from rs, (values
  ('Bề rộng thông thủy lối thoát nạn — cửa ↔ tường đối diện ≥ 1,2m', 'clearance',
   '{"groupA":{"categories":["IFCDOOR"],"propertyFilters":[]},"groupB":{"categories":["IFCWALL","IFCWALLSTANDARDCASE"],"propertyFilters":[]},"condition":"min_distance","minDistance":1.2}',
   'high', 1),
  ('Chiều cao thông thủy cầu thang — bậc thang ↔ sàn/dầm phía trên ≥ 2,0m', 'clearance',
   '{"groupA":{"categories":["IFCSTAIRFLIGHT","IFCSTAIR"],"propertyFilters":[]},"groupB":{"categories":["IFCSLAB","IFCBEAM"],"propertyFilters":[]},"condition":"min_distance","minDistance":2.0}',
   'high', 2),
  ('Khoảng hở ống chữa cháy ↔ kết cấu sàn ≥ 0,5m', 'clearance',
   '{"groupA":{"categories":["IFCPIPESEGMENT"],"propertyFilters":[{"pset":"Pset_PipeSegmentCommon","name":"SystemType","op":"contains","value":"Fire"}]},"groupB":{"categories":["IFCSLAB"],"propertyFilters":[]},"condition":"min_distance","minDistance":0.5}',
   'medium', 3)
) as r(name, rule_type, params, severity, sort_order);

-- Preset 2: Va chạm cứng liên bộ môn MEP / Kết cấu
with rs as (
  insert into public.rule_sets (name, description, standard_ref, is_preset, created_by)
  values (
    'Phối hợp liên bộ môn — Va chạm cứng MEP/Kết cấu',
    'Phát hiện giao cắt hình học giữa hệ MEP (ống nước, ống gió, máng cáp) và kết cấu chịu lực (dầm, cột, sàn, tường). Theo thực hành phối hợp BIM ISO 19650. (Giá trị tham khảo — cần kiểm chứng theo văn bản gốc)',
    'ISO 19650 / BEP', true, 'CDE CIC'
  ) returning id
)
insert into public.rules (rule_set_id, name, rule_type, params, severity, sort_order)
select rs.id, r.name, r.rule_type, r.params::jsonb, r.severity, r.sort_order from rs, (values
  ('Ống nước/ống gió xuyên kết cấu (dầm, cột, sàn, tường)', 'clash',
   '{"groupA":{"categories":["IFCPIPESEGMENT","IFCPIPEFITTING","IFCDUCTSEGMENT","IFCDUCTFITTING"],"propertyFilters":[]},"groupB":{"categories":["IFCBEAM","IFCCOLUMN","IFCSLAB","IFCWALL","IFCWALLSTANDARDCASE"],"propertyFilters":[]},"condition":"intersect","tolerance":0.01}',
   'high', 1),
  ('Máng cáp điện giao cắt hệ ống nước', 'clash',
   '{"groupA":{"categories":["IFCCABLECARRIERSEGMENT","IFCCABLECARRIERFITTING"],"propertyFilters":[]},"groupB":{"categories":["IFCPIPESEGMENT","IFCPIPEFITTING"],"propertyFilters":[]},"condition":"intersect","tolerance":0.01}',
   'medium', 2)
) as r(name, rule_type, params, severity, sort_order);

-- Preset 3: Thông thủy cơ bản
with rs as (
  insert into public.rule_sets (name, description, standard_ref, is_preset, created_by)
  values (
    'Thông thủy cơ bản — Kiến trúc & Cơ điện',
    'Kiểm tra khoảng thông thủy cơ bản trong thiết kế kiến trúc và lắp đặt cơ điện. (Giá trị tham khảo — cần kiểm chứng theo văn bản gốc)',
    'TCVN / Thực hành thiết kế', true, 'CDE CIC'
  ) returning id
)
insert into public.rules (rule_set_id, name, rule_type, params, severity, sort_order)
select rs.id, r.name, r.rule_type, r.params::jsonb, r.severity, r.sort_order from rs, (values
  ('Khoảng cách cửa đi ↔ cột ≥ 0,9m', 'clearance',
   '{"groupA":{"categories":["IFCDOOR"],"propertyFilters":[]},"groupB":{"categories":["IFCCOLUMN"],"propertyFilters":[]},"condition":"min_distance","minDistance":0.9}',
   'low', 1),
  ('Khoảng hở ống gió ↔ trần/sàn ≥ 0,3m (không gian bảo trì)', 'clearance',
   '{"groupA":{"categories":["IFCDUCTSEGMENT"],"propertyFilters":[]},"groupB":{"categories":["IFCSLAB","IFCCOVERING"],"propertyFilters":[]},"condition":"min_distance","minDistance":0.3}',
   'low', 2)
) as r(name, rule_type, params, severity, sort_order);
