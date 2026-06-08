# Design System Master - CDE CIC Platform

> **LOGIC:** Khi phát triển hoặc cải tiến bất kỳ giao diện nào trong CDE CIC, hãy tuân thủ nghiêm ngặt các quy chuẩn thiết kế trong tài liệu Master này để đảm bảo chất lượng UI/UX đạt mức cao nhất.

---

## 1. Bản đồ Màu sắc (Color Palette)

Hệ màu được trích xuất và ánh xạ trực tiếp từ cấu hình CSS `@theme` của Tailwind v4 trong dự án:

| Vai trò | Mã màu Hex | Biến CSS | Ứng dụng |
|:---|:---:|:---|:---|
| **Primary** | `#004282` | `--color-primary` | Màu chủ đạo, nút nhấn chính, chỉ trạng thái tích cực |
| **Secondary** | `#4c5f80` | `--color-secondary` | Nền phụ, các thành phần bổ trợ |
| **Tertiary** | `#6f3000` | `--color-tertiary` | Điểm nhấn AI, chỉ báo phân tích thông minh |
| **Surface (Lowest)** | `#ffffff` | `--color-surface-container-lowest` | Nền thẻ (card), nền bảng thuộc tính, sidebar chính |
| **Surface (Low)** | `#f2f3fa` | `--color-surface-container-low` | Nền trang phụ, nền khu vực toolbar |
| **Text (Dark)** | `#191c20` | `--color-on-background` | Chữ chính trên nền sáng |
| **Text Muted** | `#424751` | `--color-on-surface-variant` | Chữ phụ, mô tả ngắn |
| **Teal Accent** | `#008080` | `--color-teal-accent` | Trạng thái thành công, đã giải quyết, an toàn |
| **Error** | `#ba1a1a` | `--color-error` | Cảnh báo xung đột, lỗi nghiêm trọng |

---

## 2. Quy chuẩn Typography

* **Heading Font**: `"Inter", ui-sans-serif, system-ui, sans-serif` (Chữ không chân, rõ ràng, mang phong cách hiện đại).
* **Body Font**: `"Inter", sans-serif`
* **Mono Font**: `"JetBrains Mono", monospace` (Sử dụng cho GUID, mã RFI, giá trị đo đạc kỹ thuật).

---

## 3. Hệ thống Spacing & Shadow

| Token | Giá trị | Ứng dụng |
|:---|:---|:---|
| `--space-xs` | `4px` / `0.25rem` | Khoảng cách cực hẹp (giữa icon và nhãn chữ) |
| `--space-sm` | `8px` / `0.5rem` | Khoảng cách hẹp (padding trong hàng table, khoảng cách phần tử con) |
| `--space-md` | `16px` / `1rem` | Padding chuẩn cho các thẻ, khoảng cách layout |
| `--space-lg` | `24px` / `1.5rem` | Padding cho section lớn |
| `--shadow-sm` | `0 1px 2px rgba(0,0,0,0.02)` | Lift nhẹ cho header, thanh toolbar |
| `--shadow-md` | `0 4px 6px rgba(0,0,0,0.05)` | Độ nổi chuẩn cho các thẻ KPI, popup |
| `--shadow-lg` | `0 10px 15px rgba(0,0,0,0.1)` | Độ nổi cho Side Drawer và Modals |

---

## 4. Các Quy tắc UI/UX Phải Tuân thủ (Anti-Patterns)

* ❌ **Không dùng Emoji làm Icon**: Mọi icon phải sử dụng duy nhất bộ thư viện **Lucide-React** để đảm bảo tính đồng bộ kỹ thuật và chuyên nghiệp.
* ❌ **Không được dịch chuyển Layout khi Hover**: Mọi hiệu ứng hover phóng to (`hover:scale-*`) phải được kiểm soát để không làm rung/lệch giao diện xung quanh.
* ❌ **Không dùng hiệu ứng thay đổi trạng thái lập tức**: Luôn áp dụng hiệu ứng chuyển đổi mượt mà (`transition-all duration-200 ease-in-out`).
* ❌ **Thiếu cursor-pointer**: Tất cả các phần tử có thể tương tác (nút bấm, hàng bảng, thẻ KPI bấm được) bắt buộc phải có thuộc tính `cursor-pointer`.
* ❌ **Độ tương phản thấp**: Chữ phụ (muted text) phải dùng tối thiểu `--color-on-surface-variant` (`#424751`) để đảm bảo khả năng đọc được rõ ràng.

---

## 5. Pre-Delivery Checklist (Bảng kiểm tra trước khi bàn giao)

* [ ] Tất cả các nút bấm và phần tử click được đều có `cursor-pointer`.
* [ ] Trạng thái hover có chuyển đổi màu/nền mượt mà (150ms - 200ms).
* [ ] Kiểm tra phản hồi Responsive đầy đủ trên màn hình 375px (Mobile), 768px (Tablet), và 1440px (Desktop).
* [ ] Không có hiện tượng tràn màn hình ngang (horizontal scroll) ngoài ý muốn trên thiết bị di động.
* [ ] Mọi tệp SVG và Icon có kích thước cố định (`w-4 h-4` hoặc `w-5 h-5`) tránh bị co giãn méo hình.
