import XLSX from 'xlsx';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const file = path.join(__dirname, '../Docs/kinh-doanh-tai-chinh/ke-hoach-tai-chinh-cde-cic-mo-hinh-dong.xlsx');
const workbook = XLSX.readFile(file);

function printRows(sheetName, range) {
  const sheet = workbook.Sheets[sheetName];
  const data = XLSX.utils.sheet_to_json(sheet, { header: 1 });
  console.log(`\n--- ${sheetName} ---`);
  range.forEach(rowIdx => {
    if (data[rowIdx]) {
      console.log(`${String(rowIdx).padStart(2, '0')}:`, data[rowIdx].map(v => typeof v === 'number' ? v.toLocaleString('en-US') : v));
    }
  });
}

printRows('Dau_Tu', [0, 4, 5, 6, 7, 8, 9, 10, 11]);
printRows('OPEX', [0, 4, 5, 6, 7]);
printRows('P_and_L', [0, 4, 5, 6, 7, 8, 9]);
printRows('NPV_IRR', [0, 4, 5, 8, 9, 10, 11, 12, 13]);
printRows('Do_Nhay', [0, 4, 5, 6, 7, 10, 11, 12, 13]);
