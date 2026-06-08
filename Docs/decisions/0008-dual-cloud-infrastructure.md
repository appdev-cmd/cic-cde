# 0008 Hạ Tầng Dual-Cloud Nội Địa (Dual-Cloud Infrastructure)

Date: 2026-06-08

## Status

Accepted

## Context

Để cung cấp dịch vụ CDE cho các ban quản lý dự án đầu tư công (B2G) và doanh nghiệp lớn tại Việt Nam, hệ thống phải tuân thủ nghiêm ngặt **Quy chuẩn QCVN 12:2026/BCA** về an ninh mạng. Đồng thời, kiến trúc phải đảm bảo tính liên tục của dữ liệu (Disaster Recovery) với chi phí vận hành tối ưu cho một đội ngũ tinh gọn (7-8 người).

## Decision

Chúng tôi quyết định thiết lập mô hình **Dual-Cloud nội địa** (Active-Standby):
1. **Hạ tầng chính (Primary Site - Hà Nội)**: Thuê dịch vụ tại **Viettel Cloud**. Viettel Cloud đáp ứng đầy đủ tiêu chuẩn Tier III, có chứng nhận An toàn thông tin Cấp độ 4 và cung cấp dịch vụ GPU Spot Instance cho việc xử lý AI/BIM.
2. **Hạ tầng dự phòng (DR Site - TP.HCM)**: Thuê dịch vụ tại **VNPT Cloud**. Dữ liệu PostgreSQL sẽ được đồng bộ bất đối xứng liên tục từ Hà Nội vào TP.HCM, và tệp thiết kế trên vStorage sẽ được backup định kỳ hàng đêm.

## Alternatives Considered

1. **Sử dụng Cloud quốc tế (AWS/Azure/GCP)**: Không đáp ứng quy định QCVN 12 vì dữ liệu hành chính/thiết kế đầu tư công bị bắt buộc lưu trữ trong lãnh thổ Việt Nam.
2. **Thiết lập mô hình 3 Cloud (Viettel + VNPT + FPT)**: Tăng quá tải gánh nặng vận hành DevOps cho đội ngũ nhân sự tinh gọn.

## Consequences

Positive:

* Đảm bảo tính pháp lý 100% khi tiếp cận các Ban quản lý dự án nhà nước.
* Đảm bảo an toàn dữ liệu và khả năng khôi phục hệ thống khi xảy ra sự cố thiên tai/đứt cáp.

Tradeoffs:

* Chi phí thuê hạ tầng trong nước cao hơn một chút so với Cloud quốc tế nếu không tối ưu hóa tốt tài nguyên tính toán.
