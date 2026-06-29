# Bộ quy tắc kiểm tra quy chuẩn (Compliance Rules) — CDE CIC

> **Mục đích.** File này là **nguồn sự thật (source of truth) do con người biên tập** cho
> bộ máy kiểm tra tự động (TC2). Mỗi quy tắc được số hóa từ văn bản QCVN/TCVN gốc thành
> dạng máy kiểm được, sau đó biên dịch vào bảng `compliance_rules` (cột `definition jsonb`).
>
> **Phạm vi hiện tại:** trích từ văn bản gốc trong `resources/01_phap_ly_quy_chuan/`:
> QCVN 06:2022/BXD (an toàn cháy) và QCVN 10:2014/BXD (tiếp cận cho người khuyết tật) —
> hai nhóm có nhiều quy định **kích thước kiểm được bằng máy** nhất, phù hợp thẩm định.
>
> Ngày lập: 2026-06-28 · Trạng thái: Draft — **cần chuyên gia nghiệp vụ rà soát ánh xạ BIM**

---

## 1. Quy ước & lược đồ quy tắc (Rule schema)

Mỗi quy tắc gồm các trường:

| Trường | Ý nghĩa |
| --- | --- |
| `id` | Mã duy nhất, dạng `<QCVN>-<chủ đề>-<số>` |
| `source` | Quy chuẩn nguồn (số hiệu) |
| `clause` | Điều/khoản trích dẫn (để đưa vào báo cáo thẩm định) |
| `title` | Mô tả ngắn |
| `appliesTo` | Đối tượng áp dụng: loại IFC + điều kiện lọc |
| `property` | Thuộc tính/Pset BIM được kiểm (hoặc đại lượng suy diễn) |
| `op` / `value` / `unit` | Toán tử so sánh + ngưỡng + đơn vị |
| `severity` | `fail` (vi phạm) / `warning` (cảnh báo) / `info` |
| `level` | Mức tự động hóa (xem §2) |
| `status` | `verified-text` (giá trị đúng văn bản) / `needs-expert` (ánh xạ/điều kiện cần xác nhận) |

### Mức tự động hóa (`level`)
- **L1 — Kiểm thuộc tính trực tiếp**: đọc property/Pset của cấu kiện. *Chạy được client-side ngay.*
- **L2 — Cần đại lượng suy diễn/hình học**: cự ly thoát nạn, diện tích khoang cháy, số tầng hầm, tải trọng người. *Cần engine Python (giai đoạn sau).*
- **L3 — Cần phán đoán/ngữ cảnh**: định tính, phụ thuộc hồ sơ. *Chỉ hỗ trợ bằng AI / kiểm thủ công.*

### ⚠️ Lưu ý ánh xạ BIM quan trọng
- IFC `IfcDoor.OverallWidth` là **bề rộng ô cửa**, không bằng **chiều rộng thông thủy** (clear width)
  mà QCVN yêu cầu. Cần Pset chuẩn (vd `Pset_DoorCommon` hoặc Pset tùy biến dự án có `ClearWidth`).
  → Đây là lý do **chuẩn EIR/BEP bắt buộc** trước khi rule chạy chính xác.
- Nhiều ngưỡng QCVN **phụ thuộc số người thoát nạn / nhóm công năng (F1.1, F5...)** — các giá trị
  này là **tham số dự án (L2)**, không có sẵn trong cấu kiện. Quy tắc dưới đây ghi rõ ở cột điều kiện.

### Ví dụ định dạng biên dịch (JSON cho `compliance_rules.definition`)
```jsonc
{
  "id": "QCVN10-ramp-slope-01",
  "source": "QCVN 10:2014/BXD",
  "clause": "2.2.2",
  "title": "Độ dốc đường dốc tiếp cận",
  "appliesTo": { "ifcType": "IfcRamp" },
  "property": "slope",            // đại lượng suy diễn từ hình học
  "op": "<=", "value": 0.0833, "unit": "ratio",   // 1/12
  "severity": "fail", "level": "L2", "status": "verified-text"
}
```

---

## 2. QCVN 10:2014/BXD — Tiếp cận cho người khuyết tật

Nhóm này lý tưởng để khởi động: ngưỡng rõ ràng, đa số là L1.

