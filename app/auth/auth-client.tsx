// app/auth/auth-client.tsx
"use client";

import { useEffect, useMemo, useState } from "react";
import { createClient } from "@supabase/supabase-js";

type UserLite = { id: string; email?: string | null };

export default function AuthClient() {
  const [loading, setLoading] = useState(true);
  const [user, setUser] = useState<UserLite | null>(null);
  const [error, setError] = useState<string | null>(null);

  const supabase = useMemo(() => {
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
    const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
    return createClient(url, anon);
  }, []);

  // Load current user and subscribe to auth changes
  useEffect(() => {
    let mounted = true;

    (async () => {
      try {
        const { data, error } = await supabase.auth.getUser();
        if (error) throw error;
        if (!mounted) return;
        setUser(data.user ? { id: data.user.id, email: data.user.email } : null);
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
    const form = new FormData(e.currentTarget);
    const email = String(form.get("email") || "").trim();
    if (!email) return;

    try {
      const { error } = await supabase.auth.signInWithOtp({
        email,
        options: { emailRedirectTo: `${window.location.origin}/` },
      });
      if (error) throw error;
      alert("Magic link sent! Check your email.");
      (e.target as HTMLFormElement).reset();
    } catch (err: any) {
      alert(err?.message || "Error sending magic link");
    }
  }

  async function handleSignOut() {
    try {
      await supabase.auth.signOut();
    } catch {
      /* ignore */
    }
  }

  // ----- UI -----
  if (loading) return <p>Loading…</p>;

  if (user) {
    return (
      <div className="space-y-4">
        <div className="rounded border border-green-300 bg-green-50 p-3 text-green-800">
          You are signed in as <span className="font-medium">{user.email || user.id}</span>.
        </div>
        <button
          onClick={handleSignOut}
          className="rounded bg-black px-4 py-2 text-white"
        >
          Sign out
        </button>
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
      {error ? (
        <div className="rounded border border-red-300 bg-red-50 p-2 text-sm text-red-700">
          Error: {error}
        </div>
      ) : null}
    </form>
  );
}
