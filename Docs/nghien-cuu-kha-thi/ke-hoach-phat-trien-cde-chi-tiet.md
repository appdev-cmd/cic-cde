# KẾ HOẠCH PHÁT TRIỂN CHI TIẾT NỀN TẢNG CDE CIC
## Bám sát Báo cáo Nghiên cứu Khả thi & Hành lang Pháp lý 2026

Tài liệu này chi tiết hóa kế hoạch phát triển kỹ thuật cho nền tảng Môi trường Dữ liệu chung (CDE CIC) phục vụ ngành xây dựng Việt Nam. Kế hoạch được xây dựng trên cơ sở Luật Xây dựng số 135/2025/QH15, các Nghị định số 217, 212, 206, 207, 210 ban hành năm 2026 và Quy chuẩn An ninh mạng QCVN 12:2026/BCA.

---

## 1. Kiến trúc Hệ thống Tổng thể & Phân bổ Công nghệ (Polyglot Architecture)

Hệ thống được phát triển theo kiến trúc vi dịch vụ đa ngôn ngữ (Polyglot Microservices), phân bổ công nghệ tối ưu theo thế mạnh của từng ngôn ngữ nhằm tiết kiệm tài nguyên hạ tầng Cloud và đẩy nhanh tốc độ hoàn thiện sản phẩm.

### 1.1. Sơ đồ Cấu trúc Phân lớp Công nghệ
* **Phân lớp Giao diện (Frontend - TypeScript & Next.js 15)**: Giao diện người dùng web chính sử dụng React 19 và bộ dựng hình 3D BIM Viewer tích hợp.
* **Phân lớp Điều phối & API (Core Backend - Golang)**: Trục trung tâm xử lý API Gateway, phân quyền Keycloak, quản lý vòng đời tài liệu ISO 19650 và thông báo thời gian thực qua WebSockets.
* **Phân lớp Tính toán Nặng & AI (BIM/AI Backend - Python)**: Xử lý phân tích tệp tin IFC (IfcOpenShell), công cụ bóc tách khối lượng (QTO) và bộ máy kiểm tra quy chuẩn tự động (ACC Engine).
* **Phân lớp Lưu trữ (Database & Storage)**: PostgreSQL (lưu trữ metadata và cây cấu trúc không gian), Redis (bộ đệm và hàng đợi thông báo), vStorage/MinIO S3 (lưu trữ tệp tin thiết kế gốc) và phân vùng WORM (lưu trữ nhật ký kiểm toán bất biến).

### 1.2. Phân bổ Vai trò Kỹ thuật chi tiết
* **Golang**: Xử lý API, xác thực, và workflow tài liệu nhờ cơ chế Goroutines hiệu năng cao, tiêu tốn ít RAM (~2KB bộ nhớ cho mỗi kết nối so với 1MB của Java/Thread), hỗ trợ co giãn linh hoạt trên Kubernetes (VKE).
* **Python**: Tập trung cho các thư viện BIM chuyên sâu. Sử dụng IfcOpenShell Core (C++ wrapper) để phân tích hình học và thuộc tính của mô hình BIM, thực hiện bóc tách khối lượng (QTO) và vận hành bộ máy suy diễn quy luật.
* **TypeScript**: Hợp nhất toàn bộ logic hiển thị trên trình duyệt. Bộ dựng hình sử dụng ThatOpen Engine (web-ifc WASM) trong Giai đoạn 1 và chuyển dần sang luồng Streaming Format (.cic3d) tự chủ trong Giai đoạn 2.

---

## 2. Kế hoạch Phát triển Chi tiết 5 Phân hệ R&D

### 2.1. Phân hệ 1: Engine Đồ họa IFC & OpenBIM Viewer
* **Mục tiêu**: Hiển thị mô hình BIM định dạng mở (IFC) hiệu năng cao trên trình duyệt, hỗ trợ điều phối đa mô hình và tiến tới tự chủ 100% công nghệ hiển thị.
* **Lộ trình phát triển**: Tháng 1 - Tháng 18.
* **Ngân sách CAPEX**: 1.00 tỷ VNĐ.

