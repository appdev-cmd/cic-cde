import { createClient } from '@supabase/supabase-js';
import { config } from 'dotenv';
config();
const sb = createClient(process.env.VITE_SUPABASE_URL, process.env.VITE_SUPABASE_ANON_KEY);
const { data, error } = await sb.from('activities').insert({ project_id:'fpt-arch', user_name:'Verify Bot', action:'kiểm thử ghi anon', target:'test', activity_type:'system' }).select();
console.log('anon insert activity:', error ? 'ERROR '+error.message : 'OK id='+data[0].id);
if (data) { await sb.from('activities').delete().eq('id', data[0].id); console.log('cleanup done'); }
