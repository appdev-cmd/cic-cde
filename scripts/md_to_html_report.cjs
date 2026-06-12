const fs = require('fs');
const path = require('path');
const { marked } = require('marked');

const mdPath = path.join(__dirname, '../Docs/bao_cao_nghien_cuu_kha_thi_cde_cic.md');
const outPath = path.join(__dirname, '../Docs/bao_cao_nghien_cuu_kha_thi_cde_cic_report.html');

const md = fs.readFileSync(mdPath, 'utf8');

// ── Build TOC from headings ──
const tocItems = [];
let headingCounter = 0;

const renderer = new marked.Renderer();
const origHeading = renderer.heading.bind(renderer);

renderer.heading = function({ text, depth }) {
  headingCounter++;
  const id = `heading-${headingCounter}`;
  const cleanText = text.replace(/<[^>]+>/g, '');
  if (depth >= 2 && depth <= 4) {
    tocItems.push({ id, text: cleanText, depth });
  }
  return `<h${depth} id="${id}">${text}</h${depth}>`;
};

// Keep mermaid code blocks as-is for client-side rendering
renderer.code = function({ text, lang }) {
  if (lang === 'mermaid') {
    return `<div class="mermaid">${text}</div>`;
  }
  const escaped = text.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
  return `<pre class="code-block"><code class="language-${lang || 'text'}">${escaped}</code></pre>`;
};

marked.setOptions({ renderer, gfm: true, breaks: false });

const bodyHtml = marked.parse(md);

// ── Build TOC HTML ──
let tocHtml = '<nav class="toc" id="toc"><div class="toc-title">📑 Mục lục</div><ul>';
tocItems.forEach(item => {
  const indent = item.depth - 2;
  tocHtml += `<li class="toc-level-${indent}"><a href="#${item.id}">${item.text}</a></li>`;
});
tocHtml += '</ul></nav>';

