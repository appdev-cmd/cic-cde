# Kế hoạch hoàn thiện Phân hệ 1, 2, 3 (Giai đoạn 1 — cốt lõi)

> Phạm vi: 3 phân hệ cốt lõi đã thương mại hóa GĐ1:
> **P1 — Quản lý tài liệu ISO 19650** · **P2 — BIM 3D Viewer** · **P3 — Phối hợp & BCF**.
> Ngày lập: 2026-06-28 · Ưu tiên: **P0** (chặn bán hàng) → **P1** (giá trị cao) → **P2** (nâng cao).

Cả 3 phân hệ đã chạy backend Supabase thật (không phải prototype). Kế hoạch này tập trung
**lấp các khoảng trống nghiệp vụ ISO 19650 / phối hợp** để đạt mức "dùng thật cho B2G".

---

## P1 — Quản lý Tài liệu chung (ISO 19650)
**Code:** `src/components/tabs/DocumentsTab.tsx`, `src/lib/api/documents.ts`, `storage.ts`, `audit.ts`

### Đã có
WIP/Shared/Published/Archive · kiểm tra tên ISO 19650 (cảnh báo) · suitability codes ·
version control (`document_versions`) · upload Storage · SHA‑256 + kiểm tra toàn vẹn ·
audit log bất biến · luồng phê duyệt (Dashboard) · RBAC theo vai trò (RLS).

### Hạng mục hoàn thiện
| # | Ưu tiên | Hạng mục | Mô tả |
|---|:---:|---|---|
| 1.1 | **P0** | **Naming Engine cưỡng chế** | Hiện chỉ *cảnh báo*. Cần **từ chối upload** khi sai chuẩn (regex 7 trường) + gợi ý sửa; cấu hình mã trường theo dự án |
| 1.2 | **P0** | **Gate workflow tường minh** | Nút chuyển WIP→Shared (Gate 1) / Shared→Published (Gate 2) ngay trên tài liệu, khóa theo quyền; tự nâng suitability/revision |
| 1.3 | **P1** | **Transmittal / Phiếu phát hành** | Khi Publish: sinh phiếu phát hành (PDF) liệt kê tài liệu, phiên bản, người nhận, ngày |
| 1.4 | **P1** | **MIDP/TIDP tracking** | Nối `delivery_tasks` (TasksTab) ↔ tài liệu thực nạp → cảnh báo trễ hạn/thiếu hồ sơ |
| 1.5 | **P1** | **Chữ ký số** | Ký số PDF/mô hình tại Publish (USB Token / ký số đám mây), lưu chứng thư + verify |
| 1.6 | **P2** | Thao tác hàng loạt + tìm kiếm nâng cao | Chọn nhiều, đổi trạng thái hàng loạt; full‑text search; saved filters |
| 1.7 | **P2** | Xem trước inline tốt hơn | PDF/DWG preview thật (hiện là placeholder) |

### Tiêu chí nghiệm thu
- Upload sai chuẩn ISO 19650 **bị chặn**; đúng chuẩn mới qua.
- Publish sinh **transmittal PDF**; MIDP cảnh báo hồ sơ trễ; chữ ký số verify hợp lệ.

---

## P2 — BIM 3D Web Viewer
**Code:** `src/components/bim/BimViewer.tsx`, `src/components/tabs/ViewerTab.tsx`

### Đã có
Federation đa mô hình · clash detection · QTO · đo đạc · clipping · isolate/hide/ghost ·
highlight · **trích Pset** (mới) · so sánh phiên bản mô hình · minimap/viewcube · camera views ·
cache `.frag` · screenshot.

### Hạng mục hoàn thiện
| # | Ưu tiên | Hạng mục | Mô tả |
|---|:---:|---|---|
| 2.1 | **P0** | **Lưu & chia sẻ Viewpoint** | Bảng `viewpoints` đã có — wire UI lưu (camera + ẩn/hiện + ảnh) và mở lại; dùng chung với BCF |
| 2.2 | **P1** | **Clash → DB + lưu kết quả** | Lưu kết quả clash (`clashes`) + lịch sử lần kiểm; bộ lọc theo cặp bộ môn |
| 2.3 | **P1** | **Streaming file lớn** | **Convert IFC→Fragments phía server** (Node/worker) + xuất song song **OGC 3D Tiles 1.1** (Draco/Meshopt); tile on‑demand + cache; LOD theo camera. Bỏ định dạng riêng `.cic3d` — xem ADR 0007 (cập nhật 2026‑06‑28) |
| 2.6 | **P2** | **Smart Views (rule‑based coloring)** | Tô màu/lọc cấu kiện theo Pset + validate **IDS** — bệ phóng cho TC2 auto‑check (học từ BIMcollab) |
| 2.4 | **P2** | Persist thuộc tính cấu kiện | Lưu Pset/thuộc tính (`bim_elements_properties`) để tra khi chưa nạp model |
| 2.5 | **P2** | Công cụ nâng cao | Section box, đo diện tích/góc, đo nhiều mặt cắt; tối ưu mobile/tablet |

### Tiêu chí nghiệm thu
- Lưu/tải **viewpoint** chuẩn; file 100MB hiển thị **<10s**; (2.3) khung hình đầu **<5s** cho >500MB.
- Kết quả clash lưu DB và mở lại được.

### Nghiên cứu nền tảng tham chiếu (2026-06-28)
Đối chiếu kiến trúc viewer 3D của 4 nền tảng dẫn đầu để chốt phương án kỹ thuật:

