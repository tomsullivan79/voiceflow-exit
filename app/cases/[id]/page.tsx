// app/cases/[id]/page.tsx
import Link from "next/link";
import { notFound } from "next/navigation";
import { supabaseAdmin } from "../../../lib/supabaseServer";
import AutoRefresher from "./AutoRefresher";
import CloseCaseButton from "./CloseCaseButton";

export const dynamic = "force-dynamic";
export const fetchCache = "force-no-store";

type PageProps = { params: { id: string } };

type Conversation = {
  id: string;
  title: string | null;
  created_at: string;
  closed_at: string | null;
};
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
      <AutoRefresher conversationId={conversationId} />

      <div className="wt-wrap">
        <header className="wt-header">
          <h1>{conv.title || "Web Chat"}</h1>

          <div className="wt-meta">
            <span>
              Created: {new Date(conv.created_at).toLocaleString("en-US", { timeZone: "America/Chicago" })}
            </span>
            {conv.closed_at ? <span> • Status: Closed</span> : <span> • Status: Open</span>}
          </div>

          <div className="wt-actions">
            <Link className="wt-btn" href="/cases">← Back to Cases</Link>
            {!conv.closed_at && <CloseCaseButton conversationId={conversationId} />}
          </div>
        </header>

        <section className="wt-card wt-thread">
          {messages.length === 0 ? (
            <div className="wt-empty">No messages yet.</div>
          ) : (
            <ul className="wt-list" style={{ gap: 10 }}>
              {messages.map((m, i) => (
                <li
                  key={`${i}-${m.created_at}`}
                  className={`wt-msg ${m.role === "assistant" ? "wt-assistant" : "wt-user"}`}
                >
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
    </main>
  );
}
