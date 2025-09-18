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
    const text = input.trim();

    // Optimistic user bubble
    setMessages((m) => [...m, { role: "user", content: text }]);
    setInput("");
    setSending(true);

    try {
      // Single server call: saves user msg, calls agent, saves assistant, returns assistant text
      const controller = new AbortController();
      abortRef.current = controller;

      const resp = await fetch("/api/web-chat/message", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ content: text }),
        cache: "no-store",
        signal: controller.signal,
      });

      const json = await resp.json().catch(() => ({} as any));

      if (!resp.ok || json?.ok === false) {
        const msg =
          json?.error ? `${json.stage ?? "server"}: ${json.error}` : `HTTP ${resp.status}`;
        setMessages((m) => [
          ...m,
          { role: "assistant", content: `Sorry—saving or agent failed (${msg}).` },
        ]);
        return;
      }

      const assistantText = (json?.assistant_text as string) || "(no response)";
      setMessages((m) => [...m, { role: "assistant", content: assistantText }]);
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

        {/* Transcript */}
        <section className="wt-card wt-transcript">
          {messages.length === 0 ? (
            <p className="wt-empty">No messages yet. Say hello!</p>
          ) : (
            <div className="wt-list">
              {messages.map((m, i) => (
                <div key={i} className="wt-row">
                  {/* Avatar (use white icon in dark mode for contrast if available) */}
                  {m.role === "assistant" ? (
                    <picture>
                      <source media="(prefers-color-scheme: dark)" srcSet="/White_Sage.png" />
                      <img
                        src="/Green_Sage.png"
                        alt="Sage"
                        width={32}
                        height={32}
                        className="wt-avatar wt-avatar-sage"
                      />
                    </picture>
                  ) : (
                    <div aria-hidden className="wt-avatar wt-avatar-user">U</div>
                  )}

                  {/* Bubble */}
                  <div
                    className={`wt-bubble ${
                      m.role === "assistant" ? "wt-bubble-assistant" : "wt-bubble-user"
                    }`}
                  >
                    <div className="wt-role">{m.role}</div>
                    <div className="wt-content">{m.content}</div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>

        {/* Composer */}
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

      {/* Scoped CSS: centered layout, readable cards, brand primary */}
      <style jsx>{`
        :root {
          --sage-50: #eff6ef;
          --sage-100: #deede0;
          --sage-200: #bddbc1;
          --sage-300: #9cc9a2;
          --sage-400: #7bbb82;
          --sage-500: #5aa563;
          --sage-600: #48844f;
          --sage-700: #36633c;
          --sage-800: #244228;
          --sage-900: #122114;
          --sage-primary: #6daf75;
          --page-bg: var(--sage-50);
          --card-bg: #ffffff;
          --card-border: rgba(0, 0, 0, 0.08);
          --bubble-user: #f4f7f5;
          --bubble-assistant: #eef7f0;
          --bubble-border: rgba(0, 0, 0, 0.1);
          --text-dark: #0a0a0a;
          --text-light: #f5f5f5;
        }
        @media (prefers-color-scheme: dark) {
          :root {
            --page-bg: #0a0a0a;
            --card-bg: #151515;
            --card-border: rgba(255, 255, 255, 0.08);
            --bubble-user: #1b1b1b;
            --bubble-assistant: #162019;
            --bubble-border: rgba(255, 255, 255, 0.1);
          }
        }

        .wt-main {
          min-height: 60vh;
          background: var(--page-bg);
          color: var(--text-dark);
        }
        @media (prefers-color-scheme: dark) {
          .wt-main {
            color: var(--text-light);
          }
        }

        .wt-wrap {
          max-width: 760px;
          margin: 0 auto;
          padding: 28px 16px;
          font-family: "UCity Pro", ui-sans-serif, system-ui, -apple-system, Segoe UI, Roboto,
            "Helvetica Neue", Arial, "Noto Sans", "Apple Color Emoji", "Segoe UI Emoji";
        }

        .wt-card {
          border-radius: 16px;
          padding: 16px;
          border: 1px solid var(--card-border);
          background: var(--card-bg);
          box-shadow: 0 2px 10px rgba(0, 0, 0, 0.04);
          margin-top: 14px;
        }

        .wt-empty {
          font-size: 14px;
          opacity: 0.7;
          margin: 6px 0;
        }

        .wt-list {
          display: flex;
          flex-direction: column;
          gap: 14px;
        }

        .wt-row {
          display: flex;
          gap: 10px;
          align-items: flex-start;
        }

        .wt-avatar {
          width: 32px;
          height: 32px;
          border-radius: 999px;
          flex-shrink: 0;
          display: grid;
          place-items: center;
          font-size: 12px;
          font-weight: 700;
          border: 1px solid var(--bubble-border);
          background: #fff;
          color: #6b7280;
        }
        .wt-avatar-user {
          background: var(--bubble-user);
        }
        .wt-avatar-sage {
          background: #fff;
          padding: 2px;
          border-color: var(--card-border);
        }

        .wt-bubble {
          flex: 1;
          border-radius: 12px;
          padding: 10px 12px;
          border: 1px solid var(--bubble-border);
          background: var(--bubble-user);
        }
        .wt-bubble-assistant {
          background: var(--bubble-assistant);
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
          border: 1px solid var(--bubble-border);
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
        @media (prefers-color-scheme: dark) {
          .wt-textarea {
            background: #111;
            color: var(--text-light);
          }
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
          cursor: pointer;
          border: 1px solid var(--bubble-border);
          background: #f8f9fb;
          color: #111827;
        }
        .wt-btn:disabled {
          opacity: 0.5;
          cursor: not-allowed;
        }
        .wt-btn-primary {
          background: var(--sage-primary);
          border-color: var(--sage-primary);
          color: #ffffff;
        }
        .wt-btn-primary:hover:enabled {
          filter: brightness(1.05);
        }
        .wt-btn-secondary {
          background: #fff;
        }
        @media (prefers-color-scheme: dark) {
          .wt-btn {
            background: #1e1e1e;
            color: #e5e7eb;
          }
          .wt-btn-secondary {
            background: #151515;
          }
        }
      `}</style>
    </main>
  );
}
