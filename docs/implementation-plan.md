# Kế hoạch triển khai QA BIM

Triển khai theo các luồng dùng được từ đầu đến cuối. Mỗi giai đoạn có đầu ra và điều kiện nghiệm thu trước khi mở rộng chức năng.

## Giả định nguồn lực và thời gian

Ước lượng dành cho 2 đến 3 lập trình viên có kinh nghiệm, có ít nhất một người làm Rust/native integration và một BIM Coordinator tham gia kiểm thử thường xuyên. Thời gian là dự kiến, chưa phải cam kết giao hàng.

| Giai đoạn | Thời lượng | Mốc sản phẩm |
| --- | --- | --- |
| G0 | 1 tuần | Scope, fixtures, contracts và baseline |
| G1 | 2 đến 3 tuần | Chứng minh kỹ thuật và MCP slice |
| G2 | 3 đến 4 tuần | Viewer alpha |
| G3 | 4 đến 5 tuần | Checking alpha |
| G4 | 2 đến 3 tuần | Issues và BCF beta |
| G5 | 2 đến 3 tuần | AI Assistant beta và MCP hoàn chỉnh cho MVP |
| G6 | 3 đến 4 tuần | Pilot dự án thật và release candidate |

Tổng tuần tự khoảng 17 đến 23 tuần. G1 có thể làm thay đổi exporter, cache format hoặc phạm vi hiệu năng; cập nhật ước lượng ngay tại mốc này. Không đưa cloud collaboration vào tổng trên. Một người phát triển cần lập lại tiến độ theo năng lực thực tế, không lấy số tuần chia tuyến tính.

## G0 Chốt dữ liệu kiểm chứng

1. Viết product brief và danh sách use cases: import, federate, inspect, check, review, issue, replace model, recheck và export.
2. Thu thập bộ IFC được phép dùng: STR/ARC/MEP của cùng dự án, file nhỏ để debug và file nặng đại diện. Ghi hash, nguồn xuất, schema và quyền chia sẻ.
3. Tạo IFC synthetic có đáp án: không va, xuyên nhau, chạm mặt, gần nhau, nằm trong nhau, xuyên lỗ mở, trùng cấu kiện, sai đơn vị và tọa độ lớn.
4. Chốt frame/units policy, ElementRef, RuleRevision, CheckRun, Finding và Issue.
5. Chốt contract version 1 cho application/worker, error codes và tool metadata.
6. Kiểm Windows x64 toolchain hiện có; khóa phiên bản dependencies khi dựng POC.

Đầu ra: fixture manifest, acceptance matrix, schema draft và kế hoạch benchmark. Nghiệm thu khi từng use case có dữ liệu thử và người BIM xác nhận cách hiểu đúng/sai, đặc biệt semantics của tiếp xúc và tolerance.

## G1 Chứng minh nền tảng kỹ thuật

1. Scaffold Tauri, React và Rust workspace tối thiểu; có một command health và typed response.
2. Tạo Python worker hello/handshake; core quản lý start, stderr, timeout và shutdown.
3. Nhập IFC nhỏ, lưu immutable snapshot/hash, trích thuộc tính và tạo geometry cache GLB.
4. Hiển thị mô hình; chọn mesh phải trả đúng ElementRef và thuộc tính.
5. Ghép hai file có transform, đơn vị và tọa độ khác nhau. Kiểm marker, đo và clash point cùng frame.
6. Chạy hard clash synthetic; xác nhận broad-phase khác narrow-phase và báo coverage.
7. Đóng gói worker trên máy Windows sạch, không Python/Node cài sẵn.
8. Dựng qa-bim-mcp stdio → named pipe → project_get/models_list. Thêm MockProvider gọi handler thử.
9. Ghi benchmark và quyết định exporter/cache; chỉ khảo sát renderer adapter khác nếu có vấn đề đo được.

Đầu ra: một app POC mở IFC thật, query/selection đúng, một clash run, một tool MCP hoạt động và một installer thử.

Điều kiện vượt G1:

- Không mất mapping giữa render và cấu kiện; số đối tượng thiếu có báo cáo.
- Không lệch frame giữa renderer, phép đo và check chéo mô hình.
- Tắt worker giữa job không làm hỏng project; app còn phản hồi.
- GLB xuất từ IfcOpenShell giữ đủ semantics cần cho Viewer hoặc có exporter adapter đã kiểm chứng.
- Named pipe định tuyến đúng session và từ chối caller không được phép.
- Nếu không đạt một tiêu chí, xử lý trước khi làm nhiều màn hình UI.

## G2 Viewer alpha

