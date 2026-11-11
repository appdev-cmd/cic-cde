# Tham khảo phần mềm BIM cho QA BIM

Nghiên cứu ngày 05 tháng 11 năm 2026 kết hợp REA CLI trên các artifact đã cài và tài liệu chính thức về quy trình. Static evidence áp dụng cho đúng file/hash được kiểm tra; không đại diện mọi bản phát hành hoặc hành vi runtime.

## Phạm vi và phương pháp REA

Skill sử dụng: [Reverse Engineer Anything](C:/Users/Personal/.codex/skills/reverse-engineer-anything/SKILL.md).

Phiên hiện tại không có REA MCP tools. REA CLI 6.8.0 được dùng qua runtime Node hiện có; không sửa cấu hình MCP, không cài disassembler và không chạy code của phần mềm đích. Skill đang cài có phạm vi mới hơn CLI; các lệnh thực thi được chọn từ help của CLI thực tế.

Target được resolve từ phần mềm đã có trong C:/Program Files/KUBUS/BIMcollab Zoom và C:/Program Files/Solibri/SOLIBRI. Đã kiểm PE imports, managed metadata và JAR inventory. Không mở native analysis session hoặc runtime instrumentation; các CLI calls là tác vụ độc lập và evidence được lưu trực tiếp.

## Bằng chứng từ artifact đã cài

| Quan sát trực tiếp | Evidence | Giới hạn |
| --- | --- | --- |
| BIMcollab.Zoom.GUI.dll có assembly version 9.5.5.0, target .NET Framework 4.8.1; tham chiếu System.Windows.Forms, Telerik và CefSharp | [Managed metadata](evidence/zoom-gui-managed.json), ID ev_e9eb4b53f4aaa8a80ef3efb0647d37bc940b63e712104dbb65ed80e248b56a3d | Metadata không xác định ngôn ngữ nguồn và không chứng minh thành phần nào đang hiển thị trong runtime |
| BIMcollab.Zoom.Engine.dll khai báo import OPENGL32.dll, IfcEngine.dll với các hàm sdai; có các C++ decorated imports và MSVC runtime imports | [Engine imports](evidence/zoom-engine-imports.json), ID ev_4225c58270c79ddd34154c0ee8ea280ba5a3106bf616970dd182df3938ab89e9 | Import table không chứng minh đường chạy, nhà cung cấp kernel, thuật toán clash hay hiệu năng |
| Thư viện ardor3d-core.jar trong bộ cài Solibri có ZIP/JAR inventory 516 file và 46 directory | [Inventory summary](evidence/solibri-ardor3d-summary.json), parent ID ev_665936036251fd9f137d98a4ca632c35c6cf50557011d23e9f107f82373a20d0 | Chứng minh thư viện được đóng gói, không chứng minh toàn bộ renderer của Solibri dùng thư viện này |
| Solibri.exe là PE x64; import table được kiểm nhưng không đủ chỉ ra runtime render/check | [Launcher imports](evidence/solibri-launcher-imports.json), ID ev_fee5603dcb09fbed27fdbfa37033e3cdc242398a247aac2e36fdf1a7276b7fb2 | Launcher không đại diện engine |

SHA-256 của các target nằm trong subject của từng Evidence. JAR inventory đầy đủ nằm trong [REA evidence bundle](evidence/solibri-ardor3d-bundle.json); đây là metadata inventory/hash, không phải bản sao JAR hoặc mã ứng dụng.

Suy luận kiến trúc có giới hạn: bộ Zoom đã cài cho thấy sự kết hợp thành phần managed UI và dependency native trong engine. Điều này phù hợp với cách phân lớp UI/core/engine của QA BIM. Nó không chứng minh ta cần dùng lại stack của họ hoặc đạt cùng hiệu năng.

## Quy trình được tài liệu chính thức mô tả

