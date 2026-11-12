# CIC CDE

BIM Workspace cho Windows bằng Tauri, Rust, React và IfcOpenShell. Vòng triển khai đầu có desktop native, Viewer 3D, import IFC local, Rust mock assistant và MCP đọc dữ liệu.

Web CIC CDE sử dụng Supabase Auth, PostgreSQL và Storage riêng tư. Vercel phục vụ giao diện React và chạy worker IfcOpenShell cho nhập IFC và kiểm tra va chạm. Người dùng chọn dự án, nhận lời mời theo đơn vị và xử lý hồ sơ, issue theo vai trò được cấp. Desktop có chế độ offline dùng Rust và chế độ kết nối workspace cloud.

[Hướng dẫn triển khai Supabase và Vercel](docs/vercel-supabase.md) · [Giới hạn và tiến độ G0/G1](docs/g0-g1-progress.md)

Trên web, vào **Hồ sơ → Bản vẽ CAD** để tải lên và xem DWG/DXF tối đa 25 MB mỗi file. File được chia sẻ ngay với thành viên có quyền xem dự án. Bản vẽ được xử lý trong trình duyệt. Cần áp dụng migration `cde_cad_drawings` vào Supabase trước khi phát hành bản build web.

Trình xem dùng [MLightCAD](https://github.com/mlightcad/cad-viewer/tree/v1.7.8). Mã nguồn của thành phần đọc DWG và mã WebAssembly đi kèm có tại [LibreDWG Converter 3.15.21](https://github.com/mlightcad/realdwg-web/tree/e03b9f2ca005506880855b0a55f236fef7c7530a) và [LibreDWG Web 0.8.3](https://github.com/mlightcad/libredwg-web/tree/b5177613f2c735858a6d1cb1d1c7e238c397b88f). Bản build phục vụ giấy phép GPL trong `cad-assets/libredwg-LICENSE.txt`.

## Chạy local

Yêu cầu phát triển: Node, pnpm, Rust MSVC toolchain, WebView2, Python 3.12 với IfcOpenShell 0.8.5. Rust/pnpm dependencies có lockfile. Người dùng cuối chưa có bộ cài độc lập Python.

```powershell
pnpm install --frozen-lockfile
python -m pip install -e "./workers/bim[test]"
pnpm fixtures
```

Mở hai terminal trong thư mục dự án:

```powershell
# Terminal 1: UI có hot reload
pnpm dev
```

```powershell
# Terminal 2: native desktop, sở hữu core/API cho cả browser và MCP
pnpm desktop:attach
```

Preview: [http://127.0.0.1:1420](http://127.0.0.1:1420). Rust development API chỉ bind 127.0.0.1:4318.

Nếu chưa chạy Vite, `pnpm desktop` sẽ tự khởi động Vite và Tauri. Desktop sở hữu một core dùng chung với browser/MCP tại cổng 4318. `pnpm core` chỉ dùng thay thế desktop khi chạy browser-only; không chạy cùng desktop.

## Kiểm tra và MCP

```powershell
pnpm build
pnpm test:worker
pnpm test:core
cargo build -p qabim-mcp
python scripts/verify_mcp.py
```

Để gắn vào MCP client, chạy binary `target/debug/qabim-mcp.exe` bằng transport stdio sau khi desktop (hoặc core browser-only) hoạt động. Các tool hiện có là `project_get`, `models_list`, `elements_search`, `checks_run`. Đây là development bridge đọc dữ liệu và chạy kiểm tra có giới hạn; named pipe có xác thực và điều khiển view từ agent còn trong backlog.

File IFC nhập được lưu snapshot và cache trong `.local/models`; metadata/audit nằm trong `.local/workspace.sqlite`. Thư mục `.local` không được commit. IFC STEP có giới hạn 500 MB, preview tối đa 25.000 represented products và ngân sách geometry riêng. Kiểm tra va chạm giới hạn 12 snapshot, 5.000 cấu kiện trong phạm vi và 1.000 cặp kết quả; khả năng upload không bảo đảm xử lý đầy đủ toàn bộ mô hình.

## Tài liệu triển khai

| Tài liệu | Nội dung |
| --- | --- |
| [Kiến trúc](docs/architecture.md) | Tiến trình, trách nhiệm module, pipeline IFC, renderer, dữ liệu và đóng gói |
| [Dữ liệu và giao thức](docs/data-contracts.md) | Mô hình dữ liệu, API, jobs, tọa độ, cache và tương thích phiên bản |
| [AI và MCP](docs/ai-mcp.md) | Tool registry, agent loop, quyền, giao tiếp desktop và kiểm thử |
| [Cấu trúc dự án](docs/project-structure.md) | Monorepo Rust, TypeScript, Python và nguyên tắc phụ thuộc |
| [Kế hoạch triển khai](docs/implementation-plan.md) | Giai đoạn, backlog, đầu ra và điều kiện nghiệm thu |
| [Tham khảo sản phẩm](docs/research/product-reference.md) | REA trên Zoom/Solibri đã cài và bài học từ tài liệu chính thức |

## Quyết định nền tảng

- Windows x64 trước, chạy offline cho Viewer và Checking; kết nối AI là tùy chọn.
- Rust sở hữu dữ liệu dự án, điều phối nghiệp vụ, jobs, permissions và audit log.
- React sở hữu tương tác giao diện; renderer 3D hoạt động qua một Viewer Adapter.
- IfcOpenShell worker là nguồn xử lý IFC chính; không parse lại IFC bằng web-ifc trong luồng chính.
- UI, AI và MCP cùng gọi Application API. Không tạo ba bộ logic nghiệp vụ.
- Tách ModelVersion, CheckRun, Finding, Conflict và Issue để theo dõi thay đổi chính xác.
- Phát triển từng luồng hoàn chỉnh; kiến trúc mở rộng module nhưng chưa xây marketplace/plugin runtime.

## Tiếp tục G1

Đã có fixtures, cache nhị phân/mapping, federation/transform, clash chéo file và import jobs có hủy. Còn đóng gói worker trên máy sạch, benchmark IFC lớn và hoàn thiện quản lý phiên bản. Chưa đánh dấu G0/G1 hoàn thành.

## Thử kiểm tra hình học

Chọn **Kiểm tra mô hình**, giữ nguồn Riverside IFC tổng hợp, nhóm IfcDuctSegment và IfcBeam, toàn công trình, 2 mm rồi chạy. Bộ mẫu cho 42 giao cắt, coverage 147/147. Chọn một dòng để tới tầng, cấu kiện và marker giao cắt. Chọn nhiều IFC trong nhóm A/B để kiểm chéo file. Nút Hủy tải dừng job trước bước lưu; khi dựng hình học có thanh tiến trình theo số cấu kiện, hủy và tiếp tục tải.

Chi tiết cache và federation: [ADR 002](docs/decisions/002-federation-and-render-cache.md). Kiểm tra bằng `pnpm test:worker`, `pnpm test:core`, `pnpm test:geometry`, `pnpm test:federation`.


## Pilot Công Báo có đăng nhập

Mở http://127.0.0.1:18420/?cde=1 qua SSH tunnel. Tài khoản quản trị tạo thành viên với đơn vị và vai trò trong màn hình Thành viên. Riverside là workspace có sẵn. Tài khoản quản trị hệ thống có thể tạo dự án mới và phân quyền từng đơn vị trong mỗi dự án. WIP được giới hạn theo đơn vị sở hữu mã hồ sơ. Hồ sơ đã chia sẻ được thành viên dự án xem. Quản trị dự án phát hành hồ sơ và quản lý quyền. Vai trò Kiểm duyệt có thể duyệt, trả lại hồ sơ và đóng issue. Mật khẩu được băm Argon2, session có hạn 8 giờ và bị thu hồi khi đăng xuất.

Desktop có nút Kết nối pilot Công Báo. Sau đăng nhập, desktop tải mô hình và issue từ cùng API với web, cập nhật mô hình mỗi 8 giây và issue mỗi 3 giây. Nhập IFC ở chế độ này lưu lên pilot. Chế độ desktop local giữ workspace SQLite của máy trạm. Hàng đợi hợp nhất thay đổi offline còn ở giai đoạn tiếp theo.

Kiểm thử quyền bằng cargo build -p qabim-host --bin qabim-local rồi python scripts/verify_security.py. Bài thử tạo workspace tạm, kiểm tra chặn truy cập ẩn danh, WIP/geometry/job giữa hai đơn vị, quyền duyệt và thu hồi phiên.


Để mời đơn vị, chọn dự án rồi mở Quản lý dự án và đơn vị. Nhập tên đơn vị và chọn vai trò Quản trị dự án, Kiểm duyệt, Phối hợp hoặc Chỉ xem. Link mời có hiệu lực 7 ngày và dùng một lần. Người có tài khoản đăng nhập để nhận lời mời. Người chưa có tài khoản tạo tài khoản từ link. Với pilot Công Báo, người nhận cần truy cập được qua VPN và SSH tunnel.

Mỗi dự án mới lưu database, IFC và geometry riêng dưới .local/projects/<project-id>. Riverside tiếp tục dùng volume và cấu trúc cũ. Tài khoản, phiên, dự án và quyền đơn vị nằm ở database đăng ký chung. Sao lưu toàn bộ volume để giữ cả dữ liệu và cấu hình quyền.
