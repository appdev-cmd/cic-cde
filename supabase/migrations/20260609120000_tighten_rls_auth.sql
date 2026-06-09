-- CDE CIC — Siết RLS khi đã có Auth: bỏ quyền GHI của anon.
-- Đọc vẫn công khai (anon select) để app tải dữ liệu mượt; mọi thao tác GHI
-- yêu cầu người dùng đã đăng nhập (authenticated). Quyền authenticated full đã
-- tạo ở migration 1 (write_auth_*).

do $$
declare t text;
begin
  foreach t in array array[
    'profiles','projects','project_members','documents','approvals',
    'clashes','activities','bcf_topics','assets','maintenance_tickets'
  ]
  loop
    execute format('drop policy if exists "write_anon_%1$s" on public.%1$I;', t);
  end loop;
end $$;

-- Storage: giữ đọc công khai, chỉ cho authenticated ghi/sửa/xóa
drop policy if exists "cde_files_insert" on storage.objects;
create policy "cde_files_insert" on storage.objects
  for insert to authenticated with check (bucket_id = 'cde-files');

drop policy if exists "cde_files_update" on storage.objects;
create policy "cde_files_update" on storage.objects
  for update to authenticated using (bucket_id = 'cde-files');

drop policy if exists "cde_files_delete" on storage.objects;
create policy "cde_files_delete" on storage.objects
  for delete to authenticated using (bucket_id = 'cde-files');
