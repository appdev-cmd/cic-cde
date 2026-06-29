// Áp 2 migration mới (Trụ 2 + P3.1) lên Supabase production qua pooler.
// Idempotent (add column if not exists) — chạy lại nhiều lần an toàn.
import pg from 'pg';
import { readFileSync } from 'fs';
import { config } from 'dotenv';
config();

const pw = process.env.SUPABASE_DB_PASSWORD;
if (!pw) { console.error('Thiếu SUPABASE_DB_PASSWORD trong .env'); process.exit(1); }
const conn = `postgresql://postgres.shiqfawlgeintqsibqmk:${encodeURIComponent(pw)}@aws-1-ap-northeast-1.pooler.supabase.com:5432/postgres`;

const files = [
  'supabase/migrations/20260628050000_documents_frag_status.sql',
  'supabase/migrations/20260628060000_viewpoints_element_level.sql',
];

const client = new pg.Client({ connectionString: conn, ssl: { rejectUnauthorized: false } });
await client.connect();
console.log('Connected.');
for (const f of files) {
  const sql = readFileSync(f, 'utf8');
  await client.query(sql);
  console.log('✔ applied', f);
}
// Xác minh cột đã tồn tại
const cols = await client.query(`
  select table_name, column_name from information_schema.columns
  where table_schema='public'
    and ((table_name='documents' and column_name in ('frag_status','frag_error'))
      or (table_name='viewpoints' and column_name in ('hidden_elements','clipping')))
  order by table_name, column_name`);
console.log('Cột mới:', cols.rows.map(r => `${r.table_name}.${r.column_name}`).join(', '));
await client.end();
