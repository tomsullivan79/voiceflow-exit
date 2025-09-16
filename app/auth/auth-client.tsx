// app/auth/auth-client.tsx
"use client";

import { useEffect, useMemo, useState } from "react";
import { createClient } from "@supabase/supabase-js";

type UserLite = { id: string; email?: string | null };

function readHash() {
  if (typeof window === "undefined") return null;
  const raw = window.location.hash || "";
  if (!raw) return null;
  const params = new URLSearchParams(raw.replace(/^#/, ""));
  return Object.fromEntries(params.entries()) as Record<string, string>;
}

function cleanUrl() {
  if (typeof window !== "undefined") {
    window.history.replaceState({}, "", window.location.pathname);
  }
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
        // 1) If redirected with magic-link tokens, persist to HTTP-only cookies via our server route
        const hash = readHash();
        if (hash) {
          if (hash.error_description) {
            setError(hash.error_description);
          }
          if (hash.access_token && hash.refresh_token) {
            const r = await fetch("/api/auth/set", {
              method: "POST",
              headers: { "content-type": "application/json" },
              credentials: "include",
              body: JSON.stringify({
                access_token: hash.access_token,
                refresh_token: hash.refresh_token,
              }),
            });
            if (!r.ok) {
              const j = await r.json().catch(() => ({}));
              setError(j?.error || "Failed to persist session");
            }
          }
          cleanUrl();
        }

        // 2) Load current user (suppress the benign “Auth session missing!” when logged out)
        const { data, error: getUserErr } = await supabase.auth.getUser();
        if (getUserErr && getUserErr.message !== "Auth session missing!") {
          throw getUserErr; // show real errors only
        }

        if (!mounted) return;
        setUser(data?.user ? { id: data.user.id, email: data.user.email } : null);
      } catch (e: any) {
        if (!mounted) return;
        setError(e?.message || "Failed to load session");
      } finally {
        if (mounted) setLoading(false);
      }
    })();

    const { data: sub } = supabase.auth.onAuthStateChange((_evt, session) => {
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
      await fetch("/api/auth/set", {
        method: "POST",
        headers: { "content-type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ access_token: "", refresh_token: "" }),
      }).catch(() => {});
    } catch (err: any) {
      setError(err?.message || "Sign-out failed");
    }
  }

  if (loading) return <p>Loading…</p>;

  return (
    <div style={{ display: "grid", gap: 16 }}>
      {user ? (
        <>
          <div style={{ border: "1px solid #86efac", background: "#f0fdf4", padding: 12, color: "#166534" }}>
            Signed in as <span style={{ fontWeight: 600 }}>{user.email || user.id}</span>.
          </div>
          <button onClick={handleSignOut} style={{ borderRadius: 6, background: "#111827", color: "#fff", padding: "8px 12px" }}>
            Sign out
          </button>
        </>
      ) : (
        <form onSubmit={handleSendMagicLink} style={{ display: "grid", gap: 12 }}>
          <div>
            <label htmlFor="email" style={{ display: "block", fontSize: 14, fontWeight: 500 }}>
              Email
            </label>
            <input
              id="email"
              name="email"
              type="email"
              placeholder="you@example.org"
              required
              style={{ marginTop: 6, width: "100%", padding: "8px 10px", border: "1px solid #d1d5db", borderRadius: 4 }}
            />
          </div>
          <button type="submit" style={{ borderRadius: 6, background: "#111827", color: "#fff", padding: "8px 12px" }}>
            Send magic link
          </button>
        </form>
      )}

      {/* Only show meaningful errors; not the benign “Auth session missing!” */}
      {error && error !== "Auth session missing!" ? (
        <div style={{ border: "1px solid #fecaca", background: "#fef2f2", padding: 10, color: "#991b1b", fontSize: 14 }}>
          {error}
        </div>
      ) : null}
      {notice ? (
        <div style={{ border: "1px solid #bfdbfe", background: "#eff6ff", padding: 10, color: "#1e40af", fontSize: 14 }}>
          {notice}
        </div>
      ) : null}
    </div>
  );
}
