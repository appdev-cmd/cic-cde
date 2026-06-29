# Kế hoạch chỉnh sửa & hoàn thiện Báo cáo NCKT CDE CIC

> Căn cứ: bản phản biện toàn văn `bao-cao-nghien-cuu-kha-thi-cde-cic.md` (936 dòng).
> Ngày lập: 2026-06-28 · Trạng thái: chờ chốt quyết định nghiệp vụ ở §0.

## Cơ chế quan trọng cần nắm trước khi sửa
Các bảng tài chính **sinh tự động** từ `financial_inputs.json` qua
`scripts/recalculate_financials.mjs` (ghi vào các vùng `<!-- TABLE_*_START -->`).
Vì vậy chia làm 2 loại sửa:
- **(A) Số liệu auto-gen** → sửa `financial_inputs.json` (+ generator nếu cần) → **chạy lại generator**, KHÔNG gõ tay bảng.
- **(B) Văn xuôi gõ tay** (changelog, §6.1.2 giá, "OPEX 65%", "CAPEX=0", narrative) → sửa trực tiếp, **đồng bộ với (A)**.

Gốc rễ phần lớn mâu thuẫn: **văn xuôi (B) không khớp model (A)**.

---

## 0. QUYẾT ĐỊNH NGHIỆP VỤ CẦN CHỐT TRƯỚC (blocking — chỉ Ban LĐ quyết)

Không sửa được tài chính cho tới khi chốt 4 điểm sau (mỗi điểm hiện đang "2 nguồn đá nhau"):

| # | Vấn đề | Hai phương án đang tồn tại | Khuyến nghị |
|---|---|---|---|
| Q1 | **CAPEX** | Văn xuôi "= 0" vs JSON "= 3,5 tỷ" | Giữ **3,5 tỷ** (thực chất có chi R&D/thiết bị/marketing), bỏ khẩu hiệu "CAPEX=0" |
| Q2 | **Giá On-Prem** | §6.1.2 "PMU 0,75 / DN 1,5 tỷ" vs JSON "PMU 2,0–3,0 / DN 3,0–4,2" | Chốt **1 bộ giá thật**; sửa bên còn lại theo. (Giá JSON khả thi hơn cho B2G cấp Bộ/tỉnh) |
| Q3 | **Thuế TNDN** | 0% (ưu đãi R&D, chưa xác minh) vs 20% | Lấy **20% làm số cơ sở**; 0% chỉ là kịch bản phụ |
| Q4 | **Kịch bản chủ đạo** | Headline đang dùng KB A (100%) | Lấy **KB B (55%)** làm số trình hội đồng (đúng khuyến nghị §5.1bis) |

> Sau khi chốt Q1–Q4, mọi con số khác suy ra tự động. Đây là nút thắt của toàn bộ kế hoạch.

---

## Đợt 1 — 🔴 Tài chính: dựng "một nguồn sự thật" (ưu tiên cao nhất)

**Mục tiêu:** khử toàn bộ mâu thuẫn số ở mục 1 bản phản biện.

1.1. Cập nhật `financial_inputs.json` theo Q1–Q4 (capex, giá on-prem, taxRate, và nếu cần thêm khối kịch bản B/C).
1.2. **Audit generator** `recalculate_financials.mjs`:
   - Kiểm tra vì sao **bảng 6.5bis-c (tích lũy KB A) = 59,31** trong khi **6.5.1 = 128,29** cho cùng KB A → sửa công thức để hai bảng **reconcile**.
   - Bổ sung sinh **KB B & thuế 20%** làm số cơ sở (hiện generator chỉ tính KB A).
   - Đảm bảo `payback`/`đỉnh dòng tiền âm` phản ánh đúng giai đoạn tích lũy âm (2026–2027) — bỏ khẳng định sai "đỉnh âm = 0".
1.3. **Chạy generator** → regenerate toàn bộ bảng: 6.2c, 6.4a, 6.4b, 6.5.1, 6.5.2, 6.5.3, 6.5bis-b, 6.5bis-c.
1.4. **Sửa văn xuôi (B)** đồng bộ:
   - Bỏ/đổi mọi câu "CAPEX = 0 VNĐ" (changelog, §6.2, §6.5, Kết luận "tiết kiệm 66% CAPEX").
   - Sửa "OPEX chiếm 65% doanh thu" → đúng tỷ lệ thật (~12%), hoặc nêu rõ "COGS+OPEX ≈ x%".
   - Sửa §6.1.2 (giá) + bảng TCO khớp giá đã chốt; sửa "rẻ hơn 60%" → đúng % (0,97/1,87 ≈ rẻ hơn 48%); thống nhất giá Autodesk (đang $60–100/tháng vs $500/năm).
   - Sửa §6.5 "Zero Working Capital": nêu đúng **nhu cầu vốn lưu động đỉnh ≈ |tích lũy âm|** thay vì "luôn dương".
   - Đưa **NPV/hoàn vốn theo KB B + thuế 20%** lên Executive Summary & §6.5.3; bỏ IRR khỏi mọi mục (đã tự loại ở §5.1bis.5).

**Tiêu chí hoàn thành Đợt 1:** không còn 2 con số nào mâu thuẫn; mọi số tài chính truy được về `financial_inputs.json`; headline = KB B.

---

## Đợt 2 — 🟠 Pháp lý & trích dẫn

