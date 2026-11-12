# Rà soát và kế hoạch nâng cấp CIC CDE

Ngày đánh giá: 12/11/2026. Phạm vi: web, desktop local, API cloud, worker IFC, dữ liệu và quy trình phát hành.

CIC CDE đã có nền tảng pilot thực dụng cho quản lý mô hình, xem IFC/CAD, kiểm tra va chạm và phối hợp issue. Ưu tiên tiếp theo là thống nhất bản phát hành, hoàn thiện vòng đời thông tin và kiểm chứng vận hành nhiều người. Chưa đủ bằng chứng để tuyên bố toàn hệ thống đã đáp ứng ISO 19650 hoặc sẵn sàng triển khai đại trà.

## Cơ sở đánh giá

- Mã nguồn đang làm việc và mã phát hành `origin/main` tại `ebde437`; bản worker va chạm vừa phát hành đã được xác nhận READY ở lượt làm việc trước.
- Đọc migration và RPC; kiểm tra trực tiếp lịch sử migration, catalog và Supabase Advisors bằng thao tác chỉ đọc trên dự án CIC CDE.
- Chạy mới `pnpm test:geometry`: đạt trên 399 cấu kiện, 4.788 tam giác, 2 chunk; `pnpm test:core`: 3/3 đạt.
- Kế thừa kết quả ngay trước lượt rà soát này: 20 kiểm thử worker đạt; build local và bản phát hành đạt; API nhận kết quả từ worker; Riverside 42 va chạm toàn công trình, 6 ở L05; benchmark ba tệp SVDSP giữ 14 cặp và số đo sau tối ưu.
- Chưa chạy lại toàn bộ luồng trình duyệt cho từng vai trò, diễn tập khôi phục hay tải đồng thời nhiều người trong đợt này. Các nhận định về phần chưa có dựa trên mã nguồn đã đọc, không phải chứng nhận tuân thủ.

## Đánh giá từng phân hệ

