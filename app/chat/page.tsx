// app/chat/page.tsx
"use client";

import { useEffect, useRef, useState } from "react";
import BrandHeader from "../../components/BrandHeader";
import { supabaseBrowser } from "../../lib/supabaseBrowser";
import RateLimitToast from "../../components/RateLimitToast";
import PolicyBanner from "./PolicyBanner"; // ← use your existing banner

type ChatMsg = { role: "user" | "assistant"; content: string };

// Keep Policy as a permissive type so shape differences don't block rendering.
// We only check existence (truthy) to show the banner; the component handles the details.
type Policy = any;

export default function WebChatPage() {
  const [messages, setMessages] = useState<ChatMsg[]>([]);
  const [conversationId, setConversationId] = useState<string | null>(null);
  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);
  const [assistantTyping, setAssistantTyping] = useState(false);
  const [policy, setPolicy] = useState<Policy | null>(null);

  // Rate-limit toast
  const [rlOpen, setRlOpen] = useState(false);
  const [rlMessage, setRlMessage] = useState(
    "You’re sending too quickly. Please wait a few seconds and try again."
  );

  const abortRef = useRef<AbortController | null>(null);
  const trimmed = input.trim();

  // Load prior history + conversation id
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch("/api/web-chat/history", { cache: "no-store" });
        const json = await res.json().catch(() => ({} as any));
        if (!cancelled && res.ok && json?.ok) {
          const prior: ChatMsg[] = (json.messages ?? []).map((m: any) => {
            const role = m.role === "assistant" ? "assistant" : "user";
            return { role, content: String(m.content ?? "") };
          });
          setMessages(prior);
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

  // Realtime subscribe to inserts for this conversation
  useEffect(() => {
    if (!conversationId) return;
    const supa = supabaseBrowser();

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
          const role: "assistant" | "user" = r.role === "assistant" ? "assistant" : "user";
          const content = String(r.content ?? "");
          // Cheap de-dupe: don't add identical consecutive message
          setMessages((prev) => {
            const last = prev[prev.length - 1];
            if (last && last.role === role && last.content === content) return prev;
            return [...prev, { role, content }];
          });
        }
      )
      .subscribe();

    return () => {
      supa.removeChannel(channel);
    };
  }, [conversationId]);

  async function onSend() {
    if (!trimmed || sending) return;
    const text = trimmed;

    // Optimistic user bubble
    setMessages((m) => [...m, { role: "user", content: text }]);
    setInput("");
    setSending(true);
    setAssistantTyping(false);

    try {
      // 1) Persist user message (creates conversation if needed) — API returns `policy` if detected
      const persist = await fetch("/api/web-chat/message", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ content: text }),
        cache: "no-store",
      });

      // Rate limit → roll back optimistic bubble and toast
      if (persist.status === 429) {
        setMessages((prev) => prev.slice(0, -1));
        setRlMessage("You’re sending too quickly. Please wait a few seconds and try again.");
        setRlOpen(true);
        setPolicy(null);
        return;
      }

      const pjson = await persist.json().catch(() => ({} as any));
      if (!persist.ok || pjson?.ok === false) {
        const msg = pjson?.error ? `${pjson.stage ?? "persist"}: ${pjson.error}` : `HTTP ${persist.status}`;
        setMessages((m) => [...m, { role: "assistant", content: `Sorry—saving failed (${msg}).` }]);
        setPolicy(null);
        return;
      }

      // capture policy (if any) for the banner
      setPolicy(pjson?.policy ?? null);

      // If the conversation was just created, keep its id for realtime
      if (!conversationId && pjson?.conversation_id) {
        setConversationId(pjson.conversation_id);
      }

      // 2) Get assistant text (browser call)
      abortRef.current = new AbortController();
      setAssistantTyping(true);
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

      // 3) Persist assistant message; DO NOT append locally — let Realtime deliver it (prevents duplicates)
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
        // Still show the text, but flag save issue
        setMessages((m) => [
          ...m,
          { role: "assistant", content: `${assistantText}\n\n(Warning: save failed — ${msg})` },
        ]);
        return;
      }

      // No local append here; realtime INSERT will render the assistant message.
    } catch (err: any) {
      setMessages((m) => [
        ...m,
        { role: "assistant", content: `Sorry—something went wrong: ${err?.message || err}` },
      ]);
    } finally {
      setAssistantTyping(false);
      setSending(false);
      abortRef.current = null;
    }
  }

  function onComposerKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      if (!trimmed || sending) return;
      void onSend();
    }
  }

  return (
    <main className="wt-main">
      <div className="wt-wrap">
        <BrandHeader title="Sage" subtitle="Wildlife Triage Agent" imageSrc="/Green_Sage.png" />

        {/* Policy Banner (if any) */}
        {policy ? <PolicyBanner policy={policy} /> : null}

        {/* Transcript */}
        <section className="wt-card wt-transcript">
          {messages.length === 0 ? (
            <p className="wt-empty">No messages yet. Say hello!</p>
          ) : (
            <div className="wt-list">
              {messages.map((m, i) => (
                <div key={`${i}-${m.role}-${m.content.slice(0, 12)}`} className="wt-row">
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

              {/* Typing indicator */}
              {assistantTyping && (
                <div className="wt-row wt-typing">
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
                  <div className="wt-bubble wt-bubble-assistant">
                    <div className="wt-role">assistant</div>
                    <div className="wt-typing-dots" aria-live="polite" aria-label="Assistant is typing">
                      <span />
                      <span />
                      <span />
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}
        </section>

        {/* Composer */}
        <section className="wt-card wt-composer">
          <textarea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={onComposerKeyDown}
            rows={3}
            placeholder="Describe the animal, location, and situation…"
            className="wt-textarea"
          />
          <div className="wt-actions">
            <button onClick={() => abortRef.current?.abort()} className="wt-btn wt-btn-secondary" disabled={!sending} aria-disabled={!sending}>
              Cancel
            </button>
            <button onClick={onSend} className="wt-btn wt-btn-primary" disabled={sending || !trimmed} aria-disabled={sending || !trimmed}>
              {sending ? "Sending…" : "Send"}
            </button>
          </div>
        </section>
      </div>

      {/* Toast (rate limit) */}
      <RateLimitToast open={rlOpen} message={rlMessage} onClose={() => setRlOpen(false)} />

      {/* Scoped CSS */}
      <style jsx>{`
        :root {
          --sage-50:  #EFF6EF;
          --sage-200: #BDDBC1;
          --sage-500: #5AA563;
          --sage-primary: #6DAF75;
        }

        .wt-main { min-height: 60vh; background: var(--sage-50); color: #0a0a0a; }
        @media (prefers-color-scheme: dark) {
          .wt-main { background: #0a0a0a; color: #f5f5f5; }
        }

        .wt-wrap { max-width: 760px; margin: 0 auto; padding: 24px 16px; font-family: "UCity Pro", ui-sans-serif, system-ui, -apple-system, Segoe UI, Roboto, "Helvetica Neue", Arial; }

        .wt-card {
          border-radius: 16px;
          padding: 16px;
          border: 1px solid rgba(0, 0, 0, 0.08);
          background: #ffffff;
          box-shadow: 0 1px 2px rgba(0, 0, 0, 0.03);
          margin-top: 12px;
        }
        @media (prefers-color-scheme: dark) {
          .wt-card { background: #161616; border-color: rgba(255, 255, 255, 0.08); box-shadow: none; }
        }

        .wt-empty { font-size: 14px; opacity: 0.7; margin: 6px 0; }
        .wt-list { display: flex; flex-direction: column; gap: 12px; }
        .wt-row { display: flex; gap: 10px; }

        .wt-avatar {
          width: 32px; height: 32px; border-radius: 50%;
          display: grid; place-items: center; background: var(--sage-200);
          color: #fff; font-weight: 700; flex-shrink: 0;
        }
        .wt-avatar-user { background: var(--sage-500); }

        .wt-bubble { flex: 1; }
        .wt-role { text-transform: uppercase; letter-spacing: 0.06em; font-size: 11px; opacity: 0.65; margin-bottom: 2px; }
        .wt-content { white-space: pre-wrap; font-size: 15px; line-height: 1.6; }

        .wt-typing-dots { display: inline-flex; gap: 6px; padding: 8px 0; }
        .wt-typing-dots span {
          width: 6px; height: 6px; border-radius: 999px; background: rgba(0,0,0,0.5);
          animation: wt-bounce 1.3s infinite ease-in-out both;
        }
        .wt-typing-dots span:nth-child(1) { animation-delay: -0.32s; }
        .wt-typing-dots span:nth-child(2) { animation-delay: -0.16s; }
        @keyframes wt-bounce { 0%, 80%, 100% { transform: scale(0); } 40% { transform: scale(1.0); } }

        .wt-textarea {
          width: 100%; resize: vertical; border-radius: 12px;
          border: 1px solid rgba(0, 0, 0, 0.15);
          padding: 10px 12px; background: #fff; color: #0a0a0a; font-size: 15px; line-height: 1.5; outline: none;
        }
        .wt-textarea::placeholder { color: #9ca3af; }

        .wt-actions { display: flex; justify-content: flex-end; gap: 8px; margin-top: 10px; }
        .wt-btn {
          border-radius: 12px; padding: 8px 12px; font-size: 14px;
          border: 1px solid rgba(0, 0, 0, 0.15); background: #f8f9fb; color: #111827; cursor: pointer;
        }
        .wt-btn:disabled { opacity: 0.5; cursor: not-allowed; }
        .wt-btn-primary { background: var(--sage-primary); color: #ffffff; border-color: var(--sage-primary); }
        .wt-btn-primary:hover:enabled { filter: brightness(1.05); }
        .wt-btn-secondary { background: #fff; }
        @media (prefers-color-scheme: dark) {
          .wt-textarea { background: #111; color: #f5f5f5; border-color: rgba(255, 255, 255, 0.15); }
          .wt-btn { background: #1e1e1e; color: #e5e7eb; border-color: rgba(255, 255, 255, 0.15); }
          .wt-btn-primary { background: #5AA563; border-color: #5AA563; }
          .wt-btn-secondary { background: #161616; }
        }
      `}</style>
    </main>
  );
}