// ── Full HTML template ──
const html = `<!DOCTYPE html>
<html lang="vi">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>Báo cáo Nghiên cứu Khả thi Dự án CDE CIC</title>
<meta name="description" content="Đề án Nghiên cứu Công nghệ, Thiết kế Kiến trúc và Kế hoạch Thương mại hóa Nền tảng CDE - Công ty CIC">
<link rel="preconnect" href="https://fonts.googleapis.com">
<link href="https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700;800&family=JetBrains+Mono:wght@400;500&display=swap" rel="stylesheet">
<script src="https://cdn.jsdelivr.net/npm/mermaid@10/dist/mermaid.min.js"><\/script>
<style>
:root {
  --bg: #0f172a;
  --bg-card: #1e293b;
  --bg-surface: #334155;
  --text: #e2e8f0;
  --text-muted: #94a3b8;
  --text-heading: #f1f5f9;
  --accent: #06b6d4;
  --accent2: #10b981;
  --accent3: #8b5cf6;
  --border: #334155;
  --danger: #ef4444;
  --warning: #f59e0b;
}
*, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
html { scroll-behavior: smooth; font-size: 16px; }
body {
  font-family: 'Inter', -apple-system, sans-serif;
  background: var(--bg);
  color: var(--text);
  line-height: 1.75;
  min-height: 100vh;
  text-align: justify;
  word-break: break-word;
  hyphens: auto;
}

/* ── Cover Page ── */
.cover {
  min-height: 60vh;
  display: flex;
  flex-direction: column;
  justify-content: center;
  align-items: center;
  text-align: center;
  padding: 60px 40px;
  background: linear-gradient(135deg, #0f172a 0%, #1e293b 50%, #0f172a 100%);
  border-bottom: 3px solid var(--accent);
  position: relative;
}
.cover::before {
  content: '';
  position: absolute;
  top: 0; left: 0; right: 0; bottom: 0;
  background: radial-gradient(ellipse at 30% 50%, rgba(6,182,212,0.08) 0%, transparent 60%),
              radial-gradient(ellipse at 70% 50%, rgba(16,185,129,0.06) 0%, transparent 60%);
}
.cover > * { position: relative; z-index: 1; }
.cover .company { font-size: 0.85rem; font-weight: 600; color: var(--accent); letter-spacing: 3px; text-transform: uppercase; margin-bottom: 24px; }
.cover h1 { font-size: 2.5rem; font-weight: 800; color: var(--text-heading); margin-bottom: 16px; line-height: 1.2; max-width: 800px; }
.cover .subtitle { font-size: 1.1rem; color: var(--text-muted); max-width: 700px; margin-bottom: 32px; line-height: 1.6; }
.cover .meta { font-size: 0.85rem; color: var(--text-muted); }
.cover .meta strong { color: var(--accent2); }

/* ── Layout ── */
.page-wrapper {
  display: grid;
  grid-template-columns: 280px 1fr;
  max-width: 1500px;
  margin: 0 auto;
  min-height: 100vh;
}
.toc {
  position: sticky;
  top: 0;
  height: 100vh;
  overflow-y: auto;
  padding: 24px 16px;
  background: #0c1322;
  border-right: 1px solid var(--border);
  font-size: 0.78rem;
}
.toc-title {
  font-size: 0.9rem;
  font-weight: 700;
  color: var(--accent);
  margin-bottom: 16px;
  padding-bottom: 8px;
  border-bottom: 1px solid var(--border);
}
.toc ul { list-style: none; }
.toc li { margin-bottom: 2px; }
.toc li a {
  display: block;
  padding: 4px 8px;
  color: var(--text-muted);
  text-decoration: none;
  border-radius: 4px;
  transition: all 0.2s;
  border-left: 2px solid transparent;
}
.toc li a:hover { color: var(--accent); background: rgba(6,182,212,0.08); border-left-color: var(--accent); }
.toc .toc-level-0 a { font-weight: 600; color: var(--text); }
.toc .toc-level-1 a { padding-left: 20px; font-size: 0.74rem; }
.toc .toc-level-2 a { padding-left: 36px; font-size: 0.7rem; }

/* ── Main Content ── */
.content {
  padding: 40px 56px;
  max-width: 1100px;
  min-width: 0;
}
.content h1 { font-size: 2rem; font-weight: 800; color: var(--text-heading); margin: 48px 0 20px; padding-bottom: 12px; border-bottom: 2px solid var(--accent); text-align: left; }
.content h2 { font-size: 1.6rem; font-weight: 700; color: var(--accent); margin: 48px 0 16px; padding-bottom: 10px; border-bottom: 1px solid var(--border); text-align: left; }
.content h3 { font-size: 1.25rem; font-weight: 600; color: var(--accent2); margin: 36px 0 12px; text-align: left; }
.content h4 { font-size: 1.05rem; font-weight: 600; color: var(--accent3); margin: 28px 0 10px; text-align: left; }
.content h5 { font-size: 0.9rem; font-weight: 600; color: var(--warning); margin: 24px 0 8px; text-align: left; }
.content p { margin-bottom: 16px; }
.content ul, .content ol { margin: 12px 0 16px 24px; }
.content li { margin-bottom: 6px; }
.content strong { color: var(--text-heading); }
.content em { color: var(--text-muted); font-style: italic; }
.content a { color: var(--accent); text-decoration: none; border-bottom: 1px dotted var(--accent); }
.content a:hover { color: var(--accent2); }
.content hr { border: none; border-top: 1px solid var(--border); margin: 40px 0; }
.content blockquote {
  border-left: 4px solid var(--accent);
  background: rgba(6,182,212,0.06);
  padding: 12px 20px;
  margin: 16px 0;
  border-radius: 0 8px 8px 0;
  color: var(--text-muted);
}

/* ── Tables ── */
.content table {
  width: 100%;
  border-collapse: collapse;
  margin: 16px 0 24px;
  font-size: 0.75rem;
  table-layout: auto;
}
.content thead { position: sticky; top: 0; }
.content th {
  background: var(--accent);
  color: #0f172a;
  font-weight: 600;
  padding: 8px 10px;
  text-align: left;
  white-space: normal;
  border: 1px solid rgba(6,182,212,0.3);
  word-break: break-word;
}
.content td {
  padding: 6px 10px;
  border: 1px solid var(--border);
  vertical-align: top;
  word-break: break-word;
}
.content tbody tr:nth-child(even) { background: rgba(30,41,59,0.5); }
.content tbody tr:nth-child(odd) { background: rgba(15,23,42,0.8); }
.content tbody tr:hover { background: rgba(6,182,212,0.08); }

/* ── Code Blocks ── */
.code-block {
  background: #020617;
  border: 1px solid var(--border);
  border-radius: 8px;
  padding: 16px 20px;
  margin: 16px 0;
  overflow-x: auto;
  font-family: 'JetBrains Mono', monospace;
  font-size: 0.8rem;
  line-height: 1.6;
  color: #a5b4fc;
}
.content code {
  font-family: 'JetBrains Mono', monospace;
  background: rgba(139,92,246,0.12);
  padding: 2px 6px;
  border-radius: 4px;
  font-size: 0.85em;
  color: var(--accent3);
}
.code-block code { background: none; padding: 0; color: inherit; }

/* ── Mermaid ── */
.mermaid {
  background: rgba(30,41,59,0.5);
  border: 1px solid var(--border);
  border-radius: 8px;
  padding: 20px;
  margin: 16px 0;
  text-align: center;
}

/* ── Back to Top ── */
.back-top {
  position: fixed;
  bottom: 24px;
  right: 24px;
  width: 44px;
  height: 44px;
  background: var(--accent);
  color: #0f172a;
  border: none;
  border-radius: 50%;
  cursor: pointer;
  font-size: 1.2rem;
  display: flex;
  align-items: center;
  justify-content: center;
  box-shadow: 0 4px 16px rgba(6,182,212,0.3);
  transition: all 0.3s;
  z-index: 100;
}
.back-top:hover { transform: translateY(-2px); box-shadow: 0 6px 20px rgba(6,182,212,0.5); }

/* ── Mobile ── */
@media (max-width: 900px) {
  .page-wrapper { grid-template-columns: 1fr; }
  .toc { position: relative; height: auto; max-height: 50vh; }
  .content { padding: 24px 20px; }
  .cover h1 { font-size: 1.6rem; }
}

/* ── Print ── */
@media print {
  body { background: #fff; color: #1a1a1a; font-size: 11pt; }
  .cover { min-height: auto; padding: 40px; border-bottom: 2px solid #06b6d4; background: #fff; }
  .cover::before { display: none; }
  .cover h1 { color: #0f172a; font-size: 1.8rem; }
  .cover .company, .cover .subtitle, .cover .meta { color: #555; }
  .toc { display: none; }
  .page-wrapper { display: block; }
  .content { padding: 20px 0; max-width: 100%; }
  .content h2 { color: #06b6d4; page-break-after: avoid; }
  .content h3, .content h4 { page-break-after: avoid; }
  .content table { font-size: 9pt; }
  .content th { background: #e2e8f0; color: #0f172a; }
  .content td { border-color: #ccc; }
  .content tbody tr { background: #fff !important; }
  .content tbody tr:nth-child(even) { background: #f8f9fa !important; }
  .back-top { display: none; }
  .code-block { background: #f5f5f5; color: #333; border-color: #ddd; }
  .mermaid { background: #fff; border-color: #ddd; }
}
</style>
</head>
<body>

<!-- Cover Page -->
<div class="cover">
  <div class="company">Công ty Cổ phần Công nghệ và Tư vấn CIC</div>
  <h1>Báo cáo Nghiên cứu Khả thi Dự án CDE CIC</h1>
  <div class="subtitle">Đề án Nghiên cứu Công nghệ, Thiết kế Kiến trúc và Kế hoạch Thương mại hóa Nền tảng CDE (Common Data Environment)</div>
  <div class="meta"><strong>Ngày lập:</strong> 08/06/2026 &nbsp;|&nbsp; <strong>Phiên bản:</strong> v1.0 &nbsp;|&nbsp; <strong>Bảo mật:</strong> Nội bộ</div>
</div>

<!-- Main Layout -->
<div class="page-wrapper">
  ${tocHtml}
  <main class="content">
    ${bodyHtml}
  </main>
</div>

<!-- Back to Top -->
<button class="back-top" onclick="window.scrollTo({top:0,behavior:'smooth'})" title="Lên đầu trang">↑</button>

<script>
mermaid.initialize({ startOnLoad: true, theme: 'dark', securityLevel: 'loose' });
</script>
</body>
</html>`;

fs.writeFileSync(outPath, html, 'utf8');
console.log(`✅ Generated: ${outPath}`);
console.log(`   Size: ${(Buffer.byteLength(html) / 1024).toFixed(1)} KB`);
console.log(`   TOC items: ${tocItems.length}`);
