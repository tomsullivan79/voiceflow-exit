// app/cases/[id]/page.tsx
import { notFound } from "next/navigation";
import { supabaseAdmin } from "../../../lib/supabaseServer";
import RefreshDetailClient from "./RefreshDetailClient";
import RefreshDetailClient from "./RefreshDetailClient";
export const dynamic = "force-dynamic";

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
      <RefreshDetailClient conversationId={conversationId} />
      <div className="wt-wrap">
        <header className="wt-header">
          <h1>{conv.title || "Case"}</h1>
          <div style={{ fontSize: 12, opacity: 0.75 }}>
            <span>
              Created: {new Date(conv.created_at).toLocaleString("en-US", { timeZone: "America/Chicago" })}
            </span>
            {conv.closed_at ? <span> • Status: Closed</span> : <span> • Status: Open</span>}
          </div>
        </header>

        <section>
          {messages.length === 0 ? (
            <div>No messages yet.</div>
          ) : (
            messages.map((m, i) => (
              <div key={`${i}-${m.created_at}`}>
                <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12, opacity: 0.8 }}>
                  <span style={{ textTransform: "uppercase", letterSpacing: "0.06em" }}>{m.role}</span>
                  <span>
                    {new Date(m.created_at).toLocaleString("en-US", { timeZone: "America/Chicago" })}
                  </span>
                </div>
                <div style={{ whiteSpace: "pre-wrap" }}>{m.content ?? ""}</div>
                {/* spacer */}
                {i < messages.length - 1 ? <div style={{ height: 12 }} /> : null}
              </div>
            ))
          )}
        </section>
      </div>
    </main>
  );
}