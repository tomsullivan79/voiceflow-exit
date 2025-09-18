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

      {/* (Keep your existing scoped CSS; omitted here for brevity) */}
    </main>
  );
}
