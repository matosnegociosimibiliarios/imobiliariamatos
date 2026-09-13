import { supabase, supabaseConfigured } from '../lib/supabase';

export async function signIn(email, password) {
  if (!supabaseConfigured) throw new Error('Supabase não configurado.');

  return supabase.auth.signInWithPassword({
    email,
    password,
  });
}

export async function signOut() {
  if (!supabaseConfigured) return;
  return supabase.auth.signOut();
}

export async function getCurrentSession() {
  if (!supabaseConfigured) return null;

  const { data } = await supabase.auth.getSession();
  return data.session || null;
}

export async function getCurrentProfile() {
  const session = await getCurrentSession();
  if (!session?.user) return null;

  const { data, error } = await supabase
    .from('profiles')
    .select('id, full_name, role')
    .eq('id', session.user.id)
    .maybeSingle();

  if (error) throw error;
  return data;
}

export async function isCurrentUserAdmin() {
  const profile = await getCurrentProfile();
  return profile?.role === 'admin';
}
