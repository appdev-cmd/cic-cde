# US-005 Phân hệ Quản lý Tiến độ & Bóc tách Khối lượng 5D

## Status

planned

## Lane

normal

## Product Contract

Hệ thống cho phép nhập bảng tiến độ (Gantt Chart), tự động bóc tách khối lượng (QTO) từ mô hình BIM IFC thông qua server Python, và lập bảng dự toán chi phí đối chiếu với hệ thống định mức hiện hành của Bộ Xây dựng.

## Relevant Product Docs

- `Docs/bao_cao_nghien_cuu_kha_thi_cde_cic.md` (Chương 3 - Phân hệ 3 & 4)

## Acceptance Criteria

1. Phía Python backend parse file IFC, lấy toàn bộ danh sách cấu kiện hình học kèm thông tin kích thước (chiều cao, diện tích, thể tích, v.v.).
2. Người dùng có thể import tệp định mức xây dựng (.xlsx hoặc JSON) và map mã định mức với các cấu kiện trong mô hình.
3. Đồng bộ hóa mốc thời gian thi công (4D) và hiển thị tiến độ lũy kế chi phí (5D) trực quan.

## Design Notes

- **UI surfaces**: Tab `ScheduleTab.tsx` phía frontend hiển thị biểu đồ tiến độ Gantt kết hợp dữ liệu chi phí.
- **Python libraries**: `ifcopenshell`, `pandas`, `openpyxl`

## Validation

Khi cập nhật bằng chứng, chạy lệnh:
`scripts/bin/harness-cli story update --id US-005 --unit 1 --integration 1 --e2e 0 --platform 0`.

| Layer | Expected proof |
| --- | --- |
| Unit | Python engine trích xuất đúng diện tích, thể tích từ cấu kiện IFC mẫu |
| Integration | So khớp thành công thuộc tính hình học với cơ sở dữ liệu định mức Bộ Xây dựng |
| E2E | |
| Platform | |
| Release | |

## Harness Delta

Không có.

## Evidence

Chưa có.
