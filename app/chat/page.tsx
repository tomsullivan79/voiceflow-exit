// app/chat/page.tsx
"use client";

import { useEffect, useRef, useState } from "react";
import BrandHeader from "../../components/BrandHeader";
import { supabaseBrowser } from "../../lib/supabaseBrowser";

type ChatMsg = { role: "user" | "assistant"; content: string };

export default function WebChatPage() {
  const [messages, setMessages] = useState<ChatMsg[]>([]);
  const [conversationId, setConversationId] = useState<string | null>(null);
  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);
  const abortRef = useRef<AbortController | null>(null);

  // Load prior history AND conversation_id
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch("/api/web-chat/history", { cache: "no-store" });
        const json = await res.json().catch(() => ({} as any));
        if (!cancelled && res.ok && json?.ok) {
          const prior: ChatMsg[] = (json.messages ?? []).map((m: any) => ({
            role: m.role === "assistant" ? "assistant" : "user",
            content: String(m.content ?? ""),
          }));
          if (prior.length) setMessages(prior);
          setConversationId(json.conversation_id ?? null);
        }
      } catch {
        /* ignore for MVP */
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  // Subscribe to realtime inserts for this conversation
  useEffect(() => {
    if (!conversationId) return;
    const supa = getBrowserSupabase();

    const channel = supa
      .channel(`web-chat-${conversationId}`)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "conversation_messages",
          filter: `conversation_id=eq.${conversationId}`,
        },
        (payload) => {
          const r = payload.new as { role?: string; content?: string };
          const role = r.role === "assistant" ? "assistant" : "user";
          const content = (r.content ?? "") as string;

          // Cheap de-dupe: avoid adding if last message is identical
          setMessages((prev) => {
            const last = prev[prev.length - 1];
            if (last && last.role === role && last.content === content) return prev;
            return [...prev, { role, content }];
          });
        }
      )
      .subscribe((status) => {
        // Optional: console.debug("Realtime status", status);
      });

    return () => {
      supa.removeChannel(channel);
      supa.realtime.disconnect();
    };
  }, [conversationId]);

  async function onSend() {
    if (!input.trim() || sending) return;
    const text = input.trim();

    // Optimistic user bubble
    setMessages((m) => [...m, { role: "user", content: text }]);
    setInput("");
    setSending(true);

    try {
      // 1) Persist user message to DB (creates conversation if needed)
      const persist = await fetch("/api/web-chat/message", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ content: text }),
        cache: "no-store",
      });
      const pjson = await persist.json().catch(() => ({} as any));
      if (!persist.ok || pjson?.ok === false) {
        const msg = pjson?.error ? `${pjson.stage ?? "persist"}: ${pjson.error}` : `HTTP ${persist.status}`;
        setMessages((m) => [...m, { role: "assistant", content: `Sorry—saving failed (${msg}).` }]);
        return;
      }

      // If conversation id was just created, capture it for realtime
      if (!conversationId && pjson?.conversation_id) {
        setConversationId(pjson.conversation_id);
      }

      // 2) Get assistant text from /api/chat in the browser
      abortRef.current = new AbortController();
      const replyRes = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ input: text, remember: false }),
        cache: "no-store",
        signal: abortRef.current.signal,
      });
      if (!replyRes.ok) {
        const t = await replyRes.text();
        setMessages((m) => [...m, { role: "assistant", content: `Agent failed: ${t || replyRes.status}` }]);
        return;
      }
      const assistantText = (await replyRes.text()) || "(no response)";

      // 3) Persist assistant message to DB
      const saveAssistant = await fetch("/api/web-chat/assistant", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ content: assistantText }),
        cache: "no-store",
      });
      const sajson = await saveAssistant.json().catch(() => ({} as any));
      if (!saveAssistant.ok || sajson?.ok === false) {
        const msg = sajson?.error
          ? `${sajson.stage ?? "assistant-save"}: ${sajson.error}`
          : `HTTP ${saveAssistant.status}`;
        // Show text anyway, but flag save issue
        setMessages((m) => [
          ...m,
          { role: "assistant", content: `${assistantText}\n\n(Warning: save failed — ${msg})` },
        ]);
        return;
      }

      // The realtime listener will also append this row; our cheap de-dupe avoids double-add.
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
                <div key={`${i}-${m.role}`} className="wt-row">
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
                  <div className={`wt-bubble ${m.role === "assistant" ? "wt-bubble-assistant" : "wt-bubble-user"}`}>
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
            <button onClick={() => abortRef.current?.abort()} className="wt-btn wt-btn-secondary" disabled={!sending}>
              Cancel
            </button>
            <button onClick={onSend} className="wt-btn wt-btn-primary" disabled={sending || !input.trim()}>
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

      {/* (Keep your existing scoped CSS; omitted here for brevity) */}
    </main>
  );
}
