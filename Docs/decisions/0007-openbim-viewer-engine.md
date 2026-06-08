# 0007 Trình Hiển Thị 3D OpenBIM (OpenBIM 3D Viewer Engine)

Date: 2026-06-08

## Status

Accepted

## Context

Hiển thị mô hình BIM lớn (>500MB) trên nền web yêu cầu tốc độ xử lý nhanh và độ trễ thấp để lập trình viên và cán bộ quản lý dự án có thể tương tác mượt mà.
* Các giải pháp như Autodesk APS (Forge) yêu cầu trả phí theo lưu lượng gọi API và vi phạm quy chuẩn QCVN 12 do truyền dữ liệu thiết kế ra máy chủ nước ngoài.
* Việc tự viết 1 trình dựng hình 3D hoàn chỉnh từ đầu tốn rất nhiều thời gian và chi phí R&D.

## Decision

Chúng tôi quyết định áp dụng chiến lược **Hybrid Open-source Engine** phân kỳ:
1. **Phase 1 (MVP/Giai đoạn đầu)**: Sử dụng **ThatOpen Engine (trước đây là IFC.js)**. Lõi hiển thị dựa trên Three.js biên dịch sang WebAssembly (`web-ifc`) giúp parse và render IFC trực tiếp trên trình duyệt của người dùng.
2. **Phase 2 (Tối ưu hóa)**: Xây dựng pipeline phía server chuyển đổi tệp IFC sang định dạng **Streaming (.cic3d)** được nén bằng thuật toán Google Draco. Phía client chỉ stream các mảnh hình học (tiles) đang hiển thị trong tầm nhìn camera để xử lý các tệp siêu lớn mà không bị crash RAM.

## Alternatives Considered

1. **Sử dụng Autodesk APS (Forge)**: Bị loại bỏ vì nguy cơ rò rỉ dữ liệu ngoài nước và chi phí vận hành phụ thuộc cao.
2. **Sử dụng Xeokit SDK**: Tốt nhưng giấy phép thương mại đắt đỏ.

## Consequences

Positive:

* Tự chủ hoàn toàn công nghệ render 3D, dữ liệu thiết kế lưu trữ và xử lý hoàn toàn trong nước.
* Khởi động nhanh cho Phase 1 nhờ thư viện ThatOpen miễn phí và chất lượng cao.

Tradeoffs:

* Thư viện ThatOpen sử dụng giấy phép AGPLv3/tương đương, do đó cần thiết kế module viewer độc lập để tránh ảnh hưởng bản quyền đến phần mềm chính.
