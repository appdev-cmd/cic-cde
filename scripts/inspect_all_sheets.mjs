import XLSX from 'xlsx';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const file = path.join(__dirname, '../Docs/kinh-doanh-tai-chinh/260616-BoM-CIC-v1 (1).xlsx');
const workbook = XLSX.readFile(file);

for (const name of workbook.SheetNames) {
  const sheet = workbook.Sheets[name];
  const keys = Object.keys(sheet).filter(k => !k.startsWith('!'));
  const numberCells = keys.filter(k => sheet[k].t === 'n');
  const formulaCells = keys.filter(k => sheet[k].f);
  console.log(`Sheet: ${name} | Total Cells: ${keys.length} | Number Cells: ${numberCells.length} | Formula Cells: ${formulaCells.length}`);
  if (numberCells.length > 0) {
    console.log(`  Example Number Cells: ${numberCells.slice(0, 5).map(k => `${k}: ${sheet[k].v}`).join(', ')}`);
  }
}
