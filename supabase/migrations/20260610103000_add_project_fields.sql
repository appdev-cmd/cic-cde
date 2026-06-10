-- CDE CIC — Bổ sung Nhóm dự án & Cấp công trình
alter table public.projects add column if not exists project_group text;
alter table public.projects add column if not exists building_grade text;

-- Cập nhật dữ liệu mẫu cho các dự án hiện tại
update public.projects set project_group='Nhóm A', building_grade='Cấp đặc biệt' where id='fpt-arch';
update public.projects set project_group='Nhóm A', building_grade='Cấp I' where id='complex-a';
update public.projects set project_group='Nhóm B', building_grade='Cấp I' where id='fpt-uni';
update public.projects set project_group='Nhóm C', building_grade='Cấp II' where id='vp-hang-a';
