import { supabase } from '../supabase';
import type { Session } from '@supabase/supabase-js';

export interface Profile {
  id: string;
  fullName: string;
  role: string;
}

export async function getSession(): Promise<Session | null> {
  const { data } = await supabase.auth.getSession();
  return data.session;
}

export function onAuthChange(cb: (session: Session | null) => void): () => void {
  const { data } = supabase.auth.onAuthStateChange((_event, session) => cb(session));
  return () => data.subscription.unsubscribe();
}

export async function signIn(email: string, password: string): Promise<void> {
  const { error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) throw error;
}

export async function signUp(email: string, password: string, fullName: string): Promise<void> {
  const { error } = await supabase.auth.signUp({
    email,
    password,
    options: { data: { full_name: fullName } },
  });
  if (error) throw error;
}

export async function signOut(): Promise<void> {
  await supabase.auth.signOut();
}

export async function updateMyRole(role: string): Promise<void> {
  const { data } = await supabase.auth.getUser();
  if (!data.user) throw new Error('Chưa đăng nhập');
  const { error } = await supabase.from('profiles').update({ role }).eq('id', data.user.id);
  if (error) throw error;
}

export async function fetchProfile(userId: string): Promise<Profile | null> {
  const { data, error } = await supabase.from('profiles').select('*').eq('id', userId).maybeSingle();
  if (error || !data) return null;
  return { id: data.id, fullName: data.full_name ?? '', role: data.role ?? 'Architect' };
}