| Phân hệ | Hiện trạng và bằng chứng | Phần cần hoàn thiện | Ưu tiên |
|---|---|---|---|
| Phát hành và cấu hình | Bản production có BEP, batch move CAD và viewer motion worker; cây làm việc hiện tại thiếu một số tệp tương ứng, đồng thời có nhiều thay đổi chưa commit | Hợp nhất trên nhánh sạch; kiểm kê frontend–API–migration–Edge Function; ngăn triển khai làm mất tính năng | P0 |
| Đăng nhập và tài khoản | Supabase Auth, đăng nhập, đăng xuất, khôi phục mật khẩu; cơ chế tài khoản/mời theo đơn vị | Kiểm thử hết hạn phiên, thu hồi quyền, lời mời dùng lại; xem xét bật bảo vệ mật khẩu rò rỉ; hướng dẫn quản trị tài khoản | P0/P1 |
| Dự án và thành viên | Tạo/chọn dự án, vai trò quyền truy cập, mời đơn vị; local có giao diện dashboard và thành viên mới | Hoàn tất đồng bộ chức năng local–cloud; xác nhận quyền quản trị dự án tạo tài khoản; phân biệt vai trò giao việc ISO với quyền dùng app | P0/P1 |
| Hồ sơ IFC và CDE | Đăng ký hồ sơ, lịch sử, chuỗi WIP → Shared → Review → Approved → Published → Archived; có kiểm tra trạng thái kỳ vọng | Tách trạng thái CDE với bước xét duyệt; giao nộp theo gói, ma trận người kiểm tra/cho phép/chấp thuận; lưu bằng chứng quyết định | P1 |
| BEP theo dự án | Mã phát hành có cấu hình mã sử dụng, tiền tố, số chữ số, bộ đếm sơ bộ/phát hành, phiên bản cấu hình và snapshot quy tắc trong hồ sơ; bảng BEP tồn tại trên DB | Bộ kiểm thử chuyển trạng thái, tranh chấp đồng thời, đổi BEP giữa vòng đời; đồng bộ desktop; giao diện giải thích và xem trước tác động | P1 |
| Hồ sơ cũ Rxx | `documentRevision` fallback Rxx khi chưa có mã mới; migration chỉ gắn quy tắc cho hồ sơ mới đăng ký | Đưa việc bảo toàn mã, hash, lịch sử hồ sơ cũ thành điều kiện bắt buộc của mỗi migration | P0/P1 |
| Tài liệu PDF/Office/EIR/BEP | Upload, danh mục, tìm kiếm, tải xuống và xóa qua bucket riêng; metadata một phần mã hóa trong tên object | Đưa vào sổ đăng ký information container; phiên bản, trạng thái sử dụng, phê duyệt, lịch sử và gói giao nộp như IFC | P1 |
| CAD DWG/DXF | Xem bản vẽ, thư mục, lựa chọn hàng loạt, di chuyển thư mục/bản vẽ, overlay và căn chỉnh trên mô hình | Kiểm thử sai đơn vị, Xref/font, chia sẻ căn chỉnh và xung đột hai người; báo lỗi file; liên kết revision CAD với hồ sơ | P1/P2 |
| Import IFC | Snapshot/hash, cache QBM1, upload tiếp tục, job và hủy; giới hạn rõ | Preflight IFC/schema/đơn vị; báo cấu kiện lỗi theo mô hình; thử lại có kiểm soát; telemetry thời gian từng bước | P1 |
| Viewer | Chọn cấu kiện, thuộc tính, lọc tầng/bộ môn, ẩn/cô lập, cắt, đo, ảnh chụp; batching và giảm tải khi di chuyển ở bản phát hành | Đo FPS/RAM/GPU trên máy đại diện; lưu/khôi phục viewpoint; so sánh hai revision; phản hồi rõ khi geometry thiếu | P1/P2 |
| Liên kết mô hình và tọa độ | Transform, chuyển đơn vị, tọa độ lớn, chéo IFC đã có fixture | Kiểm soát transform revision; cảnh báo mô hình xa gốc/sai cao độ; phép đo đối chiếu theo BEP; kiểm shared coordinates thực tế | P1 |
| Kiểm tra va chạm | Hard clash giữa 6 lớp IFC, nhiều mô hình, tầng, tolerance; lọc khung bao 3D, đo float64, chống lặp cặp, ưu tiên độ giao cắt, báo coverage | Rule lưu theo dự án, filter thuộc tính/hệ thống/khu vực, lịch sử chạy, ma trận phối hợp, exclusions có lý do; clearance là phép kiểm riêng | P1/P2 |
| Theo dõi xung đột | Kết quả gắn với run và snapshot; có lưu issue từ finding | Identity bền qua model revision; mới/còn tồn tại/đã xử lý/cần kiểm lại; không tự kết luận đã sửa khi coverage chưa đầy đủ | P1 |
| Issue | Người/đơn vị phụ trách, trạng thái, bình luận, bằng chứng và kiểm tra revision khi cập nhật | Hạn xử lý, người phụ trách dạng định danh, đính kèm, issue thủ công, nhiều finding/issue, viewpoint đầy đủ; thông báo và lọc quá hạn | P1 |
| BCF và báo cáo | Chưa thấy bộ nhập/xuất BCF trong mã ứng dụng; kiến thức BCF đã có trong thư viện | Xuất/nhập BCF có kiểm chứng qua phần mềm đối chiếu; báo cáo Excel/PDF, snapshot, lịch sử và danh sách loại trừ | P2 |
| Thư viện BIM | Bài tóm tắt ISO/CDE, Uniclass, OmniClass, LOD/LOIN, openBIM, tìm kiếm và nguồn tham khảo | Tra cứu dữ liệu phân loại thực sự, phiên bản/hiệu lực/nguồn, quy trình duyệt nội dung; danh mục áp dụng theo dự án | P2 |
| Kiểm tra chất lượng thông tin | Chưa thấy engine IDS hoặc kiểm LOIN tự động | Kiểm thuộc tính bắt buộc, đơn vị, classification, naming; IDS theo mẫu BEP; báo lỗi đến cấu kiện | P2 |
| Trợ lý và MCP | Rust có lệnh mock; MCP có bốn tool giới hạn | Nêu đúng khả năng mock; chỉ bổ sung AI có nguồn dẫn sau khi dữ liệu/quyền đã ổn; mọi thao tác sửa qua API và audit | P3 |
| Desktop và offline | Rust/SQLite local và kết nối cloud; README ghi chưa có bộ cài độc lập Python | Bộ cài trên máy sạch, nâng cấp/rollback, đồng bộ có giải quyết xung đột; chốt rõ phạm vi offline | P2/P3 |
| Vận hành và an toàn dữ liệu | Private buckets, phân quyền RPC, job lease, audit và giới hạn xử lý | Kiểm thử truy cập chéo dự án/đơn vị, log theo job, cảnh báo, backup/restore DB cùng Storage, retention và dọn file mồ côi | P0/P1 |

