-- CDE CIC — Bổ sung dữ liệu mẫu quản lý vận hành (FM / COBie) cho cả 4 dự án mẫu.
-- Lần lượt bổ sung cho fpt-arch, complex-a, fpt-uni, vp-hang-a.

-- ============================================================
-- 1. Bổ sung thêm thiết bị cho dự án 'fpt-arch'
-- ============================================================
insert into public.assets (id, project_id, code, name, space, type, manufacturer, model, capacity, install_date, warranty_until, maintenance_cycle, status)
values
  ('88888888-1111-2222-3333-444455556666', 'fpt-arch', 'CH-B2-001', 'Hệ thống Chiller làm mát trung tâm', 'Tầng hầm B2 - Phòng kỹ thuật Chiller', 'Water-cooled Chiller', 'Carrier', '30XW1002', '1000 kW', '2025-04-10', '2027-04-10', '3 tháng/lần', 'Hoạt động'),
  ('88888888-2222-2222-3333-444455556666', 'fpt-arch', 'ELEV-L01-001', 'Thang máy chở khách số 1 (Sảnh A)', 'Tầng 1 - Sảnh A', 'Passenger Elevator', 'Schindler', 'Schindler 5500', '1350 kg - 1.75 m/s', '2025-05-10', '2028-05-10', '1 tháng/lần', 'Hoạt động')
on conflict (id) do nothing;

insert into public.maintenance_tickets (id, asset_id, code, ticket_type, title, status, ticket_date, technician)
values
  ('88888888-1111-2222-3333-aaaaaaaaaaaa', '88888888-1111-2222-3333-444455556666', 'PM-005', 'PM', 'Bảo trì Chiller định kỳ quý 2', 'Hoàn thành', '2026-05-15', 'KTV. Nguyễn Thanh Sơn'),
  ('88888888-2222-2222-3333-aaaaaaaaaaaa', '88888888-2222-2222-3333-444455556666', 'PM-008', 'PM', 'Kiểm định an toàn và tra dầu cáp thang máy', 'Hoàn thành', '2026-05-10', 'KTV. Trần Minh Quang')
on conflict (id) do nothing;


-- ============================================================
-- 2. Dữ liệu thiết bị và phiếu bảo trì cho 'complex-a'
-- ============================================================
insert into public.assets (id, project_id, code, name, space, type, manufacturer, model, capacity, install_date, warranty_until, maintenance_cycle, status)
values
  ('a1111111-2222-3333-4444-555566667777', 'complex-a', 'CH-B4-001', 'Chiller giải nhiệt nước trục vít', 'Tầng hầm B4 - Phòng kỹ thuật Chiller', 'Water-cooled Screw Chiller', 'Trane', 'RTHD-1200', '1200 kW', '2025-09-15', '2027-09-15', '3 tháng/lần', 'Cần bảo trì'),
  ('a2222222-2222-3333-4444-555566667777', 'complex-a', 'CT-R-001', 'Tháp giải nhiệt nước Cooling Tower', 'Tầng mái R - Khu kỹ thuật tháp giải nhiệt', 'Cooling Tower', 'Liang Chi', 'LBC-500', '500 RT', '2025-10-01', '2027-10-01', '6 tháng/lần', 'Hoạt động'),
  ('a3333333-2222-3333-4444-555566667777', 'complex-a', 'TBA-B3-001', 'Trạm biến áp khô ABB 2500kVA', 'Tầng hầm B3 - Trạm biến áp trung thế', 'Dry-type Transformer', 'ABB', 'HiDry-2500', '2500 kVA - 22/0.4kV', '2025-08-20', '2028-08-20', '12 tháng/lần', 'Hoạt động'),
  ('a4444444-2222-3333-4444-555566667777', 'complex-a', 'FP-B5-001', 'Bơm chữa cháy động cơ Diesel', 'Tầng hầm B5 - Phòng bơm cứu hỏa', 'Fire Pump', 'Pentax', 'CA 80-315A', '110 kW - 180 m³/h', '2025-09-10', '2027-09-10', '1 tháng/lần', 'Hoạt động'),
  ('a5555555-2222-3333-4444-555566667777', 'complex-a', 'ELEV-L01-002', 'Thang máy chở khách Otis tốc độ cao', 'Tầng 1 - Sảnh chính thang máy', 'Passenger Elevator', 'Otis', 'SkyRise-1600', '1600 kg - 4.0 m/s', '2025-11-05', '2027-11-05', '1 tháng/lần', 'Hỏng')
on conflict (id) do nothing;

