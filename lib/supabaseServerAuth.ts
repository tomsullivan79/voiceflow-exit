// lib/supabaseServerAuth.ts
import { createServerClient, type CookieOptions } from "@supabase/ssr";
import { cookies } from "next/headers";

/**
 * Read-only Supabase server client for Server Components & Route Handlers.
 * NOTE: This is async because `cookies()` must be awaited in Next 14/15.
 */
export async function supabaseServerAuth() {
  const cookieStore = await cookies(); // <-- important: await

  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        get(name: string) {
          return cookieStore.get(name)?.value;
        },
        // No-ops to avoid "Cookies can only be modified..." errors
        set(_name: string, _value: string, _options: CookieOptions) {},
        remove(_name: string, _options: CookieOptions) {},
      },
      auth: { persistSession: false, autoRefreshToken: false },
    }
  );
}
