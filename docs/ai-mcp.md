# Nền tảng AI và MCP của QA BIM

AI Assistant và MCP dùng cùng tool registry trong Rust application core. Mỗi chức năng mới phải có hợp đồng nghiệp vụ có thể kiểm thử, sau đó mới mở cho UI, AI hoặc agent theo capability phù hợp.

## Các lớp

```text
AI chat UI → AI Runtime → Provider Adapter
                   ↓ tool request
            ToolRegistry + Policy
                   ↓
            Application handlers

External agent → MCP stdio bridge → Desktop IPC adapter
                                      ↓
                              ToolRegistry + Policy
```

AI Runtime nằm trong tiến trình Rust host nhưng không chặn UI. Domain/application không biết model hay provider nào đang dùng. Tắt AI vẫn mở IFC, chạy check và quản lý issue được.

MVP chưa cần vector database, multi-agent framework hoặc cloud orchestration. Truy vấn cấu kiện dùng dữ liệu có cấu trúc; RAG cho BEP/tài liệu là module sau, có citation và version riêng.

## Tool registry

Mỗi tool có operation ID, input/output JSON Schema, scopes, classification, handler, giới hạn, idempotency policy và description. Metadata cho UI/AI/MCP được sinh từ một định nghĩa; handler có typed validation ở boundary.

| Application operation | MCP tool | Tác dụng |
| --- | --- | --- |
| project.get | project_get | Dự án và snapshot hiện tại |
| models.list | models_list | Các mô hình và trạng thái nhập |
| elements.search | elements_search | Truy vấn phân trang theo Filter AST |
| elements.properties | elements_get_properties | Thuộc tính của tập cấu kiện giới hạn |
| view.get_state | view_get_state | Desired/applied revision của viewer |
| view.select | view_select | Chọn đúng element refs |
| view.isolate | view_isolate | Cô lập có giới hạn và khả năng khôi phục |
| review.finding.open | review_finding_open | Mở góc nhìn kiểm tra hoàn chỉnh |
| checks.list_rules | checks_list_rules | Rule revisions hợp lệ |
| checks.run | checks_run | Tạo job kiểm tra trên snapshot |
| jobs.get | jobs_get | Trạng thái và coverage |
| jobs.cancel | jobs_cancel | Hủy job thuộc session/project được phép |
| findings.list | findings_list | Kết quả phân trang, có stale marker |
| issues.create_draft | issues_create_draft | Tạo issue nháp từ bằng chứng |
| issues.update | issues_update | Sửa với expectedRevision |
| reports.export | reports_export | Xuất tới destination grant được phép |

App có thể có operation chưa mở qua MCP/AI. Ví dụ import file mới chỉ được mở sau khi có file/directory grant rõ. Không tạo tool chạy shell, eval Python, SQL tùy ý hoặc sửa IFC bằng code trong MVP.

## AI Runtime

Provider interface gồm stream, tool requests, cancellation, usage và error normalization. MVP có MockProvider để kiểm thử không dùng API key, sau đó tích hợp một provider thật theo lựa chọn sản phẩm. Local provider là adapter bổ sung, không giả định model local nào cũng gọi tool tốt.

Luồng một yêu cầu:

1. ContextBuilder lấy project summary, model readiness, selection, tool capabilities và trạng thái view.
2. Model đề xuất tool call có cấu trúc.
3. Runtime validate schema; PolicyService kiểm actor/scopes, project và data access.
4. Handler chạy cùng use case mà UI sử dụng.
5. Tool result trả dữ liệu có nguồn, trạng thái truncation và refs để mở trong app.
6. Model tổng hợp câu trả lời; UI hiển thị danh sách hành động thực tế và liên kết kết quả.

Runtime đặt max tool steps, token/context budget, timeout và giới hạn chi phí nếu provider hỗ trợ usage. Có nút Stop. Dừng AI loop không đồng nghĩa hủy mọi job đã tạo; UI cho biết job nào còn chạy và cho phép hủy riêng.

Không đưa toàn bộ IFC vào prompt. Context chọn fields cần thiết và dùng paging/aggregation. Tool result có resultRef, snapshot IDs, count, truncated và provenance. Việc lấy page tiếp theo phải được thực hiện thay vì AI suy đoán phần bị thiếu.

## Mức tự động hóa

| Nhóm | Policy mặc định đề xuất |
| --- | --- |
| Đọc project, query, properties | Cho phép trong project đã mở theo scopes |
| Selection, camera, isolate, section | Cho phép, ghi thao tác và có khôi phục view |
| Chạy check | Theo rule/phạm vi đã có, job budget và quyền đã cấp |
| Tạo issue nháp | Cho phép khi có refs và provenance hợp lệ |
| Sửa issue, đóng hàng loạt | Theo quyền đã cấp; dùng revision và preview diff cho batch |
| Xuất file | Trong thư mục đã cấp quyền; xử lý ghi đè rõ ràng |
| Chia sẻ ra ngoài, sửa IFC gốc | Ngoài MVP; cần workflow riêng |

