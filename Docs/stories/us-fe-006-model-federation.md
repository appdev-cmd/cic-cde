# US-FE-006 Model Federation (BIM viewer đa mô hình)

## Status

in_progress

## Lane

high-risk

## Product Contract

Nâng cấp BIM viewer từ load 1 mô hình sang LIÊN HỢP nhiều mô hình IFC cùng lúc
(kiểu BIMcollab): nhóm theo bộ môn, bật/tắt hiển thị từng mô hình, chọn cấu kiện
và xem thuộc tính trên mô hình liên hợp. Là nền tảng cho Walk/Fly, Viewpoints,
Issues và Clash detection.

## Relevant Product Docs

- `Docs/ROADMAP.md` (Milestone 3, Phase A)
- `Docs/product/bim-viewer.md`

## Acceptance Criteria

1. BimViewer load và giữ NHIỀU model đồng thời (không thay thế model cũ).
2. Panel Navigation: liệt kê tài liệu IFC của dự án (từ Supabase) nhóm theo bộ môn,
   toggle tải/ẩn/hiện từng model, hiển thị số "đã tải/tổng".
3. Fit-to-all bao toàn bộ model đang hiện.
4. Chọn cấu kiện trên bất kỳ model nào → hiện đúng thuộc tính.
5. `npm run lint` + `npm run build` xanh.

## Design Notes

- Engine: ThatOpen FragmentsManager (hỗ trợ đa model).
- modelsRef: Map<modelId, { model, discipline, name, visible }>.
- propsDict per-model để tránh trùng localId.
- Discipline suy từ mã ISO 19650 (trường Discipline) của tài liệu.
- loadModel/removeModel/setModelVisibility + fitToAll trên BimViewerRef.

## Validation

| Layer | Expected proof |
| --- | --- |
| Unit | |
| Integration | |
| E2E | Thao tác tay trong trình duyệt (load 2+ model, toggle) |
| Platform | lint + build xanh |

## Harness Delta

Milestone 3 mới trong ROADMAP.

## Evidence

- Đang làm Phase A.
