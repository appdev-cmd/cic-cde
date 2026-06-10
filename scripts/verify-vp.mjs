import { createClient } from '@supabase/supabase-js';
import { config } from 'dotenv';
config();
const sb = createClient(process.env.VITE_SUPABASE_URL, process.env.VITE_SUPABASE_ANON_KEY);
const email=`cic.test.${Date.now()}@gmail.com`;
await sb.auth.signUp({email,password:'Test123456!',options:{data:{full_name:'VP Test'}}});
await sb.auth.signInWithPassword({email,password:'Test123456!'});
const { data, error } = await sb.from('viewpoints').insert({project_id:'fpt-arch',name:'Test VP',camera:{position:[1,2,3],target:[0,0,0]},hidden_models:['m1'],recentered:true}).select().single();
console.log('viewpoint insert (auth):', error?'ERR '+error.message:'OK id='+data.id);
if(data){ const r=await sb.from('viewpoints').select('camera').eq('id',data.id).single(); console.log('readback camera:', JSON.stringify(r.data.camera)); await sb.from('viewpoints').delete().eq('id',data.id); }
