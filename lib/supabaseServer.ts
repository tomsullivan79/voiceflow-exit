// lib/supabaseServer.ts
import { createClient } from '@supabase/supabase-js';

export function supabaseAdmin() {
  const url =
    process.env.SUPABASE_URL ||
    process.env.NEXT_PUBLIC_SUPABASE_URL; // fallback to the public URL
  const service = process.env.SUPABASE_SERVICE_ROLE;

  if (!url || !service) {
    throw new Error('Missing Supabase envs: SUPABASE_URL/NEXT_PUBLIC_SUPABASE_URL and/or SUPABASE_SERVICE_ROLE');
  }

  return createClient(url, service, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}
