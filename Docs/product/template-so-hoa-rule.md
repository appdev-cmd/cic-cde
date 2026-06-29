# Template số hóa rule kiểm tra quy chuẩn (TC2)

> **Dành cho chuyên gia nghiệp vụ điền.** Mỗi dòng = 1 quy tắc kiểm được bằng máy.
> Điền trực tiếp vào bảng §3 (copy thêm dòng nếu cần). Khi xong, kỹ thuật sẽ biên
> dịch sang `compliance_rules` cho engine. Tham khảo bộ rule khởi điểm đã trích sẵn:
> [rules-kiem-tra-quy-chuan.md](rules-kiem-tra-quy-chuan.md).
>
> **Mục tiêu vòng đầu:** chỉ cần **10–20 check ưu tiên cao + kiểm được bằng máy**.
> Không cần số hóa toàn bộ QCVN.

---

## 1. Hướng dẫn điền từng cột

| Cột | Bắt buộc | Cách điền |
| --- | --- | --- |
| **Ưu tiên** | ✓ | Cao / TB / Thấp — để chọn làm trước |
| **Mã rule** | ✓ | Tự đặt, dạng `QCVN06-exit-width-01` (nguồn-chủ đề-số) |
| **Nguồn** | ✓ | Số hiệu quy chuẩn, vd `QCVN 06:2022/BXD` |
| **Điều/khoản** | ✓ | Để trích dẫn vào báo cáo thẩm định, vd `3.2.9` |
| **Nội dung kiểm** | ✓ | Mô tả ngắn, vd "Chiều rộng lối thoát nạn" |
| **Đối tượng IFC** | ✓ | Loại cấu kiện, vd `IfcDoor`, `IfcStairFlight`, `IfcSpace` (xem §4) |
| **Pset** | ✓ | Tên property set chứa thuộc tính, vd `Pset_DoorCommon` |
| **Thuộc tính** | ✓ | **QUAN TRỌNG** — tên property chính xác trong model, vd `OverallWidth`. Nếu là đại lượng phải tính (cự ly, độ dốc) → ghi `(suy diễn)` |
| **Toán tử** | ✓ | `>=` `<=` `=` `!=` `between` `exists` |
| **Ngưỡng** | ✓ | Giá trị số, vd `1200`. Với `between` ghi `50..220` |
| **Đơn vị** | ✓ | `mm` `m` `m2` `độ` `ratio` |
| **Điều kiện áp dụng** | | Lọc đối tượng, vd `IsExternal=true`, `công năng=F1.1`, `số người>50` |
| **Mức độ** | ✓ | `fail` (vi phạm) / `warning` (cảnh báo) |
| **Tự động** | ✓ | `L1` đọc property trực tiếp · `L2` cần tính hình học/tham số dự án · `L3` cần người xét |
| **Ghi chú** | | Lưu ý mapping, ngoại lệ… |

---

## 2. Ví dụ đã điền (mẫu tham khảo)

| Ưu tiên | Mã rule | Nguồn | Điều/khoản | Nội dung kiểm | Đối tượng IFC | Pset | Thuộc tính | Toán tử | Ngưỡng | Đơn vị | Điều kiện áp dụng | Mức độ | Tự động | Ghi chú |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| Cao | QCVN06-exit-width-01 | QCVN 06:2022/BXD | 3.2.9 | Chiều rộng lối thoát nạn | IfcDoor | Pset_DoorCommon | ClearWidth | >= | 800 | mm | cửa thoát nạn | fail | L1 | Dùng chiều rộng thông thủy, KHÔNG dùng OverallWidth |
| Cao | QCVN06-stair-riser-01 | QCVN 06:2022/BXD | 3.4.2 | Chiều cao bậc thang | IfcStairFlight | Pset_StairFlightCommon | RiserHeight | between | 50..220 | mm | đường thoát nạn | fail | L1 | |
| TB | QCVN10-ramp-slope-01 | QCVN 10:2014/BXD | 2.2.2 | Độ dốc đường dốc tiếp cận | IfcRamp | — | slope (suy diễn) | <= | 0.0833 | ratio | — | fail | L2 | 1/12; tính từ hình học |

---

## 3. BẢNG ĐIỀN (chuyên gia điền vào đây)

| Ưu tiên | Mã rule | Nguồn | Điều/khoản | Nội dung kiểm | Đối tượng IFC | Pset | Thuộc tính | Toán tử | Ngưỡng | Đơn vị | Điều kiện áp dụng | Mức độ | Tự động | Ghi chú |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
|  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |
|  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |
|  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |
|  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |
|  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |
|  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |
|  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |
|  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |
|  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |
|  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |

---

## 4. Gợi ý ánh xạ IFC ↔ Pset/thuộc tính phổ biến (cheat sheet)

Giúp xác định cột "Đối tượng IFC / Pset / Thuộc tính". **Lưu ý:** tên Pset/thuộc
tính thực tế phụ thuộc cách model được dựng — nên mở 1 file IFC mẫu trong viewer,
click cấu kiện, xem nhóm "Pset · …" để lấy đúng tên (tính năng đã có ở tab Mô hình 3D).

| Hạng mục kiểm | Đối tượng IFC | Pset thường gặp | Thuộc tính thường dùng |
| --- | --- | --- | --- |
| Cửa (thoát nạn, tiếp cận) | `IfcDoor` | `Pset_DoorCommon` | `OverallWidth`, `OverallHeight`, `ClearWidth`*, `IsExternal`, `FireRating` |
| Cầu thang / bậc | `IfcStairFlight` | `Pset_StairFlightCommon` | `TreadLength`, `RiserHeight`, `NumberOfRiser`, `NumberOfTreads` |
| Đường dốc | `IfcRamp` / `IfcRampFlight` | `Pset_RampFlightCommon` | `Slope`*, độ dốc (thường phải suy diễn từ hình học) |
| Gian phòng / diện tích / cự ly | `IfcSpace` | `Pset_SpaceCommon`, `Qto_SpaceBaseQuantities` | `NetFloorArea`, `Height`, `OccupancyNumber`*, cự ly thoát nạn (suy diễn) |
| Tường / chống cháy | `IfcWall` | `Pset_WallCommon` | `IsExternal`, `FireRating`, `LoadBearing` |
| Hành lang (rộng/cao) | `IfcSpace` (corridor) | — | chiều rộng/cao (suy diễn hình học) |
| Thang máy | `IfcTransportElement` | `Pset_TransportElementCommon` | kích thước buồng (suy diễn) |

\* Các thuộc tính có dấu sao thường **không có sẵn mặc định** — phụ thuộc chuẩn
EIR/BEP của dự án. Nếu thiếu, cần quy định trong EIR để đơn vị thiết kế bổ sung,
hoặc chuyển sang đại lượng suy diễn (L2).

---

## 5. Sau khi điền xong
1. Lưu file này (đã điền §3).
2. Bỏ **2–3 file IFC mẫu** vào `resources/02_ifc_mau/`.
3. Báo lại → kỹ thuật biên dịch rule vào `compliance_rules` và bắt đầu code engine + chạy thử.
