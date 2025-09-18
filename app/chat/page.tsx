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

        {/* Transcript card */}
        <section className="wt-card wt-transcript">
          {messages.length === 0 ? (
            <p className="wt-empty">No messages yet. Say hello!</p>
          ) : (
            <div className="wt-list">
              {messages.map((m, i) => (
                <div key={i} className="wt-row">
                  {/* Avatar */}
                  {m.role === "assistant" ? (
                    <img
                      src="/Green_Sage.png"
                      alt="Sage"
                      width={32}
                      height={32}
                      className="wt-avatar wt-avatar-sage"
                    />
                  ) : (
                    <div aria-hidden className="wt-avatar wt-avatar-user">U</div>
                  )}

                  {/* Bubble */}
                  <div className={`wt-bubble ${m.role === "assistant" ? "wt-bubble-assistant" : "wt-bubble-user"}`}>
                    <div className="wt-role">{m.role}</div>
                    <div className="wt-content">{m.content}</div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>

        {/* Composer card */}
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

      {/* Scoped CSS with strong light/dark contrast + brand primary always */}
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
          --sage-primary: #6DAF75; /* brand green */
          --text-dark: #0a0a0a;
          --text-light: #f5f5f5;
          --card-bg: #ffffff;
          --bubble-user: #f4f7f5;
          --bubble-assistant: #eef7f0;
          --bubble-border: rgba(0,0,0,0.08);
        }
        @media (prefers-color-scheme: dark) {
          :root {
            --card-bg: #151515;
            --bubble-user: #1b1b1b;
            --bubble-assistant: #162019; /* green-tinted dark */
            --bubble-border: rgba(255,255,255,0.08);
          }
        }

        .wt-main {
          min-height: 60vh;
          background: var(--sage-50);
          color: var(--text-dark);
        }
        @media (prefers-color-scheme: dark) {
          .wt-main { background: #0a0a0a; color: var(--text-light); }
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
          border: 1px solid var(--bubble-border);
          background: var(--card-bg);
          box-shadow: 0 1px 2px rgba(0,0,0,0.03);
          margin-top: 12px;
        }

        .wt-empty { font-size: 14px; opacity: 0.7; margin: 6px 0; }

        .wt-list { display: flex; flex-direction: column; gap: 14px; }

        .wt-row { display: flex; gap: 10px; align-items: flex-start; }

        .wt-avatar {
          width: 32px; height: 32px; border-radius: 999px; flex-shrink: 0;
          display: grid; place-items: center; font-size: 12px; font-weight: 700;
          border: 1px solid var(--bubble-border);
          background: #fff; color: #6b7280;
        }
        .wt-avatar-user { background: var(--bubble-user); }
        .wt-avatar-sage { background: #fff; padding: 2px; }

        .wt-bubble {
          flex: 1;
          border-radius: 12px;
          padding: 10px 12px;
          border: 1px solid var(--bubble-border);
          background: var(--bubble-user);
        }
        .wt-bubble-assistant { background: var(--bubble-assistant); }

        .wt-role {
          text-transform: uppercase; letter-spacing: 0.06em;
          font-size: 11px; opacity: 0.65; margin-bottom: 2px;
        }
        .wt-content { white-space: pre-wrap; font-size: 15px; line-height: 1.6; }

        .wt-textarea {
          width: 100%; resize: vertical; border-radius: 12px;
          border: 1px solid var(--bubble-border);
          padding: 10px 12px; background: #fff; color: var(--text-dark);
          font-size: 15px; line-height: 1.5; outline: none;
        }
        .wt-textarea::placeholder { color: #9ca3af; }
        @media (prefers-color-scheme: dark) {
          .wt-textarea { background: #111; color: var(--text-light); }
        }

        .wt-actions { display: flex; justify-content: flex-end; gap: 8px; margin-top: 10px; }

        .wt-btn {
          border-radius: 12px; padding: 8px 12px; font-size: 14px; cursor: pointer;
          border: 1px solid var(--bubble-border);
          background: #f8f9fb; color: #111827;
        }
        .wt-btn:disabled { opacity: 0.5; cursor: not-allowed; }

        /* Force brand green for primary in both modes */
        .wt-btn-primary {
          background: var(--sage-primary) !important;
          border-color: var(--sage-primary) !important;
          color: #ffffff !important;
        }
        .wt-btn-primary:hover:enabled { filter: brightness(1.05); }

        .wt-btn-secondary { background: #fff; }
        @media (prefers-color-scheme: dark) {
          .wt-btn { background: #1e1e1e; color: #e5e7eb; }
          .wt-btn-secondary { background: #151515; }
        }
      `}</style>
    </main>
  );
}
