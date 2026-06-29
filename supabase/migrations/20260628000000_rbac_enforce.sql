-- ============================================================
-- Migration: RBAC enforcement (TC4 - Phase 1)
-- Date: 2026-06-28
-- Mục tiêu: Đóng 2 lỗ hổng thực tế của bản pilot mà KHÔNG khóa nhầm user:
--   1) User tự nâng role của chính mình (profiles.role) -> Manager.
--   2) Bất kỳ ai đăng nhập cũng PUBLISH/ARCHIVE tài liệu & quyết định phê duyệt.
--
-- Nguyên tắc an toàn (tránh lockout trên môi trường đang chạy):
--   - GIỮ quyền đọc công khai như cũ (không siết read ở phase này).
--   - GIỮ quyền tạo/sửa WIP cho mọi authenticated (Author vẫn làm việc bình thường).
--   - CHỈ siết các hành động nhạy cảm: chuyển trạng thái PUBLISHED/ARCHIVED và
--     quyết định phê duyệt -> yêu cầu vai trò đủ thẩm quyền.
--
-- Mô hình quyền: per-project (project_members.role) + fallback super-admin toàn
-- cục (profiles.role in Manager/Admin) để admin không bao giờ bị khóa.
-- ============================================================

-- ---- Helper: role toàn cục của user hiện tại ----
create or replace function public.fn_my_global_role()
returns text language sql stable security definer set search_path = public as $$
  select role from public.profiles where id = auth.uid() limit 1;
$$;

-- ---- Helper: super-admin toàn cục (fallback chống khóa) ----
create or replace function public.fn_is_super_admin()
returns boolean language sql stable security definer set search_path = public as $$
  select coalesce(public.fn_my_global_role() in ('Manager','Admin'), false);
$$;

-- ---- Helper: role của user hiện tại trong 1 dự án cụ thể ----
create or replace function public.fn_project_role(p_project text)
returns text language sql stable security definer set search_path = public as $$
  select role from public.project_members
  where project_id = p_project and user_id = auth.uid() limit 1;
$$;

-- ---- Helper: được phê duyệt (Gate 1/2) trong dự án ----
create or replace function public.fn_can_approve(p_project text)
returns boolean language sql stable security definer set search_path = public as $$
  select public.fn_is_super_admin()
      or coalesce(public.fn_project_role(p_project) in ('Checker','Approver','Manager'), false);
$$;

-- ---- Helper: được xuất bản & lưu trữ (Gate 2 / Archive) trong dự án ----
create or replace function public.fn_can_publish(p_project text)
returns boolean language sql stable security definer set search_path = public as $$
  select public.fn_is_super_admin()
      or coalesce(public.fn_project_role(p_project) in ('Approver','Manager'), false);
$$;

-- ============================================================
-- 1) Chặn tự nâng role: chỉ super-admin mới được đổi profiles.role
--    (user vẫn sửa được full_name của mình).
-- ============================================================
create or replace function public.fn_guard_profile_role()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  -- auth.uid() IS NULL => ngữ cảnh service-role/migration (không có JWT): cho phép,
  -- để còn đường khôi phục/bootstrap super-admin. Người dùng đã đăng nhập thì phải
  -- là super-admin mới được đổi role.
  if new.role is distinct from old.role
     and auth.uid() is not null
     and not public.fn_is_super_admin() then
    raise exception 'Chỉ quản trị (Manager/Admin) mới được thay đổi vai trò người dùng';
  end if;
  return new;
end;
$$;

drop trigger if exists trg_guard_profile_role on public.profiles;
create trigger trg_guard_profile_role
  before update on public.profiles
  for each row execute function public.fn_guard_profile_role();

-- ============================================================
-- 2) Siết quyền GHI trên documents theo trạng thái.
--    - INSERT / UPDATE WIP-SHARED: mọi authenticated (Author làm việc bình thường).
--    - Chuyển sang PUBLISHED / ARCHIVED: phải fn_can_publish(project_id).
-- ============================================================
drop policy if exists "write_auth_documents" on public.documents;

drop policy if exists "documents_insert_auth" on public.documents;
create policy "documents_insert_auth" on public.documents
  for insert to authenticated
  with check (
    status in ('S0 - WIP','S1 - SHARED','PENDING_APPROVAL')
    or public.fn_can_publish(project_id)
  );

drop policy if exists "documents_update_role" on public.documents;
create policy "documents_update_role" on public.documents
  for update to authenticated
  using (true)
  with check (
    -- Đặt trạng thái PUBLISHED/ARCHIVED đòi hỏi quyền publish.
    status not in ('S2 - PUBLISHED','S3 - ARCHIVED')
    or public.fn_can_publish(project_id)
  );

drop policy if exists "documents_delete_role" on public.documents;
create policy "documents_delete_role" on public.documents
  for delete to authenticated
  using (public.fn_can_publish(project_id) or status = 'S0 - WIP');

-- ============================================================
-- 3) Quyết định phê duyệt (approvals): tạo RFI/Submittal thì authenticated;
--    nhưng RESOLVE (update/delete) đòi hỏi quyền phê duyệt.
-- ============================================================
drop policy if exists "write_auth_approvals" on public.approvals;

drop policy if exists "approvals_insert_auth" on public.approvals;
create policy "approvals_insert_auth" on public.approvals
  for insert to authenticated with check (true);

drop policy if exists "approvals_update_role" on public.approvals;
create policy "approvals_update_role" on public.approvals
  for update to authenticated
  using (public.fn_can_approve(project_id)) with check (public.fn_can_approve(project_id));

drop policy if exists "approvals_delete_role" on public.approvals;
create policy "approvals_delete_role" on public.approvals
  for delete to authenticated using (public.fn_can_approve(project_id));

-- ============================================================
-- GHI CHÚ rollout:
--   - Phase này KHÔNG yêu cầu project_members để đọc/ghi WIP -> không lockout.
--   - Để cấp quyền phê duyệt/publish theo dự án: thêm bản ghi project_members
--     (project_id, user_id, role in 'Checker'|'Approver'|'Manager').
--   - Super-admin: đặt profiles.role = 'Manager' cho tài khoản quản trị (chỉ
--     super-admin hiện hữu mới đặt được — bootstrap lần đầu chạy trực tiếp trên DB).
-- ============================================================
