import fs from 'fs';
import path from 'path';

const files = [
  'Docs/nghien-cuu-kha-thi/bao-cao-nghien-cuu-kha-thi-cde-cic.v1.md',
  'Docs/nghien-cuu-kha-thi/bao-cao-nghien-cuu-kha-thi-cde-cic.md'
];

for (const file of files) {
  const filePath = path.resolve(file);
  if (fs.existsSync(filePath)) {
    console.log(`Processing: ${file}`);
    let content = fs.readFileSync(filePath, 'utf8');
    // Replace &amp; with &
    content = content.replace(/&amp;/g, '&');
    fs.writeFileSync(filePath, content, 'utf8');
    console.log(`Fixed: ${file}`);
  }
}