P0: xử lý trước đợt phát hành chức năng tiếp theo. P1: cần cho pilot nhiều người. P2: mở rộng nghiệp vụ sau khi P1 đạt. P3: sau khi quy trình cốt lõi ổn định.

## Các phát hiện cần xử lý trước

### Bản phát hành và cơ sở dữ liệu chưa đồng nhất với cây làm việc

`ProjectBepSettings.tsx`, `documentVersion.ts`, `viewerMotion.worker.ts` và migration BEP có trong mã phát hành nhưng không đầy đủ trong cây làm việc hiện tại. Ngược lại, dashboard, giao diện thành viên và các migration mới đang nằm ở thay đổi local. Không nên build trực tiếp toàn bộ cây local rồi ghi đè production.

DB hiện ghi nhận 13 migration, bao gồm `cde_project_bep_rules` và `cde_delete_projects`. Hai migration local về vai trò ISO và tài khoản dự án chưa có trong lịch sử này. Catalog không có cột vai trò ISO được tìm theo mẫu `%iso%role%`; hàm `cde_manage_account` chưa có nhánh `project.create.commit`. Cần kiểm tra chuỗi migration cùng các wrapper RPC BEP trước khi áp dụng, đặc biệt migration sửa nội dung hàm bằng thay chuỗi.

### Chất lượng và an toàn vận hành

- Supabase báo WARN: bảo vệ mật khẩu rò rỉ đang tắt. Kiểm tra điều kiện tài khoản/gói và tác động rồi bật trong đợt hardening đã nghiệm thu.
- Bốn khóa ngoại thiếu covering index: `cad_drawing_locations(project_id, folder_id)`, `cad_folder_aliases(project_id, folder_id)`, `jobs(owner)`, `runs(owner)`. Đo truy vấn và EXPLAIN trước/sau khi bổ sung; không xóa index `runs_project` chỉ vì hiện bị đánh dấu chưa dùng.
- 17 bảng `cde_private` có RLS nhưng không policy trực tiếp: đây là INFO phù hợp với thiết kế thu hồi quyền bảng và dùng RPC có kiểm tra quyền. Cần kiểm thử RPC/Storage theo vai trò; không tự thêm policy mở quyền để làm hết cảnh báo.
- Ba bucket `cde-files`, `cde-cad`, `cde-documents` đều riêng tư; giới hạn lần lượt 500 MB, 25 MB và 50 MB. Bucket riêng tư không thay thế kiểm thử truy cập chéo dự án.
- Chưa thấy CI workflow trong mã phát hành. Test core hiện chỉ có 3 test tự động; các script integration đã tồn tại nhưng cần môi trường staging và chạy trong pipeline.
- README và tài liệu triển khai còn số liệu 100 MB/2.000 cấu kiện, trong khi worker đang dùng 500 MB/25.000 cấu kiện preview và budget geometry. Acceptance matrix còn đánh dấu tọa độ lớn là Pending dù đã có test; phải cập nhật bằng chứng có ngày và phiên bản.

