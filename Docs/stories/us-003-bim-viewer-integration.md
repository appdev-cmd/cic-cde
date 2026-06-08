# US-003 Tích hợp 3D BIM Viewer Thực tế

## Status

planned

## Lane

high-risk

## Product Contract

Giao diện xem mô hình 3D Front-end kết nối trực tiếp với công cụ dựng hình ThatOpen Engine, cho phép lập trình viên và người dùng tải và phân tích mô hình IFC thực tế trực tiếp trên trình duyệt web mà không cần dùng ảnh mock tĩnh.

## Relevant Product Docs

- `Docs/bao_cao_nghien_cuu_kha_thi_cde_cic.md` (Chương 3 - Phân hệ 1)
- `Docs/decisions/0007-openbim-viewer-engine.md`

## Acceptance Criteria

1. Thay thế ảnh mock Unsplash tĩnh trong `ViewerTab.tsx` bằng 1 canvas HTML5 tích hợp ThatOpen Engine.
2. Khi người dùng chọn tệp IFC từ danh sách tài liệu, mô hình được tải lên và hiển thị 3D trên màn hình.
3. Hiển thị chính xác cấu trúc không gian (Spatial Tree) ở thanh biên trái (aside) trích xuất từ mô hình IFC.
4. Khi click chọn một đối tượng (ví dụ: SW-01 Wall), hiển thị đầy đủ thuộc tính (GUID, Dimension, Vật liệu) lên bảng thuộc tính phía bên phải.

## Design Notes

- **UI surfaces**: Tab `ViewerTab.tsx` frontend.
- **Libraries**: `@thatopen/components`, `three`, `web-ifc`

## Validation

Khi cập nhật bằng chứng, chạy lệnh:
`scripts/bin/harness-cli story update --id US-003 --unit 1 --integration 1 --e2e 0 --platform 0`.

| Layer | Expected proof |
| --- | --- |
| Unit | Kiểm tra render canvas HTML5 trong Component React |
| Integration | ThatOpen Engine khởi tạo thành công và nạp tệp `.ifc` mẫu thành công ở client |
| E2E | |
| Platform | |
| Release | |

## Harness Delta

Không có.

## Evidence

Chưa có.
