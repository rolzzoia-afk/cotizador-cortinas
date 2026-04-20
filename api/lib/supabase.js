// ══════════════════════════════════════════════════════════════════════
//  Supabase Admin Client — service_role key (NUNCA exponer al browser)
//  Solo se usa en el backend (serverless functions)
// ══════════════════════════════════════════════════════════════════════

import { createClient } from '@supabase/supabase-js';

const supabaseAdmin = createClient(
    process.env.SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY,
    { auth: { persistSession: false, autoRefreshToken: false } }
);

export default supabaseAdmin;
