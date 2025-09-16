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
        const hash = readHash();
        if (hash) {
          if (hash.error_description) setError(hash.error_description);
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

        const { data, error: getUserErr } = await supabase.auth.getUser();
        if (getUserErr && getUserErr.message !== "Auth session missing!") {
          throw getUserErr; // real error
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
        options: { emailRedirectTo: `${window.location.origin}/auth` },
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

  if (loading) return <p style={{ color: "#e5e7eb" }}>Loading…</p>;

  // High-contrast card styles
  const cardStyle: React.CSSProperties = {
    border: "1px solid #d1d5db",
    background: "#ffffff",
    color: "#111827",
    borderRadius: 8,
    padding: 16,
  };
  const labelStyle: React.CSSProperties = { display: "block", fontSize: 14, fontWeight: 600, color: "#111827" };
  const inputStyle: React.CSSProperties = {
    marginTop: 6,
    width: "100%",
    padding: "10px 12px",
    border: "1px solid #6b7280",
    borderRadius: 6,
    color: "#111827",
    background: "#ffffff",
  };
  const primaryBtn: React.CSSProperties = {
    borderRadius: 6,
    background: "#111827",
    color: "#ffffff",
    padding: "10px 14px",
    fontWeight: 600,
  };
  const successBox: React.CSSProperties = {
    border: "1px solid #34d399",
    background: "#d1fae5",
    color: "#065f46",
    borderRadius: 6,
    padding: 10,
    fontSize: 14,
  };
  const errorBox: React.CSSProperties = {
    border: "1px solid #fecaca",
    background: "#fee2e2",
    color: "#991b1b",
    borderRadius: 6,
    padding: 10,
    fontSize: 14,
  };
  const infoBox: React.CSSProperties = {
    border: "1px solid #bfdbfe",
    background: "#eff6ff",
    color: "#1e40af",
    borderRadius: 6,
    padding: 10,
    fontSize: 14,
  };

  return (
    <div style={{ display: "grid", gap: 16 }}>
      <div style={cardStyle}>
        {user ? (
          <div style={{ display: "grid", gap: 12 }}>
            <div style={successBox}>
              Signed in as <span style={{ fontWeight: 700 }}>{user.email || user.id}</span>.
            </div>
            <button onClick={handleSignOut} style={primaryBtn}>
              Sign out
            </button>
          </div>
        ) : (
          <form onSubmit={handleSendMagicLink} style={{ display: "grid", gap: 12 }}>
            <div>
              <label htmlFor="email" style={labelStyle}>
                Email
              </label>
              <input
                id="email"
                name="email"
                type="email"
                placeholder="you@example.org"
                required
                style={inputStyle}
              />
            </div>
            <button type="submit" style={primaryBtn}>
              Send magic link
            </button>
          </form>
        )}
      </div>

      {/* High-contrast notices */}
      {error && error !== "Auth session missing!" ? <div style={errorBox}>{error}</div> : null}
      {notice ? <div style={infoBox}>{notice}</div> : null}
    </div>
  );
}
