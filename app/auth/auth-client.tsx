// app/auth/auth-client.tsx
"use client";

import { useEffect, useMemo, useState } from "react";
import { createClient } from "@supabase/supabase-js";

type UserLite = { id: string; email?: string | null };

function parseHash() {
  // Supabase appends tokens or errors after redirect as a URL hash (#...).
  const h = typeof window !== "undefined" ? window.location.hash : "";
  const params = new URLSearchParams(h.startsWith("#") ? h.slice(1) : h);
  return {
    hasHash: !!h,
    error: params.get("error"),
    error_code: params.get("error_code"),
    error_description: params.get("error_description"),
    access_token: params.get("access_token"),
    refresh_token: params.get("refresh_token"),
    expires_in: params.get("expires_in"),
    token_type: params.get("token_type"),
    code: params.get("code"), // OAuth code (not typical for magic link)
  };
}

export default function AuthClient() {
  const [loading, setLoading] = useState(true);
  const [user, setUser] = useState<UserLite | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const supabase = useMemo(() => {
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
    const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
    return createClient(url, anon);
  }, []);

  // Handle redirect hash (tokens or errors), load user, and subscribe to changes
  useEffect(() => {
    let mounted = true;

    (async () => {
      try {
        // 1) If Supabase appended a hash (tokens or errors), handle it gracefully
        const hash = parseHash();

        if (hash.hasHash) {
          if (hash.error) {
            // Example: otp_expired, access_denied, etc.
            setError(
              hash.error_description ||
                `Authentication error (${hash.error_code || hash.error}).`
            );
          }

          // For OAuth code flow we could exchange with:
          // if (hash.code) await supabase.auth.exchangeCodeForSession(hash.code);
          // For email magic links, supabase-js automatically picks tokens from the hash on first auth call.

          // Clean the URL (remove the hash so you get a nice, clean address bar)
          // Do this regardless of error/success so the URL is clean post-redirect.
          if (typeof window !== "undefined") {
            window.history.replaceState({}, "", window.location.pathname);
          }
        }

        // 2) Load current user
        const { data, error: getUserErr } = await supabase.auth.getUser();
        if (getUserErr) throw getUserErr;

        if (!mounted) return;
        setUser(data.user ? { id: data.user.id, email: data.user.email } : null);
      } catch (e: any) {
        if (!mounted) return;
        setError(e?.message || "Failed to load session");
      } finally {
        if (mounted) setLoading(false);
      }
    })();

    // 3) Stay in sync with future changes (e.g., sign out)
    const { data: sub } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ? { id: session.user.id, email: session.user.email } : null);
    });

    return () => {
      mounted = false;
      sub.subscription.unsubscribe();
    };
  }, [supabase]);

  async function handleSendMagicLink(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setNotice(null);
    setError(null);

    const form = new FormData(e.currentTarget);
    const email = String(form.get("email") || "").trim();
    if (!email) return;

    try {
      const { error } = await supabase.auth.signInWithOtp({
        email,
        options: { emailRedirectTo: `${window.location.origin}/` }, // redirect to home (clean URL)
      });
      if (error) throw error;
      setNotice("Magic link sent. Check your email.");
      (e.target as HTMLFormElement).reset();
    } catch (err: any) {
      setError(err?.message || "Error sending magic link");
    }
  }

  async function handleSignOut() {
    setNotice(null);
    setError(null);
    try {
      await supabase.auth.signOut();
    } catch (err: any) {
      setError(err?.message || "Sign-out failed");
    }
  }

  // ---------- UI ----------
  if (loading) return <p>Loading…</p>;

  if (user) {
    return (
      <div className="space-y-4">
        <div className="rounded border border-green-300 bg-green-50 p-3 text-green-800">
          You are signed in as <span className="font-medium">{user.email || user.id}</span>.
        </div>
        <button onClick={handleSignOut} className="rounded bg-black px-4 py-2 text-white">
          Sign out
        </button>
        {notice ? (
          <div className="rounded border border-blue-300 bg-blue-50 p-2 text-sm text-blue-800">
            {notice}
          </div>
        ) : null}
        {error ? (
          <div className="rounded border border-red-300 bg-red-50 p-2 text-sm text-red-700">
            {error}
          </div>
        ) : null}
      </div>
    );
  }

  return (
    <form onSubmit={handleSendMagicLink} className="space-y-4">
      <div>
        <label htmlFor="email" className="block text-sm font-medium">
          Email
        </label>
        <input
          id="email"
          name="email"
          type="email"
          placeholder="you@example.org"
          className="mt-1 w-full rounded border px-3 py-2"
          required
        />
      </div>
      <button type="submit" className="rounded bg-black px-4 py-2 text-white">
        Send magic link
      </button>

      {notice ? (
        <div className="rounded border border-blue-300 bg-blue-50 p-2 text-sm text-blue-800">
          {notice}
        </div>
      ) : null}
      {error ? (
        <div className="rounded border border-red-300 bg-red-50 p-2 text-sm text-red-700">
          {error}
        </div>
      ) : null}
    </form>
  );
}
