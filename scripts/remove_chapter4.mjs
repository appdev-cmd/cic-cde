import fs from 'fs';
import path from 'path';

const v1Path = path.resolve('Docs/nghien-cuu-kha-thi/bao-cao-nghien-cuu-kha-thi-cde-cic.v1.md');
const mainPath = path.resolve('Docs/nghien-cuu-kha-thi/bao-cao-nghien-cuu-kha-thi-cde-cic.md');

if (!fs.existsSync(v1Path)) {
  console.error("Error: v1 report file not found!");
  process.exit(1);
}

let content = fs.readFileSync(v1Path, 'utf8');

// Find Chapter 4 and Chapter 5 indices
const ch4Header = '## Chương 4: Đề xuất Kiến trúc & Giải pháp Công nghệ (CDE CIC Technical Proposal)';
const ch5Header = '## Chương 5: Kế hoạch Nhân sự & Mô hình R&D Tinh gọn phối hợp AI (Lean R&D & Operations Model)';

const ch4Idx = content.indexOf(ch4Header);
const ch5Idx = content.indexOf(ch5Header);

if (ch4Idx === -1 || ch5Idx === -1) {
  console.error(`Error: Could not find chapter headings! ch4Idx=${ch4Idx}, ch5Idx=${ch5Idx}`);
  process.exit(1);
}

console.log(`Removing Chapter 4 (from index ${ch4Idx} to ${ch5Idx})`);

// Keep content before Ch 4, and content starting from Ch 5
const beforeCh4 = content.slice(0, ch4Idx);
let remaining = content.slice(ch5Idx);

// Apply renumbering to the remaining content
console.log("Renumbering chapters...");
remaining = remaining
  .replace(/## Chương 5:/g, '## Chương 4:')
  .replace(/## Chương 6:/g, '## Chương 5:')
  .replace(/## Chương 7:/g, '## Chương 6:')
  .replace(/## Chương 8:/g, '## Chương 7:');

console.log("Renumbering sections...");
// Sections renumbering (e.g. 5.1 -> 4.1, 6.2 -> 5.2, etc.)
const sectionReplacements = [
  // Chapter 5 -> 4
  { from: /### 5\.1\./g, to: '### 4.1.' },
  { from: /### 5\.2\./g, to: '### 4.2.' },
  { from: /### 5\.3\./g, to: '### 4.3.' },
  { from: /##### Bảng 5\.2/g, to: '##### Bảng 4.2' }, // inside R&D staff table headings
  { from: /Bảng 5\.2/g, to: 'Bảng 4.2' },
  { from: /mục 5\.2/g, to: 'mục 4.2' },
  { from: /mục 5\.3/g, to: 'mục 4.3' },
  
  // Chapter 6 -> 5
  { from: /### 6\.1\./g, to: '### 5.1.' },
  { from: /#### 6\.1\.1\./g, to: '#### 5.1.1.' },
  { from: /#### 6\.1\.2\./g, to: '#### 5.1.2.' },
  { from: /### 6\.2\./g, to: '### 5.2.' },
  { from: /#### 6\.2\.1\./g, to: '#### 5.2.1.' },
  { from: /#### 6\.2\.2\./g, to: '#### 5.2.2.' },
  { from: /#### 6\.2\.3\./g, to: '#### 5.2.3.' },
  { from: /### 6\.3\./g, to: '### 5.3.' },
  { from: /### 6\.4\./g, to: '### 5.4.' },
  { from: /### 6\.5\./g, to: '### 5.5.' },
  { from: /#### 6\.5\.1\./g, to: '#### 5.5.1.' },
  { from: /#### 6\.5\.2\./g, to: '#### 5.5.2.' },
  { from: /#### 6\.5\.3\./g, to: '#### 5.5.3.' },
  { from: /### 6\.5bis\./g, to: '### 5.5bis.' },
  { from: /#### Bảng 6\.5/g, to: '#### Bảng 5.5' },
  { from: /### 6\.6\./g, to: '### 5.6.' },
  
  // Chapter 7 -> 6
  { from: /### 7\.1\./g, to: '### 6.1.' },
  { from: /### 7\.2\./g, to: '### 6.2.' },
  { from: /#### 7\.2\.1\./g, to: '#### 6.2.1.' },
  { from: /#### 7\.2\.2\./g, to: '#### 6.2.2.' },
  
  // Chapter 8 -> 7
  { from: /### 8\.1\./g, to: '### 7.1.' },
  { from: /### 8\.2\./g, to: '### 7.2.' },
  { from: /### 8\.3\./g, to: '### 7.3.' }
];

for (const rep of sectionReplacements) {
  remaining = remaining.replace(rep.from, rep.to);
}

console.log("Renumbering tables...");
// Tables renumbering (e.g. Bảng 6.2a -> Bảng 5.2a)
const tableReplacements = [
  { from: /Bảng 6\.2a/g, to: 'Bảng 5.2a' },
  { from: /Bảng 6\.2a1/g, to: 'Bảng 5.2a1' },
  { from: /Bảng 6\.2a2/g, to: 'Bảng 5.2a2' },
  { from: /Bảng 6\.2a3/g, to: 'Bảng 5.2a3' },
  { from: /Bảng 6\.2b/g, to: 'Bảng 5.2b' },
  { from: /Bảng 6\.2c/g, to: 'Bảng 5.2c' },
  { from: /Bảng 6\.2c1/g, to: 'Bảng 5.2c1' },
  { from: /Bảng 6\.2d/g, to: 'Bảng 5.2d' },
  { from: /Bảng 6\.2e/g, to: 'Bảng 5.2e' },
  { from: /Bảng 6\.3a/g, to: 'Bảng 5.3a' },
  { from: /Bảng 6\.3b/g, to: 'Bảng 5.3b' },
  { from: /Bảng 6\.4a/g, to: 'Bảng 5.4a' },
  { from: /Bảng 6\.4b/g, to: 'Bảng 5.4b' },
  { from: /Bảng 6\.5\.1/g, to: 'Bảng 5.5.1' },
  { from: /Bảng 6\.5\.2/g, to: 'Bảng 5.5.2' },
  { from: /Bảng 6\.5bis-a/g, to: 'Bảng 5.5bis-a' },
  { from: /Bảng 6\.5bis-b/g, to: 'Bảng 5.5bis-b' },
  { from: /Bảng 6\.5bis-c/g, to: 'Bảng 5.5bis-c' },
  { from: /Bảng 6\.5bis-d/g, to: 'Bảng 5.5bis-d' },
  // General text references
  { from: /mục 6\.5bis/g, to: 'mục 5.5bis' },
  { from: /Mục 6\.5bis/g, to: 'Mục 5.5bis' },
  { from: /chương 6/g, to: 'chương 5' },
  { from: /Chương 6/g, to: 'Chương 5' }
];

for (const rep of tableReplacements) {
  remaining = remaining.replace(rep.from, rep.to);
}

const finalContent = beforeCh4 + remaining;
fs.writeFileSync(v1Path, finalContent, 'utf8');
fs.writeFileSync(mainPath, finalContent, 'utf8');

console.log("Successfully removed Chapter 4 and renumbered everything!");