1. Project create/open/recent và lưu layout.
2. Model import/remove/replace theo version; spatial tree phân trang/lazy load.
3. Orbit, pan, zoom, fit, selection nhiều đối tượng và chọn qua bảng.
4. Properties, query theo class/tầng/hệ thống, saved SelectionSet.
5. Hide/isolate, màu bộ môn, section box/planes và đo cơ bản.
6. Saved ViewState với restore và applied acknowledgement.
7. Chunk loading, cancellation, GPU disposal, cache reopen và budgets.
8. MCP query/view tools chạy qua cùng handlers; AI panel hiển thị mock tool trace.

Nghiệm thu: kỹ sư có thể mở và rà mô hình mà không dùng phần mềm khác cho các thao tác Viewer đã chọn. Khởi động lại phục hồi project/view đúng; unload/reload không làm RAM/GPU tăng không giới hạn trong kịch bản lặp có kiểm soát.

## G3 Checking alpha

1. Rule editor cho nhóm A/B dùng Filter AST, scope, tolerance và exclusions.
2. RuleRevision bất biến; lưu presets cho HVAC–STR, CTN–STR và MEP–MEP theo cấu hình thử nghiệm.
3. Chạy hard clash, progress, cancel, resource limit và partial coverage.
4. Lưu findings/evidence; deduplicate cặp và vùng theo semantics đã kiểm chứng.
5. Gom theo tầng/hệ thống/khu vực bằng projection, không sửa identity gốc.
6. OpenFinding với review overlay và restore view trước.
7. Conflict tracking qua lần chạy; phân biệt active, fixed candidate, ignored và needs_review.
8. Stale detection khi đổi model, transform, rule hoặc phạm vi.
9. MCP check/job tools, test parity với UI.

Nghiệm thu: bộ IFC có đáp án vượt test; bounding-box overlap không thành false hard clash; case không đủ coverage không được báo clean. Kỹ sư duyệt được kết quả và hiểu rule nào sinh finding đó.

Clearance là capability tiếp theo trong G3 chỉ khi hard clash đạt gate và thời gian cho phép; nếu không, chuyển sau pilot với scope rõ. Tính khoảng hở và độ xuyên là semantics riêng, không coi là đổi tên cùng một phép kiểm.

## G4 Issues và BCF beta

1. Tạo issue từ một hoặc nhiều conflicts; cho phép issue thủ công không có clash.
2. Status, assignee, priority, comments, attachments, viewpoints và audit.
3. Preview batch update và optimistic concurrency theo revision.
4. BCF XML 2.1 import/export, topic identity, component refs và camera transform.
5. Thay IFC, recheck và giữ liên kết issue khi match đáng tin cậy.
6. Xuất CSV và báo cáo HTML có ảnh trước; PDF là hạng mục riêng nếu cần.
7. Thêm MCP issue/export tools với destination grants.

Nghiệm thu: BCF round-trip với công cụ đích đã chọn; ghi rõ fields mất/không hỗ trợ. Thiếu một model không làm issue tự đóng. Snapshot và cấu kiện không resolve được có trạng thái rõ.

## G5 AI Assistant beta

1. Provider Adapter thật đầu tiên; keychain và project data policy.
2. ContextBuilder có snapshot refs, field selection và byte/token budgets.
3. Tool loop có schema validation, max steps, stop, usage và error recovery.
4. UI action trace hiển thị tool đã chạy, trạng thái và link kết quả.
5. Các tác vụ mục tiêu: tìm cấu kiện, điều khiển view, chạy rule đã lưu, tạo issue nháp và tóm tắt issue.
6. Kiểm prompt injection qua property/comment, query truncation và quyền không đủ.
7. Kiểm client MCP thực tế với tools/resources; pin protocol/SDK tương thích.

Nghiệm thu: tác vụ dựa trên tool/evidence, không bịa kết quả tính hình học; không tự đổi project hoặc mở rộng scope; app hoạt động khi mất kết nối AI.

## G6 Pilot và phát hành thử

1. Pilot trên ít nhất hai bộ dự án có đặc điểm khác nhau, nếu có quyền sử dụng.
2. Đo và sửa bottleneck import, cache, query, check, review và memory.
3. Kiểm crash recovery, DB backup/restore, migration, cache corruption và thiếu ổ đĩa.
4. Kiểm installer, WebView2, worker dependencies, MCP bridge và upgrade trên máy sạch.
5. Chuẩn bị code signing, update channel và release compatibility matrix.
6. Tạo SBOM/danh mục licenses theo artifacts thực phát hành; quyết định phân phối theo dependencies thực tế.
7. Viết hướng dẫn nhập IFC, chạy check, BCF và cấu hình MCP; ghi known limits cụ thể.

Nghiệm thu: BIM Coordinator hoàn thành một vòng import → check → issue → cập nhật → recheck → export. Release notes công bố phạm vi support đã kiểm chứng, không chỉ liệt kê tên schema.

