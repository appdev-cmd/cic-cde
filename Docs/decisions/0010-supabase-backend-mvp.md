# 0010 Supabase làm Backend cho Giai đoạn MVP (Lean Team)

Date: 2026-06-09

## Status

Accepted

## Context

Báo cáo nghiên cứu khả thi (`Docs/bao_cao_nghien_cuu_kha_thi_cde_cic.md`) đề xuất
kiến trúc Polyglot Backend Go + Python + PostgreSQL tự dựng (xem decision
`0006-polyglot-backend.md`). Kiến trúc đó tối ưu cho đội ngũ 6-10 người có vốn
đầu tư, cần dựng API Gateway, gRPC, Keycloak, Docker/K8s từ đầu.

Tuy nhiên giai đoạn hiện tại chỉ có **2 người phát triển** (Product owner +
Claude theo mô hình AI-Conductor). Frontend đã là một prototype hoàn chỉnh
(~6,800 dòng) với BIM viewer thật (ThatOpen), nhưng toàn bộ dữ liệu đang nằm
trong `localStorage` (mock). Cần một backend thật để có dữ liệu bền vững, đa
người dùng, xác thực và lưu trữ file — nhưng không đủ nhân lực để vận hành
polyglot microservices.

Dấu vết trong codebase cho thấy Supabase đã bắt đầu được thiết lập: project đã
link (`shiqfawlgeintqsibqmk` / "cic-cde"), `src/lib/supabase.ts` đã tạo,
`@supabase/supabase-js` đã thêm vào dependencies.

## Decision

Chọn **Supabase làm backend chính cho giai đoạn MVP**:

1. **Database**: PostgreSQL của Supabase (đúng CSDL mà báo cáo đề xuất), kèm
   PostGIS cho GeoBIM về sau.
2. **Auth**: Supabase Auth cho đăng nhập/phân quyền giai đoạn đầu. VNeID SSO +
   Keycloak là mục tiêu giai đoạn B2G sau (giữ nguyên decision hướng tới VNeID).
3. **Storage**: Supabase Storage (S3-compatible) cho file IFC/PDF/DWG, thay cho
   MinIO/vStorage trong báo cáo.
4. **API**: REST/Realtime tự sinh của Supabase + Row Level Security (RLS) thay
   cho việc tự viết API Gateway Go ở giai đoạn này.
5. **Edge Functions** (Deno/TypeScript) cho logic nghiệp vụ cần server-side
   (validate naming ISO 19650, workflow gate, audit hash).

Kiến trúc polyglot Go + Python (decision 0006) **không bị huỷ bỏ** — nó trở
thành lộ trình migrate giai đoạn 2 khi có vốn/nhân sự, đặc biệt cho dịch vụ
Python QTO/IFC parsing và Go cho throughput cao. Supabase đóng vai trò "đường
băng" để ship nhanh và xác nhận product-market fit trước.

## Alternatives Considered

1. **Tự dựng Go + Python ngay (theo báo cáo)**: Loại bỏ ở giai đoạn này vì quá
   tải cho 2 người; làm chậm việc ship và xác nhận PMF.
2. **Giữ frontend-only trên localStorage**: Loại bỏ vì không có dữ liệu bền
   vững/đa người dùng — không thể pilot thật với Sở Xây dựng.
3. **Firebase**: Loại bỏ vì NoSQL không hợp dữ liệu quan hệ phức tạp của CDE và
   không phải PostgreSQL như định hướng dài hạn.

## Consequences

Positive:

* Ship nhanh: có Auth + DB + Storage + API ngay mà không cần viết backend.
* Đúng định hướng PostgreSQL dài hạn — schema và dữ liệu migrate được sang
  self-hosted Postgres/Go+Python về sau.
* Phù hợp tuyệt đối mô hình AI-Conductor 2 người.

Tradeoffs:

* Phụ thuộc Supabase ở giai đoạn MVP (cloud nước ngoài) — **chưa đạt QCVN 12**.
  Cần ghi nhận rõ: trước khi phục vụ B2G/đầu tư công thật, phải migrate sang hạ
  tầng nội địa (Viettel/VNPT) hoặc self-host Supabase. MVP/pilot dùng để chứng
  minh tính năng, không lưu dữ liệu mật.
* Logic nghiệp vụ nặng (QTO, IFC parse server-side) chưa làm được trên Supabase
  thuần — tạm thời xử lý client-side hoặc hoãn sang giai đoạn Python.

## Migration Path (Giai đoạn 2)

```text
MVP (Supabase)                  Giai đoạn 2 (Tự chủ nội địa)
-----------------               ----------------------------
Supabase Postgres        -->    PostgreSQL self-host (Viettel Cloud) + PostGIS
Supabase Auth            -->    Keycloak + VNeID SSO
Supabase Storage         -->    MinIO / vStorage (WORM cho audit)
Auto REST + RLS          -->    Go API Gateway + gRPC
Edge Functions (Deno)    -->    Python services (IfcOpenShell, QTO, AI/RAG)
```
