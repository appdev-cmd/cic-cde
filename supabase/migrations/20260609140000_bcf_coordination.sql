-- CDE CIC — Nâng cấp bcf_topics thành module điều phối (BIMcollab-style):
-- thêm loại sự vụ, viewpoint (camera + model ẩn), và ảnh thu nhỏ.
alter table public.bcf_topics add column if not exists topic_type text default 'Clash';
alter table public.bcf_topics add column if not exists camera jsonb;
alter table public.bcf_topics add column if not exists hidden_models jsonb;
alter table public.bcf_topics add column if not exists screenshot text;
