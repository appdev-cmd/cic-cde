import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const mdPath = path.resolve(__dirname, '../Docs/nghien-cuu-kha-thi/bao-cao-nghien-cuu-kha-thi-cde-cic.md');
console.log('Reading report:', mdPath);

let content = fs.readFileSync(mdPath, 'utf8');

// List of table headers to wrap
const targets = [
  { id: '6_2A', header: '##### Bảng 5.2a: Phân bổ Chi tiết CAPEX theo năm và danh mục đầu tư (tỷ VNĐ)' },
  { id: '6_2C', header: '##### Bảng 5.2c: Tổng hợp Chi phí Vận hành OPEX 5 năm (tỷ VNĐ)' },
  { id: '6_4A', header: '##### Bảng 5.4a: Khối lượng Khách hàng Mục tiêu phát triển qua các năm' },
  { id: '6_4B', header: '##### Bảng 5.4b: Chi tiết tính toán kế hoạch doanh thu theo từng kênh (tỷ VNĐ)' },
  { id: '6_5_1', header: '#### 5.5.1. Bảng dòng tiền ròng của toàn bộ dự án CDE CIC (tỷ VNĐ)' },
  { id: '6_5_2', header: '#### 5.5.2. Bảng dòng tiền ròng của riêng chủ đầu tư CIC (tỷ VNĐ)' },
  { id: '6_5BIS_B', header: '##### Bảng 5.5bis-b: Chi tiết doanh thu theo kịch bản (tỷ VNĐ)' },
  { id: '6_5BIS_C', header: '##### Bảng 5.5bis-c: Dòng tiền ròng tích lũy theo kịch bản (tỷ VNĐ)' },
  { id: '6_5BIS_D', header: '##### Bảng 5.5bis-d: Chỉ số tài chính cốt lõi theo kịch bản (WACC = 12%)' }
];

let modified = false;

for (const t of targets) {
  const startComment = `<!-- TABLE_${t.id}_START -->`;
  const endComment = `<!-- TABLE_${t.id}_END -->`;
  
  if (content.includes(startComment)) {
    console.log(`Table ${t.id} is already wrapped.`);
    continue;
  }
  
  const headerIdx = content.indexOf(t.header);
  if (headerIdx === -1) {
    console.error(`ERROR: Header not found for ${t.id}: "${t.header}"`);
    continue;
  }
  
  // Find where table starts (first '|' after header)
  let searchStart = headerIdx + t.header.length;
  let firstPipeIdx = content.indexOf('|', searchStart);
  if (firstPipeIdx === -1) {
    console.error(`ERROR: No table found after header for ${t.id}`);
    continue;
  }
  
  // Backtrack to the start of the line containing the first pipe
  let lineStartIdx = content.lastIndexOf('\n', firstPipeIdx) + 1;
  
  // Find where the table ends (first line that does NOT start with '|' after firstPipeIdx)
  let searchEnd = firstPipeIdx;
  let nextLineIdx = content.indexOf('\n', searchEnd);
  let tableEndIdx = nextLineIdx;
  
  while (nextLineIdx !== -1) {
    let checkStart = nextLineIdx + 1;
    let nextNewLine = content.indexOf('\n', checkStart);
    let line = nextNewLine === -1 ? content.slice(checkStart) : content.slice(checkStart, nextNewLine);
    let trimmed = line.trim();
    if (trimmed.startsWith('|')) {
      tableEndIdx = nextNewLine === -1 ? content.length : nextNewLine;
      nextLineIdx = nextNewLine;
    } else {
      break;
    }
  }
  
  console.log(`Wrapping table ${t.id} from index ${lineStartIdx} to ${tableEndIdx}`);
  
  const beforeTable = content.slice(0, lineStartIdx);
  const tableContent = content.slice(lineStartIdx, tableEndIdx);
  const afterTable = content.slice(tableEndIdx);
  
  content = beforeTable + startComment + '\n' + tableContent + '\n' + endComment + afterTable;
  modified = true;
}

if (modified) {
  fs.writeFileSync(mdPath, content, 'utf8');
  console.log('Markdown successfully prepared with comment tags!');
} else {
  console.log('No modifications needed.');
}