2.1. **Quét & sửa chuỗi hỏng** `"Thông tư 47/2026/TT-BCA (QCVN 12:2026/BCA):2026/BCA"` trên toàn file (find/replace) → dạng chuẩn: *"QCVN 12:2026/BCA (ban hành kèm Thông tư 47/2026/TT-BCA)"*. Tách rõ TT 47 (văn bản) vs QCVN 12 (quy chuẩn).
2.2. **Đối chiếu Công báo** mọi văn bản 2025–2026 (Luật 135, NĐ 217/212/207/210/206, TT 47, Luật DL 60/2024, Luật BVDLCN 91/2025); kẹp link/nguồn chính thức; nếu chưa xác minh được điều/khoản cụ thể → hạ về diễn giải chung.
2.3. **Hạ giọng §2.7 (SHTT mã nguồn AI)**: chuyển từ khẳng định chắc nịch → "rủi ro pháp lý cần tư vấn luật sư"; bỏ khái niệm "Work for Hire" (Mỹ), dùng khung Luật SHTT VN (quyền tác giả thuộc tổ chức giao nhiệm vụ).

---

## Đợt 3 — 🟠 Chiến lược & kỹ thuật: hạ overclaim, sửa nhất quán

3.1. **Phân biệt 🎯 (mục tiêu) vs ✅ (đã có)** trong văn xuôi quanh bảng 3.1a/3.1b/3.5: nói rõ Cấp độ 3/QCVN12/NDXP/VNeID là **kế hoạch chưa đạt**, không phải lợi thế hiện hữu.
3.2. **Định khung lại "hào pháp lý"**: với đối thủ nội địa là **first-mover 1–2 năm** (NovaCDE có thể đạt trong 12–18 tháng — chính §3.6); chỉ với Autodesk mới là rào cản cứng.
3.3. **Gắn cảnh báo cho số ERP nội bộ** (39 HĐ/45,53 tỷ/89 KH) và tỷ lệ chuyển đổi 30% → "ước tính, cần khảo sát xác nhận".
3.4. **Thống nhất tech stack**: §4.1 sửa "Node.js/xeokit" → **Go + Python + ThatOpen Engine** cho khớp toàn báo cáo & sản phẩm thật.
3.5. **Sửa sơ đồ kiến trúc §4.1**: định nghĩa thiếu **MS4** (hoặc bỏ MS4 khỏi cạnh); đánh số phân hệ §4.2/§4.3 cho nhất quán (đang 1,2,3,4,6 / "Phân hệ 5").
3.6. **Chương 7 (SonarQube dashboard)**: ghi rõ **"chỉ tiêu mục tiêu"**, không trình số 84,5%/0 bug như đã đạt (hiện chưa có test/CI). Hoặc bổ sung lộ trình đạt KPI.
3.7. **Năng lực vận hành**: bổ sung mục giải trình **SLA 99,9% với đội 2–4 người** (kế hoạch on-call, đối tác hạ tầng, hoặc **hạ cam kết SLA** xuống mức khả tín như 99,5%).

---

## Đợt 4 — ⚪ Biên tập & cấu trúc (sửa nhanh, làm sau cùng)

4.1. **Đánh số lại toàn bộ:** gộp "5.1bis" vào Chương 6 đúng thứ tự; khử **3 lần "6.5"**; tách **2 "Chương 7"** (Cẩm nang → Ch.7, Kết luận → Ch.8); đổi nhãn "Bảng 5.x" → "Bảng 6.x"; sửa cross-ref §5.5bis/§5.5.1.
4.2. Xóa câu lặp ở §3.1a; sửa lỗi render `$\rightarrow$` ("ightarrow") trong bảng; sửa "Thuếu TNDN" → "Thuế TNDN".
4.3. Rà mục lục/heading khớp nội dung sau khi đánh số lại.

---

## Trình tự thực thi & phụ thuộc
```
Q1–Q4 (Ban LĐ chốt)  ─▶ Đợt 1 (tài chính)  ─▶ Đợt 3.x liên quan số
                         │
Đợt 2 (pháp lý)  ───────┤  (song song được)
Đợt 3 (chiến lược/kỹ thuật) ─┘
Đợt 4 (biên tập) ── làm cuối, sau khi nội dung ổn định
```

## Checklist nghiệm thu báo cáo "hoàn thiện"
- [ ] Không còn cặp số mâu thuẫn (CAPEX, OPEX%, tích lũy dòng tiền, vốn lưu động, giá On-Prem).
- [ ] Mọi số tài chính regenerate từ `financial_inputs.json`; headline = KB B + thuế 20%.
- [ ] Hết chuỗi pháp lý hỏng; văn bản pháp lý có nguồn đối chiếu.
- [ ] 🎯/✅ phân biệt rõ; moat mô tả đúng thời hạn.
- [ ] Tech stack & sơ đồ kiến trúc nhất quán; phân hệ đánh số đúng.
- [ ] Ch.7 KPI ghi rõ "mục tiêu"; SLA khả tín.
- [ ] Đánh số chương/mục/bảng sạch; hết lỗi render & chính tả.
- [ ] `npm run lint`/generator chạy không lỗi; (tùy chọn) xuất lại bản HTML.

## Ước lượng & cách làm
- **Đợt 1**: phần nặng nhất — sửa JSON + audit/มở rộng generator + đồng bộ văn xuôi. Cần Q1–Q4 trước.
- **Đợt 2–4**: chủ yếu thao tác văn bản (find/replace + biên tập), làm được ngay, không chờ quyết định.
- Công cụ: sửa `financial_inputs.json` → `node scripts/recalculate_financials.mjs` → kiểm bảng; còn lại Edit trực tiếp file `.md`.
