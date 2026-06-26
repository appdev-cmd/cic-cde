# CDE CIC — Tài liệu Đặc tả UI/UX & Frontend
## Dành cho Claude Design / Figma / v0.dev

> **Phiên bản:** 1.0 | **Ngày:** 08/06/2026  
> **Mục đích:** Tài liệu thiết kế đầy đủ để đưa vào Claude Design, v0.dev, Figma AI tạo mockup  
> **Stack:** React 19 + Next.js 15 + TypeScript + Tailwind CSS

---

## PHẦN 1: DESIGN SYSTEM

### 1.1. Định hướng Phong cách (Design Direction)

**Style:** **Dark Enterprise Glassmorphism** — Professional, High-tech, Trustworthy  
**Mood:** Nghiêm túc nhưng hiện đại. Cảm giác như phần mềm chuyên nghiệp cấp doanh nghiệp của Autodesk nhưng được làm mới với ngôn ngữ thiết kế 2026.  
**Tham chiếu:** Autodesk Construction Cloud + Vercel Dashboard + Linear.app + Grafana Enterprise

**Nguyên tắc cốt lõi:**
1. **Data-first** — Thông tin luôn là trung tâm. UI phục vụ dữ liệu, không che khuất dữ liệu.
2. **Precision** — Mọi element phải chính xác, có lý do rõ ràng.
3. **Depth without clutter** — Nhiều thông tin nhưng không rối mắt — dùng hierarchy và grouping.
4. **Professional dark mode** — Dark mode là mặc định cho công việc kỹ thuật 3D dài giờ.

---

### 1.2. Bảng màu (Color Palette)

#### Primary Palette — Dark Navy + Electric Teal

```css
/* === BACKGROUND SYSTEM === */
--bg-canvas:      #0A0E1A;   /* Nền ngoài cùng — Navy đen */
--bg-surface:     #0F1629;   /* Nền panel chính */
--bg-elevated:    #141D35;   /* Card, sidebar */
--bg-overlay:     #1A2540;   /* Dropdown, modal backdrop */
--bg-input:       #1F2D47;   /* Input fields */
--bg-hover:       #243355;   /* Hover state */

/* === BRAND / ACCENT === */
--accent-primary:   #00D4AA;  /* Electric Teal — CTA chính, link active */
--accent-secondary: #0094FF;  /* Electric Blue — thứ cấp, info states */
--accent-tertiary:  #7C3AED;  /* Purple — AI/Smart features */
--accent-warning:   #F59E0B;  /* Amber — cảnh báo, pending */
--accent-danger:    #EF4444;  /* Red — lỗi, nguy hiểm */
--accent-success:   #10B981;  /* Emerald — thành công, đạt */

/* === TEXT === */
--text-primary:   #F0F4FF;   /* Chữ chính — gần trắng */
--text-secondary: #8B96B4;   /* Chữ phụ — gray-blue */
--text-muted:     #4A5568;   /* Chữ tắt — label, placeholder */
--text-disabled:  #2D3748;   /* Chữ disabled */

/* === BORDERS === */
--border-subtle:  rgba(255,255,255,0.06);  /* Viền card tinh tế */
--border-normal:  rgba(255,255,255,0.12);  /* Viền input, section */
--border-accent:  rgba(0,212,170,0.3);     /* Viền active/focus */

/* === GLASS === */
--glass-bg:       rgba(20,29,53,0.7);      /* Glassmorphism card bg */
--glass-border:   rgba(255,255,255,0.08);  /* Glassmorphism viền */
```

#### ISO 19650 Status Colors (quan trọng — dùng xuyên suốt)

```css
--status-wip:       #F59E0B;   /* WIP — Amber/Vàng */
--status-shared:    #0094FF;   /* Shared — Blue */
--status-published: #10B981;   /* Published — Green */
--status-archived:  #6B7280;   /* Archived — Gray */
--status-rejected:  #EF4444;   /* Rejected — Red */
--status-pending:   #8B5CF6;   /* Pending Review — Purple */
```

#### BIM Element Category Colors

```css
--cat-architecture: #60A5FA;   /* Kiến trúc — Blue */
--cat-structure:    #F97316;   /* Kết cấu — Orange */
--cat-mep:          #34D399;   /* MEP — Green */
--cat-site:         #A78BFA;   /* Hạ tầng/Site — Purple */
```

---

### 1.3. Typography

#### Font Families

```css
/* Chữ UI chính */
@import url('https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700&display=swap');
--font-sans: 'Inter', -apple-system, sans-serif;

/* Code, ID, số kỹ thuật */
@import url('https://fonts.googleapis.com/css2?family=JetBrains+Mono:wght@400;500&display=swap');
--font-mono: 'JetBrains Mono', 'Fira Code', monospace;

/* Heading premium (optional) */
@import url('https://fonts.googleapis.com/css2?family=DM+Sans:wght@500;600;700&display=swap');
--font-display: 'DM Sans', 'Inter', sans-serif;
```

#### Type Scale

| Token | Size | Weight | Line-height | Usage |
|-------|:----:|:------:|:-----------:|-------|
| `display-2xl` | 48px | 700 | 1.1 | Hero headlines |
| `display-xl` | 36px | 700 | 1.2 | Page titles |
| `display-lg` | 28px | 600 | 1.25 | Section headers |
| `heading-xl` | 22px | 600 | 1.3 | Card headers |
| `heading-lg` | 18px | 600 | 1.4 | Sub-section |
| `heading-md` | 15px | 600 | 1.4 | Label, tab |
| `body-lg` | 15px | 400 | 1.6 | Body text |
| `body-md` | 13px | 400 | 1.6 | Secondary text |
| `body-sm` | 12px | 400 | 1.5 | Caption, meta |
| `mono-md` | 13px | 400 | 1.5 | Code, ID, coords |
| `mono-sm` | 11px | 400 | 1.4 | Technical labels |

---

### 1.4. Spacing & Grid

```css
/* 8px Base Unit */
--space-1:   4px;    /* 0.5 unit — tiny gap */
--space-2:   8px;    /* 1 unit — icon margin */
--space-3:   12px;   /* 1.5 unit — compact padding */
--space-4:   16px;   /* 2 unit — standard padding */
--space-5:   20px;   /* 2.5 unit */
--space-6:   24px;   /* 3 unit — section gap */
--space-8:   32px;   /* 4 unit — card padding */
--space-10:  40px;   /* 5 unit — section margin */
--space-12:  48px;   /* 6 unit */
--space-16:  64px;   /* 8 unit — page section */
```

