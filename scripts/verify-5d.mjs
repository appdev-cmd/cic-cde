import { createClient } from '@supabase/supabase-js'; import { config } from 'dotenv'; config();
const sb=createClient(process.env.VITE_SUPABASE_URL,process.env.VITE_SUPABASE_ANON_KEY);
const cnt=await sb.from('cost_norms').select('*',{count:'exact',head:true});
console.log('cost_norms total:', cnt.count);
const s=await sb.from('cost_norms').select('code,name,unit').or('code.ilike.%AF.111%,name.ilike.%bê tông%').limit(3);
console.log('search "bê tông"/AF.111:', s.data?.map(x=>x.code+' '+x.unit).join(' | '));
// auth + boq add
const email=`cic.5d.${Date.now()}@gmail.com`;
await sb.auth.signUp({email,password:'Test123456!',options:{data:{full_name:'5D'}}});
await sb.auth.signInWithPassword({email,password:'Test123456!'});
const b=await sb.from('boq_items').insert({project_id:'fpt-arch',norm_code:'AF.11110',name:'BT móng',unit:'m3',quantity:10,material_unit:1400000}).select().single();
console.log('boq add (auth):', b.error?('ERR '+b.error.message):('OK total='+(10*1400000)));
if(b.data) await sb.from('boq_items').delete().eq('id',b.data.id);
