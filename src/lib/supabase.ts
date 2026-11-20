import { createClient } from '@supabase/supabase-js';

const envUrl = (import.meta.env.VITE_SUPABASE_URL ?? '').trim();
const envKey = (import.meta.env.VITE_SUPABASE_ANON_KEY ?? '').trim();

export const isSupabaseConfigured = envUrl.length > 0 && envKey.length > 0;

const url = isSupabaseConfigured ? envUrl : 'https://placeholder.supabase.co';
const anonKey = isSupabaseConfigured ? envKey : 'placeholder-anon-key';

export const supabase = createClient(url, anonKey, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: true,
  },
});
