# 0006 Backend Đa Ngôn Ngữ (Polyglot Backend)

Date: 2026-06-08

## Status

Accepted

## Context

Hệ thống Common Data Environment (CDE) đòi hỏi hiệu năng cao trong việc truyền tải, quản lý tài liệu dung lượng lớn (ISO 19650) và đồng thời cần xử lý các phép toán hình học BIM, phân tích cấu trúc IFC và hỗ trợ trợ lý ảo AI.
* **Go** cực kỳ mạnh mẽ về mặt xử lý song song, kết nối mạng hiệu năng cao và tốn rất ít RAM, tuy nhiên lại thiếu các thư viện xử lý BIM chuyên sâu.
* **Python** sở hữu thư viện `IfcOpenShell` tốt nhất thế giới để parse file IFC và hệ sinh thái AI rất mạnh, nhưng hiệu năng tính toán đa luồng lại bị giới hạn bởi GIL.

## Decision

Chúng tôi quyết định áp dụng kiến trúc **Polyglot Backend (Kiến trúc đa ngôn ngữ)**:
1. **Dịch vụ API chính & Quản lý tài liệu (Go)**: Viết bằng Go để tối đa hóa tốc độ truyền tải tệp, định tuyến API Gateway, phân quyền (Keycloak SSO) và gửi thông báo real-time.
2. **Dịch vụ BIM & AI (Python)**: Viết bằng Python, giao tiếp với lõi Go qua giao thức **gRPC** hiệu năng cao. Python chịu trách nhiệm chạy IfcOpenShell để phân tích tệp IFC, bóc tách khối lượng và chạy mô hình ngôn ngữ lớn RAG (BIM Agent).

## Alternatives Considered

1. **Sử dụng duy nhất .NET (C#)**: .NET Core rất mạnh và hỗ trợ ODA SDK, tuy nhiên không tạo ra sự khác biệt công nghệ và khó mở rộng AI RAG linh hoạt như Python.
2. **Sử dụng duy nhất Java**: Thời gian khởi động nguội rất lâu và tốn tài nguyên RAM trên cloud hơn Go từ 5-10 lần.

## Consequences

Positive:

* Tối ưu hóa hiệu năng: Tận dụng tối đa ưu thế tốc độ của Go và tính năng phong phú của Python.
* Giảm chi phí hạ tầng RAM trên Viettel Cloud nhờ các Static Binary rất nhẹ của Go.

Tradeoffs:

* Tăng độ phức tạp của việc CI/CD và cấu hình giao tiếp gRPC giữa các dịch vụ.
* Đội ngũ kỹ sư cần thành thạo cả hai ngôn ngữ.
