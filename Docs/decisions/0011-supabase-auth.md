# 0011 Supabase Auth — Public Read / Authenticated Write

Date: 2026-06-09

## Status

Accepted

## Context

Milestone 2 chuyển app sang dùng Supabase. Giai đoạn đầu chạy "pilot mở" (anon
read+write) để ship nhanh (xem decision 0010). Sau khi nền dữ liệu ổn, cần lớp
xác thực để dữ liệu không bị ghi tùy tiện và để gắn hành động với người dùng.

## Decision

1. **Xác thực**: Supabase Auth email/password. Bật `mailer_autoconfirm = true`
   (qua Management API) để pilot đăng nhập không cần xác nhận email.
2. **RLS**: ĐỌC công khai (anon `select`) để app tải dữ liệu mượt; mọi thao tác
   GHI yêu cầu `authenticated`. Đã bỏ toàn bộ policy ghi của anon.
3. **profiles**: tự tạo qua trigger `on_auth_user_created` khi đăng ký (role mặc
   định `Architect`).
4. **Gate**: App hiển thị `LoginScreen` khi chưa đăng nhập; Sidebar hiện tên +
   vai trò người dùng và nút đăng xuất.

## Alternatives Considered

1. **Per-project membership RLS** (project_members): bảo mật đa tổ chức đúng
   chuẩn, nhưng cần seed membership cho từng user/dự án — hoãn sang sau pilot.
2. **Magic link / VNeID**: hoãn. VNeID là mục tiêu B2G giai đoạn 2 (decision 0010).
3. **Bật email confirmation**: an toàn hơn nhưng gây ma sát cho pilot nội bộ.

## Consequences

Positive:

* Dữ liệu chỉ bị ghi bởi người đã đăng nhập; hành động gắn với danh tính.
* Đăng nhập mượt cho pilot.

Tradeoffs:

* `mailer_autoconfirm` bật → không xác minh email thật. Chấp nhận cho pilot nội
  bộ; phải tắt + dùng VNeID/Keycloak trước khi phục vụ B2G thật.
* Đọc còn công khai (anon) — cần siết theo project_members khi lên production.
