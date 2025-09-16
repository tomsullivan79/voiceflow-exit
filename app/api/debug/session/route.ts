// app/api/debug/session/route.ts
import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { createClient } from "@supabase/supabase-js";

export const runtime = "nodejs";

export async function GET() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
  const cookieStore = cookies();

  const supabase = createClient(url, anon, {
    auth: { persistSession: false, detectSessionInUrl: false },
    global: { headers: { Cookie: cookieStore.toString() } },
  });

  const { data, error } = await supabase.auth.getUser();
  return NextResponse.json({
    ok: !error,
    error: error?.message || null,
    user: data?.user ? { id: data.user.id, email: data.user.email } : null,
  });
}
