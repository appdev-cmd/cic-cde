-- Trụ 2 (Phân hệ 2): convert IFC -> Fragments phía SERVER.
-- Worker (selfhost/api) quét documents có IFC nhưng chưa có frag_url để convert nền.
-- frag_status: null/pending = chờ xử lý · processing = đang convert · ready = xong · error = lỗi.

alter table public.documents add column if not exists frag_status text;
alter table public.documents add column if not exists frag_error text;

-- Index giúp worker tìm nhanh việc cần làm (IFC chưa có frag, chưa lỗi/đang chạy).
create index if not exists documents_frag_pending_idx
  on public.documents (project_id)
  where frag_url is null and file_url is not null;
