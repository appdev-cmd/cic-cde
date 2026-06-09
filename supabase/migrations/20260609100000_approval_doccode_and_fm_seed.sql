-- CDE CIC — Milestone 2: bổ sung cột link tài liệu cho approvals + seed FM assets
-- Frontend liên kết approval với tài liệu bằng MÃ ISO 19650 (code), nên thêm
-- cột document_code thay vì dùng document_id (uuid).

alter table public.approvals add column if not exists document_code text;

-- ============================================================
-- SEED — Thiết bị FM (COBie) cho dự án fpt-arch + phiếu bảo trì
-- ============================================================
insert into public.assets (id, project_id, code, name, space, type, manufacturer, model, capacity, install_date, warranty_until, maintenance_cycle, status)
values
  ('8a9b7c1d-4e5f-90ab-1234-567890abcdef','fpt-arch','PUMP-B1-001','Bơm nước sinh hoạt trục đứng','Tầng hầm B1 - Phòng bơm','Máy bơm ly tâm trục đứng','Ebara','EVMS 32','15 kW - 30 m³/h','2025-03-15','2027-03-15','6 tháng/lần','Hoạt động'),
  ('1f2e3d4c-5b6a-7890-abcd-ef1234567890','fpt-arch','AHU-L05-003','Máy xử lý không khí (AHU) tầng 5','Tầng 5 - Phòng kỹ thuật điều hòa','Air Handling Unit','Daikin','AHU-D2000','20.000 m³/h','2025-05-20','2026-05-20','3 tháng/lần','Cần bảo trì'),
  ('aabbccdd-1122-3344-5566-778899aabbcc','fpt-arch','FCU-L12-027','Dàn lạnh FCU phòng họp 12.3','Tầng 12 - Phòng họp 12.3','Fan Coil Unit','Trane','FCU-600','600 CFM','2025-08-01','2027-08-01','6 tháng/lần','Hoạt động'),
  ('deadbeef-0000-1111-2222-333344445555','fpt-arch','GEN-B2-001','Máy phát điện dự phòng','Tầng hầm B2 - Phòng máy phát','Máy phát điện Diesel','Cummins','C1100D5','1100 kVA','2025-02-10','2028-02-10','1 tháng/lần','Hỏng')
on conflict (id) do nothing;

insert into public.maintenance_tickets (asset_id, code, ticket_type, title, status, ticket_date, technician)
values
  ('8a9b7c1d-4e5f-90ab-1234-567890abcdef','PM-001','PM','Bảo trì định kỳ quý 1','Hoàn thành','2026-03-10','KTV. Phạm Văn Đức'),
  ('1f2e3d4c-5b6a-7890-abcd-ef1234567890','CM-014','CM','Tiếng ồn bất thường từ quạt ly tâm','Đang xử lý','2026-06-05','KTV. Lê Hoàng Sơn'),
  ('deadbeef-0000-1111-2222-333344445555','CM-021','CM','Không khởi động được khi mất điện thử tải','Mới','2026-06-08',null)
on conflict do nothing;
