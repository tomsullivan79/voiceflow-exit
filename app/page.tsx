"use client";
import { useRef, useState } from "react";

export default function Home() {
  const [input, setInput] = useState("");
  const [streamed, setStreamed] = useState("");
  const [loading, setLoading] = useState(false);
  const [remember, setRemember] = useState(false);
  const abortRef = useRef<AbortController | null>(null);

  async function onSend() {
    setStreamed("");
    setLoading(true);
    abortRef.current = new AbortController();

    const res = await fetch("/api/chat", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        messages: [{ role: "user", content: input }],
        remember,
      }),
      signal: abortRef.current.signal,
    });

    if (!res.ok || !res.body) {
      setLoading(false);
      setStreamed(`Error: ${res.status} ${res.statusText}`);
      return;
    }
    const reader = res.body.getReader();
    const decoder = new TextDecoder();
    while (true) {
      const { value, done } = await reader.read();
      if (done) break;
      setStreamed((prev) => prev + decoder.decode(value, { stream: true }));
    }
    setLoading(false);
    setRemember(false);
  }

  return (
    <main style={{ maxWidth: 720, margin: "40px auto", padding: "0 16px" }}>
      <h1>wildlife triage agent</h1>
      <textarea
        value={input}
        onChange={(e) => setInput(e.target.value)}
        placeholder="Say something…"
        rows={4}
        style={{ width: "100%", padding: 12, marginTop: 16 }}
      />
      <div style={{ display: "flex", gap: 8, marginTop: 12 }}>
        <button onClick={onSend} disabled={loading || !input.trim()}>
          {loading ? "Streaming…" : "Send"}
        </button>
        {loading && (
          <button
            onClick={() => {
              abortRef.current?.abort();
              setLoading(false);
            }}
          >
            Stop
          </button>
        )}

        <label
          style={{
            marginLeft: "auto",
            display: "flex",
            alignItems: "center",
            gap: 6,
          }}
        >
          <input
            type="checkbox"
            checked={remember}
            onChange={(e) => setRemember(e.target.checked)}
          />
          Remember this
        </label>
      </div>

      <h3 style={{ marginTop: 24 }}>Response</h3>
      <pre
        style={{
          whiteSpace: "pre-wrap",
          background: "#111",
          color: "#eee",
          padding: 12,
          borderRadius: 8,
          minHeight: 120,
        }}
      >
        {streamed || "—"}
      </pre>

      {/* Helper Links */}
      <section style={{ marginTop: 32 }}>
        <h3>Helper Links</h3>
        <br></br>
        <a href="/memories" style={{ display: "inline-block" }}>
          Memories
        </a>
        <div style={{ height: 12 }} />
        
        <a href="/ingest" style={{ display: "inline-block" }}>
          Ingest
        </a>

        <div style={{ height: 12 }} />
        <a href="/auth" style={{ display: "inline-block" }}>
          Auth
        </a>

        <div style={{ height: 12 }} />
        <a href="/sms" style={{ display: "inline-block" }}>
          SMS
        </a>

         <div style={{ height: 12 }} />
        <a href="/cases" style={{ display: "inline-block" }}>
          Cases
        </a>

          <div style={{ height: 12 }} />
        <a href="/api/debug/session" style={{ display: "inline-block" }}>
          API Debug Session
        </a>
        <div style={{ height: 12 }} />

        <a href="/chat" style={{ display: "inline-block" }}>
          Chat
        </a>
        <div style={{ height: 12 }} />


      </section>
    </main>
  );
}