#### 2.1.1. Các tính năng chi tiết
1. **Đọc và Dựng hình IFC Client-side (Tháng 1 - 6)**:
   - Tích hợp ThatOpen Engine (web-ifc) biên dịch sang WebAssembly (WASM) chạy trực tiếp trên trình duyệt.
   - Hỗ trợ hiển thị cây cấu trúc không gian (Spatial Tree: Project -> Site -> Building -> Storey -> Element).
   - Các công cụ tương tác cơ bản: Di chuyển (Orbit/Pan/Zoom), Cắt mặt phẳng (Clipping Plane), Đo kích thước (Measurement), Ẩn/Hiện cấu kiện (Isolate/Hide/Ghost).
2. **Điều phối Đa Mô hình (Model Federation) (Tháng 4 - 9)**:
   - Cho phép tải và ghép nhiều tệp mô hình IFC của các bộ môn khác nhau (Kiến trúc, Kết cấu, MEP) vào cùng một không gian tọa độ dùng chung.
   - Bật/Tắt hiển thị từng mô hình riêng lẻ và quản lý thuộc tính tổng hợp.
3. **Hệ thống Quản lý Sự vụ & Góc nhìn (BCF & Viewpoints) (Tháng 6 - 12)**:
   - Lưu trữ góc nhìn camera, trạng thái ẩn/hiện cấu kiện và ảnh chụp màn hình (Viewpoint) vào cơ sở dữ liệu.
   - Tích hợp chuẩn mở BCF (BIM Collaboration Format) để xuất/nhập danh sách lỗi phối hợp thiết kế dưới dạng tệp `.bcfzip`.
4. **Phát hiện Xung đột Hình học Client-side (Tháng 8 - 14)**:
   - Thực hiện thuật toán kiểm tra giao cắt giữa các hộp bao (Bounding Box) và lưới tam giác (Mesh) của các cấu kiện thuộc các bộ môn khác nhau trực tiếp trên trình duyệt.
5. **Xây dựng Pipeline Streaming (.cic3d) & Tự chủ Đồ họa (Tháng 10 - 18)**:
   - Phát triển công cụ server-side (Python) phân tích tệp IFC lớn thành các phân đoạn hình học nhỏ, nén bằng thuật toán Google Draco và lưu trữ dưới dạng các mảnh 3D (Tiled Chunks).
   - Phát triển trình xem client-side sử dụng Three.js thuần túy để tải các mảnh hình học theo yêu cầu của camera (LOD tự động), hỗ trợ tải các mô hình siêu lớn (>500MB) trên thiết bị di động mà không gây quá tải RAM.

#### 2.1.2. Tiêu chí nghiệm thu (Acceptance Criteria)
* Hiển thị tệp IFC dung lượng dưới 100MB trên trình duyệt trong thời gian dưới 10 giây ở Phase 1.
* Tải luồng dữ liệu mảnh (.cic3d) hiển thị khung hình đầu tiên trong dưới 5 giây đối với tệp mô hình trên 500MB ở Phase 2.
* Xuất và nhập tệp BCF 2.1 thành công, tương thích với các phần mềm BIM thương mại (Revit, Navisworks).

---

### 2.2. Phân hệ 2: Quản lý Tài liệu Dự án Số theo Tiêu chuẩn ISO 19650
* **Mục tiêu**: Xây dựng môi trường lưu trữ và điều phối hồ sơ dự án xây dựng chuẩn hóa, kiểm soát chặt chẽ vòng đời tài liệu theo tiêu chuẩn quốc tế ISO 19650.
* **Lộ trình phát triển**: Tháng 1 - Tháng 12.
* **Ngân sách CAPEX**: 0.70 tỷ VNĐ.