| id | Điều | Nội dung kiểm | Đối tượng IFC | Thuộc tính | Điều kiện | Ngưỡng | Mức | Trạng thái |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| `QCVN10-ramp-slope-01` | 2.2.2 | Độ dốc đường dốc ≤ 1/12 | `IfcRamp`/`IfcRampFlight` | `slope` (suy diễn) | — | ≤ 1/12 (8,33%) | L2 | verified-text |
| `QCVN10-ramp-width-01` | 2.2.2 | Chiều rộng đường dốc ≥ 1200mm | `IfcRamp` | `Width` | — | ≥ 1200 mm | L1 | needs-expert |
| `QCVN10-ramp-run-01` | 2.2.2 | Chiều dài một đoạn dốc ≤ 9000mm (>9000 phải có chiếu nghỉ) | `IfcRampFlight` | `length` (suy diễn) | — | ≤ 9000 mm | L2 | verified-text |
| `QCVN10-step-riser-01` | 2.3 | Chiều cao bậc lối vào tiếp cận ≤ 150mm | `IfcStairFlight` | `RiserHeight` | lối vào tiếp cận | ≤ 150 mm | L1 | needs-expert |
| `QCVN10-step-tread-01` | 2.3 | Bề rộng mặt bậc ≥ 300mm | `IfcStairFlight` | `TreadLength` | lối vào tiếp cận | ≥ 300 mm | L1 | needs-expert |
| `QCVN10-door-main-01` | 2.4.1 | Cửa ra vào công trình thông thủy ≥ 900mm | `IfcDoor` | `ClearWidth` | cửa ngoài/lối vào | ≥ 900 mm | L1 | needs-expert |
| `QCVN10-door-room-01` | 2.4.1 | Cửa phòng chức năng thông thủy ≥ 800mm | `IfcDoor` | `ClearWidth` | cửa trong | ≥ 800 mm | L1 | needs-expert |
| `QCVN10-door-clearance-01` | 2.4.2 | Không gian thông thủy trước/sau cửa ≥ 1400×1400mm | `IfcSpace`/cửa | hình học | — | ≥ 1400×1400 mm | L2 | verified-text |
| `QCVN10-lift-door-01` | 2.5.1 | Cửa thang máy thông thủy ≥ 900mm | `IfcDoor` (transport) | `ClearWidth` | thang máy tiếp cận | ≥ 900 mm | L1 | needs-expert |
| `QCVN10-lift-cabin-01` | 2.5.1 | Buồng thang máy thông thủy ≥ 1100×1400mm | `IfcSpace`/`IfcTransportElement` | hình học | thang máy tiếp cận | ≥ 1100×1400 mm | L2 | verified-text |
| `QCVN10-wc-door-01` | 2.6.3.4 | Cửa WC người khuyết tật ≥ 800mm, mở ra ngoài | `IfcDoor` | `ClearWidth` | WC tiếp cận | ≥ 800 mm | L1 | needs-expert |
| `QCVN10-wc-space-01` | 2.6.3.3 | Không gian xoay xe lăn trong WC ≥ 1400×1400mm | `IfcSpace` | hình học | WC tiếp cận | ≥ 1400×1400 mm | L2 | verified-text |

---

## 3. QCVN 06:2022/BXD — An toàn cháy (lối & đường thoát nạn)

⚠️ Phần lớn ngưỡng **phụ thuộc nhóm công năng & số người thoát nạn** → cần tham số dự án (L2).
Quy tắc dưới chọn giá trị **mặc định/tối thiểu** và ghi rõ điều kiện ở cột tương ứng.

