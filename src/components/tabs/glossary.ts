// ============================================================================
// Thuật ngữ công nghệ — nguồn dữ liệu cho tooltip giải thích khi rê chuột.
// Thay thế cho Phụ lục "Giải thích Thuật ngữ" trước đây.
// ============================================================================

export const GLOSSARY: Record<string, string> = {
  // A. Kiến trúc & Mô hình phát triển
  'Microservices': 'Kiến trúc vi dịch vụ — chia ứng dụng thành các dịch vụ độc lập giao tiếp qua API, giúp dễ nâng cấp và mở rộng linh hoạt.',
  'SaaS': 'Software as a Service — phần mềm cung cấp trực tuyến, người dùng trả phí định kỳ thay vì cài đặt trên máy chủ riêng.',
  'On-Premise': 'Mô hình cài đặt và vận hành phần mềm trực tiếp trên hạ tầng máy chủ riêng của đơn vị sử dụng.',
  'gRPC': 'Giao thức truyền tin hiệu năng cao của Google dùng định dạng nhị phân (Protocol Buffers), nhanh gấp 5-10 lần REST API truyền thống.',
  'OpenBIM': 'Hướng tiếp cận BIM dùng định dạng mở (IFC), không phụ thuộc phần mềm độc quyền của một hãng.',
  'QTO': 'Quantity Take-Off — bóc tách khối lượng tự động từ mô hình BIM phục vụ lập dự toán, quản lý chi phí.',

  // B. Ngôn ngữ & Framework
  'Golang': 'Ngôn ngữ lập trình của Google, nổi bật về hiệu năng xử lý song song, khởi động nhanh và tiêu tốn cực ít tài nguyên máy chủ.',
  'Python': 'Ngôn ngữ cú pháp ngắn gọn, hệ sinh thái thư viện khoa học dữ liệu, hình học 3D và AI/ML phong phú nhất thế giới.',
  'TypeScript': 'Bản nâng cấp của JavaScript, bổ sung kiểm soát kiểu dữ liệu nghiêm ngặt giúp giảm lỗi trong ứng dụng lớn.',
  'Next.js': 'Framework web hiện đại xây trên React, tối ưu hiển thị phía máy chủ giúp tải nhanh và đạt điểm SEO cao.',
  'FastAPI': 'Thư viện Python hiệu năng cao để xây dựng API, tự động tạo tài liệu hướng dẫn sử dụng.',

  // C. BIM, 3D & Đồ họa
  'IFC': 'Industry Foundation Classes — định dạng dữ liệu mở tiêu chuẩn quốc tế để trao đổi mô hình BIM giữa các phần mềm mà không mất thuộc tính.',
  'WebGPU': 'Chuẩn đồ họa web thế hệ mới, truy cập trực tiếp phần cứng GPU để hiển thị hàng triệu đa giác mượt hơn WebGL.',
  'WebGL': 'Chuẩn công nghệ cho phép trình duyệt hiển thị đồ họa 3D tương tác mà không cần cài thêm phần mềm.',
  'ThatOpen Engine': 'Bộ công cụ mã nguồn mở (C++/WebAssembly) đọc và dựng hình file IFC trực tiếp trên trình duyệt với tốc độ cao.',
  'IfcOpenShell': 'Thư viện mã nguồn mở phân tích cấu trúc hình học và truy vấn dữ liệu bên trong tệp IFC ở phía máy chủ.',
  'BCF': 'BIM Collaboration Format — định dạng mở để trao đổi ghi chú, lỗi thiết kế trực tiếp trên mô hình BIM giữa các phần mềm.',
  '3D Tiles': 'Tiêu chuẩn mở của OGC để truyền và hiển thị dữ liệu địa lý 3D khối lượng lớn trên web theo cơ chế phân tầng (streaming).',
  'Cesium.js': 'Thư viện JavaScript mã nguồn mở hàng đầu để hiển thị bản đồ địa lý 3D tương tác hiệu năng cao trên trình duyệt.',
  'PostGIS': 'Tiện ích mở rộng của PostgreSQL bổ sung khả năng lưu trữ, xử lý và truy vấn dữ liệu không gian địa lý (GIS).',
  'VN-2000': 'Hệ tọa độ bản đồ quốc gia của Việt Nam, bắt buộc cho mọi dự án đầu tư công và đo đạc địa lý tại Việt Nam.',
  'WGS84': 'Hệ tọa độ địa lý toàn cầu chuẩn quốc tế, nền tảng cho GPS và hầu hết bản đồ trực tuyến.',
  'Vmap': 'Nền tảng bản đồ số chính thức của Cục Đo đạc, Bản đồ và Thông tin địa lý Việt Nam, dữ liệu lưu trữ 100% trong nước.',

  // D. Hạ tầng & DevOps
  'Kubernetes': 'Hệ thống mã nguồn mở tự động hóa triển khai, mở rộng quy mô và quản lý các ứng dụng đóng gói trong container.',
  'Object Storage': 'Mô hình lưu trữ dữ liệu dạng đối tượng (phù hợp file BIM dung lượng lớn), khả năng mở rộng dung lượng gần như vô hạn.',
  'Disaster Recovery': 'Tập hợp quy trình kỹ thuật bảo đảm hệ thống khôi phục và hoạt động tại hạ tầng khác khi hạ tầng chính gặp sự cố nghiêm trọng.',
  'Air-gap': 'Phương pháp bảo mật bằng cách ngắt kết nối mạng vật lý hoàn toàn với máy chủ sao lưu, tránh nguy cơ mã độc tống tiền tấn công từ xa.',
  'WORM': 'Write Once Read Many — cơ chế lưu trữ chỉ ghi một lần, không thể sửa/xóa, dùng bảo vệ nhật ký kiểm toán bất biến.',

  // E. An ninh mạng & An toàn thông tin
  'QCVN 12': 'Quy chuẩn kỹ thuật quốc gia về an ninh mạng cho hệ thống lưu trữ tài liệu điện tử trong cơ quan Đảng, Nhà nước (Bộ Công an, hiệu lực 01/7/2026).',
  'SIEM': 'Security Information and Event Management — hệ thống giám sát an ninh tập trung, thu thập nhật ký để phát hiện và cảnh báo sớm tấn công mạng.',
  'MFA': 'Xác thực đa nhân tố — yêu cầu từ hai bằng chứng xác thực trở lên (vd mật khẩu + OTP) mới cho phép truy cập.',
  'VNeID': 'Ứng dụng định danh điện tử quốc gia của Việt Nam, dùng cho đăng nhập một lần (SSO) định danh công vụ.',
  'Keycloak': 'Giải pháp mã nguồn mở hàng đầu để quản lý định danh và phân quyền, hỗ trợ đầy đủ các giao thức bảo mật hiện đại.',
  'Pentest': 'Kiểm thử xâm nhập — chuyên gia bảo mật giả lập tấn công thực tế nhằm tìm và khắc phục lỗ hổng trước khi bị khai thác.',
  'ISO 19650': 'Bộ tiêu chuẩn quốc tế về quản lý thông tin theo BIM, định nghĩa 4 trạng thái dữ liệu WIP–Shared–Published–Archived.',
  'NDXP': 'Nền tảng tích hợp, chia sẻ dữ liệu quốc gia (National Data eXchange Platform) — trục liên thông dữ liệu giữa các cơ quan nhà nước.',
  'LGSP': 'Nền tảng tích hợp, chia sẻ dữ liệu cấp bộ/tỉnh (Local Government Service Platform), kết nối với trục NDXP quốc gia.',
};

