"use client";

import { useState } from "react";
import { supabaseBrowser } from "@/lib/supabaseBrowser";

export default function AuthClient() {
  const sb = supabaseBrowser();
  const [email, setEmail] = useState("");
  const [status, setStatus] = useState("");

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setStatus("Sending…");
    try {
      const { error } = await sb.auth.signInWithOtp({
        email,
        options: { emailRedirectTo: `${window.location.origin}/auth/callback` },
      });
      if (error) setStatus(`Error: ${error.message}`);
      else setStatus("Check your email for the sign-in link.");
    } catch (err: any) {
      setStatus(`Error: ${err?.message || String(err)}`);
    }
  }

  return (
    <form onSubmit={onSubmit} style={{ marginTop: 16 }}>
      <label style={{ display: "block", marginBottom: 8 }}>
        Email
        <input
          type="email"
          required
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="you@example.org"
          style={{ display: "block", width: "100%", padding: 8, marginTop: 6 }}
        />
      </label>
      <button type="submit" style={{ padding: "8px 12px" }}>Send magic link</button>
      {status && <p style={{ marginTop: 12, opacity: 0.8 }}>{status}</p>}
    </form>
  );
}
