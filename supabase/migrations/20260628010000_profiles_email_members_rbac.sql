-- ============================================================
-- Migration: Profiles email + project_members RBAC (TC4 - Phase 2)
-- Date: 2026-06-28
-- Mục tiêu:
--   1) Bổ sung email vào profiles để quản trị tài khoản & gán quyền theo dự án.
--   2) Siết quyền GHI trên project_members: chỉ super-admin toàn cục hoặc
--      Manager của chính dự án mới được thêm/sửa/xóa thành viên-tài khoản.
-- Phụ thuộc: 20260628000000_rbac_enforce.sql (fn_is_super_admin, fn_project_role).
-- ============================================================

-- ---- 1) Email cho profiles ----
alter table public.profiles add column if not exists email text;

-- Backfill từ auth.users (migration chạy với quyền postgres -> đọc được auth schema)
update public.profiles p
set email = u.email
from auth.users u
where u.id = p.id and (p.email is null or p.email = '');

-- Cập nhật trigger tạo profile khi có user mới: lưu kèm email
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (id, full_name, email, role)
  values (new.id, coalesce(new.raw_user_meta_data->>'full_name', new.email), new.email, 'Architect')
  on conflict (id) do update set email = excluded.email;
  return new;
end;
$$;

-- ---- 2) RBAC cho project_members ----
-- Helper: được quản trị thành viên của 1 dự án (super-admin hoặc Manager dự án đó)
create or replace function public.fn_can_manage_members(p_project text)
returns boolean language sql stable security definer set search_path = public as $$
  select public.fn_is_super_admin()
      or coalesce(public.fn_project_role(p_project) = 'Manager', false);
$$;

-- Bỏ quyền ghi rộng cũ, thay bằng policy theo quyền quản trị
drop policy if exists "write_auth_project_members" on public.project_members;

drop policy if exists "members_insert_admin" on public.project_members;
create policy "members_insert_admin" on public.project_members
  for insert to authenticated with check (public.fn_can_manage_members(project_id));

drop policy if exists "members_update_admin" on public.project_members;
create policy "members_update_admin" on public.project_members
  for update to authenticated
  using (public.fn_can_manage_members(project_id))
  with check (public.fn_can_manage_members(project_id));

drop policy if exists "members_delete_admin" on public.project_members;
create policy "members_delete_admin" on public.project_members
  for delete to authenticated using (public.fn_can_manage_members(project_id));

-- Đọc giữ công khai (như các bảng khác trong pilot) để UI tải danh sách mượt.
