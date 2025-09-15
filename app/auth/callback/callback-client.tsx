"use client";

import { useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { supabaseBrowser } from "@/lib/supabaseBrowser";

export default function CallbackClient() {
  const router = useRouter();
  const sp = useSearchParams();

  useEffect(() => {
    const run = async () => {
      try {
        const code = sp.get("code");
        const next = sp.get("next") || "/";

        const sb = supabaseBrowser();

        // Try both signatures to be robust across versions:
        // 1) exchangeCodeForSession(url)
        // 2) exchangeCodeForSession(code)
        let ok = false;
        try {
          if (typeof window !== "undefined") {
            const { error } = await sb.auth.exchangeCodeForSession(window.location.href as any);
            if (!error) ok = true;
          }
        } catch {}

        if (!ok && code) {
          try {
            const { error } = await sb.auth.exchangeCodeForSession(code as any);
            if (!error) ok = true;
          } catch {}
        }

        // Fallback: even if exchange failed, continue to app (server will read auth state)
        router.replace(next);
      } catch {
        router.replace("/");
      }
    };
    run();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sp, router]);

  return <p>Finalizing…</p>;
}
