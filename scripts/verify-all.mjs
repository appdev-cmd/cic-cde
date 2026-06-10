import { createClient } from '@supabase/supabase-js';
import { config } from 'dotenv';
config();
const U=process.env.VITE_SUPABASE_URL, K=process.env.VITE_SUPABASE_ANON_KEY;
const anon = createClient(U,K);
const auth = createClient(U,K);
let pass=0, fail=0;
const ok=(n,c)=>{ console.log((c?'✓':'✗')+' '+n); c?pass++:fail++; };

// 1. anon reads
for (const t of ['projects','documents','approvals','clashes','activities','bcf_topics','assets','maintenance_tickets','viewpoints']) {
  const r = await anon.from(t).select('*',{count:'exact',head:true});
  ok(`anon read ${t}`, !r.error);
}
// 2. anon write blocked
const w = await anon.from('activities').insert({project_id:'fpt-arch',user_name:'x',action:'y',target:'z'});
ok('anon write BLOCKED', !!w.error);

// 3. auth
const email=`cic.verify.${Date.now()}@gmail.com`;
const su=await auth.auth.signUp({email,password:'Test123456!',options:{data:{full_name:'Verify'}}});
ok('signup+session', !su.error && !!su.data.session);
const prof=await auth.from('profiles').select('*').eq('id',su.data.user.id).maybeSingle();
ok('profile auto-created', !!prof.data);

// 4. auth writes across entities
const aId=su.data.user.id;
const docIns=await auth.from('documents').insert({project_id:'fpt-arch',code:'VRF-TST-Z01-ZZ-M3-A-9999',name:'verify doc',folder:'01_WIP',status:'S0 - WIP',file_type:'pdf'}).select().single();
ok('auth create document', !docIns.error);
if(docIns.data){ const u=await auth.from('documents').update({status:'S1 - SHARED'}).eq('id',docIns.data.id); ok('auth update document', !u.error); await auth.from('documents').delete().eq('id',docIns.data.id); }
const clIns=await auth.from('clashes').insert({project_id:'fpt-arch',code:'VRF-CL',elements:'a',discipline:'X',severity:'Cao'}).select().single();
ok('auth create clash', !clIns.error); if(clIns.data) await auth.from('clashes').delete().eq('id',clIns.data.id);
const vpIns=await auth.from('viewpoints').insert({project_id:'fpt-arch',name:'vrf',camera:{position:[1,2,3],target:[0,0,0]}}).select().single();
ok('auth create viewpoint', !vpIns.error); if(vpIns.data) await auth.from('viewpoints').delete().eq('id',vpIns.data.id);

// 5. storage upload (auth) + public read
const path=`fpt-arch/_verify_${Date.now()}.txt`;
const up=await auth.storage.from('cde-files').upload(path,new Blob(['x']));
ok('auth storage upload', !up.error);
if(!up.error){ const pub=anon.storage.from('cde-files').getPublicUrl(path); ok('public url', !!pub.data.publicUrl); await auth.storage.from('cde-files').remove([path]); }

console.log(`\n=== ${pass} passed, ${fail} failed ===`);