insert into public.maintenance_tickets (id, asset_id, code, ticket_type, title, status, ticket_date, technician)
values
  ('a1111111-2222-3333-4444-aaaaaaaaaaaa', 'a1111111-2222-3333-4444-555566667777', 'CM-101', 'CM', 'Rò rỉ môi chất lạnh đường ống dẫn gas', 'Đang xử lý', '2026-06-08', 'KTV. Vũ Văn Hùng'),
  ('a1111111-2222-3333-4444-bbbbbbbbbbbb', 'a1111111-2222-3333-4444-555566667777', 'PM-102', 'PM', 'Kiểm tra Chiller định kỳ quý 1', 'Hoàn thành', '2026-03-20', 'KTV. Vũ Văn Hùng'),
  ('a2222222-2222-3333-4444-aaaaaaaaaaaa', 'a2222222-2222-3333-4444-555566667777', 'PM-103', 'PM', 'Vệ sinh tấm tản nhiệt và kiểm tra quạt tháp', 'Hoàn thành', '2026-04-12', 'KTV. Hoàng Xuân Việt'),
  ('a3333333-2222-3333-4444-aaaaaaaaaaaa', 'a3333333-2222-3333-4444-555566667777', 'PM-104', 'PM', 'Đo điện trở cách điện cuộn dây biến áp', 'Hoàn thành', '2026-02-15', 'KTV. Nguyễn Văn Thái'),
  ('a4444444-2222-3333-4444-aaaaaaaaaaaa', 'a4444444-2222-3333-4444-555566667777', 'PM-105', 'PM', 'Khởi động thử tải và kiểm tra áp suất bơm hàng tháng', 'Hoàn thành', '2026-05-25', 'KTV. Lê Hồng Sơn'),
  ('a5555555-2222-3333-4444-aaaaaaaaaaaa', 'a5555555-2222-3333-4444-555566667777', 'CM-106', 'CM', 'Lỗi hiển thị bảng điều khiển cabin và đứt cáp tín hiệu', 'Mới', '2026-06-10', null)
on conflict (id) do nothing;


-- ============================================================
-- 3. Dữ liệu thiết bị và phiếu bảo trì cho 'fpt-uni'
-- ============================================================
insert into public.assets (id, project_id, code, name, space, type, manufacturer, model, capacity, install_date, warranty_until, maintenance_cycle, status)
values
  ('b1111111-2222-3333-4444-555566667777', 'fpt-uni', 'VRV-H4-001', 'Hệ thống điều hòa trung tâm VRV IV', 'Giảng đường H4 - Mái kỹ thuật', 'VRV Air Conditioning', 'Daikin', 'RXQ20AY1', '54 HP', '2024-05-15', '2026-05-15', '6 tháng/lần', 'Cần bảo trì'),
  ('b2222222-2222-3333-4444-555566667777', 'fpt-uni', 'PV-H5-001', 'Hệ thống pin mặt trời áp mái 150kWp', 'Giảng đường H5 - Mái tòa nhà', 'Solar PV System', 'Canadian Solar', 'CS6W-550MS', '150 kWp', '2024-06-10', '2034-06-10', '6 tháng/lần', 'Hoạt động'),
  ('b3333333-2222-3333-4444-555566667777', 'fpt-uni', 'WP-H4-002', 'Bơm thoát nước thải sinh hoạt bể hầm', 'Giảng đường H4 - Bể thu gom hầm B1', 'Sewage Submersible Pump', 'Tsurumi', '80U21.5', '1.5 kW - 30 m³/h', '2024-04-20', '2026-04-20', '3 tháng/lần', 'Hoạt động'),
  ('b4444444-2222-3333-4444-555566667777', 'fpt-uni', 'MSB-H4-001', 'Tủ điện phân phối chính tổng MSB', 'Giảng đường H4 - Tầng 1 Phòng điện', 'Main Distribution Board', 'Schneider', 'Prisma iPM-1600A', '1600A', '2024-04-10', '2026-04-10', '12 tháng/lần', 'Hoạt động'),
  ('b5555555-2222-3333-4444-555566667777', 'fpt-uni', 'SD-H4-105', 'Đầu báo khói địa chỉ phòng máy 105', 'Giảng đường H4 - Phòng máy tính 105', 'Smoke Detector', 'Hochiki', 'ALN-V', '24VDC', '2024-05-01', '2026-05-01', '6 tháng/lần', 'Hỏng')
on conflict (id) do nothing;

insert into public.maintenance_tickets (id, asset_id, code, ticket_type, title, status, ticket_date, technician)
values
  ('b1111111-2222-3333-4444-aaaaaaaaaaaa', 'b1111111-2222-3333-4444-555566667777', 'CM-201', 'CM', 'Thiếu gas cục nóng điều hòa số 2 gây báo lỗi E4', 'Đang xử lý', '2026-06-07', 'KTV. Đỗ Đăng Khoa'),
  ('b2222222-2222-3333-4444-aaaaaaaaaaaa', 'b2222222-2222-3333-4444-555566667777', 'PM-202', 'PM', 'Vệ sinh các tấm pin mặt trời và kiểm tra inverter', 'Hoàn thành', '2026-05-20', 'KTV. Phạm Minh Đức'),
  ('b3333333-2222-3333-4444-aaaaaaaaaaaa', 'b3333333-2222-3333-4444-555566667777', 'PM-203', 'PM', 'Vệ sinh rác buồng chứa và đo dòng điện động cơ bơm chìm', 'Hoàn thành', '2026-04-05', 'KTV. Trần Văn Tú'),
  ('b4444444-2222-3333-4444-aaaaaaaaaaaa', 'b4444444-2222-3333-4444-555566667777', 'PM-204', 'PM', 'Kiểm tra siết điểm tiếp xúc thanh cái tủ điện MSB', 'Hoàn thành', '2025-12-15', 'KTV. Nguyễn Thanh Tùng'),
  ('b5555555-2222-3333-4444-aaaaaaaaaaaa', 'b5555555-2222-3333-4444-555566667777', 'CM-205', 'CM', 'Đầu báo cháy báo giả liên tục và mất tín hiệu kết nối tủ trung tâm', 'Mới', '2026-06-09', null)