#### Layout Grid

| Breakpoint | Columns | Gutter | Margin |
|-----------|:-------:|:------:|:------:|
| Mobile (< 768px) | 4 | 16px | 16px |
| Tablet (768–1024px) | 8 | 20px | 24px |
| Desktop (1024–1440px) | 12 | 24px | 32px |
| Wide (> 1440px) | 16 | 24px | 48px |

---

### 1.5. Shadows & Elevation

```css
--shadow-sm:  0 1px 3px rgba(0,0,0,0.4), 0 1px 2px rgba(0,0,0,0.3);
--shadow-md:  0 4px 12px rgba(0,0,0,0.5), 0 2px 4px rgba(0,0,0,0.3);
--shadow-lg:  0 10px 30px rgba(0,0,0,0.6), 0 4px 10px rgba(0,0,0,0.4);
--shadow-xl:  0 20px 50px rgba(0,0,0,0.7), 0 8px 20px rgba(0,0,0,0.5);

/* Glow effects for active/accent */
--glow-teal:  0 0 20px rgba(0,212,170,0.25), 0 0 40px rgba(0,212,170,0.1);
--glow-blue:  0 0 20px rgba(0,148,255,0.25);
```

---

### 1.6. Border Radius

```css
--radius-sm:   4px;   /* Tags, badges */
--radius-md:   8px;   /* Input, button */
--radius-lg:   12px;  /* Card */
--radius-xl:   16px;  /* Panel, modal */
--radius-2xl:  24px;  /* Large card */
--radius-full: 9999px; /* Pill, avatar */
```

---

### 1.7. Animation & Transitions

```css
/* Duration */
--duration-fast:   150ms;  /* Hover, focus */
--duration-normal: 250ms;  /* State change */
--duration-slow:   400ms;  /* Panel slide, modal */
--duration-slower: 600ms;  /* Page transition */

/* Easing */
--ease-out:  cubic-bezier(0, 0, 0.2, 1);    /* Enter transitions */
--ease-in:   cubic-bezier(0.4, 0, 1, 1);    /* Exit transitions */
--ease-inout: cubic-bezier(0.4, 0, 0.2, 1); /* State changes */
--ease-spring: cubic-bezier(0.34, 1.56, 0.64, 1); /* Playful pop */

/* Rules */
/* Mọi hover state: transition-colors/opacity 150ms ease-out */
/* Sidebar collapse: transform 250ms ease-out */
/* Modal open: opacity + scale(0.95→1) 250ms ease-out */
/* Toast notification: slide-in-right 300ms ease-spring */
```

---

## PHẦN 2: LAYOUT ARCHITECTURE

### 2.1. Shell Layout (App Shell)

```
┌─────────────────────────────────────────────────────────────────┐
│  TOP BAR (56px fixed)                                            │
│  [Logo] [Project Switcher ▼]     [Search] [Notif] [Avatar]      │
├──────────────┬──────────────────────────────────────────────────┤
│              │                                                   │
│  LEFT SIDEBAR│          MAIN CONTENT AREA                       │
│  (240px)     │          (flex-1, scrollable)                    │
│              │                                                   │
│  [Icon+Label]│  ┌─────────────────────────────────────────────┐ │
│  Navigation  │  │  Page Header (breadcrumb + actions)          │ │
│              │  ├─────────────────────────────────────────────┤ │
│  ─────────── │  │                                             │ │
│  Projects    │  │           Page Content                      │ │
│  Documents   │  │                                             │ │
│  3D Viewer   │  │                                             │ │
│  4D/5D       │  │                                             │ │
│  GIS Map     │  └─────────────────────────────────────────────┘ │
│  Reports     │                                                   │
│  ─────────── │                                                   │
│  Settings    │                                                   │
│  Help        │                                                   │
└──────────────┴──────────────────────────────────────────────────┘
```

**Chi tiết kỹ thuật Shell:**
- Top bar: `position: fixed; top: 0; left: 0; right: 0; height: 56px; z-index: 100; bg: var(--bg-surface); border-bottom: 1px solid var(--border-subtle); backdrop-filter: blur(20px);`
- Left Sidebar: `position: fixed; top: 56px; left: 0; bottom: 0; width: 240px; z-index: 90; bg: var(--bg-elevated);`
- Main Content: `margin-left: 240px; margin-top: 56px; min-height: calc(100vh - 56px);`
- Sidebar collapsed: `width: 64px` — chỉ hiện icon; transition 250ms

---

### 2.2. Top Bar — Chi tiết

```
[CIC Logo 28px] [Divider] [FPT Plaza Tower ▼ (Project Switcher)]
                                           ↑ Dropdown danh sách dự án

                              [🔍 Search... Ctrl+K]  [🔔 3] [👤 Nguyễn A ▼]
```

**Components:**
- **Logo:** SVG 28×28px, text "CDE CIC" 14px semi-bold, text-primary
- **Project Switcher:** Badge-style dropdown: `[Project Icon] [Project Name] [Caret]`
  - Hiển thị: project name (max 24 chars), code prefix
  - Dropdown: search + danh sách + "New Project" button
- **Global Search:** `Command+K` mở modal full search
  - Placeholder: "Tìm kiếm tài liệu, công trình, phiên bản..."
  - Width: 280px, rounded pill
- **Notification Bell:** Badge đỏ số lượng chưa đọc
- **Avatar Menu:** Avatar 32px + tên + role + dropdown

---

### 2.3. Left Sidebar — Chi tiết

```
┌────────────────────────────┐
│ [≡] CDE CIC           [←] │  ← collapse button
├────────────────────────────┤
│                            │
│  ◉ WORKSPACE               │
│  ┌─────────────────────┐   │
│  │ 🏗️  Dashboard        │  ← active: teal left border + bg teal/10
│  │ 📂  Tài liệu         │
│  │ 🧊  3D Viewer        │
│  │ 📅  4D/5D Tiến độ    │
│  │ 🗺️  GIS & GeoBIM     │
│  │ 📊  Báo cáo          │
│  └─────────────────────┘   │
│                            │
│  ◉ QUẢN TRỊ                │
│  ┌─────────────────────┐   │
│  │ 👥  Thành viên       │
│  │ ⚙️  Cài đặt Dự án    │
│  │ 🔒  Phân quyền       │
│  └─────────────────────┘   │
│                            │
│  ──────────────────────    │
│  ❓  Trợ giúp              │
│  🤖  BIM Agent AI          │ ← nổi bật màu purple
└────────────────────────────┘
```