| Nền tảng | Lõi / Định dạng | Bài học áp dụng | Lý do không copy nguyên |
|---|---|---|---|
| **Autodesk ACC/APS** | Three.js + **SVF2** (server dịch, khử trùng lặp mesh, instancing, tách metadata) | Khử trùng lặp + instancing; tách geometry/Pset | Cloud Autodesk → vi phạm **QCVN 12**; phí theo API |
| **Bentley iTwin.js** | iTwin.js/Cesium + **OGC 3D Tiles** (tile on‑demand + cache, ~20× nhanh) | **Hình mẫu chính**: chuẩn mở 3D Tiles, tile sinh động + cache, sẵn sàng GeoBIM | SDK nặng, gắn iModelHub → chỉ học kiến trúc |
| **Trimble Connect** | WebGL + **TrimBim** đa định dạng + **Potree** (point cloud) | Đa định dạng; Potree cho scan‑to‑BIM | Định dạng đóng, không tự host |
| **BIMcollab Zoom** | Client IFC + **Smart Views** + **BCF‑API/IDS** | Smart Views (tô màu theo rule) → bệ phóng **TC2**; clash→BCF | Yếu file siêu lớn; lấy *pattern*, không lấy engine |

**5 nguyên lý hội tụ (xương sống Phase 2):** (1) convert server‑side một lần; (2) khử trùng lặp mesh + instancing; (3) tile + LOD theo view‑frustum; (4) tách geometry ↔ metadata/Pset; (5) cache tile sinh on‑demand.

**Khuyến nghị chốt:** kiến trúc **2 lớp** — *engine nội bộ* dùng **ThatOpen Fragments convert‑on‑server** (đã có trong stack) + *lớp interop/GeoBIM* xuất **OGC 3D Tiles 1.1**. Chi tiết & quyết định: **ADR 0007 (cập nhật 2026‑06‑28)**.

**File IFC mẫu để benchmark** (`resources/25120-BVNND2_TrinhThamDinh-LOD300/IFC/`): EELV 7.8MB · STRU 42MB · ELEC 97MB · ARCH 152MB · FIRE 208MB · PLUM 251MB · **HVAC 476MB** (test mốc >500MB).

---

## P3 — Phối hợp Thiết kế & Quản lý Va chạm (BCF)
**Code:** `src/components/bim/IssuesPanel.tsx`, `src/lib/bcf/bcf.ts`, `src/lib/api/data.ts` (`bcf_topics`,`bcf_comments`)

### Đã có
Import/Export `.bcfzip` · topic CRUD **persist Supabase** · bình luận · gán người · priority/status/labels.

### Hạng mục hoàn thiện
| # | Ưu tiên | Hạng mục | Mô tả |
|---|:---:|---|---|
| 3.1 | **P0** | **Viewpoint thực trong topic** | Lưu camera + expressIds vào topic → mở topic **nhảy đúng góc nhìn + highlight cấu kiện** (nối 2.1) |
| 3.2 | **P1** | **Tạo BCF từ Clash** | Một click biến điểm xung đột (2.2) thành topic BCF kèm viewpoint |
| 3.3 | **P1** | **Workflow + Dashboard** | Trạng thái Open→In Progress→Resolved→Closed + lịch sử; dashboard tồn đọng theo bộ môn/severity/người xử lý |
| 3.4 | **P1** | **Thông báo** | Realtime/email khi được gán hoặc đến hạn |
| 3.5 | **P2** | **BCF 2.1/3.0 đầy đủ + interop** | Đóng/đọc viewpoint, snippet trong `.bcfzip`; kiểm thử round‑trip với Revit/Navisworks |

### Tiêu chí nghiệm thu
- Click topic → đúng viewpoint + highlight; tạo BCF từ clash; export/import `.bcfzip` round‑trip với Revit/Navisworks; dashboard tồn đọng + thông báo gán việc.

---

## Lộ trình theo Sprint (2 tuần/sprint)
| Sprint | Trọng tâm (P0/P1) | Kết quả |
|:---:|---|---|
| **S1** | 1.1 Naming cưỡng chế · 1.2 Gate workflow · 2.1 Viewpoint · 3.1 Viewpoint trong BCF | Vòng đời tài liệu chặt + phối hợp đúng góc nhìn |
| **S2** | 1.3 Transmittal · 1.4 MIDP/TIDP · 2.2 Clash→DB · 3.2 Clash→BCF · 3.3 Workflow+Dashboard | Bàn giao hồ sơ + phối hợp clash khép kín |
| **S3** | 1.5 Chữ ký số · 2.3 Streaming file lớn · 3.4 Thông báo | Pháp lý hồ sơ + hiệu năng + nhắc việc |
| **S4** | 1.6/1.7 · 2.4/2.5 · 3.5 (BCF 3.0 + interop) | Hoàn thiện nâng cao & tương thích |

## Phụ thuộc & rủi ro
- **Chữ ký số (1.5):** cần tích hợp nhà cung cấp CA (USB Token/ký số đám mây) — phụ thuộc đối tác.
- **Streaming (2.3):** cần dịch vụ server‑side (Python/3D Tiles) theo kế hoạch chiến lược — hạ tầng riêng.
- **Interop BCF (3.5):** cần license Revit/Navisworks để kiểm thử thực.
- **Nền chất lượng:** bổ sung test (Vitest) + CI cho `lib/api/*` và logic viewpoint/clash trước khi mở rộng.

## Khởi động đề xuất
**Sprint 1** — bắt đầu **1.1 (Naming cưỡng chế)** + **2.1/3.1 (Viewpoint)** vì giá trị cao, rủi ro thấp, không phụ thuộc đối tác ngoài.
