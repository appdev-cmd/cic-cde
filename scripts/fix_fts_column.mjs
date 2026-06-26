import pg from 'pg';
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
const client = new pg.Client({ connectionString: conn, ssl: { rejectUnauthorized: false } });

async function run() {
  console.log('Connecting to database...');
  await client.connect();
  console.log('Connected. Altering fts column to use substring...');
  
  await client.query('ALTER TABLE public.legal_articles DROP COLUMN IF EXISTS fts');
  console.log('Dropped old fts column.');
  
  await client.query(`
    ALTER TABLE public.legal_articles ADD COLUMN fts tsvector 
      GENERATED ALWAYS AS (to_tsvector('simple', coalesce(title,'') || ' ' || coalesce(summary,'') || ' ' || coalesce(substring(content from 1 for 100000),''))) STORED
  `);
  console.log('Added new fts column with substring protection.');
  
  await client.query('CREATE INDEX IF NOT EXISTS idx_legal_articles_fts ON public.legal_articles USING GIN(fts)');
  console.log('Re-created fts index.');
  
  await client.end();
  console.log('Successfully altered FTS column!');
}

run().catch(err => {
  console.error('Failed to alter FTS column:', err);
  if (client) client.end();
  process.exit(1);
});
