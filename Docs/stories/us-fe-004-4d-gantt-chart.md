# US-FE-004 Thiết lập Liên kết Tiến độ 4D/5D & Biểu đồ Chi phí

## Status

planned

## Lane

normal

## Product Contract

Giao diện `ScheduleTab.tsx` tích hợp biểu đồ tiến độ Gantt động và liên kết 4D với Viewer 3D. Đồng thời, hiển thị trực quan biểu đồ chi phí lũy kế thực tế (S-Curve) so với kế hoạch dự toán.

## Relevant Product Docs

- `design-system/MASTER.md`
- `Docs/stories/us-005-cost-schedule-5d.md`

## Acceptance Criteria

1. Cho phép kéo, dịch chuyển thời gian của các thanh tiến độ (Gantt bars) và cập nhật tỷ lệ % hoàn thành động.
2. **Liên kết 4D**: Khi nhấp chọn một hạng mục thi công (Cột/Vách hoặc Dầm/Sàn) trên Gantt chart, gửi thông điệp và kích hoạt highlight cấu kiện đó trên 3D Viewer.
3. Vẽ biểu đồ lũy kế chi phí S-Curve thực tế so với kế hoạch bằng đồ họa SVG mượt mà.
4. KPI chênh lệch (+2.3 Tỷ) và % hoàn thành (68%) sẽ cập nhật động tương ứng với dữ liệu tiến độ Gantt.

## Design Notes

- **UI surfaces**: Tab `ScheduleTab.tsx`
- **Design rules**:
  - Biểu đồ tiến độ Gantt kéo thả mượt mà, thay đổi cursor phù hợp (`cursor-ew-resize`).
  - Biểu đồ SVG có tooltip giá trị khi rê chuột.

## Validation

Khi cập nhật bằng chứng, chạy lệnh:
`scripts/bin/harness-cli story update --id US-FE-004 --unit 1 --integration 1 --e2e 0 --platform 0`.

| Layer | Expected proof |
| --- | --- |
| Unit | Tính toán đúng chỉ số chênh lệch ngân sách SPI/CPI theo tiến độ |
| Integration | Gửi tín hiệu highlight cấu kiện 3D thành công sang kênh truyền dữ liệu của Component Viewer |
| E2E | |
| Platform | |
| Release | |

## Evidence

Chưa có.
