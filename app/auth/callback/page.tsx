"use client";
import { useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { supabaseBrowser } from "@/lib/supabaseBrowser";

export default function AuthCallback() {
  const router = useRouter();
  const params = useSearchParams();

  useEffect(() => {
    const code = params.get("code");
    const next = params.get("next") || "/"; // optional ?next=/somewhere
    const run = async () => {
      const sb = supabaseBrowser();
      if (code) {
        await sb.auth.exchangeCodeForSession({ code });
      }
      router.replace(next);
    };
    run();
  }, [params, router]);

  return (
    <main style={{ maxWidth: 520, margin: "40px auto", padding: 16 }}>
      <h1>Signing you in…</h1>
      <p>This will take just a moment.</p>
    </main>
  );
}
