# Đánh giá phản biện — BÁO CÁO PHÂN TÍCH VÀ ĐỀ XUẤT LỰA CHỌN GIẢI PHÁP CDE

> **Tài liệu được phản biện:** `BaoCao_PhanTich_CDE_Final.pdf` (7 trang, lập ngày 16/06/2026)
> **Đơn vị lập báo cáo:** Công ty CP Công nghệ và Tư vấn CIC
> **Nơi trình:** Giám đốc Ban QLDA ĐTXD các Công trình Dân dụng và Công nghiệp TP.HCM
> **Ngày phản biện:** 19/06/2026

---

## 1. Mâu thuẫn logic cốt lõi (nghiêm trọng nhất)

### 1.1. Loại Autodesk FDM ở bảng so sánh, rồi lại chọn chính Autodesk FDM ở phần đề xuất
Bảng mục IV chấm FDM **"KHÔNG PHÙ HỢP"** vì không đáp ứng TT47 §2.2.16.1 (máy chủ ngoài VN). Nhưng mục V/VI lại đề xuất Lớp 1 = **AEC Collection bao gồm Forma Data Management** — đúng cái CDE vừa bị loại.

Lý do biện minh ("Lớp 1 ít chịu ràng buộc TT47 hơn vì không lưu trữ dài hạn") là **đặc cách (special pleading)**: nếu tiêu chí TT47 có thể nới ra cho dữ liệu "động", thì lẽ ra phải áp dụng cùng cách nới đó cho BIMcollab/Trimble/Revizto khi so sánh — chứ không loại sạch chúng bằng đúng tiêu chí đó.

> **Đây là điểm phản biện chí mạng** mà người duyệt sẽ bắt ngay.

### 1.2. Bentley là phương án duy nhất "đạt" theo bảng của chính báo cáo, nhưng bị bỏ qua không giải thích
Trong bảng IV chỉ Bentley được **"CÓ THỂ (on-prem)"** và "Một phần" QCVN 12. Tức nếu xét theo đúng khung tiêu chí mà báo cáo tự dựng, Bentley là lựa chọn thương mại tuân thủ nhất. Vậy tại sao đề xuất lại là Autodesk (bị chấm "KHÔNG")? Báo cáo **không có một câu giải thích** vì sao loại ứng viên dẫn đầu theo tiêu chí của chính mình → kết luận không suy ra từ phân tích.

### 1.3. Chọn công cụ yếu nhất ở đúng tiêu chí luật bắt buộc
NĐ 175/2024 bắt buộc IFC 4.0+. Bảng IV chấm Autodesk **"Một phần (.rvt)"** về IFC — tức phương án được đề xuất lại là phương án kém nhất ở định dạng mở bắt buộc. Cần lý giải, nếu không sẽ bị xem là mâu thuẫn với cơ sở pháp lý đã viện dẫn.

---

## 2. Xung đột lợi ích chưa được khai báo

CIC (đơn vị viết báo cáo) đồng thời là:
- (a) bên cung cấp đào tạo;
- (b) bên sẽ "phát triển riêng" phân hệ CDE Lớp 2 trong "Phần mềm QLDA".

Tiêu chí *"Đào tạo & hỗ trợ tại TP.HCM – Có: CIC đào tạo"* được đưa thẳng vào bảng chấm điểm và chỉ FDM/BIMcollab được điểm này. **Một tiêu chí mà chỉ người viết báo cáo cung cấp được → thiên lệch tự phục vụ.** Cả hai khoản chi đề xuất (đào tạo + phát triển Lớp 2) đều chảy về CIC.

Việc này không sai về bản chất nhưng **bắt buộc phải được công khai** trong báo cáo trình cơ quan nhà nước; hiện chưa có.

---

## 3. Vấn đề chi phí / phạm vi

### 3.1. Mua 10 license AEC Collection đầy đủ cho Ban QLDA là over-spec
Ban là chủ đầu tư/quản lý — vai trò chính là *review, duyệt, kiểm soát*, không phải dựng mô hình trong Revit. Mua 10 bộ Revit-authoring (735 tr/năm) trong khi ghi chú ngay bên cạnh "tư vấn và nhà thầu tự mua license riêng" là **tự mâu thuẫn**: nếu bên tạo mô hình tự lo license, Ban chỉ cần license viewer/coordination (Navisworks/ACC viewer), rẻ hơn nhiều. Cần tách rõ "Ban cần gì" vs "cả chuỗi cần gì".

### 3.2. Lớp 2 phát triển 150–300 triệu là phi thực tế cho một CDE thật
Báo cáo phê phán Google Drive/OneDrive "thiếu workflow, IFC viewer, clash detection" — nhưng lại đề xuất tự xây Lớp 2 với 150–300 tr một lần. Một CDE đạt ISO 19650 (WIP→Shared→Published), có IFC viewer, audit log, approval workflow, versioning, đạt 22 tiêu chí QCVN 12 — **không thể làm trong 150–300 tr**.

Thực chất Lớp 2 được mô tả gần như **kho lưu trữ tài liệu**, không phải CDE. Vậy nó mắc đúng lỗi mà báo cáo dùng để loại Google Drive → **tiêu chuẩn kép**. Cần hoặc đổi tên đúng ("kho lưu trữ hồ sơ"), hoặc lập dự toán thực tế (thường gấp nhiều lần).