**Nav Item States:**
- Default: `text-text-secondary; hover: bg-bg-hover text-text-primary`
- Active: `border-l-2 border-accent-primary; bg: rgba(0,212,170,0.08); text: var(--accent-primary)`
- Icon: 18×18px SVG (Lucide icons), consistent stroke-width: 1.5

---

## PHẦN 3: MÀN HÌNH CHÍNH

---

### MÀN HÌNH 1: DASHBOARD (Trang chủ dự án)

#### Layout

```
┌─────────────────────────────────────────────────────────────────┐
│  📍 FPT Plaza Tower / Dashboard                [+ Upload] [⚙️]   │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌──────────┐       │
│  │📂 Tài liệu│  │✅ Phê duyệt│  │⏳ Tiến độ│  │🔔 Thông báo│   │
│  │  1,247   │  │  23/28   │  │  68%     │  │  5 mới   │       │
│  │ file     │  │ đã duyệt │  │ hoàn thành│  │ hôm nay  │       │
│  └──────────┘  └──────────┘  └──────────┘  └──────────┘       │
│                                                                  │
│  ┌──────────────────────────────┐ ┌────────────────────────────┐│
│  │  📈 Hoạt động Gần đây        │ │  📋 Phê duyệt Chờ xử lý   ││
│  │  ──────────────────────────  │ │  ────────────────────────  ││
│  │  [Avatar] A. Kiệt upload ... │ │  🟡 BT-SA-001-R03.ifc      ││
│  │  [Avatar] T. Hoa phê duyệt..│ │     Chờ review từ 2h trước ││
│  │  [Avatar] N. Nam tạo task ...│ │  🟡 ARCH-DWG-B02.pdf       ││
│  │  [Avatar] System tạo version │ │     Chờ review từ 1 ngày   ││
│  │  [Xem tất cả →]             │ │  [Xem tất cả →]            ││
│  └──────────────────────────────┘ └────────────────────────────┘│
│                                                                  │
│  ┌──────────────────────────────────────────────────────────────┤
│  │  🧊 Mô hình BIM mới nhất — FPT-ARCH-TOWER-v12.ifc  [Mở 3D]  │
│  │  ┌────────────────────────────────────────────────────────┐  │
│  │  │              [3D THUMBNAIL PREVIEW]                    │  │
│  │  │              Render nhỏ 280px × 160px                  │  │
│  │  │                                                        │  │
│  │  └────────────────────────────────────────────────────────┘  │
│  │  Cập nhật: 2h trước | Phiên bản: 12 | Kích thước: 487MB     │
└──┴──────────────────────────────────────────────────────────────┘
```

#### Spec Cards Thống kê

- **Container:** `bg: var(--glass-bg); border: 1px solid var(--glass-border); border-radius: 12px; padding: 24px; backdrop-filter: blur(20px);`
- **Icon area:** 48×48px circle, `bg: rgba(accent,0.12); color: accent`
- **Số:** `font-size: 32px; font-weight: 700; font-family: var(--font-display); color: var(--text-primary)`
- **Label:** `font-size: 13px; color: var(--text-secondary); margin-top: 4px`
- **Hover:** `border-color: var(--border-accent); box-shadow: var(--glow-teal); transform: translateY(-2px)`

#### Claude Design Prompt — Dashboard

```
Design a dark enterprise dashboard for CDE CIC construction BIM platform.

Dark navy background (#0A0E1A). Top header with logo "CDE CIC" and project switcher.
Left sidebar (240px wide, #141D35) with navigation: Dashboard, Documents, 3D Viewer, 4D/5D, GIS Map, Reports, Settings. Active item has teal (#00D4AA) left border and subtle teal background.

Main content: 4 stat cards in a row. Cards have glassmorphism style (rgba(20,29,53,0.7), white/8% border, blur(20px) backdrop filter, 12px border radius).

Card 1: "Tài liệu" — file icon in teal circle, "1,247" large number, "file trong dự án" label
Card 2: "Phê duyệt" — check icon in green circle, "23/28" number, "tài liệu đã duyệt" label
Card 3: "Tiến độ" — progress icon in blue circle, "68%" number, "hoàn thành" label
Card 4: "Thông báo" — bell icon in amber circle, "5 mới" number, "hôm nay" label

Below: 2 panels side by side.
Left panel: "Hoạt động Gần đây" — activity feed with user avatars and action descriptions.
Right panel: "Phê duyệt Chờ xử lý" — list of documents with amber status badges.

Bottom: BIM model preview card spanning full width, showing a dark 3D architectural model thumbnail on the right, metadata on the left.

Typography: Inter font. Primary text #F0F4FF. Secondary text #8B96B4. Accent teal #00D4AA.
Modern, professional, feels like high-end construction software. No emojis as icons — use SVG icons (Lucide style).
```

---

### MÀN HÌNH 2: 3D BIM VIEWER

#### Layout — Full-screen với Side Panels

```
┌──────────────────────────────────────────────────────────────────────┐
│ TOOLBAR (48px)                                                        │
│ [FPT-ARCH-v12.ifc] [v12▼] │ [↩Undo][↪Redo] │ [⊕Fit][⊖][⊗] │ [Share]│
├──────────┬───────────────────────────────────────────┬───────────────┤
│          │                                           │               │
│  SPATIAL │          3D VIEWPORT                      │  PROPERTIES   │
│  TREE    │       (WebGL Canvas — chiếm tối đa)       │  PANEL        │
│  (280px) │                                           │  (320px)      │
│          │   ┌──────────────────────────────────┐   │               │
│▼ Site    │   │                                  │   │  GlobalId:    │
│ ▶ B1    │   │   [3D MODEL RENDER AREA]         │   │  0cKY2Vd...   │
│ ▼ B2    │   │                                  │   │               │
│   ▶ KT  │   │                                  │   │  Name: Tường  │
│   ▼ KC  │   │   [Orbit/Pan/Zoom controls]      │   │  SW-01        │
│     Col1│   │   [Measurement tool active]       │   │               │
│     Col2│   │                                  │   │  ─ Pset_Wall  │
│     Col3│   │                                  │   │  Material:    │
│   ▶ MEP │   │                                  │   │  Bê tông M300 │
│          │   └──────────────────────────────────┘   │  Thickness:   │
│          │                                           │  200mm        │
│  [Filter]│   STATUS BAR: 42,871 triangles | 23 FPS  │  Area: 18.4m² │
│  [Search]│                                           │               │
│          │   [Section] [Measure] [BCF] [Hide] [Clip]│  [BCF Issue+] │
└──────────┴───────────────────────────────────────────┴───────────────┘
```