#### 2.2.1. Các tính năng chi tiết
1. **Quản lý 4 Trạng thái Tài liệu (Container States) (Tháng 1 - 6)**:
   - Thiết lập các phân vùng lưu trữ riêng biệt trên vStorage tương ứng với:
     - *WIP (Work in Progress)*: Khu vực soạn thảo nội bộ của từng bộ môn.
     - *Shared*: Khu vực chia sẻ hồ sơ đã qua kiểm duyệt nội bộ để các bộ môn khác tham chiếu.
     - *Published*: Khu vực chứa hồ sơ chính thức đã được Chủ đầu tư phê duyệt, dùng làm căn cứ pháp lý để thi công.
     - *Archived*: Khu vực lưu trữ lịch sử, đóng băng toàn bộ dữ liệu để phục vụ thanh tra pháp lý sau này.
2. **Bộ máy Kiểm soát Đặt tên Tự động (Naming Convention Engine) (Tháng 3 - 8)**:
   - Thiết lập công cụ kiểm tra chuỗi ký tự đặt tên tệp tin (Regex) tại backend Go theo đúng chuẩn ISO 19650 (gồm các trường: Dự án - Bên phát hành - Phân khu - Mặt cắt - Loại tệp - Bộ môn - Số thứ tự).
   - Tự động từ chối và gửi cảnh báo khi người dùng tải lên tệp tin sai định dạng.
3. **Quản lý Siêu dữ liệu & Phiên bản (Metadata & Revision Control) (Tháng 5 - 10)**:
   - Quản lý mã phù hợp (Suitability Codes: S0, S1, S2, D1, A1...) biểu thị mục đích sử dụng của tài liệu.
   - Quản lý mã phiên bản (Revision Codes) tự động nâng cấp phiên bản (ví dụ: từ bản nháp `P01.01` sang bản chính thức `C01` khi được xuất bản).
   - Lưu trữ mã băm SHA-256 của từng tệp tin để chống giả mạo.
4. **Luồng Phê duyệt Số hóa & Chữ ký số (Gate Workflows) (Tháng 7 - 12)**:
   - Xây dựng luồng phê duyệt chuyển trạng thái tài liệu (từ WIP sang Shared qua Gate 1, và từ Shared sang Published qua Gate 2).
   - Tích hợp cổng ký số điện tử (chữ ký số công cộng dùng USB Token hoặc ký số đám mây) trực tiếp vào tệp PDF bản vẽ và tệp mô hình BIM.
5. **Kế hoạch Bàn giao Thông tin (MIDP/TIDP Tracking) (Tháng 9 - 12)**:
   - Cho phép thiết lập danh mục tài liệu cần bàn giao theo tiến độ dự án (Master Information Delivery Plan - MIDP và Task Information Delivery Plan - TIDP).
   - Tự động đối chiếu hồ sơ thực tế đã nạp với kế hoạch để đưa ra cảnh báo trễ hạn hoặc thiếu hồ sơ.

#### 2.2.2. Tiêu chí nghiệm thu (Acceptance Criteria)
* Hệ thống tự động chặn 100% các tệp tải lên sai quy chuẩn đặt tên đã cấu hình.
* Lưu trữ lịch sử phiên bản đầy đủ, cho phép truy xuất và tải lại các phiên bản cũ của tài liệu trong phân vùng lưu trữ.
* Luồng phê duyệt gửi thông báo thời gian thực đến đúng tài khoản có vai trò kiểm duyệt (Checker/Approver) thông qua WebSockets.

---

### 2.3. Phân hệ 3: Cổng Liên thông CSDL Quốc gia & Hỗ trợ Thẩm định QLNN (B2G Module)
* **Mục tiêu**: Hỗ trợ các cơ quan quản lý nhà nước (Sở Xây dựng, Bộ Xây dựng) tự động hóa công tác thẩm định thiết kế cơ sở và đồng bộ dữ liệu dự án lên Cơ sở dữ liệu quốc gia về hoạt động xây dựng theo NĐ 212 và NĐ 217.
* **Lộ trình phát triển**: Tháng 4 - Tháng 14.
* **Ngân sách CAPEX**: 0.60 tỷ VNĐ.