### 3.3. Thiếu so sánh TCO
Không có bảng tổng chi phí sở hữu 3–5 năm giữa các phương án (thuê SaaS vs tự xây + vận hành Viettel 55–86 tr/năm + bảo trì phần mềm tự phát triển — **khoản bảo trì/nâng cấp Lớp 2 hằng năm bị bỏ sót hoàn toàn**).

---

## 4. Rủi ro kiến trúc "2 lớp" — đi ngược nguyên lý CDE

Nguyên lý cốt lõi của CDE/ISO 19650 là **một nguồn sự thật duy nhất (single source of truth)**. Mô hình 2 lớp tạo ra **hai kho song song** (Autodesk động + nội bộ tĩnh) mà báo cáo **không định nghĩa quy trình bàn giao/đồng bộ**:
- Khi nào đẩy từ Lớp 1 sang Lớp 2, theo định dạng nào (IFC? native?)
- Ai xác nhận, kiểm soát phiên bản ra sao để hai lớp không lệch nhau
- Luồng BCF/issue có chuyển không

Thiếu phần này thì 2 lớp = **nguy cơ phân mảnh dữ liệu**, đúng thứ CDE sinh ra để chống.

---

## 5. Vấn đề dữ kiện & viện dẫn cần kiểm chứng

- **Quy kết QĐ 348/QĐ-BXD (2021).** Báo cáo nói Mục 3.2.6 "liệt kê các hãng CDE" rồi đưa danh sách có Procore, Revizto, Signax... Đây giống **khảo sát thị trường 2026** hơn là nội dung văn bản 2021. Cần tách bạch "QĐ 348 thực sự liệt kê gì" với "khảo sát của CIC" — nếu không sẽ bị bắt lỗi gán sai nguồn.
- **TT 47/2026/TT-BCA & QCVN 12:2026/BCA (hiệu lực 01/07/2026).** Toàn bộ logic loại trừ phụ thuộc vào điều khoản §2.2.16.1 này. Báo cáo trình ngày 16/06/2026, tức **quy chuẩn chưa có hiệu lực** tại thời điểm trình. Cần: (a) trích nguyên văn điều khoản, (b) xác nhận phạm vi áp dụng có thực sự phủ một Ban QLDA và hệ thống CDE dự án hay không, (c) lường rủi ro nếu bản ban hành chính thức khác dự thảo. *Không khẳng định nó sai — nhưng đây là trụ cột lập luận nên phải được kiểm chứng và trích dẫn nguyên văn, hiện chỉ nêu số hiệu.*
- **TCVN 14177** được dùng như mã TCVN của ISO 19650 — nên kiểm tra lại số hiệu chính xác.

---

## 6. Thiếu sót về tính đầy đủ & phương pháp

- **Procore và Signax** có trong bảng mục II nhưng **không được phân tích** ở mục III (chỉ 7/9 giải pháp được phân tích). Loại bỏ không kèm lý do.
- **Không có phương pháp chấm điểm/trọng số.** Bảng IV chỉ "Có/Không/Một phần" định tính, không trọng số → kết luận "PHÙ HỢP/KHÔNG" mang tính khẳng định chứ không phải kết quả tính toán. Người duyệt khó tái lập.
- **Thiếu:** phân tích rủi ro, lộ trình triển khai, kế hoạch di trú dữ liệu, vendor lock-in định lượng, và yếu tố **địa chính trị/cấm vận** khi liệt kê giải pháp Nga (Signax) cho cơ quan nhà nước.
- **Lỗi trình bày:** ký hiệu "Ban DD&CN;" xuất hiện nhiều lần kèm dấu `;` thừa (lỗi escape HTML `&` → `&amp;`), cần sửa trước khi phát hành.

---

## Tổng kết

| Hạng mục | Đánh giá |
|---|---|
| Cơ sở pháp lý | Đầy đủ về số lượng nhưng **trụ cột (QCVN 12) chưa trích nguyên văn & chưa hiệu lực** |
| Khảo sát thị trường | Khá toàn diện, nhưng gán nhầm nguồn QĐ 348 và bỏ phân tích 2/9 giải pháp |
| Tính nhất quán lập luận | **Yếu** — mâu thuẫn loại-rồi-chọn Autodesk; bỏ qua Bentley |
| Phân tích chi phí | Thiếu TCO, over-spec license, dự toán Lớp 2 phi thực tế, bỏ sót bảo trì |
| Kiến trúc đề xuất | Ý tưởng 2 lớp hợp lý về chủ quyền dữ liệu nhưng **thiếu quy trình đồng bộ**, đi ngược nguyên lý single-source-of-truth |
| Tính khách quan | **Xung đột lợi ích chưa khai báo** (CIC vừa tư vấn vừa đào tạo vừa phát triển) |

### 3 việc cần làm trước khi trình duyệt

1. **Giải quyết mâu thuẫn Autodesk** (mục 1.1) — hoặc thống nhất tiêu chí TT47 cho mọi ứng viên, hoặc giải thích minh bạch vì sao FDM được miễn còn các giải pháp khác thì không; và nêu rõ lý do loại Bentley.
2. **Trích nguyên văn §2.2.16.1 QCVN 12:2026** + xác nhận phạm vi áp dụng; lập dự toán Lớp 2 thực tế (kèm bảo trì/nâng cấp hằng năm) hoặc đổi tên đúng bản chất.
3. **Khai báo xung đột lợi ích** và tách license Ban (viewer/review) khỏi license authoring của tư vấn/nhà thầu để giảm chi phí.
