# 0007 Trình Hiển Thị 3D OpenBIM (OpenBIM 3D Viewer Engine)

Date: 2026-06-08 · Cập nhật: 2026-06-28 (xét lại Phase 2 sau nghiên cứu ACC/iTwin/Trimble/BIMcollab)

## Status

Accepted (Phase 1) · Phase 2 **được sửa lại** ngày 2026-06-28 — xem mục "Cập nhật Phase 2".

## Context

Hiển thị mô hình BIM lớn (>500MB) trên nền web yêu cầu tốc độ xử lý nhanh và độ trễ thấp để lập trình viên và cán bộ quản lý dự án có thể tương tác mượt mà.
* Các giải pháp như Autodesk APS (Forge) yêu cầu trả phí theo lưu lượng gọi API và vi phạm quy chuẩn QCVN 12 do truyền dữ liệu thiết kế ra máy chủ nước ngoài.
* Việc tự viết 1 trình dựng hình 3D hoàn chỉnh từ đầu tốn rất nhiều thời gian và chi phí R&D.

## Decision

Chúng tôi quyết định áp dụng chiến lược **Hybrid Open-source Engine** phân kỳ:
1. **Phase 1 (MVP/Giai đoạn đầu)**: Sử dụng **ThatOpen Engine (trước đây là IFC.js)**. Lõi hiển thị dựa trên Three.js biên dịch sang WebAssembly (`web-ifc`) giúp parse và render IFC trực tiếp trên trình duyệt của người dùng.
2. **Phase 2 (Tối ưu hóa)** — *bản gốc, đã thay thế*: Xây dựng pipeline phía server chuyển đổi tệp IFC sang **định dạng riêng `.cic3d`** nén Draco, client stream các tiles trong tầm nhìn camera.

## Cập nhật Phase 2 (2026-06-28)

Sau khi nghiên cứu kiến trúc viewer của **Autodesk ACC/APS (SVF2)**, **Bentley iTwin.js (OGC 3D Tiles)**, **Trimble Connect (TrimBim + Potree)** và **BIMcollab Zoom (Smart Views/IDS)**, chúng tôi nhận thấy cả 4 hội tụ về cùng 5 nguyên lý: (1) convert server-side một lần, (2) khử trùng lặp mesh + instancing, (3) tile + LOD theo view-frustum, (4) tách geometry ↔ metadata/Pset, (5) sinh tile on-demand + cache. **Không nền tảng lớn nào còn tự phát minh định dạng đóng riêng** — Bentley đã chuyển sang chuẩn mở OGC 3D Tiles.

**Quyết định sửa Phase 2:** **Bỏ việc tự chế định dạng `.cic3d`.** Thay bằng kiến trúc 2 lớp, đều open-source và tự host được:

- **Lớp engine (viewer nội bộ CDE):** đẩy bước convert **IFC → ThatOpen Fragments** ra **server** (Node/worker) thay vì convert trong trình duyệt. Fragments là tương đương open-source của SVF2 (nhị phân nén, worker-thread, tile/stream sẵn có, load >10× nhanh) → đáp ứng tiêu chí P2.3 (100MB <10s; >500MB khung đầu <5s) mà không phải viết format mới.
- **Lớp trao đổi/GeoBIM:** xuất song song **OGC 3D Tiles 1.1** (glTF + Draco/Meshopt) — chuẩn mở, vendor-neutral, ghép thẳng Cesium (ADR 0009), thỏa QCVN 12.

Bổ sung từ pattern nghiệp vụ: **Smart Views** (tô màu/lọc theo Pset + validate IDS) làm bệ phóng cho TC2 auto-check; **on-demand tile + cache** kiểu iTwin cho file siêu lớn; **Potree** cho point cloud khi cần.

## Alternatives Considered

1. **Sử dụng Autodesk APS (Forge/SVF2)**: Bị loại bỏ vì nguy cơ rò rỉ dữ liệu ngoài nước (QCVN 12) và chi phí vận hành phụ thuộc cao. *Học lại: khử trùng lặp mesh + instancing + tách dbid/metadata.*
2. **Bentley iTwin.js SDK**: Kiến trúc 3D Tiles + tile on-demand rất tốt nhưng SDK nặng, gắn iModelHub. *Học lại kiến trúc, dùng chuẩn mở 3D Tiles thay vì SDK.*
3. **Tự chế định dạng `.cic3d`**: Bị loại — trùng việc với Fragments/3D Tiles, không interop, gánh nặng bảo trì.
4. **Sử dụng Xeokit SDK**: Tốt nhưng giấy phép thương mại đắt đỏ.

## Consequences

Positive:

* Tự chủ hoàn toàn công nghệ render 3D, dữ liệu thiết kế lưu trữ và xử lý hoàn toàn trong nước.
* Khởi động nhanh cho Phase 1 nhờ thư viện ThatOpen miễn phí và chất lượng cao.
* Phase 2 dùng lại Fragments (đã có trong stack) + chuẩn mở 3D Tiles → giảm rủi ro R&D, interop tốt, sẵn sàng GeoBIM.

Tradeoffs:

* Thư viện ThatOpen sử dụng giấy phép AGPLv3/tương đương, do đó cần thiết kế module viewer độc lập để tránh ảnh hưởng bản quyền đến phần mềm chính.
* Cần dịch vụ convert server-side (Node/worker) riêng cho Phase 2 — hạ tầng bổ sung.
