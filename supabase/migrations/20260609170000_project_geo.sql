-- CDE CIC — GeoBIM: thêm toạ độ địa lý cho dự án (định vị trên bản đồ)
alter table public.projects add column if not exists lat double precision;
alter table public.projects add column if not exists lng double precision;
alter table public.projects add column if not exists province text;
alter table public.projects add column if not exists tiles_url text;

-- Seed toạ độ cho các dự án mẫu
update public.projects set lat=21.0135, lng=105.5268, province='Hà Nội' where id='fpt-arch';
update public.projects set lat=10.7769, lng=106.7009, province='TP. Hồ Chí Minh' where id='complex-a';
update public.projects set lat=21.0150, lng=105.5300, province='Hà Nội' where id='fpt-uni';
update public.projects set lat=10.7800, lng=106.7000, province='TP. Hồ Chí Minh' where id='vp-hang-a';
