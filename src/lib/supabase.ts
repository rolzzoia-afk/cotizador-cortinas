import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '@/types/database';

const url = import.meta.env.VITE_SUPABASE_URL;
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

if (!url || !anonKey) {
  throw new Error('Faltan VITE_SUPABASE_URL o VITE_SUPABASE_ANON_KEY en el entorno.');
}

export const supabase: SupabaseClient<Database> = createClient<Database>(url, anonKey, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: true,
  },
});
