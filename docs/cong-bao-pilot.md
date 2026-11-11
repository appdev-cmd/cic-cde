# CIC CDE pilot tại Công Báo

## Triển khai thực tế ngày 11/11/2026

Pilot đã được build và chạy tại `/home/hello/qabim-pilot` trên `hello-sv`. Hai container là `qabim-pilot-api-1` và `qabim-pilot-web-1`. Image API có ID `a76797cf6d29`, image web có ID `6db09110cf03`. Cổng truy cập trên VM là `127.0.0.1:18420`. Trên máy trạm đã mở SSH tunnel cùng cổng để dùng `http://127.0.0.1:18420/?cde=1`.

Bài thử đã nhập `pilot-smoke.ifc`, nhận 2 cấu kiện, đọc cache QBM1 496 byte, ghi hồ sơ `PILOT-IFC-001` và xác nhận hồ sơ còn sau khi restart riêng API QA BIM. Model ID là `df56124107788946`. Sau thử nghiệm QLDA trả HTTPS 200 và các container QLDA có healthcheck vẫn healthy. Máy còn khoảng 10,4 GiB RAM khả dụng và 186 GB đĩa trống tại thời điểm kết thúc.

Pilot dùng SQLite riêng và truy cập qua SSH tunnel. Tunnel phải đang hoạt động trên máy trạm. Dữ liệu thử là IFC tổng hợp hai cấu kiện, chưa phải phép đo tải file sản xuất lớn.

Phương án hiện chọn là Docker Compose riêng trên VM QLDA. Stack `qabim-pilot` dùng network và volume `qabim-pilot_workspace` do Compose tạo. PostgreSQL, MinIO, ingress và tài khoản của QLDA không được gắn vào stack. Bản này giữ SQLite cho pilot qua SSH tunnel.

Trên máy build Linux x86_64 chạy `docker compose -f deploy/cong-bao/compose.yaml build`. Chuyển hai image đã build lên VM, sau đó chạy `docker compose -f deploy/cong-bao/compose.yaml up -d --no-build` trong bản checkout QA BIM riêng. Kiểm tra `curl --fail http://127.0.0.1:18420/api/health` trên VM.

Từ máy trạm mở tunnel `ssh -N -o ExitOnForwardFailure=yes -L 127.0.0.1:18420:127.0.0.1:18420 hello@10.112.38.96` rồi truy cập `http://127.0.0.1:18420/?cde=1`. Dùng riêng lệnh `docker compose -f deploy/cong-bao/compose.yaml stop` để dừng pilot. Giữ volume khi cập nhật hoặc dừng stack.

API được giới hạn 1,5 CPU và 2 GiB RAM. Web được giới hạn 0,25 CPU và 128 MiB RAM. Kiểm tra dung lượng đĩa và tài nguyên trước khi bật stack, sau đó theo dõi cả hai ứng dụng khi nhập một IFC mẫu. Volume lưu SQLite và bản IFC. Cần sao lưu volume riêng trước khi đưa dữ liệu dự án vào pilot.

Rà soát hồ sơ QLDA cho thấy báo cáo vận hành ngày 21/10/2026 ghi nhận VM QLDA dùng 5,1/16 GB RAM và 43/244 GB đĩa. Đây là số liệu mới hơn báo cáo phân vùng 48 GB ngày 01/10. Đường SSH qua VPN hiện timeout. Hồ sơ bàn giao chỉ ghi đường quản trị VM QLDA, chưa có đường quản trị cụm VMware hoặc số liệu dung lượng datastore còn có thể cấp cho VM QA BIM.

## Phương án VM riêng nếu tách hạ tầng sau pilot

Cấp một VM Ubuntu 24.04 x64 riêng cho QA BIM trên cụm VMware. Cấu hình thử ban đầu là 4 vCPU, 8 GiB RAM và 80 GiB đĩa hệ thống. Dùng datastore được quản trị viên chấp thuận. Tách kho IFC/PDF và backup khỏi đĩa hệ thống, cấp dung lượng theo số phiên bản, dung lượng IFC/PDF, cache và thời gian lưu thực tế. Các con số trên là cấu hình đề xuất để đo pilot.

VM cần IP nội bộ, tên DNS riêng, HTTPS và truy cập SSH quản trị qua VPN. PostgreSQL và kho đối tượng dùng tài khoản, dữ liệu và lịch sao lưu riêng cho QA BIM. Phân quyền người dùng theo dự án. Cấp quyền truy cập đối tác theo phương án mạng do Công Báo duyệt.

## Điều kiện triển khai

