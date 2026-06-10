import xlsx from 'xlsx';
const wb = xlsx.readFile('Docs/Định mức TT12-2021-BXD.xlsx');
const codeRe = /^[A-Z]{2}\.\d{4,6}$/;
const items = new Map();
let totalRows = 0;
for (const name of wb.SheetNames) {
  const rows = xlsx.utils.sheet_to_json(wb.Sheets[name], { header: 1, defval: '' });
  totalRows += rows.length;
  for (const r of rows) {
    const code = String(r[1] ?? '').trim();
    const ten = String(r[4] ?? '').trim();
    const dv = String(r[5] ?? '').trim();
    if (codeRe.test(code) && ten && !items.has(code)) {
      items.set(code, { code, name: ten.replace(/\s+/g, ' '), unit: dv || '', sheet: name });
    }
  }
}
console.log('Total rows scanned:', totalRows);
console.log('Distinct work items (công tác):', items.size);
const arr = [...items.values()];
console.log('Sample:');
arr.slice(0, 6).forEach(x => console.log(' ', x.code, '|', x.unit, '|', x.name.slice(0, 60)));
// distribution by sheet
const bySheet = {};
for (const x of arr) bySheet[x.sheet] = (bySheet[x.sheet]||0)+1;
console.log('By sheet:', JSON.stringify(bySheet));
