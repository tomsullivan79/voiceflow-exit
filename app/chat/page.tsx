// app/chat/page.tsx
"use client";

import { useRef, useState } from "react";

type ChatMsg = { role: "user" | "assistant"; content: string };

export default function WebChatPage() {
  const [messages, setMessages] = useState<ChatMsg[]>([]);
  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);
  const abortRef = useRef<AbortController | null>(null);

  async function onSend() {
    if (!input.trim() || sending) return;
    const userMsg: ChatMsg = { role: "user", content: input.trim() };
    setMessages((m) => [...m, userMsg]);
    setInput("");
    setSending(true);

    try {
      abortRef.current = new AbortController();
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        signal: abortRef.current.signal,
        body: JSON.stringify({
          input: userMsg.content,
          remember: false,
        }),
      });

      if (!res.ok) {
        const text = await res.text();
        throw new Error(text || `HTTP ${res.status}`);
      }

      const reply = await res.text();
      const assistantMsg: ChatMsg = {
        role: "assistant",
        content: reply || "(no response)",
      };
      setMessages((m) => [...m, assistantMsg]);
    } catch (err: any) {
      setMessages((m) => [
        ...m,
        {
          role: "assistant",
          content: `Sorry—something went wrong: ${err?.message || err}`,
        },
      ]);
    } finally {
      setSending(false);
      abortRef.current = null;
    }
  }

  return (
    <main className="wt-main">
      <div className="wt-wrap">
        <header className="wt-header">
          <h1 className="wt-title">Wildlife Triage — Web Chat (MVP)</h1>
          <p className="wt-sub">
            This public chat reuses the <code>/api/chat</code> endpoint. It does not store messages yet.
          </p>
        </header>

        <section className="wt-card wt-transcript">
          {messages.length === 0 ? (
            <p className="wt-empty">No messages yet. Say hello!</p>
          ) : (
            <div className="wt-list">
              {messages.map((m, i) => (
                <div key={i} className="wt-row">
                  <div
                    className={`wt-dot ${m.role === "user" ? "wt-user" : "wt-assistant"}`}
                    aria-hidden
                  />
                  <div className="wt-msg">
                    <div className="wt-role">{m.role}</div>
                    <div className="wt-content">{m.content}</div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>

        <section className="wt-card wt-composer">
          <textarea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            rows={3}
            placeholder="Describe the animal, location, and situation…"
            className="wt-textarea"
          />
          <div className="wt-actions">
            <button
              onClick={() => abortRef.current?.abort()}
              className="wt-btn wt-btn-secondary"
              disabled={!sending}
            >
              Cancel
            </button>
            <button
              onClick={onSend}
              className="wt-btn wt-btn-primary"
              disabled={sending || !input.trim()}
            >
              {sending ? "Sending…" : "Send"}
            </button>
          </div>
        </section>
      </div>

      {/* Component-scoped CSS: centered, padded, dark-mode friendly */}
      <style jsx>{`
        .wt-main {
          min-height: 60vh;
          background: #fafafa;
          color: #0a0a0a;
        }
        @media (prefers-color-scheme: dark) {
          .wt-main {
            background: #0a0a0a;
            color: #f5f5f5;
          }
        }
        .wt-wrap {
          max-width: 760px;
          margin: 0 auto;
          padding: 24px 16px;
        }
        .wt-header {
          margin-bottom: 12px;
        }
        .wt-title {
          font-size: 24px;
          line-height: 1.25;
          font-weight: 700;
          margin: 0;
        }
        .wt-sub {
          margin: 6px 0 0 0;
          font-size: 14px;
          opacity: 0.8;
        }
        .wt-card {
          border-radius: 16px;
          padding: 16px;
          border: 1px solid rgba(0, 0, 0, 0.08);
          background: #ffffff;
          box-shadow: 0 1px 2px rgba(0, 0, 0, 0.03);
          margin-bottom: 12px;
        }
        @media (prefers-color-scheme: dark) {
          .wt-card {
            background: #161616;
            border-color: rgba(255, 255, 255, 0.08);
            box-shadow: none;
          }
        }
        .wt-empty {
          font-size: 14px;
          opacity: 0.7;
          margin: 6px 0;
        }
        .wt-list {
          display: flex;
          flex-direction: column;
          gap: 12px;
        }
        .wt-row {
          display: flex;
          gap: 10px;
        }
        .wt-dot {
          width: 28px;
          height: 28px;
          border-radius: 999px;
          flex-shrink: 0;
          background: #d1d5db;
        }
        .wt-user {
          background: #3b82f6;
        }
        .wt-assistant {
          background: #10b981;
        }
        .wt-msg {
          flex: 1;
        }
        .wt-role {
          text-transform: uppercase;
          letter-spacing: 0.06em;
          font-size: 11px;
          opacity: 0.65;
          margin-bottom: 2px;
        }
        .wt-content {
          white-space: pre-wrap;
          font-size: 15px;
          line-height: 1.6;
        }
        .wt-textarea {
          width: 100%;
          resize: vertical;
          border-radius: 12px;
          border: 1px solid rgba(0, 0, 0, 0.15);
          padding: 10px 12px;
          background: #fff;
          color: #0a0a0a;
          font-size: 15px;
          line-height: 1.5;
          outline: none;
        }
        .wt-textarea::placeholder {
          color: #9ca3af;
        }
        .wt-actions {
          display: flex;
          justify-content: flex-end;
          gap: 8px;
          margin-top: 10px;
        }
        .wt-btn {
          border-radius: 12px;
          padding: 8px 12px;
          font-size: 14px;
          border: 1px solid rgba(0, 0, 0, 0.15);
          background: #f8f9fb;
          color: #111827;
          cursor: pointer;
        }
        .wt-btn:disabled {
          opacity: 0.5;
          cursor: not-allowed;
        }
        .wt-btn-primary {
          background: #2563eb;
          color: #ffffff;
          border-color: #2563eb;
        }
        .wt-btn-primary:hover:enabled {
          filter: brightness(1.05);
        }
        .wt-btn-secondary {
          background: #fff;
        }
        @media (prefers-color-scheme: dark) {
          .wt-textarea {
            background: #111;
            color: #f5f5f5;
            border-color: rgba(255, 255, 255, 0.15);
          }
          .wt-btn {
            background: #1e1e1e;
            color: #e5e7eb;
            border-color: rgba(255, 255, 255, 0.15);
          }
          .wt-btn-primary {
            background: #3b82f6;
            border-color: #3b82f6;
          }
          .wt-btn-secondary {
            background: #161616;
          }
        }
      `}</style>
    </main>
  );
}
