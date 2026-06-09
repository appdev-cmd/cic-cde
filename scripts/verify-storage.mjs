import { createClient } from '@supabase/supabase-js';
import { config } from 'dotenv';
config();
const sb = createClient(process.env.VITE_SUPABASE_URL, process.env.VITE_SUPABASE_ANON_KEY);
const path = `fpt-arch/_test_${Date.now()}.txt`;
const blob = new Blob(['hello cde'], { type: 'text/plain' });
const { error } = await sb.storage.from('cde-files').upload(path, blob);
console.log('upload:', error ? 'ERROR '+error.message : 'OK '+path);
if (!error) {
  const { data } = sb.storage.from('cde-files').getPublicUrl(path);
  console.log('publicUrl:', data.publicUrl);
  await sb.storage.from('cde-files').remove([path]);
  console.log('cleanup done');
}
