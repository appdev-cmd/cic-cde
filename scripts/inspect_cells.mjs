import XLSX from 'xlsx';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const file = path.join(__dirname, '../Docs/kinh-doanh-tai-chinh/ke-hoach-tai-chinh-cde-cic-mo-hinh-dong.xlsx');
const workbook = XLSX.readFile(file);

const sheet = workbook.Sheets['Doanh_Thu'];
console.log('Doanh_Thu Cell keys:', Object.keys(sheet).filter(k => !k.startsWith('!')));

for (let r = 1; r <= 35; r++) {
  let rowStr = `Row ${r}: `;
  for (let c = 0; c < 10; c++) {
    const colName = XLSX.utils.encode_col(c);
    const cellRef = `${colName}${r}`;
    const cell = sheet[cellRef];
    if (cell) {
      rowStr += `[${cellRef}] ${cell.v} | `;
    }
  }
  console.log(rowStr);
}
