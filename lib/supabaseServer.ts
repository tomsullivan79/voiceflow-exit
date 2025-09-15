import { createClient } from "@supabase/supabase-js";

export function supabaseAdmin() {
  const url = process.env.SUPABASE_URL!;
  const service = process.env.SUPABASE_SERVICE_ROLE!;
  return createClient(url, service, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}