#### Viewport Interactions

| Action | Control | Visual Feedback |
|:------:|:-------:|-----------------|
| Orbit | Left drag | Camera rotates, element stays |
| Pan | Right drag / Middle drag | Crosshair cursor |
| Zoom | Scroll wheel | Smooth zoom with depth |
| Select | Left click | Element highlights teal, properties panel opens |
| Multi-select | Ctrl+Click | Multiple elements highlight |
| Focus | Double-click | Camera moves to fit element |
| Hide | Right-click → Hide | Element fades then disappears |
| Isolate | Right-click → Isolate | Others fade to 10% opacity |

#### Spatial Tree Spec

```
▼ 🏗️ Site: FPT_SITE                    [toggle all ◉]
  ▼ 🏢 Building: TOWER_A
    ▼ B1 — Tầng hầm 1                  [👁 show/hide]
      ▶ Kiến trúc (KT) — 248 elements   [blue badge]
      ▶ Kết cấu (KC) — 156 elements     [orange badge]
      ▶ MEP — 89 elements               [green badge]
    ▼ B2 — Tầng hầm 2
    ▶ T01 — Tầng 1
    ...
    ▶ T45 — Tầng 45
```

- Tree item hover: `bg: rgba(255,255,255,0.04)`
- Selected: `bg: rgba(0,212,170,0.1); color: var(--accent-primary); border-left: 2px solid teal`
- Category badge: small pill `8px padding, font-size: 10px, font-weight: 600`

#### BCF Issue Panel (bottom sheet khi active)

```
┌──────────────────────────────────────────────────────┐
│ BCF Issues  [+ New Issue]          [Filter ▼] [✕]   │
├──────────────────────────────────────────────────────┤
│ 🔴 Clash: Cột KC-023 va chạm ống MEP-PP-012         │
│    Tầng 3 | Nguyễn A | 2 ngày trước | OPEN           │
│ 🟡 Review: Kích thước lỗ cửa tầng 1 không khớp     │
│    Tầng 1 | Trần B | 1 ngày trước | IN REVIEW        │
└──────────────────────────────────────────────────────┘
```

#### Claude Design Prompt — 3D Viewer

```
Design a professional 3D BIM viewer interface in dark mode for construction software.

Three-column layout: Left panel (280px) = spatial tree, Center = 3D viewport (takes maximum space), Right panel (320px) = properties inspector.

Left panel (#141D35): Hierarchical tree with Site > Building > Floor > Category (Architecture/Structure/MEP). Each category has a colored badge (blue/orange/green). Eye icon for visibility toggle. Search bar at top.

Center viewport: Pure black background (#000), showing a dark 3D architectural building model rendered in WebGL. Subtle grid floor. Selected elements glow in teal (#00D4AA). Performance stats bar at bottom: "42,871 triangles | 23 FPS".

Right panel (#141D35): "Properties" header. Selected element: "Tường SW-01" with GlobalId (monospace font), material properties in key-value rows. Collapsible sections: Base Properties, Pset_WallCommon, Quantities. "+ Add BCF Issue" button at bottom in teal.

Top toolbar: File name "FPT-ARCH-v12.ifc", version dropdown "v12", separator, undo/redo buttons, zoom controls, share button.

Bottom floating toolbar: Section plane tool, Measurement tool, BCF, Hide, Clip — pill-shaped toolbar centered below viewport with glass background.

Style: Dark, precise, technical. Inter font. Teal accent. Professional like Autodesk but with 2026 aesthetics.
```

---

### MÀN HÌNH 3: QUẢN LÝ TÀI LIỆU (Document Management)

#### Layout

```
┌──────────────────────────────────────────────────────────────────────┐
│ 📂 Tài liệu Dự án           [🔍 Tìm kiếm...]  [+ Upload] [⚙️ Filter]│
├──────────────────────────────────────────────────────────────────────┤
│                                                                       │
│  FOLDER TREE              DOCUMENT LIST (main)                       │
│  ┌───────────────┐  ┌──────────────────────────────────────────────┐│
│  │ 📁 Toàn dự án │  │ [Grid view ⊞] [List view ☰]   [Sort: Mới ▼]││
│  │  ├📁 KT-KiếnT  │  ├──────────────────────────────────────────────┤│
│  │  │  ├📁 T01-T10│  │ [☐] Name▲          Status   Version  Date   ││
│  │  │  └📁 T11-T45│  ├──────────────────────────────────────────────┤│
│  │  ├📁 KC-KếtCấu │  │ [☐] 🏗️ ARCH-F01-R3 ● Published v.3 12/6   ││
│  │  ├📁 MEP       │  │ [☐] 📐 ARCH-F01-R2 ● Shared   v.2 11/6   ││
│  │  ├📁 QT-QuyTrinh│  │ [☐] 📄 KC-CALC-003 ● WIP      v.1 10/6   ││
│  │  └📁 HS-HoSo   │  │ [☐] 📄 MEP-HVAC-01 ⏸ Pending  v.1 09/6   ││
│  └───────────────┘  └──────────────────────────────────────────────┘│
│                                                                       │
│  [Đang chọn: 2 file]  [↓ Download] [→ Submit Review] [🗑 Delete]    │
└──────────────────────────────────────────────────────────────────────┘
```

#### ISO 19650 Status Badges

| Trạng thái | Màu | Badge |
|:----------:|:---:|-------|
| WIP | Amber `#F59E0B` | `● WIP` — pill amber/20 bg |
| Shared | Blue `#0094FF` | `● Shared` — pill blue/20 bg |
| Published | Green `#10B981` | `✓ Published` — pill green/20 bg |
| Archived | Gray `#6B7280` | `○ Archived` — pill gray/20 bg |
| Pending Review | Purple `#8B5CF6` | `⏸ Pending` — pill purple/20 bg |
| Rejected | Red `#EF4444` | `✗ Rejected` — pill red/20 bg |

