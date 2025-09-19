// lib/supabaseAdmin.ts
import { createClient } from "@supabase/supabase-js";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const serviceRole = process.env.SUPABASE_SERVICE_ROLE!;

if (!url || !serviceRole) {
  throw new Error("Supabase admin missing env: NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE");
}

export const supabaseAdmin = createClient(url, serviceRole, {
  auth: { persistSession: false, autoRefreshToken: false },
});
