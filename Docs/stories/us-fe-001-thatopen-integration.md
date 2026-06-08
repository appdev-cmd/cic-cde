# US-FE-001 Tích hợp ThatOpen Engine & Render IFC Thực tế

## Status

planned

## Lane

high-risk

## Product Contract

Giao diện xem mô hình 3D (`ViewerTab.tsx`) sử dụng thư viện `@thatopen/components` và WebAssembly (`web-ifc`) để hiển thị tệp tin `.ifc` thực tế, thay thế ảnh mô phỏng tĩnh hiện có. Người dùng có thể xoay, di chuyển camera, chọn cấu kiện để xem thuộc tính động.

## Relevant Product Docs

- `design-system/MASTER.md`
- `Docs/decisions/0007-openbim-viewer-engine.md`

## Acceptance Criteria

1. Loại bỏ ảnh mockup Unsplash và hiệu ứng mix-blend trong `ViewerTab.tsx`.
2. Khởi tạo thành công Canvas WebGL sử dụng ThatOpen Engine trong component React.
3. Khi người dùng nạp một tệp IFC mẫu:
   - Render hình học 3D đầy đủ trên canvas.
   - Trích xuất cấu trúc không gian và cập nhật vào thanh danh sách bên trái.
   - Khi chọn một cấu kiện, trích xuất GUID và các thuộc tính (Identity, Materials, Dimensions) để cập nhật sang Properties Panel bên phải.
4. Tích hợp nút Cắt lát (Clipping Planes) và Đo đạc (Ruler) trên thanh công cụ Floating Toolbar.

## Design Notes

- **UI surfaces**: Tab `ViewerTab.tsx`
- **Libraries**: `@thatopen/components`, `three`, `web-ifc`
- **Design rules**:
  - Đảm bảo Canvas chiếm trọn khung hình Viewer.
  - Hover các nút toolbar có tooltip tiếng Việt rõ ràng, transition mượt mà 150ms.

## Validation

Khi cập nhật bằng chứng, chạy lệnh:
`scripts/bin/harness-cli story update --id US-FE-001 --unit 1 --integration 1 --e2e 0 --platform 0`.

| Layer | Expected proof |
| --- | --- |
| Unit | Component `ViewerTab` khởi tạo Canvas mà không gây lỗi crash React |
| Integration | Nạp thành công tệp IFC mẫu và trích xuất đúng cây cấu trúc hình học ở client |
| E2E | |
| Platform | |
| Release | |

## Evidence

Chưa có.
