// app/api/auth/set/route.ts
import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { createServerClient } from "@supabase/ssr";

export const runtime = "nodejs";

export async function POST(req: NextRequest) {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
  const body = await req.json().catch(() => ({}));
  const access_token = body?.access_token as string | undefined;
  const refresh_token = body?.refresh_token as string | undefined;

  if (!access_token || !refresh_token) {
    return NextResponse.json(
      { ok: false, error: "Missing access_token or refresh_token" },
      { status: 400 }
    );
  }

  const reqCookies = cookies();
  const res = NextResponse.json({ ok: true });

  const supabase = createServerClient(url, anon, {
    cookies: {
      get(name: string) {
        return reqCookies.get(name)?.value;
      },
      set(name: string, value: string, options: any) {
        // Set HTTP-only cookies on the response
        res.cookies.set({ name, value, ...options });
      },
      remove(name: string, options: any) {
        // Clear cookies on the response
        res.cookies.set({ name, value: "", ...options });
      },
    },
  });

  const { error } = await supabase.auth.setSession({ access_token, refresh_token });
  if (error) {
    return NextResponse.json(
      { ok: false, error: error.message },
      { status: 400 }
    );
  }

  return res;
}
