# US-001 API Gateway & Xác thực VNeID SSO

## Status

planned

## Lane

normal

## Product Contract

Hệ thống cung cấp một cổng API Gateway trung tâm chịu trách nhiệm điều tuyến yêu cầu và tích hợp Keycloak SSO hỗ trợ cơ chế xác thực tài khoản định danh VNeID của Bộ Công an dành cho cán bộ công vụ.

## Relevant Product Docs

- `Docs/bao_cao_nghien_cuu_kha_thi_cde_cic.md` (Chương 3 - Phân hệ 7)

## Acceptance Criteria

1. API Gateway (Go) định tuyến chính xác các yêu cầu tới các microservices phía sau.
2. Keycloak được cấu hình đúng để xử lý đăng nhập bằng tài khoản công sở và liên kết VNeID OAuth2/OpenID Connect.
3. Người dùng đăng nhập thành công sẽ nhận được JWT token chứa thông tin chức vụ và quyền hạn.

## Design Notes

- **API**: `/api/v1/auth/login`, `/api/v1/auth/callback`
- **UI surfaces**: Màn hình đăng nhập chính của CDE hỗ trợ tùy chọn "Đăng nhập qua VNeID".

## Validation

Khi cập nhật bằng chứng, chạy lệnh:
`scripts/bin/harness-cli story update --id US-001 --unit 1 --integration 1 --e2e 0 --platform 0`.

| Layer | Expected proof |
| --- | --- |
| Unit | Kiểm thử API Gateway chuyển tiếp yêu cầu thành công |
| Integration | Kết nối thành công Keycloak sandbox với môi trường mock VNeID |
| E2E | |
| Platform | |
| Release | |

## Harness Delta

Không có.

## Evidence

Chưa có.
