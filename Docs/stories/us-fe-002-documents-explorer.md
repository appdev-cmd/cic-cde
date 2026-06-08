# US-FE-002 Động hóa Trình duyệt Tài liệu ISO 19650 & Luồng Phê duyệt

## Status

planned

## Lane

normal

## Product Contract

Giao diện `DocumentsTab.tsx` quản lý danh sách thư mục và tệp tin động theo phân tầng ISO 19650 (WIP, Shared, Published, Archived). Người dùng có thể duyệt qua các thư mục con, tải lên tệp mới và thực hiện hành động chuyển đổi trạng thái phê duyệt của tài liệu.

## Relevant Product Docs

- `design-system/MASTER.md`
- `Docs/stories/us-002-iso19650-documents.md`

## Acceptance Criteria

1. Thư mục ISO 19650 bên trái hoạt động động: Khi bấm vào thư mục (ví dụ `01_WIP` hoặc `02_SHARED/Bản vẽ thiết kế`), danh sách tệp tin tương ứng ở bảng bên phải sẽ cập nhật đúng.
2. Thiết lập Drag & Drop zone tải lên tệp mới. Tệp tải lên sẽ được thêm động vào danh sách WIP cục bộ (lưu `localStorage`).
3. Properties Panel bên phải hiển thị động thông số của tệp đang được chọn (Tên file, GUID, Revision, Version, Trạng thái, Người tạo).
4. Thêm nút "Gửi yêu cầu phê duyệt" đối với tệp ở thư mục WIP, và nút "Phê duyệt / Từ chối" (dành cho cấp quản lý) để chuyển trạng thái tệp từ WIP -> SHARED -> PUBLISHED.
5. Việc cập nhật tệp chờ duyệt sẽ tăng/giảm động số lượng "chờ xử lý" trong widget của `DashboardTab.tsx`.

## Design Notes

- **UI surfaces**: Tab `DocumentsTab.tsx`
- **Design rules**:
  - Hàng bảng có `cursor-pointer` và hover đổi nền nhẹ nhàng.
  - Sử dụng icon Lucide-React đồng bộ (`Folder`, `FolderOpen`, `FileText`, `Box`).

## Validation

Khi cập nhật bằng chứng, chạy lệnh:
`scripts/bin/harness-cli story update --id US-FE-002 --unit 1 --integration 1 --e2e 0 --platform 0`.

| Layer | Expected proof |
| --- | --- |
| Unit | State thay đổi chính xác khi chuyển thư mục và chọn dòng bảng |
| Integration | Hành động phê duyệt cập nhật đúng trạng thái file trong danh sách và đồng bộ sang tab Dashboard |
| E2E | |
| Platform | |
| Release | |

## Evidence

Chưa có.
