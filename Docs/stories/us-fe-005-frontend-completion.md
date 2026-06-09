# US-FE-005 Hoàn thiện Frontend (client-side)

## Status

in_progress

## Lane

normal

## Product Contract

Biến các tính năng frontend đang ở dạng mock/giả lập thành tính năng thật ở mức
client-side (không phụ thuộc backend), để xác nhận đầy đủ nghiệp vụ và UX trước
khi dựng backend. Bao gồm 5 sprint: AI thật (Gemini), QTO từ IFC, BCF
export/import, workflow tài liệu đầy đủ + polish, và tab FM/COBie.

## Relevant Product Docs

- `Docs/ROADMAP.md` (Milestone 1)
- `Docs/product/bim-viewer.md`
- `Docs/product/document-management.md`
- `Docs/product/scheduling.md`

## Acceptance Criteria

1. `npm run lint` xanh (sửa lỗi `import.meta.env`).
2. AI Assistant gọi Gemini thật (Dashboard chat + nút "Phân tích với AI" trong Viewer).
3. QTO: bảng khối lượng thật trích từ `Qto_*` của IFC đang mở.
4. BCF: export/import file `.bcfzip` chuẩn.
5. Workflow tài liệu đủ 4 trạng thái với Gate 2 (Published/Archived) + suitability codes.
6. Polish: search chạy, thông báo, bỏ nút tĩnh.
7. Tab FM/COBie: danh sách thiết bị + QR code + phiếu bảo trì (mock data).

## Design Notes

- UI surfaces: DashboardTab (AI), ViewerTab (AI, QTO, BCF), DocumentsTab (workflow),
  AppHeader (search/notif), tab FM mới.
- Domain rules: ISO 19650 4 states + suitability codes; BCF 2.x schema; COBie.
- Libs: `@google/genai` (đã có), cần thêm lib zip cho BCF (jszip — đã có gián tiếp
  qua deps?), lib QR code.
- Không thêm backend trong story này. Dữ liệu vẫn localStorage.

## Validation

When updating durable proof status, use numeric booleans:
`scripts/bin/harness-cli story update --id US-FE-005 --unit 0 --integration 0 --e2e 0 --platform 0`.

| Layer | Expected proof |
| --- | --- |
| Unit | validateISO19650, BCF serialize/parse, QTO extract (nếu thêm test) |
| Integration | |
| E2E | Thao tác tay trong trình duyệt từng tính năng |
| Platform | `npm run lint` + `npm run build` xanh |
| Release | |

## Harness Delta

- Cập nhật `Docs/ROADMAP.md` đổi thứ tự frontend-first.
- Decision `0010-supabase-backend-mvp.md` đã ghi (backend dời sang Milestone 2).

## Evidence

- Sprint 1 (đang làm): bắt đầu bằng sửa lint.
