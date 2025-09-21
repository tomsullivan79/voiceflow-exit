// lib/supabaseBrowser.ts
"use client";

import { createClient, SupabaseClient } from "@supabase/supabase-js";

declare global {
  // eslint-disable-next-line no-var
  var __wt_supabase_browser__: SupabaseClient | undefined;
}

export function supabaseBrowser(): SupabaseClient {
  if (typeof window === "undefined") {
    throw new Error("supabaseBrowser() must be called in the browser.");
  }
  if (!globalThis.__wt_supabase_browser__) {
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
    const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
    globalThis.__wt_supabase_browser__ = createClient(url, anon, {
      auth: {
        persistSession: true,
        detectSessionInUrl: true,
        autoRefreshToken: true,
      },
      global: { headers: { "X-WT-Client": "web-chat" } },
    });
  }
  return globalThis.__wt_supabase_browser__!;
}
