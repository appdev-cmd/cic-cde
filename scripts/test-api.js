import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://shiqfawlgeintqsibqmk.supabase.co';
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InNoaXFmYXdsZ2VpbnRxc2licW1rIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODA5OTE0NjcsImV4cCI6MjA5NjU2NzQ2N30.U2oO7oFalHzo5OTt2i49UbJLjeOY2rNt04Knfx2FL3A';

const supabase = createClient(supabaseUrl, supabaseAnonKey);

async function test() {
  console.log('Testing connection to Supabase API...');
  const { data, error } = await supabase.from('documents').select('*');
  
  if (error) {
    console.log('Error received (this is normal if table does not exist):', error.message);
  } else {
    console.log('Success! Data:', data);
  }
}

test();
