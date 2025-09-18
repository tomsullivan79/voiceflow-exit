// app/chat/page.tsx
"use client";

import { useRef, useState } from "react";
import BrandHeader from "../../components/BrandHeader";

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
        body: JSON.stringify({ input: userMsg.content, remember: false }),
      });
      if (!res.ok) {
        const text = await res.text();
        throw new Error(text || `HTTP ${res.status}`);
      }
      const reply = await res.text();
      setMessages((m) => [...m, { role: "assistant", content: reply || "(no response)" }]);
    } catch (err: any) {
      setMessages((m) => [
        ...m,
        { role: "assistant", content: `Sorry—something went wrong: ${err?.message || err}` },
      ]);
    } finally {
      setSending(false);
      abortRef.current = null;
    }
  }

  return (
    <main className="wt-main">
      <div className="wt-wrap">
        <BrandHeader title="Sage" subtitle="Wildlife Triage Agent" imageSrc="/Green_Sage.png" />

        <section className="wt-card wt-transcript">
          {messages.length === 0 ? (
            <p className="wt-empty">No messages yet. Say hello!</p>
          ) : (
            <div className="wt-list">
              {messages.map((m, i) => (
                <div key={i} className="wt-row">
                  <div className={`wt-dot ${m.role === "user" ? "wt-user" : "wt-assistant"}`} />
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

      {/* Scoped CSS with your palette + primary color */}
      <style jsx>{`
        :root {
          --sage-50:  #EFF6EF;
          --sage-100: #DEEDE0;
          --sage-200: #BDDBC1;
          --sage-300: #9CC9A2;
          --sage-400: #7BBB82;
          --sage-500: #5AA563;
          --sage-600: #48844F;
          --sage-700: #36633C;
          --sage-800: #244228;
          --sage-900: #122114;
          --sage-primary: #6DAF75; /* voiceflow primary */
          --text-dark: #0a0a0a;
          --text-light: #f5f5f5;
        }

        .wt-main {
          min-height: 60vh;
          background: var(--sage-50);
          color: var(--text-dark);
        }
        @media (prefers-color-scheme: dark) {
          .wt-main {
            background: #0a0a0a;
            color: var(--text-light);
          }
        }

        .wt-wrap {
          max-width: 760px;
          margin: 0 auto;
          padding: 24px 16px;
          font-family: "UCity Pro", ui-sans-serif, system-ui, -apple-system, Segoe UI,
            Roboto, "Helvetica Neue", Arial, "Noto Sans", "Apple Color Emoji", "Segoe UI Emoji";
        }

        .wt-card {
          border-radius: 16px;
          padding: 16px;
          border: 1px solid rgba(0, 0, 0, 0.08);
          background: #ffffff;
          box-shadow: 0 1px 2px rgba(0, 0, 0, 0.03);
          margin-top: 12px;
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
          background: var(--sage-200);
        }
        .wt-user {
          background: var(--sage-500);
        }
        .wt-assistant {
          background: var(--sage-400);
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
          color: var(--text-dark);
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
          background: var(--sage-primary);
          color: #ffffff;
          border-color: var(--sage-primary);
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
            color: var(--text-light);
            border-color: rgba(255, 255, 255, 0.15);
          }
          .wt-btn {
            background: #1e1e1e;
            color: #e5e7eb;
            border-color: rgba(255, 255, 255, 0.15);
          }
          .wt-btn-primary {
            background: var(--sage-500);
            border-color: var(--sage-500);
          }
          .wt-btn-secondary {
            background: #161616;
          }
        }
      `}</style>
    </main>
  );
}