1. Quản trị viên VMware xác nhận CPU và RAM có thể cấp, tải giờ cao điểm, dung lượng datastore sau khi tính snapshot/backup, và chỗ dự phòng còn lại cho QLDA. Số liệu từ VM QLDA không thay thế được số liệu của cụm.
2. Cấp VM riêng, xác nhận SSH qua VPN và đường truy cập HTTPS. Triển khai QA BIM trên VM mới bằng tài khoản dịch vụ riêng.
3. Hoàn thiện bản server Linux với API cùng origin, PostgreSQL, kho file riêng tư và đăng nhập/phân quyền dự án. Bản CDE hiện tại dùng SQLite và API loopback cho môi trường local.
4. Chạy thử một job IFC đồng thời trên bộ mô hình đại diện. Đo RAM đỉnh, CPU, thời gian xử lý và độ trễ QLDA trong cùng khoảng đo. Kiểm thử quyền giữa hai dự án, tải IFC, đồng bộ desktop, và khôi phục cả metadata lẫn file gốc trước khi mở pilot.


## Cập nhật đăng nhập và phối hợp ngày 11/11/2026

Pilot đã bật QABIM_AUTH_REQUIRED=1. API và geometry yêu cầu session hợp lệ. Quyền admin/member và đơn vị lấy từ database ở mỗi request. Tài khoản bootstrap là cic.admin. Hai tài khoản pilot.arc và pilot.mep phục vụ thử cách ly ARC/MEP. Thông tin đăng nhập nằm trong file .local/cic-cde-accounts.json trên máy phát triển, ngoài bundle triển khai.

Trước cập nhật đã dừng riêng API và sao lưu volume vào /home/hello/qabim-pilot/backups/pre-auth-20261111.tar.gz. Hai image cũ giữ tag before-auth để phục hồi có kiểm soát.

Kiểm thử live đã xác nhận WIP và geometry riêng bị chặn, hai mô hình Shared xuất hiện cho cả ARC/MEP, request từ origin desktop được chấp nhận, 42 va chạm sinh từ hai IFC, bình luận issue dùng chung và session bị thu hồi khi logout. Giao diện web ARC và desktop MEP đã đăng nhập và mở cùng issue ISS-001 tại tầng L01. Hồ sơ cũ chưa gắn đơn vị sở hữu WIP được giữ ở phạm vi admin.

Tại thời điểm cập nhật đăng nhập, pilot dùng một dự án và hai vai trò. Bản remote desktop dùng kết nối online qua tunnel.

## Cập nhật quản lý nhiều dự án ngày 11/11/2026

Pilot đang chạy image API `0a6f4ca6b581` và web `1e3faaa3746a`. Trước khi nâng cấp, đã sao lưu volume vào `/home/hello/qabim-pilot/backups/pre-projects-20261111.tar.gz` và giữ hai image cũ dưới tag `before-projects`. QLDA trả HTTPS 200 sau cập nhật.

Riverside Tower giữ workspace cũ. Mỗi dự án mới có database, IFC và cache hình học riêng. Tài khoản dùng chung, nhưng tư cách tham gia và quyền của từng đơn vị được kiểm tra theo dự án. Quản trị hệ thống có thể tạo dự án. Quản trị dự án có thể mời đơn vị và đổi hoặc thu hồi quyền trong dự án của mình. Bốn vai trò là Quản trị dự án, Kiểm duyệt, Phối hợp và Chỉ xem.

Tại bộ chọn dự án, mở **Quản lý dự án và đơn vị**. Nhập tên đơn vị, chọn vai trò, rồi bấm **Tạo link mời**. Link dùng một lần, hết hạn sau 7 ngày và cần được gửi trực tiếp cho người nhận. Tài khoản hiện có phải thuộc đúng đơn vị; người chưa có tài khoản có thể đăng ký từ link. Với pilot hiện tại, máy người nhận phải có đường truy cập qua VPN và SSH tunnel. Web và desktop ở chế độ remote dùng cùng dữ liệu online; chưa hỗ trợ hợp nhất thay đổi offline.

Bài thử live giữ nguyên hồ sơ và issue ở Riverside, nhập IFC vào **CIC CDE - Dự án thử số 2**, và xác nhận ARC có vai trò Phối hợp ở Riverside, Kiểm duyệt ở dự án thử. MEP chỉ xem ở dự án thử và bị từ chối ghi dữ liệu. Thu hồi quyền của MEP ở dự án thử không ảnh hưởng Riverside; quyền Chỉ xem được khôi phục sau bài thử. Lời mời đã dùng bị từ chối và API geometry chấp nhận origin desktop. Giao diện web đã được kiểm tra khi chuyển dự án và mở bảng phân quyền đơn vị.

