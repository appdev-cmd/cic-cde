-- CDE CIC — Nâng cấp "Sự vụ BCF" thành module "Vấn đề (Issue)" đầy đủ:
-- thêm hạn xử lý, nhãn, người tạo, số thứ tự hiển thị + bảng bình luận/trao đổi.

-- 1) Trường nâng cao cho bcf_topics
alter table public.bcf_topics add column if not exists due_date date;
alter table public.bcf_topics add column if not exists labels jsonb;
alter table public.bcf_topics add column if not exists author text;

-- 2) Bảng bình luận/trao đổi cho từng vấn đề (threaded discussion + nhật ký)
create table if not exists public.bcf_comments (
  id uuid primary key default gen_random_uuid(),
  topic_id uuid references public.bcf_topics (id) on delete cascade,
  project_id text references public.projects (id) on delete cascade,
  author text not null,
  body text not null,
  comment_type text not null default 'comment', -- comment | status | assign | priority | system
  created_at timestamptz not null default now()
);
create index if not exists bcf_comments_topic_idx on public.bcf_comments (topic_id);
create index if not exists bcf_comments_project_idx on public.bcf_comments (project_id);

-- 3) RLS mở (pilot) giống các bảng khác
alter table public.bcf_comments enable row level security;
drop policy if exists "read_all_bcf_comments" on public.bcf_comments;
create policy "read_all_bcf_comments" on public.bcf_comments for select using (true);
drop policy if exists "write_auth_bcf_comments" on public.bcf_comments;
create policy "write_auth_bcf_comments" on public.bcf_comments for all to authenticated using (true) with check (true);

-- 4) Realtime cho bình luận (trao đổi thời gian thực)
do $$ begin
  alter publication supabase_realtime add table public.bcf_comments;
exception when duplicate_object then null; end $$;
