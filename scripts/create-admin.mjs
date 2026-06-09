import { createClient } from '@supabase/supabase-js';
import { config } from 'dotenv';
config();

const sb = createClient(process.env.VITE_SUPABASE_URL, process.env.VITE_SUPABASE_ANON_KEY);
const email = 'admin@cic-cde.vn';
const password = '123456';

console.log('Đang tạo tài khoản Admin...');
const { data, error } = await sb.auth.signUp({
  email,
  password,
  options: {
    data: {
      full_name: 'Admin'
    }
  }
});

if (error) {
  console.error('Lỗi khi tạo tài khoản:', error.message);
} else {
  console.log('Tạo tài khoản Admin thành công hoặc tài khoản đã tồn tại!', data.user ? 'User ID: ' + data.user.id : 'No user data');
}
