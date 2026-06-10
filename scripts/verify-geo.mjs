import { createClient } from '@supabase/supabase-js'; import { config } from 'dotenv'; config();
const sb=createClient(process.env.VITE_SUPABASE_URL,process.env.VITE_SUPABASE_ANON_KEY);
const r=await sb.from('projects').select('id,name,lat,lng,province').order('id');
console.log('projects with coords:');
r.data?.forEach(p=>console.log(' ', p.id, '=>', p.lat, p.lng, p.province || ''));