on conflict (id) do nothing;


-- ============================================================
-- 4. Dữ liệu thiết bị và phiếu bảo trì cho 'vp-hang-a'
-- ============================================================
insert into public.assets (id, project_id, code, name, space, type, manufacturer, model, capacity, install_date, warranty_until, maintenance_cycle, status)
values
  ('c1111111-2222-3333-4444-555566667777', 'vp-hang-a', 'WFS-B1-001', 'Hệ thống lọc nước trung tâm UF', 'Tầng hầm B1 - Phòng xử lý nước sạch', 'Ultrafiltration System', 'GE Water', 'ZeeWeed-500', '15 m³/h', '2025-12-10', '2027-12-10', '3 tháng/lần', 'Hoạt động'),
  ('c2222222-2222-3333-4444-555566667777', 'vp-hang-a', 'ACS-L01-001', 'Hệ thống kiểm soát ra vào Speedgate sảnh chính', 'Tầng 1 - Sảnh đón tiếp chính', 'Speedgate Access Control', 'Gunnebo', 'SpeedStile-FLs', '30 lượt/phút', '2026-01-15', '2028-01-15', '6 tháng/lần', 'Hoạt động'),
  ('c3333333-2222-3333-4444-555566667777', 'vp-hang-a', 'UPS-B2-001', 'Bộ lưu điện UPS trung tâm phòng máy chủ 200kVA', 'Tầng hầm B2 - Phòng máy chủ Server Room', 'Three-phase UPS', 'APC', 'Symmetra-PX200', '200 kVA', '2025-12-15', '2027-12-15', '3 tháng/lần', 'Hoạt động'),
  ('c4444444-2222-3333-4444-555566667777', 'vp-hang-a', 'TEF-B1-002', 'Quạt hút khói sự cố tầng hầm B1', 'Tầng hầm B1 - Phòng kỹ thuật quạt hút', 'Emergency Exhaust Fan', 'Kruger', 'TDA-1000', '30 kW - 45.000 m³/h', '2025-12-05', '2027-12-05', '3 tháng/lần', 'Cần bảo trì'),
  ('c5555555-2222-3333-4444-555566667777', 'vp-hang-a', 'BMS-L02-001', 'Hệ thống điều khiển tòa nhà thông minh BMS', 'Tầng 2 - Phòng điều khiển trung tâm BCC', 'Integrated BMS', 'Johnson Controls', 'Metasys-BMS', '5000 DDC points', '2025-12-20', '2027-12-20', '6 tháng/lần', 'Hoạt động')
on conflict (id) do nothing;

insert into public.maintenance_tickets (id, asset_id, code, ticket_type, title, status, ticket_date, technician)
values
  ('c1111111-2222-3333-4444-aaaaaaaaaaaa', 'c1111111-2222-3333-4444-555566667777', 'PM-301', 'PM', 'Rửa ngược màng lọc UF và kiểm tra bơm hóa chất', 'Hoàn thành', '2026-05-18', 'KTV. Lê Anh Tuấn'),
  ('c2222222-2222-3333-4444-aaaaaaaaaaaa', 'c2222222-2222-3333-4444-555566667777', 'PM-302', 'PM', 'Cân chỉnh cảm biến hồng ngoại bảo vệ phân làn cổng speedgate', 'Hoàn thành', '2026-05-05', 'KTV. Nguyễn Hoàng Nam'),
  ('c3333333-2222-3333-4444-aaaaaaaaaaaa', 'c3333333-2222-3333-4444-555566667777', 'PM-303', 'PM', 'Đo nội trở ắc quy và kiểm tra dòng phóng nạp bộ lưu điện', 'Hoàn thành', '2026-04-22', 'KTV. Dương Văn Trung'),
  ('c4444444-2222-3333-4444-aaaaaaaaaaaa', 'c4444444-2222-3333-4444-555566667777', 'CM-304', 'CM', 'Quạt hút kêu rung lớn khi chạy tốc độ cao, nghi lệch cánh', 'Đang xử lý', '2026-06-06', 'KTV. Trần Quốc Bảo'),
  ('c5555555-2222-3333-4444-aaaaaaaaaaaa', 'c5555555-2222-3333-4444-555566667777', 'PM-305', 'PM', 'Sao lưu dữ liệu hệ thống Metasys và cập nhật bản vá bảo mật', 'Hoàn thành', '2026-05-10', 'KTV. Nguyễn Anh Tuấn')
on conflict (id) do nothing;
