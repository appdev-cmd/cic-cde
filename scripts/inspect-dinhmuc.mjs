import xlsx from 'xlsx';
const wb = xlsx.readFile('Docs/Định mức TT12-2021-BXD.xlsx');
console.log('Sheets:', wb.SheetNames.join(' | '));
for (const name of wb.SheetNames.slice(0, 3)) {
  const ws = wb.Sheets[name];
  const rows = xlsx.utils.sheet_to_json(ws, { header: 1, defval: '' });
  console.log(`\n=== Sheet "${name}" (${rows.length} rows) — 8 dòng đầu ===`);
  rows.slice(0, 8).forEach((r, i) => console.log(i, JSON.stringify(r.slice(0, 10))));
}
