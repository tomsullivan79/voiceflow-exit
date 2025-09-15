"use client";
import { useEffect, useState } from "react";
import { supabaseBrowser } from "@/lib/supabaseBrowser";

export default function AuthPage() {
  const sb = supabaseBrowser();
  const [email, setEmail] = useState("");
  const [status, setStatus] = useState("idle");
  const [userId, setUserId] = useState<string | null>(null);

  useEffect(() => {
    sb.auth.getUser().then(({ data }) => setUserId(data.user?.id ?? null));
  }, []);

  async function signIn() {
    setStatus("sending");
    const { error } = await sb.auth.signInWithOtp({
      email,
      options: { emailRedirectTo: `${window.location.origin}/auth/callback` },
    });
    setStatus(error ? `error: ${error.message}` : "check your email for the magic link");
  }

  async function signOut() {
    await sb.auth.signOut();
    setUserId(null);
    setStatus("signed out");
  }

  return (
    <main style={{ maxWidth: 520, margin: "40px auto", padding: 16 }}>
      <h1>Sign in</h1>
      <p style={{ opacity: 0.8, marginBottom: 16 }}>
        {userId ? `Signed in as ${userId}` : "Not signed in"}
      </p>

      {!userId && (
        <>
          <input
            type="email"
            placeholder="you@example.com"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            style={{ width: "100%", padding: 12 }}
          />
          <button onClick={signIn} disabled={!email || status === "sending"} style={{ marginTop: 12 }}>
            {status === "sending" ? "Sending…" : "Send magic link"}
          </button>
          <div style={{ marginTop: 12 }}>{status !== "idle" ? status : ""}</div>
        </>
      )}

      {userId && (
        <button onClick={signOut} style={{ marginTop: 12 }}>
          Sign out
        </button>
      )}
    </main>
  );
}
