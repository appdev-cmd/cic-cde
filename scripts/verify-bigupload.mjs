import { createClient } from '@supabase/supabase-js';
import { config } from 'dotenv'; config();
const sb = createClient(process.env.VITE_SUPABASE_URL, process.env.VITE_SUPABASE_ANON_KEY);
const email=`cic.big.${Date.now()}@gmail.com`;
await sb.auth.signUp({email,password:'Test123456!',options:{data:{full_name:'Big'}}});
await sb.auth.signInWithPassword({email,password:'Test123456!'});
const size=60*1024*1024; // 60MB (vượt giới hạn cũ 50MB)
const buf=new Uint8Array(size);
const path=`fpt-arch/_big_${Date.now()}.bin`;
const t=Date.now();
const up=await sb.storage.from('cde-files').upload(path,new Blob([buf]),{contentType:'application/octet-stream'});
console.log('upload 60MB:', up.error?('ERR '+up.error.message):('OK in '+((Date.now()-t)/1000).toFixed(1)+'s'));
if(!up.error) await sb.storage.from('cde-files').remove([path]);