#### 2.3.1. Các tính năng chi tiết
1. **Số hóa Quy chuẩn Kỹ thuật Quốc gia thành Quy luật Máy đọc (JSON/XML Rules) (Tháng 4 - 8)**:
   - **QCVN 01:2026/BXD (Quy chuẩn Quy hoạch)**: Số hóa các công thức tính toán mật độ xây dựng tối đa, hệ số sử dụng đất, khoảng lùi công trình tối thiểu theo chiều cao và chỉ giới đường đỏ.
   - **QCVN 06:2026/BXD (An toàn cháy)**: Số hóa các thông số giới hạn khoảng cách lối thoát nạn, số lượng lối thoát hiểm tối thiểu, giới hạn chịu lửa yêu cầu của các cấu kiện chính.
   - **QCVN 09:2026/BXD (Hiệu quả năng lượng)**: Số hóa chỉ số truyền nhiệt vỏ bao che và hiệu suất thiết bị.
2. **Bộ máy Kiểm tra Tuân thủ Tự động (ACC Engine - Python Backend) (Tháng 6 - 11)**:
   - Sử dụng IfcOpenShell để trích xuất tọa độ vật lý, kích thước và thuộc tính của toàn bộ cấu kiện từ tệp IFC.
   - Chạy thuật toán đối chiếu hình học và thuộc tính với bộ luật quy chuẩn đã số hóa. Tự động gắn nhãn Đạt/Không đạt (Pass/Fail) cho từng tiêu chí.
3. **Tính năng Hỗ trợ Thẩm định Thiết kế Cơ sở chuyên biệt (Tháng 8 - 12)**:
   - *Kiểm tra ranh giới đất*: Chiếu mô hình GeoBIM 3D lên bản đồ GIS đã số hóa chỉ giới đường đỏ để phát hiện lỗi vi phạm khoảng lùi.
   - *Thẩm duyệt PCCC tự động*: Chạy thuật toán tìm đường (Pathfinding) trong không gian 3D của tòa nhà để đo khoảng cách thực tế từ các căn hộ đến thang thoát hiểm, đối chiếu trực tiếp với quy chuẩn QCVN 06.
   - *Trích xuất chỉ tiêu quy hoạch tự động*: Tự động tính toán tổng diện tích sàn (GFA), diện tích hữu dụng (NFA), mật độ xây dựng dựa trên hình học thực của mô hình BIM để đối chiếu với giấy phép quy hoạch, ngăn chặn việc gian lận hoặc sai số thủ công.
4. **Cổng Liên thông CSDL Quốc gia (`csdlhdxd.gov.vn`) (Tháng 10 - 14)**:
   - Thiết lập cổng API RESTful kết nối đồng bộ dữ liệu dự án và mô hình BIM hoàn công đã thẩm định lên Cổng thông tin CSDL quốc gia theo yêu cầu của Nghị định 212/2026/NĐ-CP.
   - Hỗ trợ đóng gói hồ sơ số hóa gồm mô hình IFC định dạng mở và siêu dữ liệu đi kèm.

#### 2.3.2. Tiêu chí nghiệm thu (Acceptance Criteria)
* Trích xuất các chỉ tiêu diện tích sàn (GFA) từ mô hình IFC với sai số hình học dưới 1% so với tính toán thủ công.
* Phát hiện chính xác các cấu kiện vi phạm khoảng lùi đô thị và tự động gắn nhãn lỗi kèm tọa độ 3D trên viewer.
* Đồng bộ thành công dữ liệu kiểm thử sang cổng mô phỏng API của CSDL quốc gia.

---

