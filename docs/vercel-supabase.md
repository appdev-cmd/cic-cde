# CIC CDE trên Supabase Cloud và Vercel

Project Supabase `cic-cde` thuộc **CIC's Org**, kết nối **cty**, vùng Singapore. Project Vercel `cic-cde` thuộc tài khoản **appdev@cic.com.vn**, team `appdev-cmds-projects`. Nguồn triển khai là nhánh `main` của `appdev-cmd/cic-cde`.

React gọi Supabase Auth và RPC `cde_api` bằng phiên của người dùng. PostgreSQL kiểm tra phiên, dự án và vai trò theo đơn vị. Các bảng ứng dụng nằm trong schema riêng tư, có RLS và không cấp quyền đọc trực tiếp cho client. RPC được phép gọi khi đã đăng nhập và thực thi kiểm tra quyền ở từng thao tác. Edge Function `cde-accounts` tạo tài khoản qua mã mời một lần hoặc theo quyền quản trị hệ thống.

Trong tab **Thành viên**, quản trị dự án chỉnh quyền của đơn vị và tạo hoặc thu hồi lời mời. Đơn vị đã có tài khoản dùng tài khoản đó để nhận lời mời. Đơn vị mới có thể tạo tài khoản đầu tiên từ liên kết mời. Quản trị hệ thống có thể tạo tài khoản ngay trong tab này. Nếu đơn vị đã tham gia, tài khoản dùng quyền hiện có của đơn vị. Nếu thêm đơn vị mới vào dự án, quyền được chọn áp dụng cho mọi tài khoản của đơn vị đó.

IFC tải trực tiếp vào bucket riêng `cde-files`. Worker Vercel tải IFC được phép đọc, dùng thư mục tạm để chạy IfcOpenShell và ghi geometry về Storage. Metadata và tiến trình nằm trong PostgreSQL. Tác vụ gắn người tạo và dự án, có lease để tránh ghi đè khi chạy trùng và kiểm tra quyền lại khi lưu. Định dạng geometry QBM1 dùng chung với desktop. Giới hạn IFC STEP là 500 MB, preview tối đa 25.000 cấu kiện có hình học cùng ngân sách geometry riêng. Kiểm tra va chạm giới hạn 12 snapshot, 5.000 cấu kiện, 1.000 cặp kết quả và ngân sách xử lý 255 giây trong function Vercel 300 giây. Upload thành công không bảo đảm xử lý đầy đủ toàn bộ file.

## Cấu hình môi trường

Áp dụng migration trước khi triển khai Edge Function `cde-accounts` và bản web dùng các thao tác thành viên mới.

| Tên biến | Mục đích |
|---|---|
| `VITE_SUPABASE_URL` | URL API của project Supabase |
| `VITE_SUPABASE_PUBLISHABLE_KEY` | Publishable key cho browser và desktop |
| `VITE_QABIM_API_BASE` | `/api` trên Vercel |
| `VITE_CDE_REMOTE_API` | URL HTTPS của worker cloud cho desktop |
| `CDE_WORKER_KEY` | Khóa bí mật của worker. Chỉ đặt ở môi trường server, dùng bản băm SHA-256 trong `cde_private.settings` với tên `worker_digest` |

Migration trong `supabase/migrations` tạo schema, quyền, RPC và bucket. Triển khai Edge Function từ `supabase/functions/cde-accounts`. Lần đầu tạo quản trị cần mã bootstrap dùng một lần. Sau khi tạo tài khoản, mã bị xóa khỏi cấu hình database. Tài khoản pilot dùng tên đăng nhập và mật khẩu. Supabase Auth quản lý định danh nội bộ dưới namespace `pilot.cde.cic.com.vn`. Giá trị bí mật và tài khoản thử đặt trong `.local` hoặc trình quản lý bí mật của nhà cung cấp.

Build web bằng `pnpm build`. Dùng đúng hai biến Supabase công khai khi build desktop muốn kết nối cloud và khai báo `VITE_CDE_REMOTE_API`. Bản desktop offline và Rust host giữ cấu hình local khi thiếu biến cloud.

## Kiểm thử

`scripts/verify_cloud.py` chạy qua Supabase thật với mô hình tổng hợp. Chạy mặc định dùng FastAPI trong tiến trình test. Truyền `--api https://<deployment>` để kiểm thử worker triển khai. Bài thử kiểm tra tạo và nhận lời mời, upload IFC hơn 5 MB, geometry, duyệt/phát hành hồ sơ, cách ly giữa dự án, va chạm giữa hai IFC, issue và hủy tác vụ. Đọc thông tin kết nối và tài khoản thử từ `.local`.

Supabase Advisor báo thông tin RLS không có policy trực tiếp ở schema riêng tư và cảnh báo RPC `cde_api` cho người dùng đăng nhập. Đó là cấu hình có chủ đích của API có kiểm tra phiên và quyền. Cảnh báo bảo vệ mật khẩu rò rỉ của Supabase Auth có thể được xử lý trong phần Password Security của project khi đưa vào sử dụng rộng rãi.
