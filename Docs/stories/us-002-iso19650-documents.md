# US-002 Quản lý Hồ sơ Tài liệu theo ISO 19650

## Status

planned

## Lane

normal

## Product Contract

Hệ thống hỗ trợ phân loại và kiểm soát luồng phê duyệt tài liệu/bản vẽ thiết kế đúng theo tiêu chuẩn ISO 19650 (gồm 4 trạng thái: WIP - Work in Progress, Shared, Published, Archived).

## Relevant Product Docs

- `Docs/bao_cao_nghien_cuu_kha_thi_cde_cic.md` (Chương 3 - Phân hệ 2)

## Acceptance Criteria

1. Người dùng có thể upload các file tài liệu, bản vẽ CAD (.dwg) hoặc mô hình BIM (.ifc).
2. Tài liệu khi tạo mới mặc định nằm ở trạng thái WIP, chỉ hiển thị với người tạo.
3. Luồng phê duyệt (Approval Workflow) cho phép chuyển trạng thái tài liệu sang Shared và Published sau khi được kiểm duyệt viên và chủ đầu tư phê duyệt trực tuyến.
4. Hệ thống ghi nhật ký kiểm toán bất biến (Audit Trail) cho mọi hành động thay đổi trạng thái file.

## Design Notes

- **API**: `/api/v1/documents`, `/api/v1/documents/:id/approve`
- **Tables**: `documents`, `document_audit_trails`
- **UI surfaces**: Tab `DocumentsTab.tsx` phía frontend hiển thị cấu trúc thư mục phân tách WIP/Shared/Published/Archived.

## Validation

Khi cập nhật bằng chứng, chạy lệnh:
`scripts/bin/harness-cli story update --id US-002 --unit 1 --integration 1 --e2e 0 --platform 0`.

| Layer | Expected proof |
| --- | --- |
| Unit | API Go xử lý upload tệp tin và lưu trữ thông tin đúng schema DB |
| Integration | Luồng duyệt bất đồng bộ gửi yêu cầu chuyển trạng thái và cập nhật CSDL thành công |
| E2E | |
| Platform | |
| Release | |

## Harness Delta

Không có.

## Evidence

Chưa có.