## Tên miền cde.cic.com.vn ngày 11/11/2026

DNS công khai đã trả `113.164.232.106`. Gateway đứng trước VM đang trả trang chào mừng của Trung tâm dữ liệu cho HTTP và chứng chỉ không khớp hostname cho HTTPS. File kiểm tra `http://cde.cic.com.vn/.well-known/acme-challenge/ciccde-route-check-20261111` chưa đến VM. Bản public chưa sẵn sàng sử dụng.

Trên VM đã cài virtual host HTTP cho `cde.cic.com.vn`, đường ACME webroot và proxy sang web CIC CDE. Ingress `supabase-nginx` và web CIC CDE nối qua mạng Docker nội bộ `ciccde-edge`. API và kho workspace tiếp tục nằm trong network riêng của CDE. Network của ingress được khai báo thêm trong `/opt/qlda/selfhost/docker-compose.prod.yml` để được giữ khi recreate container. Cấu hình hostname CDE nằm tại `/opt/qlda/selfhost/nginx/ssl/ciccde-http.conf`, được include trong khối HTTP của Nginx. Đã kiểm tra `nginx -t` và reload thành công.

Khi cập nhật CDE trên VM, dùng cả hai file Compose để giữ cấu hình public và network của web.

```bash
cd /home/hello/qabim-pilot
docker compose -f deploy/cong-bao/compose.yaml -f deploy/cong-bao/compose.public.yaml up -d --no-build
```

API nhận origin `https://cde.cic.com.vn` đồng thời với origin tunnel. Proxy đặt cookie của hostname public thành `Secure`, `HttpOnly`, `SameSite=Strict`. Cổng loopback `18420` tiếp tục phục vụ pilot. Backup trước cập nhật nằm tại `/home/hello/qabim-pilot/backups/pre-domain-20261111/`, gồm volume workspace và hai file cấu hình ingress. Các image cũ được giữ dưới tag `before-domain`.

Kiểm thử qua địa chỉ VM, với `Host: cde.cic.com.vn` và header mô phỏng TLS offload, đã đạt đăng nhập/đăng xuất, cookie bảo mật, chặn origin ngoài danh sách, tải IFC và đọc geometry, chặn viewer tải lên, nhận lời mời đúng đơn vị và từ chối dùng lại. Đã tạo dự án **Kiểm thử tên miền CIC CDE** với ARC Kiểm duyệt và MEP Chỉ xem. Đây là kiểm thử nội bộ qua HTTP trên VPN. HTTPS công khai, đăng nhập trong trình duyệt qua domain và mở link mời public đang chờ gateway. QLDA tiếp tục trả HTTPS 200 sau cập nhật.

### Thông tin cần cấu hình tại gateway Công Báo

| Thuộc tính | Giá trị |
|---|---|
| Hostname / SNI | `cde.cic.com.vn` |
| TLS công khai | Chứng chỉ hợp lệ cho `cde.cic.com.vn` và gia hạn tự động tại gateway |
| Backend khi TLS offload | `http://10.112.38.96:80` |
| Host chuyển tiếp | `cde.cic.com.vn` |
| X-Forwarded-Proto khi HTTPS | `https` |
| Giới hạn body | `100m`, đồng bộ với API hiện tại |
| Timeout đọc/gửi | `150s` |
| HTTP | Chuyển HTTP sang HTTPS, cho phép ACME challenge khi dùng HTTP-01 |

Sau khi thêm route, kiểm tra file ACME ở trên trả đúng chuỗi `ciccde-congbao-route-ok`, chứng chỉ public hợp lệ và trang `https://cde.cic.com.vn/?cde=1` mở được. Sau đó chạy lại bài thử qua HTTPS thực và kiểm tra trình duyệt. Khi gateway dùng TLS offload, chứng chỉ public được quản lý tại gateway. Nếu triển khai TLS pass-through về VM, file `deploy/cong-bao/nginx-edge-https.conf` đã chuẩn bị sẵn, cần cấp chứng chỉ và hook gia hạn/reload trước khi enable include của file đó.

Hồ sơ bàn giao và lịch sử triển khai QLDA đã tra cứu cung cấp quyền SSH vào VM `hello@10.112.38.96`. Tài liệu `YEU-CAU-BAT-WEBSOCKET-GATEWAY.md` mô tả việc nhờ quản trị Công Báo chỉnh gateway. Chưa tìm thấy tài khoản hoặc đường quản trị gateway trong các nguồn đã kiểm tra.
