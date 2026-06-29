-- ============================================================
-- Migration: Audit log bất biến (TC3)
-- Date: 2026-06-28
-- Mục tiêu: Nhật ký kiểm toán append-only cho các sự kiện pháp lý quan trọng
--   (tạo tài liệu, chuyển trạng thái/phát hành). Phục vụ thanh tra — KHÔNG cho
--   sửa/xóa. SHA-256 đã có sẵn ở documents.hash_sha256 (ghi kèm để truy vết).
-- ============================================================

create table if not exists public.audit_log (
  id uuid primary key default gen_random_uuid(),
  project_id  text references public.projects(id) on delete cascade,
  actor_id    uuid,          -- auth.uid() tại thời điểm hành động
  actor_name  text,          -- tên hiển thị (snapshot)
  action      text not null, -- 'document_created' | 'document_status_changed' | ...
  entity      text,          -- 'document'
  entity_id   text,          -- code tài liệu
  detail      jsonb,         -- {from, to, name, ...}
  hash_after  text,          -- SHA-256 tài liệu tại thời điểm ghi
  at          timestamptz not null default now()
);
create index if not exists audit_log_project_idx on public.audit_log (project_id, at desc);

-- RLS: đọc công khai (như các bảng khác); CHO PHÉP INSERT; KHÔNG có policy
-- update/delete -> mặc định bị từ chối => bản ghi bất biến.
alter table public.audit_log enable row level security;
drop policy if exists "audit_read" on public.audit_log;
create policy "audit_read" on public.audit_log for select using (true);
drop policy if exists "audit_insert" on public.audit_log;
create policy "audit_insert" on public.audit_log for insert to authenticated with check (true);

-- Chặn cứng UPDATE/DELETE kể cả cho chủ sở hữu, phòng trường hợp thêm policy nhầm.
create or replace function public.fn_audit_immutable()
returns trigger language plpgsql as $$
begin
  raise exception 'audit_log là bất biến: không được sửa/xóa';
end;
$$;
drop trigger if exists trg_audit_no_update on public.audit_log;
create trigger trg_audit_no_update before update or delete on public.audit_log
  for each row execute function public.fn_audit_immutable();

-- ---- Tự động ghi nhật ký khi tài liệu thay đổi ----
create or replace function public.fn_log_document_audit()
returns trigger language plpgsql security definer set search_path = public as $$
declare a_name text;
begin
  select coalesce(full_name, email) into a_name from public.profiles where id = auth.uid();
  if tg_op = 'INSERT' then
    insert into public.audit_log(project_id, actor_id, actor_name, action, entity, entity_id, detail, hash_after)
    values (new.project_id, auth.uid(), a_name, 'document_created', 'document', new.code,
            jsonb_build_object('name', new.name, 'status', new.status), new.hash_sha256);
  elsif tg_op = 'UPDATE' and new.status is distinct from old.status then
    insert into public.audit_log(project_id, actor_id, actor_name, action, entity, entity_id, detail, hash_after)
    values (new.project_id, auth.uid(), a_name, 'document_status_changed', 'document', new.code,
            jsonb_build_object('from', old.status, 'to', new.status, 'name', new.name), new.hash_sha256);
  end if;
  return new;
end;
$$;

drop trigger if exists trg_log_document_audit on public.documents;
create trigger trg_log_document_audit
  after insert or update on public.documents
  for each row execute function public.fn_log_document_audit();
