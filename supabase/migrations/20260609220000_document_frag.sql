-- CDE CIC — Cache định dạng Fragments (.frag) để nạp mô hình nhanh (không parse lại IFC)
alter table public.documents add column if not exists frag_url text;
