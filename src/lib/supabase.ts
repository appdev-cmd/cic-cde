import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || '';
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY || '';

if (!supabaseUrl || !supabaseAnonKey) {
  console.warn(
    'Supabase credentials missing. Please check VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY in your .env file.'
  );
}

// Custom storage wrapper to dynamically support the "Remember Me" option.
// When remember me is disabled, session info is stored in sessionStorage (cleared when browser closes).
const customStorage = {
  getItem: (key: string): string | null => {
    const remember = localStorage.getItem('cic_cde_remember_me') !== 'false';
    const storage = remember ? localStorage : sessionStorage;
    return storage.getItem(key);
  },
  setItem: (key: string, value: string): void => {
    const remember = localStorage.getItem('cic_cde_remember_me') !== 'false';
    const storage = remember ? localStorage : sessionStorage;
    storage.setItem(key, value);
  },
  removeItem: (key: string): void => {
    localStorage.removeItem(key);
    sessionStorage.removeItem(key);
  }
};

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    persistSession: true,
    storage: customStorage,
    detectSessionInUrl: true,
    flowType: 'pkce'
  }
});
