// app/cases/[id]/page.tsx
import "server-only";
import { createClient } from "@supabase/supabase-js";
import { redirect } from "next/navigation";
import twilio from "twilio";
import Link from "next/link";

function getAdminClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE!;
  if (!url || !serviceKey) throw new Error("Missing Supabase env vars.");
  return createClient(url, serviceKey, { auth: { persistSession: false } });
}

const DISABLE_OUTBOUND_SMS = process.env.DISABLE_OUTBOUND_SMS === "true";
const TWILIO_ACCOUNT_SID = process.env.TWILIO_ACCOUNT_SID!;
const TWILIO_AUTH_TOKEN = process.env.TWILIO_AUTH_TOKEN!;
const TWILIO_MESSAGING_SERVICE_SID = process.env.TWILIO_MESSAGING_SERVICE_SID!;

type Conversation = {
  id: string;
  title?: string | null;
  participant_phone?: string | null;
  closed_at?: string | null;
};

type ConversationMessage = {
  id: string;
  conversation_id: string;
  role: "user" | "assistant" | "system";
  content: string;
  created_at: string;
  message_sid: string | null;
};

async function getConversationAndMessages(conversationId: string) {
  const supabase = getAdminClient();

  const { data: convo, error: convoErr } = await supabase
    .from("conversations")
    .select("*")
    .eq("id", conversationId)
    .single();
  if (convoErr || !convo) throw new Error("Conversation not found");

  const { data: messages, error: msgErr } = await supabase
    .from("conversation_messages")
    .select("*")
    .eq("conversation_id", conversationId)
    .order("created_at", { ascending: true });
  if (msgErr) throw msgErr;

  return {
    conversation: convo as Conversation,
    messages: (messages || []) as ConversationMessage[],
  };
}

async function getLatestStatusesFor(messageSids: string[]) {
  if (messageSids.length === 0) return new Map<string, any>();
  const supabase = getAdminClient();
  const { data, error } = await supabase
    .from("sms_event_latest")
    .select("*")
    .in("message_sid", messageSids);
  if (error) throw error;

  const map = new Map<string, any>();
  for (const row of data || []) map.set(row.message_sid, row);
  return map;
}

function explainTwilioError(code?: string | null) {
  switch (code) {
    case "30003": return "Unreachable destination handset.";
    case "30004": return "Blocked by carrier or user.";
    case "30005": return "Unknown or inactive number.";
    case "30006": return "Landline or unreachable route.";
    case "30007": return "Carrier filter (spam).";
    case "30034": return "A2P 10DLC registration/campaign issue.";
    default: return null;
  }
}

function StatusChip({ status }: { status?: string | null }) {
  const s = (status || "").toLowerCase();
  let bg = "#e5e7eb", fg = "#111827";
  if (s === "delivered") { bg = "#d1fae5"; fg = "#065f46"; }
  else if (s === "failed" || s === "undelivered") { bg = "#fee2e2"; fg = "#991b1b"; }
  else if (s === "sent" || s === "queued" || s === "accepted") { bg = "#dbeafe"; fg = "#1e40af"; }
  else if (s === "receiving" || s === "received") { bg = "#ede9fe"; fg = "#5b21b6"; }

  return (
    <span style={{
      display: "inline-block",
      padding: "2px 8px",
      borderRadius: 999,
      fontSize: 12,
      fontWeight: 700,
      background: bg,
      color: fg,
    }}>
      {status || "—"}
    </span>
  );
}

/* ----------------- Server actions ----------------- */

