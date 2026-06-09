import { createClient } from '@supabase/supabase-js';
import { config } from 'dotenv';
config();
const U=process.env.VITE_SUPABASE_URL, K=process.env.VITE_SUPABASE_ANON_KEY;
// anon client
const anon = createClient(U,K);
const r1 = await anon.from('projects').select('id').limit(1);
console.log('anon READ projects:', r1.error?'ERR':'OK ('+r1.data.length+')');
const w1 = await anon.from('activities').insert({project_id:'fpt-arch',user_name:'anon',action:'x',target:'y'});
console.log('anon WRITE activity:', w1.error?('BLOCKED ✓ ('+w1.error.message.slice(0,40)+')'):'ALLOWED ✗ (security hole!)');
// authenticated client
const auth = createClient(U,K);
const email=`cic.test.${Date.now()}@gmail.com`;
await auth.auth.signUp({email,password:'Test123456!',options:{data:{full_name:'RLS Test'}}});
const { data:si } = await auth.auth.signInWithPassword({email,password:'Test123456!'});
const w2 = await auth.from('activities').insert({project_id:'fpt-arch',user_name:'authed',action:'kiểm thử',target:'z'}).select();
console.log('authed WRITE activity:', w2.error?('ERR '+w2.error.message):'OK ✓');
if(w2.data) await auth.from('activities').delete().eq('id',w2.data[0].id);
