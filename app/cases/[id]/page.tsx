// app/cases/[id]/page.tsx
import { notFound } from "next/navigation";
import { supabaseAdmin } from "../../../lib/supabaseServer";
import RefreshDetailClient from "./RefreshDetailClient";

export const dynamic = "force-dynamic";

type PageProps = { params: { id: string } };

type Conversation = { id: string; title: string | null; created_at: string; closed_at: string | null };
type MessageRow = { role: "user" | "assistant" | string; content: string | null; created_at: string };

async function getConversation(id: string): Promise<Conversation | null> {
  const admin = supabaseAdmin();
  const { data, error } = await admin
    .from("conversations")
    .select("id, title, created_at, closed_at")
    .eq("id", id)
    .maybeSingle();
  if (error) throw new Error(`conversation_select_failed: ${error.message}`);
  return (data ?? null) as Conversation | null;
}

async function getMessages(id: string): Promise<MessageRow[]> {
  const admin = supabaseAdmin();
  const { data, error } = await admin
    .from("conversation_messages")
    .select("role, content, created_at")
    .eq("conversation_id", id)
    .order("created_at", { ascending: true });
  if (error) throw new Error(`messages_select_failed: ${error.message}`);
  return (data ?? []) as MessageRow[];
}

export default async function CaseDetailPage({ params }: PageProps) {
  const conversationId = params.id;
  const conv = await getConversation(conversationId);
  if (!conv) notFound();

  const messages = await getMessages(conversationId);

  return (
    <main className="wt-main">
      {/* Client bridge for realtime detail refresh */}
      <RefreshDetailClient conversationId={conversationId} />

      <div className="wt-wrap">
        <header className="wt-header">
          <h1>{conv.title || "Case"}</h1>
          <div className="wt-meta">
            <span>Created: {new Date(conv.created_at).toLocaleString("en-US", { timeZone: "America/Chicago" })}</span>
            {conv.closed_at ? (
              <span> • Status: Closed</span>
            ) : (
              <span> • Status: Open</span>
            )}
          </div>
        </header>

        <section className="wt-card wt-thread">
          {messages.length === 0 ? (
            <div className="wt-empty">No messages yet.</div>
          ) : (
            <ul className="wt-list">
              {messages.map((m, i) => (
                <li key={`${i}-${m.created_at}`} className={`wt-msg ${m.role === "assistant" ? "wt-assistant" : "wt-user"}`}>
                  <div className="wt-head">
                    <span className="wt-role">{m.role}</span>
                    <span className="wt-time">
                      {new Date(m.created_at).toLocaleString("en-US", { timeZone: "America/Chicago" })}
                    </span>
                  </div>
                  <div className="wt-body">{m.content ?? ""}</div>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>

      <style jsx>{`
        .wt-main { min-height: 60vh; }
        .wt-wrap { max-width: 900px; margin: 0 auto; padding: 24px 16px; }
        .wt-header h1 { margin: 0; font-size: 22px; }
        .wt-meta { margin-top: 6px; font-size: 12px; opacity: 0.75; }
        .wt-card {
          border-radius: 16px; padding: 16px;
          border: 1px solid rgba(0,0,0,0.08); background: #fff; margin-top: 12px;
        }
        @media (prefers-color-scheme: dark) {
          .wt-card { background: #161616; border-color: rgba(255,255,255,0.12); }
        }
        .wt-empty { opacity: 0.7; }
        .wt-list { display: grid; gap: 12px; padding: 0; margin: 0; list-style: none; }
        .wt-msg { border-radius: 12px; padding: 10px; background: #fafafa; }
        .wt-assistant { background: #eef6ff; }
        .wt-user { background: #f4fce3; }
        @media (prefers-color-scheme: dark) {
          .wt-msg { background: #1b1b1b; }
          .wt-assistant { background: rgba(147,197,253,0.12); }
          .wt-user { background: rgba(163,230,53,0.12); }
        }
        .wt-head { display: flex; justify-content: space-between; font-size: 12px; opacity: 0.8; margin-bottom: 6px; }
        .wt-role { text-transform: uppercase; letter-spacing: 0.06em; }
        .wt-time { font-variant-numeric: tabular-nums; }
        .wt-body { white-space: pre-wrap; }
      `}</style>
    </main>
  );
}