export async function sendReply(formData: FormData) {
  "use server";
  const supabase = getAdminClient();

  const conversationId = String(formData.get("conversationId") || "");
  const body = String(formData.get("body") || "").trim();
  if (!conversationId || !body) return;

  // Guard: don't send if case closed
  const { data: c } = await supabase
    .from("conversations")
    .select("closed_at, participant_phone")
    .eq("id", conversationId)
    .single();
  if (!c) return redirect(`/cases/${conversationId}`);
  const isClosed = !!c.closed_at;

  const to = (c.participant_phone || "").trim();
  const initialContent = DISABLE_OUTBOUND_SMS ? `${body}\n\n[not sent – A2P pending]` : body;

  const { data: inserted } = await supabase
    .from("conversation_messages")
    .insert({
      conversation_id: conversationId,
      role: "assistant",
      content: isClosed
        ? `${initialContent}\n\n[not sent – case closed]`
        : to
        ? initialContent
        : `${initialContent}\n\n[not sent – missing recipient number]`,
      message_sid: null,
    })
    .select("id")
    .single();

  const messageRowId = inserted?.id as string | undefined;
  if (!messageRowId) return redirect(`/cases/${conversationId}`);

  if (isClosed || DISABLE_OUTBOUND_SMS || !to) return redirect(`/cases/${conversationId}`);

  try {
    const client = twilio(TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN);
    const sent = await client.messages.create({
      to,
      body,
      messagingServiceSid: TWILIO_MESSAGING_SERVICE_SID,
    });

    await supabase
      .from("conversation_messages")
      .update({ message_sid: sent.sid })
      .eq("id", messageRowId);
  } catch (err: any) {
    await supabase
      .from("conversation_messages")
      .update({ content: `${initialContent}\n\n[send error: ${err?.message || "unknown"}]` })
      .eq("id", messageRowId);
  }

  redirect(`/cases/${conversationId}`);
}

export async function closeCase(formData: FormData) {
  "use server";
  const supabase = getAdminClient();
  const conversationId = String(formData.get("conversationId") || "");
  if (!conversationId) return;

  await supabase
    .from("conversations")
    .update({ closed_at: new Date().toISOString() })
    .eq("id", conversationId);

  redirect(`/cases/${conversationId}`);
}

export async function reopenCase(formData: FormData) {
  "use server";
  const supabase = getAdminClient();
  const conversationId = String(formData.get("conversationId") || "");
  if (!conversationId) return;

  await supabase
    .from("conversations")
    .update({ closed_at: null })
    .eq("id", conversationId);

  redirect(`/cases/${conversationId}`);
}

/* ----------------- Page ----------------- */

