// app/chat/page.tsx
"use client";

import { useEffect, useRef, useState } from "react";
import BrandHeader from "../../components/BrandHeader";
import { supabaseBrowser } from "../../lib/supabaseBrowser";

type ChatMsg = { role: "user" | "assistant"; content: string };

// --- Policy types mirrored from the API response ---
type IntakeStatus = "accept" | "conditional" | "not_supported";
type Policy =
  | { type: "out_of_scope"; public_message: string; referrals: any[] }
  | { type: "org_intake"; status: IntakeStatus; public_message: string | null; referrals: any[] }
  | null;

export default function WebChatPage() {
  const [messages, setMessages] = useState<ChatMsg[]>([]);
  const [conversationId, setConversationId] = useState<string | null>(null);
  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);
  const [policy, setPolicy] = useState<Policy>(null); // ⬅️ NEW
  const abortRef = useRef<AbortController | null>(null);

  // Load prior history + conversation id
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
          const role = r.role === "assistant" ? "assistant" : "user";
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
    if (!input.trim() || sending) return;
    const text = input.trim();

    // Optimistic user bubble
    setMessages((m) => [...m, { role: "user", content: text }]);
    setInput("");
    setSending(true);

    try {
      // 1) Persist user message (creates conversation if needed) — API returns `policy` if detected
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
        setPolicy(null); // clear any prior banner on failure
        return;
      }

      // NEW: capture policy (if any) for the banner
      setPolicy(pjson?.policy ?? null);

      // If the conversation was just created, keep its id for realtime
      if (!conversationId && pjson?.conversation_id) {
        setConversationId(pjson.conversation_id);
      }

      // 2) Get assistant text (browser call)
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

      // 3) Persist assistant message
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

      // Realtime will also deliver this; our de-dupe avoids double-append
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

        {/* Policy Banner (if any) */}
        {policy && <PolicyBanner policy={policy} />}

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

          --blue-50:  #eff6ff;
          --blue-200: #bfdbfe;
          --blue-900: #1e3a8a;
          --amber-50: #fffbeb;
          --amber-200:#fde68a;
          --amber-900:#78350f;
          --emerald-50:#ecfdf5;
          --emerald-200:#a7f3d0;
          --emerald-900:#064e3b;
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

        /* --- Policy banner styles --- */
        .wt-policy {
          border-radius: 12px;
          padding: 12px;
          margin-top: 12px;
          border: 1px solid;
        }
        .wt-policy h4 {
          margin: 0 0 4px 0;
          font-size: 14px;
          font-weight: 700;
        }
        .wt-policy p {
          margin: 0;
          font-size: 14px;
          line-height: 1.5;
          white-space: pre-line;
        }
        .wt-referrals {
          margin-top: 8px;
          display: flex;
          gap: 8px;
          flex-wrap: wrap;
        }
        .wt-ref {
          font-size: 13px;
          padding: 6px 10px;
          border-radius: 10px;
          background: #fff;
          border: 1px solid rgba(0,0,0,0.12);
          text-decoration: none;
          color: inherit;
        }

        .wt-policy-blue   { background: var(--blue-50);   border-color: var(--blue-200);   color: var(--blue-900); }
        .wt-policy-amber  { background: var(--amber-50);  border-color: var(--amber-200);  color: var(--amber-900); }
        .wt-policy-green  { background: var(--emerald-50);border-color: var(--emerald-200);color: var(--emerald-900); }

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

        .wt-avatar {
          width: 32px;
          height: 32px;
          border-radius: 50%;
          display: grid;
          place-items: center;
          background: var(--sage-200);
          color: #fff;
          font-weight: 700;
          flex-shrink: 0;
        }
        .wt-avatar-user {
          background: var(--sage-500);
        }

        .wt-bubble {
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

/* Inline banner component to keep this file self-contained */
function PolicyBanner({ policy }: { policy: NonNullable<Policy> }) {
  const toneClass =
    policy.type === "out_of_scope"
      ? "wt-policy wt-policy-blue"
      : policy.type === "org_intake" && policy.status === "not_supported"
      ? "wt-policy wt-policy-amber"
      : "wt-policy wt-policy-green";

  const headline =
    policy.type === "out_of_scope"
      ? "Not a wildlife case we can admit"
      : policy.type === "org_intake" && policy.status === "not_supported"
      ? "We’re not able to admit this species"
      : "Admission may be possible — let’s evaluate together";

  const message =
    policy.type === "out_of_scope" ? policy.public_message : (policy.public_message ?? "");

  const referrals = (policy as any).referrals ?? [];

  return (
    <section className={toneClass} role="status" aria-live="polite">
      <h4>{headline}</h4>
      {message && <p>{message}</p>}
      {referrals.length > 0 && (
        <div className="wt-referrals">
          {referrals.map((r: any, idx: number) => (
            <a
              key={idx}
              className="wt-ref"
              href={r.url || (r.phone ? `tel:${r.phone}` : "#")}
              target={r.url ? "_blank" : undefined}
              rel="noreferrer"
              title={r.phone ? `${r.label} • ${r.phone}` : r.label}
              onClick={(e) => {
                if (!r.url && !r.phone) e.preventDefault();
              }}
            >
              {r.label}
            </a>
          ))}
        </div>
      )}
    </section>
  );
}