### 2.4. Phân hệ 4: Bộ Cài đặt An ninh Đạt chuẩn QCVN 12 & SSO VNeID
* **Mục tiêu**: Bảo vệ hệ thống thông tin CDE CIC đạt các tiêu chuẩn an ninh nghiêm ngặt cấp độ hành chính công của Quy chuẩn QCVN 12:2026/BCA.
* **Lộ trình phát triển**: Tháng 6 - Tháng 18.
* **Ngân sách CAPEX**: 0.70 tỷ VNĐ.

#### 2.4.1. Các tính năng chi tiết
1. **Hệ thống Định danh SSO tích hợp VNeID & MFA (Tháng 6 - 10)**:
   - Tích hợp Keycloak làm trung tâm quản lý định danh. Kết nối API với Cổng định danh điện tử quốc gia VNeID (theo Nghị định 59/2022/NĐ-CP) qua giao thức OIDC/SAML 2.0.
   - Hỗ trợ đăng nhập không dùng mật khẩu cho cán bộ nhà nước bằng cách quét mã QR VNeID.
   - Triển khai bắt buộc xác thực đa nhân tố (MFA - TOTP/Hardware Token) cho các tài khoản có quyền phê duyệt hồ sơ và tài khoản quản trị viên.
2. **Nhật ký Kiểm toán Bất biến (Audit Trail WORM) (Tháng 8 - 12)**:
   - Thiết lập phân vùng đĩa Append-only chống ghi đè, áp dụng cơ chế WORM (Write Once, Read Many).
   - Tự động băm mã hóa SHA-256 các bản ghi log và liên kết chuỗi (cryptographic chaining) để ngăn chặn hành vi sửa đổi log từ quản trị viên.
   - Ghi nhận đầy đủ lịch sử: thời gian, địa chỉ IP, định danh cá nhân, hành động cụ thể trên từng tệp bản vẽ/mô hình BIM.
3. **Phân vùng Mạng An toàn & Giám sát SIEM (Tháng 10 - 14)**:
   - Cấu hình tường lửa ứng dụng web (WAF) ở Public Zone để chặn các tấn công OWASP Top 10.
   - Cách ly hoàn toàn Database Zone và Private Zone chứa cụm VKE K8s, chỉ cho phép kết nối nội bộ.
   - Triển khai công cụ giám sát an ninh tập trung Wazuh SIEM để phát hiện và cảnh báo các hành vi xâm nhập bất thường 24/7.
4. **Hạ tầng Dual-Cloud & Air-gapped Backup (Tháng 12 - 18)**:
   - Cấu hình đồng bộ cơ sở dữ liệu bất đối xứng thời gian thực từ Viettel Cloud (Primary Site) sang VNPT Cloud (Standby Site).
   - Triển khai quy trình sao lưu 3-2-1 với phân vùng sao lưu độc lập vật lý (Air-gap) hàng tuần để ngăn ngừa mã độc tống tiền (Ransomware).
   - Vận hành cơ chế chuyển đổi dự phòng tự động (Failover) khi cụm máy chủ chính gặp sự cố đường truyền.

#### 2.4.2. Tiêu chí nghiệm thu (Acceptance Criteria)
* Đăng nhập thành công bằng tài khoản VNeID mô phỏng và bắt buộc kích hoạt MFA khi phê duyệt tài liệu.
* Log hệ thống được ghi nhận đầy đủ vào phân vùng WORM và không thể bị xóa bởi tài khoản root/admin.
* Đạt chứng nhận đánh giá an toàn thông tin độc lập (Pentest đạt yêu cầu không còn lỗi nghiêm trọng) từ đơn vị chuyên môn được cấp phép trước khi nộp hồ sơ lên Cục An ninh mạng (A05 - Bộ Công an).

---

### 2.5. Phân hệ 5: Đóng gói SaaS Thương mại hóa, Đào tạo & Chuyển giao
* **Mục tiêu**: Đóng gói sản phẩm để đưa ra thị trường thương mại, hỗ trợ triển khai linh hoạt cả trên nền tảng đám mây (SaaS) lẫn lắp đặt tại chỗ (On-Premise) cho khách hàng doanh nghiệp và cơ quan nhà nước.
* **Lộ trình phát triển**: Tháng 10 - Tháng 18.
* **Ngân sách CAPEX**: 0.50 tỷ VNĐ.

