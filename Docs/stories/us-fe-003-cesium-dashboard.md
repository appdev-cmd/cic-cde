# US-FE-003 Tích hợp Cesium.js & Streaming 3D Tiles trên Dashboard

## Status

planned

## Lane

high-risk

## Product Contract

Bảng điều khiển (`DashboardTab.tsx`) tích hợp bản đồ địa lý 3D hiển thị vị trí các dự án. Khi người dùng chọn một dự án, camera tự động phóng đến vị trí dự án đó và tải mô hình 3D Tiles của công trình tương thích trên bản đồ nền.

## Relevant Product Docs

- `design-system/MASTER.md`
- `Docs/decisions/0009-geobim-gis-architecture.md`

## Acceptance Criteria

1. Thay thế phần hiển thị chatbot / panel phụ bằng một khu vực bản đồ 3D Cesium.js (hoặc MapBox GL).
2. Định vị chính xác điểm ghim (pin) của dự án FPT University và các dự án khác trên bản đồ địa lý.
3. Khi click chọn một điểm ghim, thực hiện hiệu ứng bay camera (`camera.flyTo`) mượt mà đến công trình.
4. Tải và render thử nghiệm một mô hình 3D Tiles định dạng `.b3dm` mẫu của công trình trên bản đồ.

## Design Notes

- **UI surfaces**: Tab `DashboardTab.tsx`
- **Libraries**: `cesium` hoặc `react-map-gl`
- **Design rules**:
  - Không gây xung đột z-index với các dropdown hay drawer phê duyệt.
  - Tối ưu hóa việc hủy map instance khi chuyển tab để tránh memory leak.

## Validation

Khi cập nhật bằng chứng, chạy lệnh:
`scripts/bin/harness-cli story update --id US-FE-003 --unit 1 --integration 1 --e2e 0 --platform 0`.

| Layer | Expected proof |
| --- | --- |
| Unit | Khởi tạo thành công bản đồ nền mà không lỗi render WebGL |
| Integration | Cesium tải thành công 3D Tiles mẫu từ server vStorage |
| E2E | |
| Platform | |
| Release | |

## Evidence

Chưa có.