#### Document Row Spec

```
[☐] [File Icon 24px] [File Name (bold 14px)]              [Status Badge] [vX] [Date] [Actions ...]
                      [Subfolder path (gray 12px)]
```

- Row height: 52px
- Hover: `bg: rgba(255,255,255,0.03)`
- Selected: `bg: rgba(0,212,170,0.06); border-left: 3px solid var(--accent-primary)`
- File icon: colored by type (IFC=teal, DWG=orange, PDF=red, DOC=blue, Excel=green)

#### Upload Dropzone (Modal)

```
┌────────────────────────────────────────────────────────────┐
│ Upload Tài liệu                                        [✕] │
├────────────────────────────────────────────────────────────┤
│ ┌──────────────────────────────────────────────────────┐   │
│ │  ⬆️                                                   │   │
│ │  Kéo thả file vào đây hoặc                           │   │
│ │  [Chọn file từ máy tính]                             │   │
│ │  Hỗ trợ: IFC, DWG, RVT, PDF, DOC, XLS (max 2GB)    │   │
│ └──────────────────────────────────────────────────────┘   │
│                                                             │
│ Mã tài liệu:  [ARCH-F01-T01-_____]  ← auto-suggest        │
│ Bộ môn:       [Kiến trúc ▼]                               │
│ Giai đoạn:    [Thi công ▼]                                │
│ Phiên bản:    [v.1]  (auto-increment)                     │
│                                                             │
│                           [Hủy]  [↑ Upload & Submit]      │
└────────────────────────────────────────────────────────────┘
```

#### Approval Workflow View

```
WIP ──────→ Shared ──────→ Published ──────→ Archived
 ↑              ↑              ↑
 └── Edit       └── Review     └── Approve
     (user)         (lead)         (PM)
```

Visual: Horizontal stepper với trạng thái hiện tại highlight, timeline history bên dưới.

#### Claude Design Prompt — Document Management

```
Design a document management interface for construction BIM project, dark enterprise style.

Layout: Left sidebar (240px, #141D35) shows folder tree with colored icons by category (Architecture=blue, Structure=orange, MEP=green). Expandable/collapsible folders.

Main content: Top bar with search input, Upload button (teal), Filter button. Below: document list in table style.

Table columns: Checkbox, File icon (colored by type), Document name (bold) + code below it in gray, Status badge (pill shape: WIP=amber, Shared=blue, Published=green, Pending=purple, Rejected=red), Version number (monospace), Date, 3-dot actions menu.

Selected rows: subtle teal left border + teal/6% background.

Status badges: small pill shapes with colored text and matching background at 15% opacity. For example, Published shows green text on green/15% background with checkmark icon.

When selecting multiple files: floating action bar appears at bottom with Download, Submit Review, Delete actions.

Dark theme: #0A0E1A background, #141D35 panels, #00D4AA teal accent. Inter font. Professional construction software feel.
```

---

### MÀN HÌNH 4: 4D/5D — TIẾN ĐỘ & CHI PHÍ

#### Layout — Dual-panel

```
┌──────────────────────────────────────────────────────────────────────┐
│ 📅 Tiến độ & Chi phí 4D/5D          [Xuất Dự toán] [Xuất Báo cáo]  │
├──────────────────────────────────────────────────────────────────────┤
│                                                                       │
│  TAB: [4D Tiến độ] [5D Dự toán] [Nghiệm thu] [Nhật ký]              │
│                                                                       │
│  ┌─────────────────────────────────────────────────────────────────┐ │
│  │ GANTT CHART / 4D TIMELINE                                       │ │
│  │ ┌──────────────┬──────────────────────────────────────────────┐ │ │
│  │ │ Task Name    │ Sep'26  Oct'26  Nov'26  Dec'26  Jan'27 Feb'27│ │ │
│  │ ├──────────────┼──────────────────────────────────────────────┤ │ │
│  │ │▼ Phần thô    │ [=====XXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX=====] │ │ │
│  │ │  Móng cọc    │         [============================]       │ │ │
│  │ │  Đài cọc     │                  [==================]        │ │ │
│  │ │▶ Cơ điện     │                           [=======]          │ │ │
│  │ │▶ Hoàn thiện  │                                    [========]│ │ │
│  │ └──────────────┴──────────────────────────────────────────────┘ │ │
│  └─────────────────────────────────────────────────────────────────┘ │
│                                                                       │
│  KPI ROW:                                                            │
│  ┌──────────────┐ ┌──────────────┐ ┌──────────────┐ ┌─────────────┐│
│  │ Dự toán       │ │ Thực tế      │ │ Chênh lệch   │ │ % Hoàn thành ││
│  │ 45.2 tỷ VNĐ  │ │ 38.7 tỷ VNĐ │ │ -6.5 tỷ      │ │    68%      ││
│  │ Ngân sách GĐ1│ │ đã chi       │ │ ▼ Tiết kiệm  │ │ ██████████░ ││
│  └──────────────┘ └──────────────┘ └──────────────┘ └─────────────┘│
└──────────────────────────────────────────────────────────────────────┘
```

#### 5D Dự toán Tab

```
┌──────────────────────────────────────────────────────────────────────┐
│ BOQ — Bảng tiên lượng dự toán         [Tải xuống Excel] [Cập nhật] │
├──────────────────────────────────────────────────────────────────────┤
│ [Filter: Bộ môn ▼] [Filter: Giai đoạn ▼] [Tìm mã công tác...]      │
├──────────────────────────────────────────────────────────────────────┤
│ STT | Mã công tác | Tên công việc         | ĐVT | SL  | Đơn giá | TT│
├──────────────────────────────────────────────────────────────────────┤
│ 1   | AF.11120    | BT móng đơn M250      | m³  | 482 | 1.8tr   | ...│
│ 2   | AF.11130    | BT móng băng M300     | m³  | 218 | 2.1tr   | ...│
│ 3   | AF.21110    | BT cột thép M400      | m³  | 156 | 3.2tr   | ...│
├──────────────────────────────────────────────────────────────────────┤
│                    TỔNG DỰ TOÁN:              45,280,000,000 VNĐ    │
└──────────────────────────────────────────────────────────────────────┘
```

#### Claude Design Prompt — 4D/5D

