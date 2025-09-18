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
      // Reuse your existing API (same as the root playground)
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        signal: abortRef.current.signal,
        body: JSON.stringify({
          input: userMsg.content,
          remember: false, // public chat defaults to no memory
        }),
      });

      if (!res.ok) {
        const text = await res.text();
        throw new Error(text || `HTTP ${res.status}`);
      }

      // The existing endpoint streams in your playground; here we consume text fully.
      const reply = await res.text();
      const assistantMsg: ChatMsg = { role: "assistant", content: reply || "(no response)" };
      setMessages((m) => [...m, assistantMsg]);
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
    <main className="min-h-[60vh] bg-neutral-50 dark:bg-neutral-950">
      <div className="mx-auto max-w-2xl px-4 sm:px-6 lg:px-8 py-8">
        <header className="mb-4">
          <h1 className="text-2xl font-semibold tracking-tight text-neutral-900 dark:text-neutral-100">
            Wildlife Triage — Web Chat (MVP)
          </h1>
          <p className="mt-1 text-sm text-neutral-600 dark:text-neutral-400">
            This public chat reuses the existing <code>/api/chat</code> endpoint. It does not store messages yet.
          </p>
        </header>

        {/* Chat transcript */}
        <div className="rounded-2xl bg-white dark:bg-neutral-900 ring-1 ring-black/5 shadow-sm p-4 sm:p-5 mb-4">
          <div className="space-y-4">
            {messages.length === 0 && (
              <p className="text-sm text-neutral-500">No messages yet. Say hello!</p>
            )}
            {messages.map((m, i) => (
              <div key={i} className="flex gap-3">
                <div
                  className={`h-8 w-8 shrink-0 rounded-full ${
                    m.role === "user" ? "bg-blue-500" : "bg-emerald-500"
                  }`}
                  aria-hidden
                />
                <div className="flex-1">
                  <div className="text-xs uppercase tracking-wide text-neutral-500 mb-1">
                    {m.role}
                  </div>
                  <div className="whitespace-pre-wrap text-[15px] leading-7 text-neutral-900 dark:text-neutral-100">
                    {m.content}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Composer */}
        <div className="rounded-2xl bg-white dark:bg-neutral-900 ring-1 ring-black/5 shadow-sm p-3 sm:p-4">
          <textarea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            rows={3}
            placeholder="Describe the animal, location, and situation…"
            className="w-full resize-y rounded-xl border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-900 px-3 py-2 text-[15px] leading-6 text-neutral-900 dark:text-neutral-100 outline-none focus:ring-2 focus:ring-blue-500"
          />
          <div className="mt-3 flex items-center justify-end gap-2">
            <button
              onClick={() => {
                if (abortRef.current) {
                  abortRef.current.abort();
                }
              }}
              className="px-3 py-2 text-sm rounded-xl border border-neutral-300 dark:border-neutral-700 text-neutral-700 dark:text-neutral-300 hover:bg-neutral-50 dark:hover:bg-neutral-800 disabled:opacity-50"
              disabled={!sending}
            >
              Cancel
            </button>
            <button
              onClick={onSend}
              disabled={sending || !input.trim()}
              className="px-4 py-2 text-sm font-medium rounded-xl bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-50"
            >
              {sending ? "Sending…" : "Send"}
            </button>
          </div>
        </div>
      </div>
    </main>
  );
}