#### 2.5.1. Các tính năng chi tiết
1. **Đóng gói Đa Khách thuê (Multi-tenant SaaS Engine) (Tháng 10 - 14)**:
   - Thiết lập cơ chế cách ly dữ liệu giữa các khách hàng thuê dịch vụ (Tenants) trên cùng một hạ tầng dùng chung thông qua chính sách phân vùng cơ sở dữ liệu (Schema-level isolation) và siết chặt chính sách bảo mật cấp dòng (RLS - Row Level Security) trong PostgreSQL.
   - Tích hợp cổng thanh toán trực tuyến trong nước và hệ thống quản lý gói cước dịch vụ (Subscription & Billing).
2. **Bộ cài đặt Triển khai tại chỗ (On-Premise Deployment Package) (Tháng 12 - 16)**:
   - Đóng gói toàn bộ hệ thống dưới dạng các Docker Containers và cấu hình Helm Charts để dễ dàng triển khai trên hạ tầng máy chủ riêng của khách hàng (Ban Quản lý Dự án, Sở Xây dựng) chỉ với một vài câu lệnh.
   - Tối ưu hóa dung lượng bộ cài đặt và loại bỏ các kết nối ra ngoài Internet để chạy độc lập trong mạng nội bộ an toàn của cơ quan nhà nước.
3. **Bộ tài liệu Đào tạo & Chuyển giao Công nghệ (Tháng 14 - 18)**:
   - Xây dựng cẩm nang hướng dẫn sử dụng chi tiết cho từng vai trò người dùng (Chủ đầu tư, Nhà thầu, Đơn vị tư vấn, Chuyên viên thẩm định Sở).
   - Soạn thảo tài liệu quản trị kỹ thuật dành cho đội ngũ vận hành hệ thống của khách hàng On-Premise.
   - Tổ chức các chương trình đào tạo thử nghiệm cho các đối tác chiến lược của CIC.

#### 2.5.2. Tiêu chí nghiệm thu (Acceptance Criteria)
* Cơ chế Multi-tenant đảm bảo cách ly dữ liệu tuyệt đối, kiểm thử truy cập chéo giữa các tenant bị chặn hoàn toàn bởi chính sách RLS của PostgreSQL.
* Đóng gói thành công bộ cài đặt Docker chạy độc lập trong mạng nội bộ không có kết nối Internet (Offline Mode) đáp ứng yêu cầu của Sở Xây dựng.

---

## 3. Lộ trình Triển khai Tổng thể (18 tháng R&D)

Tiến độ phát triển các phân hệ được thiết kế đan xen nhằm đảm bảo các phân hệ nền tảng được hoàn thiện trước làm bệ đỡ cho các phân hệ nâng cao:

```
Tháng 01 - 06: [Phân hệ 1] Dựng hình IFC cơ bản client-side + [Phân hệ 2] Thiết lập trạng thái tài liệu WIP/Shared (ISO 19650)
Tháng 04 - 08: [Phân hệ 3] Khởi động số hóa quy chuẩn QCVN 01, 06, 09
Tháng 06 - 10: [Phân hệ 4] Tích hợp Keycloak SSO và kết nối cổng xác thực VNeID
Tháng 06 - 12: [Phân hệ 1] Hoàn thiện ghép mô hình liên hợp + [Phân hệ 2] Triển khai luồng phê duyệt Gate 1 & 2
Tháng 08 - 12: [Phân hệ 3] Phát triển bộ máy ACC Engine tự động kiểm tra khoảng lùi và PCCC + [Phân hệ 4] Thiết lập log WORM bất biến
Tháng 10 - 14: [Phân hệ 3] Hoàn thiện cổng API đồng bộ với CSDL quốc gia + [Phân hệ 5] Đóng gói kiến trúc đa khách thuê (Multi-tenant SaaS)
Tháng 12 - 18: [Phân hệ 1] Hoàn thiện công nghệ Streaming .cic3d + [Phân hệ 4] Triển khai Dual-Cloud & chạy quy trình hợp quy QCVN 12 + [Phân hệ 5] Đóng gói bộ cài On-Premise
```

