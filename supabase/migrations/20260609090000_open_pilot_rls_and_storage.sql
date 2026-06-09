-- CDE CIC — Milestone 2: chế độ pilot mở (chưa có Auth) + Storage
-- Quyết định 2026-06-09: tạm bỏ Auth, giữ app mở (anon). Do đó nới RLS cho phép
-- anon ghi, và tạo bucket lưu trữ file. KHI WIRING AUTH (sau pilot) phải siết
-- lại theo project_members và bỏ quyền ghi của anon. Xem decision 0010.

-- ============================================================
-- Nới quyền ghi cho anon trên các bảng nghiệp vụ (pilot mở)
-- ============================================================
do $$
declare t text;
begin
  foreach t in array array[
    'profiles','projects','project_members','documents','approvals',
    'clashes','activities','bcf_topics','assets','maintenance_tickets'
  ]
  loop
    execute format('drop policy if exists "write_anon_%1$s" on public.%1$I;', t);
    execute format('create policy "write_anon_%1$s" on public.%1$I for all to anon using (true) with check (true);', t);
  end loop;
end $$;

-- ============================================================
-- Storage bucket cho file thiết kế (IFC/PDF/DWG)
-- ============================================================
insert into storage.buckets (id, name, public)
values ('cde-files', 'cde-files', true)
on conflict (id) do nothing;

-- Policies cho storage.objects trên bucket cde-files (pilot mở: anon đọc/ghi)
drop policy if exists "cde_files_read" on storage.objects;
create policy "cde_files_read" on storage.objects
  for select using (bucket_id = 'cde-files');

drop policy if exists "cde_files_insert" on storage.objects;
create policy "cde_files_insert" on storage.objects
  for insert with check (bucket_id = 'cde-files');

drop policy if exists "cde_files_update" on storage.objects;
create policy "cde_files_update" on storage.objects
  for update using (bucket_id = 'cde-files');

drop policy if exists "cde_files_delete" on storage.objects;
create policy "cde_files_delete" on storage.objects
  for delete using (bucket_id = 'cde-files');