| id | Điều | Nội dung kiểm | Đối tượng IFC | Thuộc tính | Điều kiện áp dụng | Ngưỡng | Mức | Trạng thái |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| `QCVN06-exit-height-01` | 3.2.9 | Lối ra thoát nạn cao thông thủy ≥ 1,9m | `IfcDoor` (exit) | `OverallHeight` | mọi lối thoát nạn | ≥ 1900 mm | L1 | verified-text |
| `QCVN06-exit-width-min-01` | 3.2.9 | Lối ra thoát nạn rộng thông thủy ≥ 0,8m | `IfcDoor` (exit) | `ClearWidth` | trường hợp còn lại | ≥ 800 mm | L1 | needs-expert |
| `QCVN06-exit-width-hi-01` | 3.2.9 | Lối ra rộng ≥ 1,2m khi đông người | `IfcDoor` (exit) | `ClearWidth` | F1.1 >15 ng; nhóm khác >50 ng | ≥ 1200 mm | L2 | verified-text |
| `QCVN06-route-height-01` | 3.3.6 | Đường thoát nạn (đoạn ngang) cao thông thủy ≥ 2,0m | `IfcSpace`/hành lang | `height` (suy diễn) | — | ≥ 2000 mm | L2 | verified-text |
| `QCVN06-corridor-width-gen-01` | 3.3.6 | Hành lang thoát nạn rộng ≥ 1,0m (mặc định) | `IfcSpace` (corridor) | `width` (suy diễn) | trường hợp còn lại | ≥ 1000 mm | L2 | verified-text |
| `QCVN06-corridor-width-hi-01` | 3.3.6 | Hành lang rộng ≥ 1,2m khi đông người | `IfcSpace` (corridor) | `width` (suy diễn) | F1 >15 ng; nhóm khác >50 ng | ≥ 1200 mm | L2 | verified-text |
| `QCVN06-stair-width-gen-01` | 3.4.1 | Bản thang thoát nạn rộng ≥ 0,9m (mặc định) | `IfcStairFlight` | `Width` | trường hợp còn lại | ≥ 900 mm | L1 | needs-expert |
| `QCVN06-stair-width-f11-01` | 3.4.1 | Bản thang ≥ 1,35m cho nhà nhóm F1.1 | `IfcStairFlight` | `Width` | nhà nhóm F1.1 | ≥ 1350 mm | L2 | verified-text |
| `QCVN06-stair-width-200-01` | 3.4.1 | Bản thang ≥ 1,2m khi >200 người/tầng | `IfcStairFlight` | `Width` | >200 người/tầng (trừ tầng 1) | ≥ 1200 mm | L2 | verified-text |
| `QCVN06-stair-pitch-01` | 3.4.2 | Độ dốc thang ≤ 1:1 (45°) | `IfcStairFlight` | `slope` (suy diễn) | đường thoát nạn | ≤ 45 ° | L2 | verified-text |
| `QCVN06-stair-tread-01` | 3.4.2 | Mặt bậc thang ≥ 25cm | `IfcStairFlight` | `TreadLength` | đường thoát nạn (trừ thang ngoài) | ≥ 250 mm | L1 | verified-text |
| `QCVN06-stair-riser-01` | 3.4.2 | Chiều cao bậc 5cm ≤ h ≤ 22cm | `IfcStairFlight` | `RiserHeight` | đường thoát nạn | 50–220 mm | L1 | verified-text |
| `QCVN06-landing-len-01` | 3.4.3 | Chiếu nghỉ trung gian thang thẳng dài ≥ 1,0m | `IfcSlab`/chiếu nghỉ | `length` (suy diễn) | thang bộ thẳng | ≥ 1000 mm | L2 | verified-text |
| `QCVN06-landing-lift-01` | 3.4.3 | Chiếu thang trước thang máy ≥ 1,6m | `IfcSpace` | hình học | chiếu thang là sảnh thang máy | ≥ 1600 mm | L2 | verified-text |
| `QCVN06-travel-dist-01` | 3.2.5(d) | Cự ly thoát nạn ≤ 25m (gian <50 người) | `IfcSpace` | cự ly (suy diễn) | gian phòng <50 người | ≤ 25 m | L2 | needs-expert |

---

## 4. Quy tắc "đủ thông tin mô hình" (tiền đề cho mọi check)

Trước khi kiểm quy chuẩn, mô hình phải đủ định danh — nếu thiếu, mọi rule trên đều vô nghĩa.
Đây là check L1 nên làm **đầu tiên** trong mọi lần chạy.

| id | Nội dung kiểm | Đối tượng | Điều kiện | Mức |
| --- | --- | --- | --- | --- |
| `MODEL-id-name-01` | Cấu kiện phải có `Name` | mọi `IfcElement` | không rỗng | L1 |
| `MODEL-id-type-01` | Cấu kiện phải có loại/`ObjectType` hợp lệ | mọi `IfcElement` | không rỗng | L1 |
| `MODEL-storey-01` | Cấu kiện phải gắn tầng (`IfcBuildingStorey`) | mọi `IfcElement` | có quan hệ không gian | L1 |
| `MODEL-door-pset-01` | Cửa phải có Pset chiều rộng thông thủy | `IfcDoor` | tồn tại `ClearWidth` | L1 |
| `MODEL-space-01` | Phải có `IfcSpace` cho gian phòng (để check diện tích/cự ly) | mô hình | tồn tại ≥1 `IfcSpace` | L1 |

---

## 5. Việc cần chuyên gia nghiệp vụ bổ sung (trước khi áp dụng TC2)

1. **Xác nhận ánh xạ BIM** cho các dòng `needs-expert`: chính xác Pset/property nào chứa
   "chiều rộng thông thủy" trong chuẩn mô hình của dự án (không dùng `OverallWidth` mặc định).
2. **Số hóa điều kiện phụ thuộc** (L2): cách lấy nhóm công năng (F1.1…) và số người thoát nạn
   cho từng gian — từ Pset hay từ bảng tải trọng người do người dùng nhập.
3. **Bổ sung nhóm rule khác** theo ưu tiên thẩm định: QCVN 04:2021 (chung cư),
   QCVN 09:2017 (sử dụng năng lượng hiệu quả), khoảng cách PCCC giữa các nhà (Phụ lục E/G).
4. **Checklist thẩm định NĐ 217/2026** ở dạng có cấu trúc, ánh xạ tới các rule trên.
5. Cung cấp **2–3 file IFC mẫu** để hiệu chỉnh ngưỡng & kiểm thử false positive.

> Tất cả ngưỡng `verified-text` đã trích **đúng từ văn bản QCVN gốc** trong repo. Các giá trị
> `needs-expert` đúng về **con số** nhưng **ánh xạ thuộc tính BIM là đề xuất**, cần chuyên gia chốt.
