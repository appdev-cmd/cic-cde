import xlsx from 'xlsx'; import pg from 'pg'; import { config } from 'dotenv'; config();
const wb = xlsx.readFile('Docs/Định mức TT12-2021-BXD.xlsx');
const codeRe = /^[A-Z]{2}\.\d{4,6}$/;
const items = new Map();
for (const name of wb.SheetNames) {
  const rows = xlsx.utils.sheet_to_json(wb.Sheets[name], { header: 1, defval: '' });
  for (const r of rows) {
    const code = String(r[1] ?? '').trim();
    const ten = String(r[4] ?? '').trim();
    const dv = String(r[5] ?? '').trim();
    if (codeRe.test(code) && ten && !items.has(code))
      items.set(code, { code, name: ten.replace(/\s+/g, ' ').slice(0, 500), unit: (dv || 'm3').slice(0, 30) });
  }
}
const arr = [...items.values()];
const c = new pg.Client({ connectionString:`postgresql://postgres.shiqfawlgeintqsibqmk:${encodeURIComponent(process.env.SUPABASE_DB_PASSWORD)}@aws-1-ap-northeast-1.pooler.supabase.com:5432/postgres`, ssl:{rejectUnauthorized:false} });
await c.connect();
await c.query('truncate table public.cost_norms');
const BATCH = 500;
for (let i = 0; i < arr.length; i += BATCH) {
  const slice = arr.slice(i, i + BATCH);
  const vals = []; const ph = [];
  slice.forEach((x, j) => { const b = j*3; ph.push(`($${b+1},$${b+2},$${b+3})`); vals.push(x.code, x.name, x.unit); });
  await c.query(`insert into public.cost_norms (code,name,unit) values ${ph.join(',')}`, vals);
}
const r = await c.query('select count(*) from public.cost_norms');
console.log('Imported cost_norms:', r.rows[0].count);
await c.end();
