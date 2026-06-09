import { createClient } from '@supabase/supabase-js';
import { config } from 'dotenv';
config();
const sb = createClient(process.env.VITE_SUPABASE_URL, process.env.VITE_SUPABASE_ANON_KEY);
const P='fpt-arch';
// 1. document update by code
let { error:e1 } = await sb.from('documents').update({status:'S1 - SHARED', folder:'02_SHARED'}).eq('project_id',P).eq('code','PRJ-STR-Z01-ZZ-M3-S-0023');
const { data:d } = await sb.from('documents').select('status').eq('project_id',P).eq('code','PRJ-STR-Z01-ZZ-M3-S-0023').single();
console.log('doc update:', e1?'ERR '+e1.message:'OK status='+d.status);
await sb.from('documents').update({status:'S0 - WIP', folder:'01_WIP'}).eq('project_id',P).eq('code','PRJ-STR-Z01-ZZ-M3-S-0023'); // revert
// 2. clash update
let { error:e2 } = await sb.from('clashes').update({status:'Đã giải quyết'}).eq('project_id',P).eq('code','CL-02');
console.log('clash update:', e2?'ERR '+e2.message:'OK');
await sb.from('clashes').update({status:'Chưa xử lý'}).eq('project_id',P).eq('code','CL-02');
// 3. bcf insert+delete
let { data:bt, error:e3 } = await sb.from('bcf_topics').insert({project_id:P,title:'VR test',priority:'High',status:'Open'}).select('id').single();
console.log('bcf insert:', e3?'ERR '+e3.message:'OK id='+bt.id); if(bt) await sb.from('bcf_topics').delete().eq('id',bt.id);
// 4. ticket insert+delete
let { data:tk, error:e4 } = await sb.from('maintenance_tickets').insert({asset_id:'8a9b7c1d-4e5f-90ab-1234-567890abcdef',code:'CM-999',ticket_type:'CM',title:'VR test',status:'Mới',ticket_date:'2026-06-09'}).select('id').single();
console.log('ticket insert:', e4?'ERR '+e4.message:'OK id='+tk.id); if(tk) await sb.from('maintenance_tickets').delete().eq('id',tk.id);
// 5. approval insert with document_code + delete
let { error:e5 } = await sb.from('approvals').insert({project_id:P,code:'RFI-999',type:'VR',description:'x',document_code:'PRJ-STR-Z01-ZZ-M3-S-0023'});
console.log('approval insert(document_code):', e5?'ERR '+e5.message:'OK'); await sb.from('approvals').delete().eq('project_id',P).eq('code','RFI-999');
