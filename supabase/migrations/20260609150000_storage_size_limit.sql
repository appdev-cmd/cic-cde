-- CDE CIC — Nâng giới hạn dung lượng file Storage lên 500MB (theo yêu cầu báo cáo:
-- hỗ trợ mô hình BIM dưới 500MB).
-- LƯU Ý: ngoài giới hạn bucket dưới đây, còn phải nâng giới hạn TOÀN CỤC của
-- project Storage (fileSizeLimit) qua Management API / Dashboard — đã đặt =
-- 524288000 (500MB) ngày 2026-06-09.
update storage.buckets set file_size_limit = 524288000 where id = 'cde-files';
