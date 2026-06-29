-- Trụ 3/P3.1: viewpoint mức CẤU KIỆN (hơn ACC/BCF).
-- Lưu thêm cấu kiện đang ẩn (theo model) và các mặt phẳng cắt, không chỉ ẩn cả model.

alter table public.viewpoints add column if not exists hidden_elements jsonb; -- { [modelId]: number[] }
alter table public.viewpoints add column if not exists clipping jsonb;        -- [{ normal:[x,y,z], origin:[x,y,z] }]