## Backlog 10 ngày làm việc đầu

| Ngày | Công việc chính | Bằng chứng |
| --- | --- | --- |
| 1 | Product scope và IFC manifest | Use cases, hashes, provenance |
| 2 | Fixture matrix và tọa độ | Các case đúng/sai được người BIM duyệt |
| 3 | Contracts và domain IDs | JSON fixtures, command catalog |
| 4 | Tauri/React/Rust skeleton | Health command và CI cơ bản |
| 5 | Worker handshake và supervisor | Start/stop/error smoke test |
| 6 | Snapshot store và metadata | Import report, element query |
| 7 | Export GLB và mapping | Picking trả đúng ElementRef |
| 8 | Federation và section | Hai mô hình khớp, marker đúng |
| 9 | Clash synthetic và job lifecycle | Findings có coverage, hủy không hỏng DB |
| 10 | MCP bridge và clean-machine spike | project_get qua client, installer report |

Đây là thứ tự ưu tiên cho đội làm song song, không bảo đảm mọi spike hoàn tất trong một ngày. G1 tiếp tục tới khi đạt gate.

## Benchmark và mục tiêu hiệu năng

Baseline máy đề xuất: Windows x64, RAM 32 GB, SSD NVMe, GPU rời 6 GB VRAM; ghi rõ CPU/GPU/driver và WebView2 thực dùng. Thêm một máy cấu hình thấp hơn để kiểm degradation.

Phân nhóm theo số cấu kiện, tam giác, schema và số file, không chỉ MB. Có mẫu nhỏ để debug, mẫu dự án điển hình và stress case vượt ngân sách để kiểm giới hạn.

| Chỉ số | Cách đo và mục tiêu sơ bộ |
| --- | --- |
| Import lần đầu | Wall time, peak RSS, số element/geometry lỗi; chốt SLA sau baseline G1 |
| Mở cache | Đo first useful view và tải đủ; so với import lạnh |
| Camera | Mục tiêu ít nhất 30 FPS ở view chuẩn cho dataset pilot đã chốt |
| Selection | Mục tiêu p95 dưới 200 ms khi geometry đã resident |
| Properties | Mục tiêu p95 dưới 500 ms cho truy vấn được index |
| Clash | Wall time, peak RAM, candidate/exact counts và coverage |
| Cancellation | UI nhận yêu cầu nhanh; native worker có grace/kill deadline cấu hình |
| Stability | Lặp open/review/unload và theo dõi mức tăng RAM/GPU |

Các con số là mục tiêu thiết kế trên bộ mẫu và máy chuẩn, chưa phải kết quả đã đo hoặc cam kết cho mọi IFC. Không đánh đổi bỏ cấu kiện âm thầm để đạt FPS.

## Các phép kiểm bắt buộc

- Contract compatibility giữa Rust, TS và Python; generated artifacts không drift.
- Unit/domain tests cho units, transform composition, snapshot/stale và issue transitions.
- Geometry fixtures cho holes, nested placements, touching và clearance thresholds.
- Tích hợp worker crash, cancel, disk-full và artifact commit recovery.
- UI/MCP parity qua cùng fixtures, bỏ các trường thời gian/IDs của lần chạy khi so sánh.
- Smoke tests trên Tauri/WebView2 thật; Playwright web mode chỉ kiểm lớp UI, không thay native integration test.
- BCF round-trip camera/components với phần mềm đích.

## Rủi ro và quyết định khi gặp

| Rủi ro | Cách xử lý |
| --- | --- |
| Export GLB mất identity | Sửa exporter/mapping ở G1, chưa mở rộng Viewer |
| GLB một cục quá nặng | Chunk theo spatial scope; benchmark batching/instancing |
| Check khác hình hiển thị | Kiểm transform/tessellation và nguồn geometry; lưu provenance |
| Native call treo | Grace cancellation, kill worker, restart và bỏ staging chưa commit |
| GUID đổi hoặc trùng | Match có confidence, needs_review, không tự đóng issue |
| Bộ cài thiếu native DLL | Build manifest, clean-machine test từ G1 |
| AI gọi sai phạm vi | Snapshot/scopes validation và task eval với expected tools |
| Phạm vi tăng nhanh | Giữ gate, đưa cloud/plugin marketplace/native renderer sau pilot |

## Phát triển sau pilot

Theo nhu cầu đã xác nhận: clearance/bảo trì, IDS và QC dữ liệu, model diff, bảng thống kê, batch/headless checks, kết nối Revit, tài liệu dự án có RAG, point cloud và cloud collaboration. Mỗi capability mới tái sử dụng QueryService, JobManager, evidence model và ToolRegistry.
