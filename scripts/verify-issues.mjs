import pg from 'pg';
import { config } from 'dotenv';
config();
const pw = process.env.SUPABASE_DB_PASSWORD;
const conn = `postgresql://postgres.shiqfawlgeintqsibqmk:${encodeURIComponent(pw)}@aws-1-ap-northeast-1.pooler.supabase.com:5432/postgres`;
const c = new pg.Client({ connectionString: conn, ssl: { rejectUnauthorized: false } });
await c.connect();
let pass = 0, fail = 0;
const ok = (n, cond) => { if (cond) { pass++; console.log('  PASS', n); } else { fail++; console.log('  FAIL', n); } };

// 1) advanced columns exist
const cols = await c.query(`select column_name from information_schema.columns where table_name='bcf_topics'`);
const set = new Set(cols.rows.map(r => r.column_name));
ok('bcf_topics.due_date', set.has('due_date'));
ok('bcf_topics.labels', set.has('labels'));
ok('bcf_topics.author', set.has('author'));

// 2) bcf_comments table + columns
const cc = await c.query(`select column_name from information_schema.columns where table_name='bcf_comments'`);
const cset = new Set(cc.rows.map(r => r.column_name));
ok('bcf_comments exists', cc.rows.length > 0);
['topic_id','project_id','author','body','comment_type','created_at'].forEach(col => ok('bcf_comments.'+col, cset.has(col)));

// 3) functional: create topic w/ advanced fields, comment, cascade delete
const pidR = await c.query(`select id from projects limit 1`);
const pid = pidR.rows[0].id;
const t = await c.query(
  `insert into bcf_topics (project_id,title,description,status,priority,topic_type,assigned_to,author,due_date,labels)
   values ($1,'__verify__','d','Open','High','Issue','Chưa giao','tester','2026-07-01','["urgent","mep"]'::jsonb) returning id`, [pid]);
const tid = t.rows[0].id;
ok('insert topic w/ labels+due', !!tid);
const cm = await c.query(
  `insert into bcf_comments (topic_id,project_id,author,body,comment_type) values ($1,$2,'tester','hello','comment') returning id`, [tid, pid]);
ok('insert comment', cm.rows.length === 1);
const fetched = await c.query(`select labels,due_date from bcf_topics where id=$1`, [tid]);
ok('labels persisted', JSON.stringify(fetched.rows[0].labels) === '["urgent","mep"]');
ok('due_date persisted', fetched.rows[0].due_date instanceof Date);
// cascade
await c.query(`delete from bcf_topics where id=$1`, [tid]);
const orphan = await c.query(`select count(*)::int n from bcf_comments where topic_id=$1`, [tid]);
ok('comment cascade-deleted', orphan.rows[0].n === 0);

// 4) realtime publication
const pub = await c.query(`select tablename from pg_publication_tables where pubname='supabase_realtime' and tablename='bcf_comments'`);
ok('bcf_comments in realtime', pub.rows.length === 1);

console.log(`\n${pass} passed, ${fail} failed`);
await c.end();
process.exit(fail ? 1 : 0);
