import pg from 'pg';
import { readFileSync } from 'fs';
import { config } from 'dotenv';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
config({ path: join(__dirname, '../.env') });

const pw = process.env.SUPABASE_DB_PASSWORD;
if (!pw) {
  console.error('Missing SUPABASE_DB_PASSWORD in .env');
  process.exit(1);
}

const conn = `postgresql://postgres.shiqfawlgeintqsibqmk:${encodeURIComponent(pw)}@aws-1-ap-northeast-1.pooler.supabase.com:5432/postgres`;
const sql = readFileSync(join(__dirname, '../supabase/migrations/20260626010000_create_legal_documents.sql'), 'utf8');

const client = new pg.Client({ connectionString: conn, ssl: { rejectUnauthorized: false } });

async function run() {
  console.log('Connecting to Supabase PostgreSQL pooler...');
  await client.connect();
  console.log('Connected. Applying migration 20260626010000_create_legal_documents.sql...');
  await client.query(sql);
  console.log('Migration applied OK.');
  await client.end();
}

run().catch(err => {
  console.error('Failed to apply migration:', err);
  process.exit(1);
});