```
Design a 4D/5D construction schedule and cost management interface, dark enterprise style.

Top section: Tab navigation (4D Schedule, 5D Cost Estimate, Progress Report, Work Log).

4D tab: Full-width Gantt chart with dark background. Left column shows task hierarchy (expandable). Right shows horizontal bars representing schedule — bar color indicates completion (teal=done, blue=in-progress, gray=planned). Today marker as vertical teal dashed line.

Below Gantt: Row of 4 KPI cards. Each card shows metric name, large bold number, unit, and trend indicator. One card shows a progress bar.

5D tab: Table with columns: STT (number), Work code (monospace teal), Task description, Unit, Quantity, Unit price, Total. Rows alternate subtle shading. Total row at bottom with highlighted background and large bold number in teal.

Export buttons: "Download Excel" with green icon, "Download PDF" with red icon.

Dark theme: Navy backgrounds, teal accents, Inter+JetBrains Mono fonts, professional construction management aesthetic.
```

---

### MÀN HÌNH 5: GIS & GEOBIM MAP

#### Layout

```
┌──────────────────────────────────────────────────────────────────────┐
│ 🗺️ GIS & GeoBIM                  [🏗️ Overlay BIM] [Filter] [3D Mode]│
├────────────────┬─────────────────────────────────────────────────────┤
│  MAP CONTROLS  │                                                      │
│  ──────────── │               MAP VIEWPORT                           │
│  🔍 Tìm địa điểm│               (Mapbox/OpenStreetMap)               │
│                │                                                      │
│  Layers        │    [Bản đồ vệ tinh với BIM model overlay]           │
│  ☑ Công trình  │                                                      │
│  ☑ BIM Overlay │    📍 Marker: FPT Plaza Tower                       │
│  ☑ Địa giới    │       ↓ Hover: popup thông tin                      │
│  ☐ Giao thông  │                                                      │
│  ☐ Hạ tầng KT  │                                                      │
│                │    [Zoom + ] [Zoom - ] [Full screen] [My location]  │
│  Projects      │                                                      │
│  ┌───────────┐ │                                                      │
│  │📍 FPT Pl..│ │                                                      │
│  │📍 Vinhome│ │                                                      │
│  │📍 Sun Gr.│ │                                                      │
│  └───────────┘ │                                                      │
└────────────────┴─────────────────────────────────────────────────────┘
```

#### Project Marker Popup

```
┌─────────────────────────────────────────┐
│ 🏗️ FPT Plaza Tower                      │
│ 📍 Cầu Giấy, Hà Nội                    │
│ ─────────────────────────────────────── │
│ Trạng thái: ● Đang thi công             │
│ Tiến độ: 68% ████████████░░░░░░         │
│ Giai đoạn: Phần thô tầng 12-18         │
│ ─────────────────────────────────────── │
│ [Mở Dashboard] [Xem 3D] [Tài liệu]    │
└─────────────────────────────────────────┘
```

---

### MÀN HÌNH 6: ADMIN / CÀI ĐẶT DỰ ÁN

#### Layout Tabs

```
┌──────────────────────────────────────────────────────────────────────┐
│ ⚙️ Cài đặt Dự án — FPT Plaza Tower                                   │
├──────────────────────────────────────────────────────────────────────┤
│ [Thông tin] [Thành viên & Quyền] [Quy trình Duyệt] [Bảo mật] [API]│
│                                                                       │
│  ═══ THÀNH VIÊN & PHÂN QUYỀN ════════════════════════════════════   │
│                                                                       │
│  [🔍 Tìm thành viên]                        [+ Mời thành viên]      │
│                                                                       │
│  ┌──────────────────────────────────────────────────────────────┐   │
│  │ Avatar | Họ tên            | Email          | Vai trò    | ... │  │
│  ├──────────────────────────────────────────────────────────────┤   │
│  │ 🟢NV   | Nguyễn Văn A     | nva@cic.vn     | [Admin ▼]  | ✕ │  │
│  │ 🟢TH   | Trần Thị H       | tth@cic.vn     | [Editor ▼] | ✕ │  │
│  │ 🟡LM   | Lê Minh N        | lmn@fpt.com    | [Viewer ▼] | ✕ │  │
│  └──────────────────────────────────────────────────────────────┘   │
│                                                                       │
│  PERMISSION MATRIX                                                   │
│  ┌─────────────────┬──────┬────────┬────────┬─────────┬──────────┐  │
│  │ Tính năng       │Admin │ Manager│ Editor │ Reviewer│  Viewer  │  │
│  ├─────────────────┼──────┼────────┼────────┼─────────┼──────────┤  │
│  │ Upload file     │  ✓   │   ✓   │   ✓   │    ✗   │    ✗     │  │
│  │ Phê duyệt       │  ✓   │   ✓   │   ✗   │    ✓   │    ✗     │  │
│  │ Xóa file        │  ✓   │   ✗   │   ✗   │    ✗   │    ✗     │  │
│  │ Xem 3D Viewer   │  ✓   │   ✓   │   ✓   │    ✓   │    ✓     │  │
│  └─────────────────┴──────┴────────┴────────┴─────────┴──────────┘  │
└──────────────────────────────────────────────────────────────────────┘
```

---

## PHẦN 4: COMPONENTS LIBRARY

### 4.1. Button System

```css
/* Primary Button */
.btn-primary {
  background: var(--accent-primary);
  color: #000;
  font-weight: 600;
  padding: 8px 20px;
  border-radius: 8px;
  transition: all 150ms ease-out;
}
.btn-primary:hover {
  background: hsl(170, 100%, 50%);  /* slightly lighter */
  box-shadow: var(--glow-teal);
  transform: translateY(-1px);
}

/* Secondary Button */
.btn-secondary {
  background: transparent;
  border: 1px solid var(--border-normal);
  color: var(--text-primary);
  padding: 8px 20px;
  border-radius: 8px;
}
.btn-secondary:hover {
  background: var(--bg-hover);
  border-color: var(--border-accent);
}

/* Danger Button */
.btn-danger {
  background: transparent;
  border: 1px solid rgba(239,68,68,0.3);
  color: #EF4444;
}
.btn-danger:hover {
  background: rgba(239,68,68,0.1);
}

/* Ghost Button */
.btn-ghost {
  background: transparent;
  color: var(--text-secondary);
}
.btn-ghost:hover {
  color: var(--text-primary);
  background: var(--bg-hover);
}
```

