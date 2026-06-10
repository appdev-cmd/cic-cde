import { createClient } from '@supabase/supabase-js';
import { config } from 'dotenv';
config();
const sb = createClient(process.env.VITE_SUPABASE_URL, process.env.VITE_SUPABASE_ANON_KEY);
const email=`cic.test.${Date.now()}@gmail.com`;
await sb.auth.signUp({email,password:'Test123456!',options:{data:{full_name:'BCF Test'}}});
await sb.auth.signInWithPassword({email,password:'Test123456!'});
const { data, error } = await sb.from('bcf_topics').insert({project_id:'fpt-arch',title:'Test clash',status:'Open',priority:'High',topic_type:'Clash',camera:{position:[1,2,3],target:[0,0,0]},hidden_models:['m1'],screenshot:'data:image/png;base64,xxx'}).select().single();
console.log('bcf insert w/ camera+type:', error?'ERR '+error.message:'OK id='+data.id+' type='+data.topic_type);
if(data){ await sb.from('bcf_topics').update({status:'In Progress'}).eq('id',data.id); const r=await sb.from('bcf_topics').select('status,camera').eq('id',data.id).single(); console.log('status update + camera readback:', r.data.status, JSON.stringify(r.data.camera)); await sb.from('bcf_topics').delete().eq('id',data.id); }
