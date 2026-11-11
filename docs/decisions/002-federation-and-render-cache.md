# Kiểm tra federation và cache hình học

Ngày 05 tháng 11 năm 2026. Quyết định cho G1: nguồn IFC bất biến, định vị dùng chung giữa Viewer và engine, cache render nhị phân tách khỏi dữ liệu kiểm tra.

## Kiểm tra nhiều IFC

Mỗi nhóm A/B chọn một hoặc nhiều model IDs. Rust chỉ resolve các snapshot đã đăng ký; agent không được đưa đường dẫn tùy ý vào kiểm tra. Mỗi source mang hash, transform và revision.

Worker lấy tessellation float64 của IfcOpenShell, quy về mét, áp phép dịch và quay Z, rồi tạo một IFC4 tạm với identity riêng cho từng cấu kiện. IFC tạm được đưa qua intersection kernel. Kết quả ánh xạ ngược về source hash và STEP ID, nên GUID và STEP ID trùng giữa hai file không làm nhập nhằng đối tượng.

Check frame được đưa về gần mô hình để xử lý tọa độ lớn. Điểm giao cắt trả về project frame. Mesh không manifold không được giả định là solid hợp lệ: nó làm coverage chưa hoàn tất. Ngưỡng kiểm tra áp dụng cho phép đo của kernel, không phải bounding-box overlap. Kiểm tra vẫn dựa vào tessellation, chưa phải chứng nhận va chạm chính xác tuyệt đối cho mọi loại hình học IFC.

Giới hạn G1: 12 source snapshots, tối đa 2.000 cấu kiện trong phạm vi kiểm tra, 1.000 findings trả về; vượt giới hạn kết quả được ghi incomplete. Chưa áp map conversion/EPSG tự động, scale/shear, clearance hoặc các ngoại lệ thiết kế.

## Cache render nhị phân

Chọn QBM1 cho đường tải nội bộ G1, thay mesh JSON. Header 16 byte chứa magic, version, số giá trị vị trí và số indices. Tiếp theo là Float32 positions và UInt32 indices little-endian. Mỗi cấu kiện lưu asset index và phạm vi offset/count trong manifest. Các vị trí được đưa về render origin trước khi chuyển Float32.

Mỗi chunk chứa tối đa 256 cấu kiện hoặc khoảng 4 MB; một cấu kiện riêng có thể vượt mốc này trong geometry budget tổng. HTTP/native reader chặn asset trên 32 MB. ID asset chứa SHA-256 nội dung; file cache có tên rút gọn để không vượt giới hạn đường dẫn Windows, manifest vẫn giữ hash đầy đủ.

Cache kiểm tra hash IFC, engine version, geometry settings và hash các chunk. Đọc lại không tessellate lại; binary hỏng sẽ được dựng lại. IFC gốc và geometry float64 được dùng cho check, không dùng Float32 render chunks để kết luận va chạm.

GLB đã được thử với IfcOpenShell serializer, nhưng chưa chọn làm đường tải chính: bản xuất thử 399 mesh khoảng 356 KB, so với khoảng 96 KB buffer QBM1. Đây là so sánh payload hình học, không phải kết luận GLB luôn kém hơn. GLB vẫn là lựa chọn trao đổi/renderer adapter về sau. QBM1 là định dạng cache có thể tạo lại, không phải định dạng bàn giao BIM.

## Viewer và ownership

Viewer tải tối đa ba nhóm chunk song song, dùng typed-array views vào ArrayBuffer, giữ geometry đã có và chỉ thêm/thay mesh khi geometry fingerprint thay đổi. Các thay đổi chọn/ẩn/tầng/định vị không nạp lại hình học. Render chỉ thực hiện khi scene hoặc camera thay đổi; vòng requestAnimationFrame vẫn phục vụ damping.

Trong chế độ desktop development, Tauri sở hữu Rust Application state và mở local HTTP bridge bằng cùng state. Browser preview, Tauri commands và MCP dùng chung model transforms. Nếu cổng bridge đã bị chiếm, desktop dừng khởi động thay vì để MCP nối nhầm một core khác. `pnpm core` vẫn dành cho browser-only; không chạy đồng thời với desktop.

## Bằng chứng

- Tests các IFC riêng biệt trùng GUID/STEP ID, translation, rotation, mm/m, tọa độ lớn, scope và stale hash.
- Tests cache hit, binary corruption/rebuild, geometry identity và typed-array zero-copy.
- Bộ hai IFC tổng hợp có 280 cấu kiện kết cấu và 105 MEP: 42 giao cắt; dịch MEP 100 m còn 0; phục hồi vị trí và lọc L05 có 6.
- [Benchmark worker](../research/loading-benchmark.json): ba lần trên IFC tổng hợp 399 cấu kiện. Số đo không gồm khởi động Python, HTTP hoặc GPU upload; chưa đại diện mô hình dự án lớn.