---

## 4. Phân bổ CAPEX & Cơ cấu Nhân sự Vận hành (Mô hình AI-Conductor)

Để đảm bảo hiệu quả kinh tế cao nhất và kiểm soát dòng tiền tự đầu tư 100% của CIC, dự án áp dụng mô hình phát triển tinh gọn tối đa.

### 4.1. Định biên Nhân sự R&D
Đội ngũ trực tiếp phát triển hệ thống bao gồm đúng **02 nhân sự con người** phối hợp chặt chẽ với các công cụ trí tuệ nhân tạo (AI coding assistants) để tăng tốc độ sinh mã nguồn và tự động hóa kiểm thử:
1. **Lead CTO / Full-stack Developer (01 người)**:
   - Chịu trách nhiệm thiết kế kiến trúc hệ thống, viết mã nguồn các dịch vụ cốt lõi (Go Backend, React Frontend, Python IFC parser).
   - Vận hành các công cụ AI hỗ trợ lập trình, kiểm duyệt và tối ưu hóa chất lượng mã nguồn trước khi tích hợp.
   - Quỹ lương: 50 triệu VNĐ/tháng.
2. **Trợ lý Dev / QA / BA / Vận hành (01 người)**:
   - Chịu trách nhiệm phân tích yêu cầu nghiệp vụ xây dựng (ISO 19650, các quy chuẩn QCVN), viết tài liệu hướng dẫn, kiểm thử chất lượng phần mềm (Manual & Auto-testing) và hỗ trợ vận hành máy chủ Cloud.
   - Quỹ lương: 30 triệu VNĐ/tháng.

### 4.2. Bảng phân bổ Chi phí Đầu tư CAPEX (3.50 tỷ VNĐ)
Toàn bộ chi phí đầu tư trong 18 tháng được phân phối chặt chẽ vào các nhóm hạng mục phục vụ trực tiếp cho công tác nghiên cứu và đạt chứng nhận sản phẩm:

* **Nhân sự lõi (CAP-01)**: **2.00 tỷ VNĐ** (Chi phí lương cứng, bảo hiểm, bản quyền công cụ hỗ trợ AI và chi phí dự phòng milestone cho đội ngũ 2 người trong 18 tháng).
* **Thiết bị làm việc (CAP-02)**: **0.10 tỷ VNĐ** (Trang bị máy tính cấu hình cao phục vụ lập trình đồ họa 3D và xử lý dữ liệu lớn).
* **Bản quyền phần mềm & API (CAP-03)**: **0.30 tỷ VNĐ** (Chi phí đăng ký tài khoản API Google Gemini, bản quyền hạ tầng cơ sở dữ liệu và các chứng thư số phục vụ ký số điện tử).
* **Hoạt động Marketing & Tiếp cận thị trường (CAP-04)**: **0.50 tỷ VNĐ** (Chi phí tổ chức các buổi hội thảo giới thiệu giải pháp đến các Ban Quản lý Dự án và các Sở Xây dựng địa phương).
* **Tư vấn chuyên gia & Pháp lý an ninh (CAP-05)**: **0.60 tỷ VNĐ** (Chi phí thuê đơn vị chuyên môn đánh giá an toàn thông tin, rà quét mã nguồn độc lập và hoàn thiện hồ sơ đạt chứng nhận hợp quy QCVN 12 của Bộ Công an).

**Tổng chi phí CAPEX R&D**: **3.50 tỷ VNĐ** (Cam kết không phát sinh chi phí ngoài dự toán, đảm bảo biên an toàn tài chính cho CIC).