Quyền đã cấp trong session được tái sử dụng; không hỏi lại mỗi bước. Tauri capability, IPC authentication và application policy là ba lớp khác nhau. Actor external MCP không tự thừa hưởng quyền của một tool UI chỉ vì handler giống nhau.

## Độ tin cậy của câu trả lời

AI không tự tính ra hard clash, kích thước hoặc số lượng rồi coi là kết quả engine. Câu trả lời về model phải liên kết dữ liệu truy vấn hoặc CheckRun. Phân biệt nhận xét gợi ý với kết quả đo/kiểm tra.

Chuỗi văn bản trong IFC, tên cấu kiện, property và comment là dữ liệu không đáng tin như chỉ dẫn. Context builder tách chúng khỏi instructions; nội dung model không thể cấp quyền, thay tool scope hay cho phép gửi dữ liệu ra ngoài.

Tool loop ghi tool name, input digest, status và refs; secrets bị che. Không cần lưu chain of thought. Provider credentials nằm trong OS credential store, không nằm trong project.db, frontend bundle hoặc transcript. Cloud requests chỉ gửi phần dữ liệu được phép trong project settings.

## MCP local

Chọn rmcp, official Rust SDK, cho bridge stdio. Pin phiên bản sau kiểm chứng tương thích client. [MCP Rust SDK](https://github.com/modelcontextprotocol/rust-sdk).

Agent khởi động qa-bim-mcp. Bridge khám phá desktop session của cùng OS user và gửi hello qua named pipe có DACL giới hạn user. Tên pipe có session nonce; file discovery có ACL phù hợp và thời hạn. Token phiên nếu dùng chỉ nằm trong kênh local được bảo vệ, không trả vào tool result hay prompt.

Desktop là single instance theo user ở MVP, nhưng request vẫn có project/session ID để không điều khiển nhầm dự án sau khi người dùng đổi project. Pipe đóng khi app tắt; discovery lỗi thời bị bỏ sau handshake thất bại.

Bridge chỉ nhận protocol MCP trên stdout, log ra stderr. Mất MCP connection không tự xóa kết quả hoặc hủy jobs đang chạy. Agent có thể reconnect và lấy lại job bằng ID nếu có quyền.

MCP stdio là transport đầu tiên. Streamable HTTP chỉ thêm khi có nhu cầu kết nối từ xa, với authentication, origin validation và lifecycle riêng; không mở cổng mạng công khai ngay trong MVP. [MCP transports](https://modelcontextprotocol.io/specification/2025-11-25/basic/transports).

## Resources và prompts

Resources đề xuất:

```text
qabim://projects/{projectId}/summary
qabim://projects/{projectId}/models
qabim://checks/{checkRunId}/summary
qabim://issues/{issueId}
qabim://jobs/{jobId}
```

Resources kiểm cùng quyền như tools, có size cap và version. Không cung cấp URI đọc file bất kỳ trên máy.

Prompts tùy chọn như review_coordination và summarize_open_issues chỉ là template hướng dẫn. Chúng không thay quy tắc kiểm tra hoặc cấp thêm quyền. AI tích hợp có thể gọi handler trực tiếp, không bắt buộc đi vòng qua MCP.

## Kiểm thử AI và MCP

| Tình huống | Kết quả bắt buộc |
| --- | --- |
| Chọn cấu kiện qua UI và MCP | Cùng element refs và applied ViewState |
| Chạy check qua UI và MCP cùng snapshot | Cùng kết quả nghiệp vụ khi bỏ run IDs/timestamps |
| Lặp request tạo issue do timeout | Không tạo trùng với cùng idempotency key |
| Project bị đổi giữa hai tool calls | Trả session/revision mismatch |
| Viewer đóng hoặc chưa render xong | Không báo thành công điều khiển view |
| Query vượt limit | Có truncation/cursor; không trả vô hạn |
| Model property chứa chỉ dẫn độc hại | Không thay quyền hoặc gọi công cụ ngoài phạm vi |
| Worker lỗi hoặc geometry thiếu | AI báo thiếu coverage, không nói đã kiểm toàn bộ |
| Không có API key/mạng | Viewer, checking và MCP local vẫn hoạt động |
| Hủy AI giữa job | Trạng thái job rõ, có thao tác hủy riêng |

MockProvider phục vụ contract tests; eval với provider thật tập trung task success, số tool calls, lỗi scope, chi phí và tính đúng của nguồn. Không dùng chất lượng văn phong làm thước đo thay cho tính đúng nghiệp vụ.

## Thứ tự triển khai

G0 định nghĩa operation IDs và scopes. G1 có project_get/models_list qua MCP, MockProvider và một lệnh chọn đối tượng thử. G2 hoàn thiện query/view tools. G3 thêm check/job tools. G4 thêm issue/report tools. G5 tích hợp provider thật và đánh giá luồng ngôn ngữ tự nhiên.

Nền tảng AI/MCP được kiểm chứng từ đầu; chatbot đầy đủ xuất hiện sau khi các công cụ BIM đã dùng được.
