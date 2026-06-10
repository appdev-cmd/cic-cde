import pg from 'pg'; import { config } from 'dotenv'; config();
const c=new pg.Client({connectionString:`postgresql://postgres.shiqfawlgeintqsibqmk:${encodeURIComponent(process.env.SUPABASE_DB_PASSWORD)}@aws-1-ap-northeast-1.pooler.supabase.com:5432/postgres`,ssl:{rejectUnauthorized:false}});
await c.connect();
await c.query("update storage.buckets set file_size_limit=524288000 where id='cde-files'");
const r=await c.query("select id,file_size_limit from storage.buckets where id='cde-files'");
console.log('bucket:', JSON.stringify(r.rows[0]));
await c.end();
