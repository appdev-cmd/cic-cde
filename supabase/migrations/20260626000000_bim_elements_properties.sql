-- CDE CIC — Bảng lưu trữ cấu kiện và thuộc tính BIM từ tệp IFC để khai thác thông tin nâng cao
CREATE TABLE IF NOT EXISTS public.elements (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id uuid REFERENCES public.projects(id) ON DELETE CASCADE,
  document_id uuid REFERENCES public.documents(id) ON DELETE CASCADE,
  express_id integer NOT NULL,
  global_id varchar(22) NOT NULL,
  name varchar(255),
  category varchar(100) NOT NULL,
  properties jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Tạo chỉ mục (Indexes) để truy vấn nhanh
CREATE UNIQUE INDEX IF NOT EXISTS idx_elements_doc_express ON public.elements(document_id, express_id);
CREATE INDEX IF NOT EXISTS idx_elements_category ON public.elements(category);
CREATE INDEX IF NOT EXISTS idx_elements_properties ON public.elements USING gin (properties);
CREATE INDEX IF NOT EXISTS idx_elements_project ON public.elements(project_id);

-- Bật Row Level Security (RLS)
alter table public.elements enable row level security;

-- Chính sách bảo mật (Policies) đồng bộ với quy chế mở của CDE CIC MVP
create policy "read_all_elements" on public.elements for select using (true);
create policy "write_auth_elements" on public.elements for all to authenticated using (true) with check (true);
create policy "write_anon_elements" on public.elements for all to anon using (true) with check (true);