export default async function CasePage({ params }: { params: { id: string } }) {
  const { conversation, messages } = await getConversationAndMessages(params.id);

  const sids = messages
    .filter((m) => m.role === "assistant" && m.message_sid)
    .map((m) => m.message_sid!) as string[];
  const statusBySid = await getLatestStatusesFor(Array.from(new Set(sids)));

  const isClosed = !!conversation.closed_at;

  // shared styles (high-contrast on white cards)
  const card: React.CSSProperties = {
    border: "1px solid #d1d5db",
    background: "#ffffff",
    color: "#111827",
    borderRadius: 8,
    padding: 16,
  };
  const meta: React.CSSProperties = { fontSize: 12, color: "#6b7280" };

  return (
    <main style={{ maxWidth: 720, margin: "32px auto", padding: 24 }}>
      {/* Header */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 8 }}>
        <Link href="/cases" style={{ fontSize: 14, color: "#93c5fd", textDecoration: "underline" }}>
          ← Back to cases
        </Link>
        <h1 style={{ fontSize: 22, fontWeight: 700, color: "#f9fafb", textAlign: "center", flex: 1 }}>
          Case: {conversation.title || conversation.id}
        </h1>
        <div style={{ width: 220, display: "flex", justifyContent: "flex-end", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
          {isClosed ? (
            <>
              <span style={{ padding: "6px 10px", borderRadius: 6, fontSize: 12, fontWeight: 700, background: "#fee2e2", color: "#991b1b", border: "1px solid #fecaca" }}>
                Closed {conversation.closed_at ? `• ${new Date(conversation.closed_at).toLocaleString()}` : ""}
              </span>
              <form action={reopenCase}>
                <input type="hidden" name="conversationId" value={conversation.id} />
                <button
                  type="submit"
                  style={{ padding: "8px 12px", background: "#111827", color: "#fff", borderRadius: 6, fontWeight: 700 }}
                  title="Reopen this case"
                >
                  Reopen case
                </button>
              </form>
            </>
          ) : (
            <form action={closeCase}>
              <input type="hidden" name="conversationId" value={conversation.id} />
              <button
                type="submit"
                style={{ padding: "8px 12px", background: "#111827", color: "#fff", borderRadius: 6, fontWeight: 700 }}
                title="Mark this case as closed"
              >
                Close case
              </button>
            </form>
          )}
        </div>
      </div>

      {/* Messages */}
      <div style={{ display: "grid", gap: 12 }}>
        {messages.map((message) => {
          const status =
            message.role === "assistant" && message.message_sid
              ? statusBySid.get(message.message_sid)
              : null;

          return (
            <div key={message.id} style={card}>
              <div style={meta}>
                {message.role.toUpperCase()} • {new Date(message.created_at).toLocaleString()}
              </div>

              <div style={{ marginTop: 8, whiteSpace: "pre-wrap" }}>{message.content}</div>

              {message.role === "assistant" && message.message_sid ? (
                <div style={{ marginTop: 12, borderTop: "1px solid #e5e7eb", paddingTop: 8 }}>
                  <div style={{ display: "flex", flexWrap: "wrap", gap: 8, alignItems: "center" }}>
                    <span style={{ fontWeight: 700 }}>Delivery:</span>
                    <StatusChip status={status?.message_status} />
                    <span style={{ color: "#9ca3af" }}>•</span>
                    <span style={{ fontSize: 11, color: "#6b7280" }}>SID: {message.message_sid}</span>
                    <span style={{ color: "#9ca3af" }}>•</span>
                    <span style={{ fontSize: 11, color: "#6b7280" }}>
                      Updated: {status?.created_at ? new Date(status.created_at).toLocaleString() : "—"}
                    </span>
                    <span style={{ color: "#9ca3af" }}>•</span>
                    <Link href={`/sms/${message.message_sid}`} style={{ color: "#1e40af", textDecoration: "underline" }}>
                      View history
                    </Link>
                  </div>

                  {status?.error_code ? (
                    <div style={{ marginTop: 4, fontSize: 13, color: "#111827" }}>
                      <span style={{ fontWeight: 700 }}>ErrorCode:</span> {status.error_code}
                      {(() => {
                        const tip = explainTwilioError(status.error_code);
                        return tip ? <span> — {tip}</span> : null;
                      })()}
                      {status?.error_message ? ` — ${status.error_message}` : ""}
                    </div>
                  ) : null}
                </div>
              ) : null}
            </div>
          );
        })}
      </div>

      {/* Reply form */}
      <div style={{ border: "1px solid #d1d5db", background: "#ffffff", color: "#111827", borderRadius: 8, padding: 16, marginTop: 16 }}>
        <form action={sendReply} style={{ display: "grid", gap: 12 }}>
          <input type="hidden" name="conversationId" value={conversation.id} />
          <div>
            <label htmlFor="reply" style={{ display: "block", fontSize: 14, fontWeight: 700, marginBottom: 6 }}>
              Your reply
            </label>
            <textarea
              id="reply"
              name="body"
              placeholder={isClosed ? "Case is closed — replies are disabled." : "Type your reply…"}
              rows={3}
              required
              disabled={isClosed}
              style={{ width: "100%", padding: "10px 12px", border: "1px solid #6b7280", borderRadius: 6, color: "#111827", background: isClosed ? "#f3f4f6" : "#fff" }}
            />
          </div>
          <div style={{ display: "flex", gap: 12, alignItems: "center", flexWrap: "wrap" }}>
            <button
              type="submit"
              disabled={isClosed || DISABLE_OUTBOUND_SMS}
              title={
                isClosed
                  ? "Case is closed"
                  : DISABLE_OUTBOUND_SMS
                  ? "Outbound SMS disabled (A2P pending)"
                  : "Send SMS"
              }
              style={{
                padding: "10px 14px",
                background: isClosed || DISABLE_OUTBOUND_SMS ? "#9ca3af" : "#111827",
                color: "#fff",
                borderRadius: 6,
                fontWeight: 700,
                cursor: isClosed || DISABLE_OUTBOUND_SMS ? "not-allowed" : "pointer",
              }}
            >
              {isClosed ? "Send (disabled — case closed)" : DISABLE_OUTBOUND_SMS ? "Send (disabled)" : "Send"}
            </button>
            {(isClosed || DISABLE_OUTBOUND_SMS) && (
              <span style={{ fontSize: 12, color: "#6b7280" }}>
                {isClosed
                  ? "Replies disabled because this case is closed."
                  : "Outbound disabled — messages will be saved as “[not sent – A2P pending]”"}
              </span>
            )}
          </div>
        </form>
      </div>
    </main>
  );
}
