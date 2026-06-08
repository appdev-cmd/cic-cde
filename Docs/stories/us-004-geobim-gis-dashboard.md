# US-004 Bản đồ số GeoBIM/GIS Dashboard

## Status

planned

## Lane

high-risk

## Product Contract

Hệ thống cung cấp một bản đồ địa lý 3D trực quan đóng vai trò làm Dashboard tổng thể quản trị đa dự án. Mô hình 3D của các dự án hạ tầng lớn sẽ được chuyển đổi sang định dạng 3D Tiles chuẩn OGC phía server và truyền trực tiếp về trình duyệt để hiển thị mượt mà trên bản đồ địa lý.

## Relevant Product Docs

- `Docs/bao_cao_nghien_cuu_kha_thi_cde_cic.md` (Chương 3 - Phân hệ 4a & 5)
- `Docs/decisions/0009-geobim-gis-architecture.md`

## Acceptance Criteria

1. DashboardTab phía Frontend hiển thị một bản đồ nền 3D sử dụng thư viện Cesium.js.
2. Thể hiện các dự án dưới dạng điểm ghim (pins/centroids) trên bản đồ. Khi click vào sẽ bay camera đến dự án đó.
3. Server-side pipeline biên dịch mô hình IFC mẫu thành định dạng 3D Tiles (.b3dm) Draco-compressed thành công.
4. Client stream và hiển thị mô hình 3D Tiles thành công trên bản đồ với tọa độ khớp chính xác hệ VN-2000 / WGS-84.

## Design Notes

- **UI surfaces**: Tab `DashboardTab.tsx`
- **Libraries**: `cesium` (frontend), `py3dtiles`, `pyproj` (backend)

## Validation

Khi cập nhật bằng chứng, chạy lệnh:
`scripts/bin/harness-cli story update --id US-004 --unit 1 --integration 1 --e2e 0 --platform 0`.

| Layer | Expected proof |
| --- | --- |
| Unit | Kiểm tra chuyển đổi hệ tọa độ VN-2000 sang WGS-84 trên backend |
| Integration | Cesium tải và hiển thị 3D Tiles mẫu từ server vStorage S3 mà không bị lỗi CORS hoặc lỗi hình học |
| E2E | |
| Platform | |
| Release | |

## Harness Delta

Không có.

## Evidence

Chưa có.