**Sizes:**
| Size | Height | Padding | Font |
|:----:|:------:|:-------:|:----:|
| sm | 28px | 6px 12px | 12px |
| md | 36px | 8px 16px | 13px |
| lg | 44px | 10px 20px | 15px |
| xl | 52px | 12px 28px | 16px |

---

### 4.2. Input Fields

```
┌────────────────────────────────────────────────┐
│ Label text *                                    │  ← 12px semibold, text-secondary
├────────────────────────────────────────────────┤
│ 🔍  Placeholder text...                        │  ← 40px height, bg-input
└────────────────────────────────────────────────┘
                                    ↑ Focus: border-accent + glow-teal 0 0 0 3px rgba(teal,0.1)
```

- Default: `border: 1px solid var(--border-normal); bg: var(--bg-input); border-radius: 8px; height: 40px; padding: 0 12px`
- Focus: `border-color: var(--accent-primary); outline: 3px solid rgba(0,212,170,0.15)`
- Error: `border-color: #EF4444; outline: 3px solid rgba(239,68,68,0.15)`
- Disabled: `opacity: 0.5; cursor: not-allowed`

---

### 4.3. Glass Card Component

```css
.glass-card {
  background: var(--glass-bg);    /* rgba(20,29,53,0.7) */
  border: 1px solid var(--glass-border);  /* rgba(255,255,255,0.08) */
  border-radius: 12px;
  backdrop-filter: blur(20px);
  -webkit-backdrop-filter: blur(20px);
  padding: 24px;
  box-shadow: var(--shadow-md);
  transition: all 250ms ease-out;
}
.glass-card:hover {
  border-color: rgba(255,255,255,0.15);
  box-shadow: var(--shadow-lg);
  transform: translateY(-2px);
}
/* Active/selected variant */
.glass-card.active {
  border-color: var(--border-accent);
  box-shadow: var(--glow-teal);
}
```

---

### 4.4. Status Badge

```jsx
// Variants theo ISO 19650 + general states
const StatusBadge = ({ status }) => (
  <span className={`
    inline-flex items-center gap-1.5 px-2.5 py-0.5 
    rounded-full text-xs font-semibold
    ${variants[status].className}
  `}>
    <span className="w-1.5 h-1.5 rounded-full bg-current" />
    {variants[status].label}
  </span>
)

// Variants:
// wip:       "bg-amber-500/15 text-amber-400"
// shared:    "bg-blue-500/15 text-blue-400"
// published: "bg-emerald-500/15 text-emerald-400"
// archived:  "bg-gray-500/15 text-gray-400"
// pending:   "bg-purple-500/15 text-purple-400"
// rejected:  "bg-red-500/15 text-red-400"
```

---

### 4.5. Notification Toast

```
Position: top-right, fixed, 16px from edges
Stack: max 5 toasts, newest on top
Animation: slide in from right (300ms ease-spring), auto-dismiss 4s

┌──────────────────────────────────────────────┐
│ ✓  Tải lên thành công              [✕]       │  ← green top border
│    ARCH-F01-R3.ifc (487MB)                   │
└──────────────────────────────────────────────┘
```

---

### 4.6. Data Table

```
Header: sticky top, bg-surface, border-bottom
Sortable columns: icon indicates sort state (up/down/default)
Row: 52px height, hover: bg-hover/50%
Selected: border-left 3px teal + bg-teal/4%
Pagination: bottom right, "Showing 1-25 of 1,247"
Actions: 3-dot menu on hover (absolute right)
Empty state: centered illustration + helper text + CTA button
Loading: skeleton rows (animated shimmer)
```

---

### 4.7. Modal Dialog

```
Backdrop: rgba(0,0,0,0.7), blur(4px)
Container: bg-elevated, border border-subtle, radius-xl, shadow-xl
Max-width: 560px (default), 800px (large), full-screen (viewer)
Animation: scale(0.95)→scale(1) + opacity 0→1, 250ms ease-out

Header: title (heading-xl) + X button
Body: scrollable (max-height: 70vh)
Footer: right-aligned buttons [Cancel] [Primary Action]
```

---

## PHẦN 5: MOBILE & RESPONSIVE

### 5.1. Breakpoints

```
Mobile:   < 768px  — Stack layout, bottom nav bar
Tablet:   768-1024px — Collapsed sidebar (icon only)
Desktop:  1024-1440px — Full layout
Wide:     > 1440px — Expanded content area
```

### 5.2. Mobile App Shell

```
┌─────────────────────────┐
│ [≡] CDE CIC      [🔔] [👤]│  ← top bar
├─────────────────────────┤
│                         │
│      CONTENT AREA       │
│      (scrollable)       │
│                         │
│                         │
├─────────────────────────┤
│ [🏠] [📂] [🧊] [📅] [⚙️]│  ← bottom tab nav
└─────────────────────────┘
```

### 5.3. Mobile Viewer

- Viewer fullscreen, bottom sheet cho properties
- Pinch to zoom, single finger orbit
- Bottom toolbar: icon only buttons
- Spatial tree: slide-out panel

---

## PHẦN 6: MICRO-INTERACTIONS

### 6.1. Loading States

```
• File upload: Progress bar với % + "Đang xử lý IFC..."
• 3D model loading: Centered spinner + progress "Đang tải 67%..."
• Table loading: Skeleton shimmer rows (3 rows animated)
• API call: Button spinner replace icon, disable button
```

### 6.2. Hover Effects (quan trọng)

```
• Nav item: background slide in from left (::before pseudo)
• Card: lift (-2px) + border lighten + shadow grow
• Button: slight brightness increase + optional glow
• Table row: background fill from center
• Status badge: none (không hover)
```

### 6.3. Skeleton Loading

```css
@keyframes shimmer {
  0% { background-position: -1000px 0; }
  100% { background-position: 1000px 0; }
}
.skeleton {
  background: linear-gradient(90deg,
    rgba(255,255,255,0.03) 25%,
    rgba(255,255,255,0.07) 50%,
    rgba(255,255,255,0.03) 75%
  );
  background-size: 2000px 100%;
  animation: shimmer 1.5s infinite;
  border-radius: 4px;
}
```

---

## PHẦN 7: BIM AGENT AI PANEL

### 7.1. AI Chat Interface

