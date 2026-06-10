import { createClient } from '@supabase/supabase-js';
import { config } from 'dotenv';
config();
const sb = createClient(process.env.VITE_SUPABASE_URL, process.env.VITE_SUPABASE_ANON_KEY);
const email=`cic.up.${Date.now()}@gmail.com`;
await sb.auth.signUp({email,password:'Test123456!',options:{data:{full_name:'Up'}}});
await sb.auth.signInWithPassword({email,password:'Test123456!'});
const code='25046-8THT_CIC_ELEC_BT_ZZ';
// upload
const path=`fpt-arch/${Date.now()}_test.ifc`;
const up=await sb.storage.from('cde-files').upload(path,new Blob(['IFC']));
console.log('storage upload:', up.error?'ERR':'OK');
const pub=sb.storage.from('cde-files').getPublicUrl(path).data.publicUrl;
// create doc
const doc=await sb.from('documents').insert({project_id:'fpt-arch',code,name:'ELEC test',folder:'02_SHARED',status:'S1 - SHARED',file_type:'ifc',file_url:pub}).select().single();
console.log('createDocument:', doc.error?'ERR '+doc.error.message:'OK');
// simulate "quay lại": fetch documents
const back=await sb.from('documents').select('code,file_type,file_url').eq('project_id','fpt-arch').eq('code',code).maybeSingle();
console.log('after reload, doc present:', back.data? ('YES file_type='+back.data.file_type+' hasUrl='+!!back.data.file_url):'NO');
// cleanup
if(doc.data) await sb.from('documents').delete().eq('id',doc.data.id);
await sb.storage.from('cde-files').remove([path]);
console.log('cleanup done');
