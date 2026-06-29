-- ============================================================
-- Migration: BCF viewpoint columns (P3.1 — Sprint 1)
-- Date: 2026-06-28
-- Mục tiêu: bổ sung cột còn thiếu cho bcf_topics. Frontend (createBcfTopic/
-- fetchBcfTopics + IssuesPanel) đã ghi/đọc topic_type, camera, hidden_models,
-- screenshot nhưng bảng chưa có các cột này → tạo topic BCF đang LỖI (insert
-- bị từ chối). Thêm cột để lưu viewpoint (camera + ẩn/hiện + ảnh) theo từng vấn đề.
-- ============================================================

alter table public.bcf_topics add column if not exists topic_type   text default 'Clash';
alter table public.bcf_topics add column if not exists camera       jsonb;   -- {position:[x,y,z], target:[x,y,z]}
alter table public.bcf_topics add column if not exists hidden_models jsonb;  -- mảng id model đang ẩn
alter table public.bcf_topics add column if not exists screenshot   text;    -- data URL ảnh chụp góc nhìn