const escapeRe = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

const escapeHtml = (s: string) =>
  s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

function buildTip(matched: string, def: string): string {
  return (
    `<span class="relative inline group/gl">` +
    `<span class="border-b border-dotted border-primary/60 text-primary cursor-help">${matched}</span>` +
    `<span class="pointer-events-none absolute left-0 bottom-full mb-1.5 z-50 hidden group-hover/gl:block w-72 bg-inverse-surface text-inverse-on-surface text-[11px] not-italic font-normal leading-relaxed rounded-lg px-3 py-2 shadow-xl whitespace-normal text-left">${escapeHtml(def)}</span>` +
    `</span>`
  );
}

// Bọc thuật ngữ bằng tooltip — CHỈ lần xuất hiện đầu tiên (qua Set `used` dùng chung toàn báo cáo).
// An toàn: chỉ xử lý phần text NGOÀI các thẻ HTML (tách theo /<[^>]+>/), không đụng class/thuộc tính.
export function wrapGlossaryTerms(html: string, used: Set<string>): string {
  const terms = Object.keys(GLOSSARY).sort((a, b) => b.length - a.length);
  if (terms.every(t => used.has(t))) return html;

  const segments = html.split(/(<[^>]+>)/);
  for (let i = 0; i < segments.length; i++) {
    const seg = segments[i];
    if (!seg || seg.startsWith('<')) continue; // bỏ qua thẻ HTML

    // Tìm vị trí khớp đầu tiên của các thuật ngữ chưa dùng trong đoạn text này
    const hits: { start: number; end: number; term: string; text: string }[] = [];
    for (const term of terms) {
      if (used.has(term)) continue;
      const re = new RegExp(`(?<![\\p{L}\\p{N}_])${escapeRe(term)}(?![\\p{L}\\p{N}_])`, 'u');
      const m = re.exec(seg);
      if (m) hits.push({ start: m.index, end: m.index + m[0].length, term, text: m[0] });
    }
    if (hits.length === 0) continue;

    // Chèn từ trái sang phải, không chồng lấn, đánh dấu đã dùng
    hits.sort((a, b) => a.start - b.start);
    let out = '';
    let pos = 0;
    for (const h of hits) {
      if (h.start < pos || used.has(h.term)) continue;
      out += seg.slice(pos, h.start) + buildTip(h.text, GLOSSARY[h.term]);
      used.add(h.term);
      pos = h.end;
    }
    out += seg.slice(pos);
    segments[i] = out;
  }
  return segments.join('');
}
