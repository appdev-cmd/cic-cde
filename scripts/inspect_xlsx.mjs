import XLSX from 'xlsx';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const file = path.join(__dirname, '../Docs/kinh-doanh-tai-chinh/ke-hoach-tai-chinh-cde-cic-mo-hinh-dong.xlsx');
const workbook = XLSX.readFile(file);

function printSheet(sheetName, maxRows = 100) {
  const sheet = workbook.Sheets[sheetName];
  const data = XLSX.utils.sheet_to_json(sheet, { header: 1 });
  console.log(`\n=========================================`);
  console.log(`--- SHEET: ${sheetName} (Rows: ${data.length}) ---`);
  console.log(`=========================================`);
  data.slice(0, maxRows).forEach((row, i) => {
    console.log(`${String(i).padStart(2, '0')}:`, row.map(v => {
      if (typeof v === 'number') {
        return v.toLocaleString('en-US', { maximumFractionDigits: 4 });
      }
      return v;
    }));
  });
}

printSheet('Nhan_Su', 46);
printSheet('Dau_Tu', 12);
printSheet('OPEX', 8);
printSheet('P_and_L', 10);
printSheet('Dong_Tien', 10);
printSheet('NPV_IRR', 14);
printSheet('Do_Nhay', 14);
