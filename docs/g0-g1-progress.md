# G0 và G1 vòng triển khai đầu

Ngày 05 tháng 11 năm 2026. Trạng thái: UI và luồng nhập IFC local đã chạy; G0 và G1 chưa đủ điều kiện nghiệm thu toàn bộ.

## Cập nhật federation, tải và hủy tác vụ

- Nhóm A/B chọn nhiều IFC, định vị XYZ + xoay Z, identity theo source hash/STEP; giao cắt thật trên cùng tọa độ với Viewer.
- Fixture chéo hai file: 42 giao cắt, dịch services 100 m còn 0, L05 có 6; coverage 147/147.
- Cache QBM1 theo content hash, metadata tách geometry, typed arrays và scene cập nhật tăng dần. Benchmark worker mẫu 399 cấu kiện: cold ~237 ms, warm ~30 ms, không gồm startup/HTTP/GPU.
- Import job: queued → processing → committing → completed/failed, có cancelled trước committing. Hủy abort task, worker kill-on-drop; bước commit không hủy để giữ dữ liệu nhất quán. Job tạm trong bộ nhớ, chỉ một import background đồng thời.
- Upload được nhận xong để lấy job ID rồi xử lý yêu cầu hủy; không báo phần trăm giả cho tessellation. Dựng hình học báo số cấu kiện, hủy giữ phần đã dựng và có nút tiếp tục. Binary request đang bay có thể hoàn tất vào cache sau khi dừng dựng.
- Native sở hữu core/API chung với browser/MCP. Không chạy headless core cùng desktop.
- Những ghi nhận dưới đây thuộc vòng spike trước khi có federation; xem ADR 002 cho quyết định triển khai hiện tại.

## Đã triển khai (lịch sử vòng đầu)

- Rust workspace, Tauri desktop, React TypeScript và Three.js Viewer; đã build và mở cửa sổ Windows native.
- IFC4 tổng hợp có 399 cấu kiện và bảy tầng, trích hình học bằng IfcOpenShell 0.8.5.
- Chọn cấu kiện, xem identity/thuộc tính, lọc tầng, ẩn bộ môn, Solid/X-ray/Wireframe, cắt tại cao độ thử nghiệm, đo hai điểm và xuất ảnh.
- Bảng cấu kiện, findings mẫu hoặc kết quả giao cắt thật, review tới điểm giao cắt và issue chỉ trong phiên.
- Rust Application API dùng cho Tauri commands và local development HTTP adapter.
- Python worker có hello/import, protocol JSON-RPC UTF-8, timeout và kill-on-drop từ Rust.
- Nhập IFC thật qua multipart trên browser hoặc native file dialog trong Tauri, có giới hạn rõ.
- Immutable IFC snapshot, SHA-256, preview artifact và SQLite schema đầu tiên cho model versions/audit.
- Rust mock assistant nhận lệnh local, trả view actions cho React áp dụng; không gọi nhà cung cấp AI.
- MCP rmcp stdio với project_get, models_list, elements_search và checks_run; đã handshake và gọi tool thật.
- Kiểm tra giao cắt trong một IFC snapshot với nhóm A/B, tầng và ngưỡng đo; lưu CheckRun, source hash và kết quả vào SQLite.
- Tính được 42 giao cắt ống gió–dầm trên IFC tổng hợp, 147/147 hình học; scope L05 có 6 giao cắt.

## Kết quả kiểm tra

| Boundary | Evidence |
| --- | --- |
| Frontend | TypeScript và Vite production build thành công |
| Rust | Application/host/MCP compile; desktop cargo check và native build thành công |
| Worker | 8 tests qua: geometry/mapping, protocol UTF-8, đầu vào lỗi, giao cắt/tách rời/chạm mặt, scope và stale snapshot |
| HTTP tới worker | Nhập fixture hai cấu kiện, generated 2/expected 2, failed 0 |
| SQLite | Một model version nhập thật có metadata trong workspace.sqlite |
| Browser sau nhập | Hiển thị 5 model entries và 401 cấu kiện qua Rust workspace.get |
| MCP | Initialize protocol 2024-11-05, 4 tools, project_get thành công, search tìm 63 dầm và checks_run L05 tìm 6 giao cắt |
| UI interaction | Review CL-001 mở L05 và thuộc tính đúng; tạo issue trong phiên; cô lập HVAC |
| Origin restriction | Development adapter từ chối Origin không thuộc frontend local bằng HTTP 403 |

Kiểm tra tích hợp đã phát hiện encoding stdout Windows; worker hiện cấu hình stdin/stdout/stderr UTF-8. Có regression test tên file tiếng Việt.

## Khác biệt tạm thời so với kiến trúc đích

1. Preview dùng mesh JSON có giới hạn thay cho GLB/chunk binary. Đây là lựa chọn cho vòng chỉnh UI đầu, không phải định dạng cache phát hành.
2. MCP nối tới local Rust HTTP adapter trong bản development; authenticated named pipe/session routing chưa làm. MCP hiện có ba công cụ đọc và một công cụ kiểm tra hình học có giới hạn.
3. TypeScript contracts được khai báo thủ công ở giai đoạn này; code generation/schema parity còn phải thêm.
4. SQLite có model_versions, audit_entries và check_runs; entities cho issues/rules và project sessions chưa đầy đủ.
5. Assistant là deterministic mock. Một số thao tác view đang được React áp dụng từ action trả về; desired/applied state acknowledgement chưa có.
6. Worker chạy one-shot mỗi lần nhập; persistent worker, progress stream, cancel UI và resource budgets đầy đủ chưa làm.
7. Các tên model theo bộ môn trong dự án mẫu là nhóm trình bày của một IFC tổng hợp, không phải chứng minh federation nhiều file thật.
8. Metadata/version nhập được lưu; issue, review status, layout và chat demo chưa lưu bền.

## Phần còn lại trước khi vượt G1

- Fixtures clash có đáp án, openings, placements, units và large coordinates.
- Export GLB với element mapping, lựa chọn chunk format và benchmark bộ nhớ.
- Mở rộng kiểm tra giao cắt đã có sang federation nhiều file; bổ sung ngoại lệ, rule revisions, đối chiếu versions và coverage cho các kiểu hình học phức tạp.
- Federation hai IFC độc lập với transform và xác minh điểm clash/đo/camera cùng frame.
- Worker progress/cancellation/recovery và import transactions khi crash.
- MCP authenticated named pipe, session identity và ViewState acknowledgement.
- PyInstaller/sidecar packaging và kiểm thử Windows sạch không Python/Node.
- IFC2x3/IFC4 thực tế và đo hiệu năng trên cấu hình chuẩn.

Ưu tiên vòng tiếp theo: người dùng chỉnh layout/typography/workflow trên bản local, sau đó hoàn thành pipeline binary và clash fixtures để vượt G1.

## Kiểm tra lượt tiếp theo

Luồng browser → Rust HTTP → worker và Tauri command → Rust → worker đều đã cho 42 giao cắt, coverage 147/147. Browser không ghi nhận console errors/warnings trong lượt thử. Review kết quả thật hiển thị đúng tầng, STEP ID và marker tại tọa độ giao cắt.

CheckRun lưu bằng chứng theo lần chạy; danh sách kết quả đang xem chưa tự phục hồi khi mở lại UI. Các findings UX mẫu vẫn xuất hiện ban đầu và được thay bằng kết quả engine khi người dùng chạy kiểm tra.
