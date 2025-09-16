// app/auth/auth-client.tsx
"use client";

import { useEffect, useMemo, useState } from "react";
import { createClient } from "@supabase/supabase-js";

type UserLite = { id: string; email?: string | null };

function readAndCleanHash() {
  if (typeof window === "undefined") return null;
  const raw = window.location.hash || "";
  if (!raw) return null;
  const params = new URLSearchParams(raw.replace(/^#/, ""));
  const obj = Object.fromEntries(params.entries());
  // Clean the URL bar immediately
  window.history.replaceState({}, "", window.location.pathname);
  return obj;
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

  useEffect(() => {
    let mounted = true;

    (async () => {
      try {
        // Handle any Supabase-auth hash if present (tokens or errors)
        const hashObj = readAndCleanHash();
        if (hashObj?.error_description) {
          setError(hashObj.error_description);
        }

        // Fetch current user (supabase-js picks up session from hash automatically)
        const { data, error: getUserErr } = await supabase.auth.getUser();
        if (getUserErr) throw getUserErr;

        if (!mounted) return;
        const u = data.user ? { id: data.user.id, email: data.user.email } : null;
        setUser(u);

        // If we’re on /auth and already signed in, bounce to /
        if (typeof window !== "undefined" && u && window.location.pathname === "/auth") {
          window.location.replace("/");
          return;
        }
      } catch (e: any) {
        if (!mounted) return;
        setError(e?.message || "Failed to load session");
      } finally {
        if (mounted) setLoading(false);
      }
    })();

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
        options: {
          // IMPORTANT: redirect back to /auth so we can parse & clean the hash,
          // then we immediately send the user to / with a clean URL.
          emailRedirectTo: `${window.location.origin}/auth`,
        },
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
    // While we auto-redirect to / above, this is a safe fallback.
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