### Giới hạn cần thể hiện đúng trong sản phẩm

Hard clash hiện tối đa 12 snapshot, 5.000 cấu kiện trong phạm vi, trả tối đa 1.000 cặp ưu tiên; worker cloud có ngân sách 255 giây trong function 300 giây. Upload được file 500 MB không bảo đảm dựng và kiểm được toàn bộ file đó.

Tất cả finding hiện đặt severity `high`; sắp xếp theo độ giao cắt không đồng nghĩa đánh giá mức nghiêm trọng theo nghiệp vụ. Cần cấu hình mức ưu tiên theo loại hệ thống, vị trí và BEP. Các marker H-xxxx được đánh lại mỗi run, không dùng làm identity để theo dõi đã sửa qua các lần chạy.

Luồng `run_check` một file và `run_federation` còn hai cách tổng hợp kết quả. Nên hợp nhất semantics, identity và coverage hoặc có test parity bắt buộc. Không khép kín kết luận nếu thiếu geometry, thiếu nhóm mục tiêu hoặc đã chạm giới hạn.

## Quy trình CDE đích

Tách rõ ba chiều: trạng thái CDE; bước kiểm tra/cho phép/chấp thuận; mã trạng thái sử dụng. Quy tắc phiên bản và các mã minh họa phải có nguồn và được BEP dự án chấp nhận. Không áp đặt các mã của UK National Annex thành yêu cầu phổ quát cho mọi dự án. Cơ sở đối chiếu: [UK BIM Framework, Guidance Part C, Edition 1, 2020](https://ukbimframework.org/wp-content/uploads/2021/02/Guidance-Part-C_Facilitating-the-common-data-environment-workflow-and-technical-solutions_Edition-1.pdf).

Một information container cần nhận diện ổn định, revision, suitability, classification, bên tạo, bên kiểm tra/chấp thuận, thời điểm, trạng thái, hash và liên kết hồ sơ nguồn. Review/Approved là các bước của workflow; giao diện không nên giải thích chúng như các trạng thái CDE độc lập ngang WIP/Shared/Published/Archive.

Mỗi lần giao nộp cần có gói và manifest chỉ rõ phiên bản nào được giao cho ai, vì mục đích gì, ai cho phép/chấp thuận, phản hồi và kết quả. Các hồ sơ Rxx cũ phải giữ nguyên giá trị, nội dung và lịch sử; việc kích hoạt BEP mới không được ghi lại mã cũ.

## Backlog có tiêu chí nghiệm thu

| Mã | Hạng mục | Phụ thuộc | Tiêu chí đạt |
|---|---|---|---|
| A01 | Hợp nhất nhánh và manifest phát hành | Không | Nhánh sạch chứa đầy đủ BEP, CAD, viewer và phần giao diện được chọn; manifest ghi commit, schema, Edge Function và env |
| A02 | Staging và kiểm tra migration | A01 | Restore bản sao đã khử dữ liệu nhạy cảm; migration chạy theo thứ tự; desktop/cloud được xác định tương thích trước phát hành |
| A03 | Test quyền và khôi phục | A02 | Admin/reviewer/member/viewer; hai dự án, hai đơn vị; không đọc/ghi chéo phạm vi; khôi phục được DB, IFC, CAD, tài liệu và geometry |
| A04 | Chốt quyền tài khoản và vai trò ISO | A02,A03 | Quyền người dùng/đơn vị và vai trò giao việc tách biệt; quản trị dự án không tạo được tài khoản vượt phạm vi |
| A05 | Test BEP và Rxx | A02 | Hai người phát hành đồng thời không trùng mã; đổi BEP không sửa lịch sử; Rxx cũ giữ nguyên; trạng thái sử dụng sai bị từ chối |
| A06 | Theo dõi và hồi phục jobs | A02 | Đóng tab/mất mạng/worker bị dừng có trạng thái hữu ích; thử lại không tạo model/run trùng; hủy không ghi kết quả muộn |
| A07 | Chỉ mục và phân trang | A02 | Có EXPLAIN và benchmark trước/sau; danh sách lớn không buộc tải mọi metadata; không giảm quyền cách ly |
| A08 | Sổ hồ sơ thống nhất | A05 | IFC/PDF/Office/CAD có container và revision; thêm bản mới không ghi đè nội dung đã phát hành |
| A09 | Giao nộp và duyệt theo BEP | A04,A08 | Một gói có manifest, người nhận, quyết định và nhật ký; thử trả lại/chỉnh sửa/phát hành lại đầy đủ |
| A10 | Rule kiểm tra theo dự án | A05 | Lưu bộ lọc hai nhóm, phạm vi, tolerance, exclusions và revision rule; chạy lại tái hiện cùng đầu vào |
| A11 | Bộ chuẩn kiểm chứng va chạm | A10 | Bao phủ xuyên/chạm/gần/nằm trong/lỗ mở/trùng/khác đơn vị/tọa độ lớn/mesh hở; BIM Coordinator duyệt đáp án |
| A12 | Theo dõi va chạm qua revision | A10,A11 | Mô hình thay đổi vẫn liên kết đúng issue; missing/partial không bị đánh dấu đã sửa; exclusions có người duyệt và lý do |
| A13 | Issue hoàn chỉnh | A04,A12 | Người phụ trách, deadline, bình luận, đính kèm và viewpoint; cập nhật đồng thời không mất thay đổi; thông báo thử trên staging |
| A14 | BCF và báo cáo | A13 | Xuất–nhập round trip trong công cụ đối chiếu giữ GUID, viewpoint, bình luận và trạng thái đã ánh xạ |
| A15 | Hiệu năng viewer và model revision | A01,A06 | Benchmark STR/ARC/MEP thực; lưu viewpoint; kiểm reload/unload lặp và GPU disposal; so sánh thêm/xóa/sửa cấu kiện |
| A16 | CAD theo revision | A08,A15 | Mốc căn chỉnh được lưu với bản CAD, đơn vị và tầng; đổi revision báo cần kiểm lại; xử lý font/Xref thiếu rõ ràng |
| A17 | Thư viện kiến thức có quản trị | A01 | Tìm theo mã/từ khóa; có nguồn, phiên bản, người duyệt, ngày kiểm lại và điều kiện sử dụng dữ liệu |
| A18 | IDS và kiểm thông tin | A08,A17 | Chạy một bộ yêu cầu BEP trên fixture; lỗi gắn đúng IFC GUID; lưu phiên bản rule và báo cáo đạt/không đạt |
| A19 | Bộ cài desktop | A01,A05 | Cài trên Windows sạch không cần Python/Node ngoài; mở IFC; cập nhật/rollback không mất workspace |
| A20 | Trợ lý có nguồn và MCP mở rộng | A03,A10,A17 | Câu trả lời dẫn nguồn/version; quyền nhất quán với UI; preview thao tác ghi; có audit và giới hạn chi phí |

IDS phục vụ yêu cầu thông tin IFC có thể kiểm bằng máy; đây là hạng mục bổ sung riêng so với engine giao cắt hình học. Tham chiếu: [buildingSMART IDS](https://github.com/buildingSMART/IDS). Định dạng BCF mục tiêu và khả năng round trip sẽ được chốt theo phiên bản BIMcollab/Navisworks thực tế của nhóm dự án.

## Lộ trình đề xuất

Ước lượng sơ bộ cho 2 kỹ sư phát triển, QA và BIM Coordinator tham gia đều đặn; cần hiệu chỉnh sau đợt A01–A03. Các khoảng dưới đây là thời gian thực hiện dự kiến, không phải cam kết giao hàng. Desktop offline nâng cao và AI không nằm trong mốc pilot cốt lõi.

| Đợt | Khoảng dự kiến | Trọng tâm | Cửa nghiệm thu |
|---|---|---|---|
| 0 | 3–5 ngày làm việc | A01–A03: hợp nhất, staging, test quyền, diễn tập restore | Biết chính xác bản nào đang chạy; không có mất tính năng hoặc dữ liệu |
| 1 | 2 tuần | A04–A07: quyền, BEP/Rxx, jobs, chỉ mục và test CI | Hoàn thành một chu kỳ hồ sơ có trả lại và phát hành; hủy/thử lại job đúng |
| 2 | 2–3 tuần | A08–A09: sổ hồ sơ nhiều định dạng và giao nộp | Gói giao nộp có manifest, version, suitability, người duyệt và audit |
| 3 | 2–3 tuần | A10–A13: rule, kiểm chứng, so sánh lần chạy và issue | Coordinator xử lý được trọn chu kỳ từ phát hiện đến kiểm chứng đã sửa |
| 4 | 2–3 tuần | A14–A17: BCF, báo cáo, hiệu năng/CAD và thư viện | Trao đổi với phần mềm ngoài; benchmark và UAT trên dự án thật đạt |
| 5 | Sau pilot | A18–A20: IDS, desktop, trợ lý/MCP | Mỗi năng lực có bộ test và phạm vi phát hành riêng |

Mốc pilot mở rộng dự kiến khoảng 9–12 tuần sau khi chốt baseline. Không gộp toàn bộ A18–A20 vào mốc này. Nếu chỉ một người phát triển, cần lập lại ước lượng theo năng lực thực tế.

## Chỉ số và điều kiện phát hành

- Chọn máy thử, trình duyệt, mạng, bộ IFC và số người đồng thời trước khi đặt SLA. Bộ nhỏ/trung bình/lớn cần có hash và đáp án kiểm chứng.
- Mục tiêu ban đầu để thương lượng: thao tác viewer phổ biến p95 dưới 200 ms khi hình học đã tải; tương tác 3D tối thiểu 30 FPS trên bộ mô hình/máy đã chốt; theo dõi first-frame, full-load, RAM/GPU và request size riêng.
- Va chạm: đối chiếu false positive/false negative trên tập có đáp án, tolerance và phạm vi giống nhau; không lấy số cặp cao hơn làm bằng chứng chính xác hơn. Bộ SVDSP ba tệp là regression về bảo toàn kết quả, chưa phải ground truth của toàn dự án.
- Dữ liệu: không mất bản phát hành; không trùng revision khi cập nhật đồng thời; restore phải kiểm hash file cùng metadata. RPO/RTO được chủ dự án chốt trước khi lựa chọn phương án backup.
- Release gate: build, worker, core, geometry, integration API/Storage, E2E theo vai trò và UAT của Coordinator. Log có request/job/run ID; cảnh báo timeout/lỗi; có kế hoạch rollback tương thích schema.
- Tài liệu giới hạn, hướng dẫn và release notes phải phản ánh đúng bản triển khai; tránh số liệu cũ gây kỳ vọng sai.

## Quyết định triển khai trước mắt

Bắt đầu A01–A03, sau đó A05 và A06. Giữ nguyên mã Rxx và lịch sử hồ sơ cũ. Hoàn thiện CDE/issue và độ tin cậy vận hành trước khi mở rộng AI. Bản rà soát này chỉ thêm tài liệu kế hoạch; không đổi schema, cấu hình bảo mật hay phát hành tính năng trong lượt đánh giá.
