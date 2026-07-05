# Rule-Check Worker — CDE CIC

Worker Python xử lý hàng đợi **kiểm tra mô hình theo quy tắc** (va chạm cứng + khoảng cách tối thiểu) bằng IfcOpenShell. Chạy song song với `converter-worker`, dùng chung Supabase.

## Kiến trúc

```
UI (ViewerTab → RuleCheckPanel)
  └─ insert check_runs (status=pending)      ← hàng đợi
        └─ worker poll mỗi 5s → claim (optimistic lock)
              ├─ tải IFC từ Storage (bucket cde-files)
              ├─ dựng hình học world-coords (mét) — ifcopenshell.geom
              ├─ phân giải nhóm cấu kiện (bảng elements / pset)
              ├─ chạy từng rule: clash / clearance
              └─ ghi check_results + summary + status=done
```

Kết quả hiển thị lại trên UI qua realtime (`check_runs`) + fallback poll.

## Module

| File | Vai trò |
|---|---|
| `main.py` | Vòng lặp poll + điều phối 1 run |
| `db.py` | Truy cập Supabase (SERVICE_ROLE) |
| `ifc_loader.py` | Tải + giải nén + dựng mesh world-coords, chuẩn hóa đơn vị về mét |
| `groups.py` | Lọc nhóm cấu kiện theo category + propertyFilters |
| `checks/broadphase.py` | Lọc cặp ứng viên bằng AABB (numpy) |
| `checks/clash.py` | Va chạm cứng (point-containment + fallback AABB) |
| `checks/clearance.py` | Khoảng cách tối thiểu (surface sampling) |

## Chạy cục bộ (dev)

```bash
python -m venv .venv
.venv/Scripts/pip install -r requirements.txt   # Windows
# hoặc: .venv/bin/pip install -r requirements.txt

cp .env.example .env    # điền SUPABASE_URL + SERVICE_ROLE_KEY
python main.py
```

Test engine không cần Supabase (nạp 2 IFC thật trong `resources/`):

```bash
python test_local.py
```

## Chạy bằng Docker (deploy selfhost)

```bash
docker build -t cic-rule-check-worker .
docker run -d --env-file .env --name rule-check cic-rule-check-worker
```

## Ghi chú kỹ thuật

- **Đơn vị**: chuẩn hóa về **mét** tại `ifc_loader`; nếu bbox mô hình > 5000 → cảnh báo nghi rò rỉ mm.
- **Georeferencing**: dùng `use-world-coords`; nếu các mô hình cách nhau > 1km → cảnh báo lệch hệ tọa độ (ghi vào `summary.modelBboxes`).
- **Loại trừ mặc định**: `IFCOPENINGELEMENT`, `IFCSPACE` (giao cắt hợp lệ).
- **Giới hạn**: mặc định 2000 vi phạm/rule (`MAX_VIOLATIONS_PER_RULE`).
- **Phụ thuộc native**: `scipy` (cho `trimesh.proximity`), `rtree`/`libspatialindex`. Không dùng `python-fcl` (đã thay bằng point-containment).

## Ngưỡng preset

Các bộ quy tắc preset (`rule_sets.is_preset = true`) mang giá trị **tham khảo** theo QCVN/tiêu chuẩn — cần kiểm chứng theo văn bản gốc trước khi dùng làm căn cứ nghiệm thu. Người dùng tạo bộ quy tắc riêng qua form no-code trong UI.