```
┌──────────────────────────────────────────────────────┐
│ 🤖 BIM Agent AI                         [×] [expand] │
├──────────────────────────────────────────────────────┤
│                                                       │
│  [AI Message bubble — purple/left]                   │
│  Xin chào! Tôi có thể giúp bạn:                      │
│  • Tra cứu quy chuẩn xây dựng VN                    │
│  • Giải thích thuộc tính IFC                         │
│  • Tính toán khối lượng                              │
│  • Hỏi đáp về tiến độ dự án                         │
│                                                       │
│  [User Message bubble — navy/right]                  │
│  Chiều dày tường chịu lực tối thiểu theo QCVN 2021? │
│                                                       │
│  [AI response typing indicator: ●●● ]               │
│                                                       │
├──────────────────────────────────────────────────────┤
│ [📎 Đính kèm file IFC] [Nhập câu hỏi...]   [→ Send]│
└──────────────────────────────────────────────────────┘
```

**Positioning:** Fixed bottom-right, 400px wide, 600px tall. Collapsed = floating button.

**AI Message Style:**
- bg: `rgba(124,58,237,0.12)` — purple tint
- border: `1px solid rgba(124,58,237,0.2)`
- border-radius: `12px 12px 12px 2px`

**User Message Style:**
- bg: `rgba(0,212,170,0.1)` — teal tint
- border: `1px solid rgba(0,212,170,0.15)`
- border-radius: `12px 12px 2px 12px`
- text-align: right

#### Claude Design Prompt — AI Chat Panel

```
Design an AI chat panel for construction BIM software. Dark panel (320px wide) sliding in from the right edge.

Header: Purple gradient bar with robot icon "BIM Agent AI" title, close and expand buttons.

Messages area: Dark scrollable area. AI messages on left with purple/dark background bubble (border-radius top-left 2px). User messages on right with teal/dark bubble. Typing indicator: three animated dots.

Input area at bottom: Text input with paperclip attachment icon, send button in teal. Suggestion chips above input showing quick actions.

Style: Dark navy (#141D35), purple accent (#7C3AED) for AI, teal (#00D4AA) for user interaction. Glassmorphism card. Subtle animation for messages appearing.
```

---

## PHẦN 8: CLAUDE DESIGN MASTER PROMPT

> Dùng prompt này để tạo toàn bộ màn hình Dashboard trong một lần

```
Create a complete dark enterprise web application UI for CDE CIC — a Vietnamese BIM/CDE construction platform.

=== OVERALL DESIGN SYSTEM ===
Background: #0A0E1A (darkest navy)
Surface: #0F1629 (main panels)
Elevated: #141D35 (cards, sidebar)
Accent Primary: #00D4AA (electric teal — CTA, active states)
Accent Secondary: #0094FF (blue — info, links)
Accent AI: #7C3AED (purple — AI features)
Text Primary: #F0F4FF (near white)
Text Secondary: #8B96B4 (gray-blue)
Font: Inter (UI) + JetBrains Mono (code/IDs)
Border: rgba(255,255,255,0.08) default, rgba(0,212,170,0.3) active
Cards: glassmorphism (rgba(20,29,53,0.7), blur 20px, white/8% border, 12px radius)

=== LAYOUT ===
Fixed top bar: 56px — Logo "CDE CIC" + Project Switcher dropdown + Search bar + Notification bell (badge 3) + User avatar
Fixed left sidebar: 240px — Navigation with icon+label, active item has teal left border

=== NAVIGATION ITEMS (sidebar) ===
Dashboard (active), Tài liệu, 3D Viewer, 4D/5D Tiến độ, GIS & GeoBIM, Báo cáo, Thành viên, Cài đặt
At bottom: Help, BIM Agent AI (purple accent, stands out)

=== MAIN CONTENT (Dashboard) ===
Page title: "Dashboard — FPT Plaza Tower" with Upload and Settings buttons

Row 1: 4 stat cards (glassmorphism)
- Tài liệu: 1,247 files (file icon in teal circle)
- Phê duyệt: 23/28 (check icon in green circle)  
- Tiến độ: 68% (gauge icon in blue circle)
- Cảnh báo: 5 mới (bell icon in amber circle)
Cards have hover effect: lift 2px + teal border glow

Row 2: Two panels side by side
Left: "Hoạt động Gần đây" — feed of recent actions with user avatars, names, actions in Vietnamese, timestamps
Right: "Phê duyệt Chờ xử lý" — list of document names with amber "Pending" badges, timestamps

Row 3: Full-width BIM preview card — shows a thumbnail of dark 3D building model on right half, metadata on left (file name, version v12, size 487MB, last updated 2h ago, discipline tags), "Mở trong 3D Viewer" teal button

=== QUALITY STANDARDS ===
- No emojis as decorative icons — use Lucide-style SVG icons only
- All interactive elements have cursor-pointer
- Hover transitions: 150ms ease-out
- No horizontal scroll
- Looks like premium SaaS ($500+/month software)
- Vietnamese text throughout (professional construction terminology)
```

---

## PHẦN 9: ACCESSIBILITY

| Yêu cầu | Giải pháp |
|---------|-----------|
| Color contrast ≥ 4.5:1 | `#F0F4FF` on `#141D35` = 12.5:1 ✓ |
| Focus visible | `outline: 3px solid rgba(0,212,170,0.5)` |
| Keyboard navigation | Tab order logical, all actions keyboard-accessible |
| Screen reader | ARIA labels cho icons, status badges, dynamic content |
| Reduced motion | `@media (prefers-reduced-motion: reduce)` — disable animations |
| Touch targets | Minimum 44×44px cho mobile |

---

## PHẦN 10: FILE NAMING CONVENTION

```
Components: PascalCase
  BIMViewer.tsx, DocumentTable.tsx, StatusBadge.tsx

Pages: camelCase (Next.js routing)
  app/dashboard/page.tsx
  app/documents/page.tsx
  app/viewer/[fileId]/page.tsx
  app/schedule/page.tsx
  app/gis/page.tsx

Styles: kebab-case
  globals.css, viewer.module.css

Assets: kebab-case
  logo-cic.svg, icon-ifc.svg

Types: PascalCase in /types/
  Document.ts, IFCModel.ts, Project.ts
```

---

*Tài liệu này dùng để input cho Claude Design / v0.dev / Figma AI để tạo mockup toàn bộ nền tảng CDE CIC. Version 1.0 — 08/06/2026.*