| Sản phẩm | Hành vi tham khảo | Quyết định thiết kế của QA BIM |
| --- | --- | --- |
| BIMcollab Smart Issues | Liên kết issue với clash và đối tượng; nhận biết đã báo cáo khi đổi rule/grouping; kiểm lại với model mới | Tách finding/conflict/issue, giữ identity độc lập với nhóm hiển thị |
| Solibri Checking | Rule có tham số, tổ chức trong ruleset; kết quả có phân cấp và các cấu kiện liên quan | Rule schema/revision có phiên bản; result hierarchy là projection; lưu primary/context elements |
| Navisworks Results | Cảnh báo kết quả cũ khi đổi model/test; review có grouping, highlight, focus và viewpoints | Snapshot/stale tracking; OpenFinding dùng chung UI/AI/MCP; review overlay có restore |

Nguồn: [BIMcollab Smart Issues](https://www.bimcollab.com/en/products/bimcollab-zoom/clash-management/), [Solibri Understanding Checking](https://help.solibri.com/hc/en-us/articles/1500005009042-Understanding-Checking), [Navisworks Results Tab](https://help.autodesk.com/cloudhelp/2026/ENU/Navisworks-Clash-Detective/files/GUID-FCC9E5E1-2717-48D2-8DBE-2055CF2DC61E.htm).

Các quyết định ở cột cuối là thiết kế của QA BIM, không phải kết luận về code nội bộ đối thủ.

## Bài học áp dụng

1. Issue là hồ sơ xử lý có vòng đời riêng, không phải một dòng kết quả có thêm cột status.
2. Gom nhóm giúp duyệt nhưng không làm thay đổi danh tính bằng chứng.
3. Khi model/rule/transform thay đổi, kết quả cũ phải được nhận diện trước khi người dùng ra quyết định.
4. Mở một finding phải đưa người dùng tới góc nhìn có ích trong một thao tác.
5. Dùng chung query và selection cho Viewer, Checking, Data và AI để tránh các bộ lọc cho kết quả khác nhau.
6. Phần mềm BIM có thể phối hợp UI managed/web với engine native; hiệu năng phải đo trên toàn pipeline.

Quy tắc thận trọng riêng của QA BIM: một finding biến mất chưa đủ để kết luận đã khắc phục nếu phạm vi kiểm tra, coverage hoặc model identity thay đổi. Những tình huống đó chuyển needs_review.

## Checklist câu hỏi và trạng thái

| Câu hỏi | Trạng thái | Bằng chứng hoặc phần còn thiếu |
| --- | --- | --- |
| Zoom trên máy có thành phần UI managed nào | Đã trả lời trong phạm vi DLL | CLI metadata và assembly refs |
| Zoom engine có dependency graphics/IFC nào | Trả lời một phần | PE imports; không resolve runtime bindings |
| Solibri được đóng gói với thư viện gì | Trả lời một phần | Một JAR được inventory và thư mục bộ cài được quan sát |
| Quy trình rule/result/issue có bài học gì | Đã trả lời ở mức tính năng tài liệu | Nguồn chính thức BIMcollab, Solibri, Autodesk |
| Thuật toán clash và kernel nội bộ đối thủ | Chưa xác định | Không có decompilation/call tracing; không cần suy đoán để chọn thiết kế |
| Hiệu năng app mới so với đối thủ | Chưa xác định | Cần bộ IFC và benchmark có kiểm soát tại G1/pilot |
| Hành vi runtime và UX trực tiếp của bản đã cài | Chưa khảo sát | Chưa launch/capture; hiện dùng tài liệu chính thức cho workflow |

## Điều tra tiếp theo có giá trị

Khi có fixture IFC dùng được, thực hiện một kịch bản tương đương trong các app: mở federation, chọn cấu kiện, cắt vùng, chạy rule, duyệt finding, xuất BCF, thay model và recheck. Ghi thời gian, số thao tác, coverage và kết quả thực; lưu build identity. Chỉ runtime observation đó mới hỗ trợ so sánh UX và tốc độ thực tế.

Không cần phân tích thêm DLL để trì hoãn G1. Các khoảng trống còn lại được giữ rõ trong checklist và không được trình bày như kiến thức đã xác nhận.
