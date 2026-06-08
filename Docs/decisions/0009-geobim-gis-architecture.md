# 0009 Kiến Trúc Bản Đồ Số GeoBIM/GIS (GeoBIM/GIS 3D Tiles Streaming)

Date: 2026-06-08

## Status

Accepted

## Context

Phân hệ GeoBIM yêu cầu hiển thị trực quan các công trình hạ tầng trên bản đồ địa lý 3D. Khách hàng B2G cần liên kết dữ liệu mô hình BIM với dữ liệu quy hoạch khu vực. Việc tải toàn bộ tệp tin hình học BIM nặng (>500MB) về máy khách và hiển thị trực tiếp trên bản đồ sẽ gây gián đoạn lớn về mặt hiệu năng hoặc gây crash trình duyệt.

## Decision

Chúng tôi quyết định áp dụng kiến trúc **3D Tiles Streaming (chuẩn OGC)**:
1. **Server-side Pipeline (Python)**: Khi tệp IFC được đăng tải, server chạy IfcOpenShell để trích xuất tọa độ `IfcSite`, thực hiện chuyển đổi hệ tọa độ VN-2000 sang WGS-84, sau đó sử dụng thư viện `py3dtiles` và nén Google Draco để tạo ra cây thư mục chứa các mảnh hình học (.b3dm) phân chia theo cấp độ chi tiết (LOD). Dữ liệu thuộc tính không gian được lưu trong PostgreSQL + PostGIS.
2. **Client-side Render (TypeScript)**: Sử dụng **Cesium.js** trên giao diện Frontend để tải động các mảnh hình học 3D Tiles tùy theo camera của người dùng, đảm bảo hiệu năng tải trang cực nhanh và mượt mà trên máy tính văn phòng thông thường.
3. **Bản đồ nền (Map Base)**: Sử dụng **Vmap (Bộ TN&MT)** cho phân khúc B2G để đảm bảo an ninh thông tin địa lý và **MapBox GL JS** cho phân khúc SaaS tư nhân.

## Alternatives Considered

1. **Client-side Parsing**: Đọc toàn bộ file trên trình duyệt và tự vẽ lại. Bị loại bỏ vì không đáp ứng được các mô hình hạ tầng giao thông lớn.

## Consequences

Positive:

* Trải nghiệm người dùng vượt trội: Tải công trình lớn chỉ mất 3-5 giây nhờ cơ chế stream thông minh.
* Hỗ trợ tốt hiển thị hàng chục công trình đồng thời trên bản đồ tổng thể.

Tradeoffs:

* Tốn tài nguyên tính toán và dung lượng lưu trữ trên server để xử lý và lưu trữ các phân tầng LOD của mô hình 3D Tiles.
