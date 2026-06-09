import { createClient } from '@supabase/supabase-js';
import { config } from 'dotenv';
config();
const sb = createClient(process.env.VITE_SUPABASE_URL, process.env.VITE_SUPABASE_ANON_KEY);
const email = `cic.test.${Date.now()}@gmail.com`;
const password = 'Test123456!';
const { data: su, error: e1 } = await sb.auth.signUp({ email, password, options:{ data:{ full_name:'Test User' }}});
console.log('signUp:', e1 ? 'ERR '+e1.message : 'OK session='+(su.session?'yes':'no(confirm required)'));
const { data: si, error: e2 } = await sb.auth.signInWithPassword({ email, password });
console.log('signIn:', e2 ? 'ERR '+e2.message : 'OK session='+(si.session?'yes':'no'));
if (si?.session) { const { data: prof } = await sb.from('profiles').select('*').eq('id', si.user.id).maybeSingle(); console.log('profile:', prof?('YES role='+prof.role):'NO'); }
