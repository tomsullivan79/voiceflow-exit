// app/cases/[id]/page.tsx
import "server-only";
import { createClient } from "@supabase/supabase-js";
import { redirect } from "next/navigation";
import twilio from "twilio";
import Link from "next/link";

// ===== Supabase admin client =====
function getAdminClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE!; // your env name
  if (!url || !serviceKey) throw new Error("Missing Supabase env vars.");
  return createClient(url, serviceKey, { auth: { persistSession: false } });
}

// ===== ENV =====
const DISABLE_OUTBOUND_SMS = process.env.DISABLE_OUTBOUND_SMS === "true";
const TWILIO_ACCOUNT_SID = process.env.TWILIO_ACCOUNT_SID!;
const TWILIO_AUTH_TOKEN = process.env.TWILIO_AUTH_TOKEN!;
const TWILIO_MESSAGING_SERVICE_SID = process.env.TWILIO_MESSAGING_SERVICE_SID!;

// ===== Types =====
type Conversation = {
  id: string;
  title?: string | null;
  participant_phone?: string | null; // adjust if your column differs
};

type ConversationMessage = {
  id: string;
  conversation_id: string;
  role: "user" | "assistant" | "system";
  content: string;
  created_at: string;
  message_sid: string | null;
};

// ===== Data access =====
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
  if (error || !data) return new Map();

  const map = new Map<string, any>();
  for (const row of data) map.set(row.message_sid, row);
  return map;
}

function explainTwilioError(code?: string | null) {
  switch (code) {
    case "30003": return "Unreachable destination handset (power off/out of service).";
    case "30004": return "Message blocked by carrier or user’s settings.";
    case "30005": return "Unknown or inactive destination number.";
    case "30006": return "Landline or unreachable carrier route.";
    case "30007": return "Carrier filter: message flagged as spam.";
    case "30034": return "A2P 10DLC issue (registration/brand/campaign/number mismatch).";
    default: return null;
  }
}

// ===== Server action: sendReply =====
export async function sendReply(formData: FormData) {
  "use server";
  const supabase = getAdminClient();

  const conversationId = String(formData.get("conversationId") || "");
  const body = String(formData.get("body") || "").trim();
  if (!conversationId || !body) return;

  const { conversation } = await getConversationAndMessages(conversationId);

  const to = (conversation.participant_phone || "").trim(); // adjust if needed
  const initialContent = DISABLE_OUTBOUND_SMS
    ? `${body}\n\n[not sent – A2P pending]`
    : body;

  // Insert assistant message
  const { data: inserted, error: insertErr } = await supabase
    .from("conversation_messages")
    .insert({
      conversation_id: conversationId,
      role: "assistant",
      content: to ? initialContent : `${initialContent}\n\n[not sent – missing recipient number]`,
      message_sid: null,
    })
    .select("id")
    .single();
  if (insertErr || !inserted) {
    console.error("Failed to insert assistant message:", insertErr);
    redirect(`/cases/${conversationId}`);
  }
  const messageRowId = inserted.id as string;

  if (DISABLE_OUTBOUND_SMS || !to) {
    redirect(`/cases/${conversationId}`);
  }

  // Send via Twilio
  try {
    const client = twilio(TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN);
    const sent = await client.messages.create({
      to,
      body,
      messagingServiceSid: TWILIO_MESSAGING_SERVICE_SID,
      // statusCallback: "https://app.wildtriage.org/api/sms/status",
    });

    await supabase
      .from("conversation_messages")
      .update({ message_sid: sent.sid })
      .eq("id", messageRowId);
  } catch (err: any) {
    console.error("Twilio send error:", err?.message || err);
    await supabase
      .from("conversation_messages")
      .update({
        content: `${initialContent}\n\n[send error: ${err?.message || "unknown"}]`,
      })
      .eq("id", messageRowId);
  }

  redirect(`/cases/${conversationId}`);
}

// ===== Page (server component) =====
export default async function CasePage({ params }: { params: { id: string } }) {
  const { conversation, messages } = await getConversationAndMessages(params.id);

  // Batch-load statuses
  const sids = messages
    .filter((m) => m.role === "assistant" && m.message_sid)
    .map((m) => m.message_sid!) as string[];
  const statusBySid = await getLatestStatusesFor(Array.from(new Set(sids)));

  return (
    <div className="mx-auto max-w-3xl p-8 space-y-8">
      {/* Header */}
      <div className="flex items-center justify-between">
        <Link href="/cases" className="text-sm text-blue-700 underline">
          ← Back to cases
        </Link>
        <h1 className="text-xl font-semibold">
          Case: {conversation.title || conversation.id}
        </h1>
        <div className="w-24" />
      </div>

      {/* Messages */}
      <div className="space-y-4">
        {messages.map((message) => {
          const status =
            message.role === "assistant" && message.message_sid
              ? statusBySid.get(message.message_sid)
              : null;

          return (
            <div key={message.id} className="rounded-lg border bg-white p-4">
              <div className="text-xs text-gray-500">
                {message.role.toUpperCase()} •{" "}
                {new Date(message.created_at).toLocaleString()}
              </div>

              <div className="mt-2 whitespace-pre-wrap">{message.content}</div>

              {message.role === "assistant" && message.message_sid ? (
                <div className="mt-3 text-xs text-gray-700 border-t pt-2 space-y-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-medium">Delivery:</span>
                    <span>{status?.message_status ?? "—"}</span>
                    <span className="text-gray-400">•</span>
                    <span className="text-[11px] text-gray-500">SID: {message.message_sid}</span>
                    <span className="text-gray-400">•</span>
                    <span className="text-[11px] text-gray-500">
                      Updated: {status?.created_at ? new Date(status.created_at).toLocaleString() : "—"}
                    </span>
                    <span className="text-gray-400">•</span>
                    <Link href={`/sms/${message.message_sid}`} className="text-blue-700 underline">
                      View history
                    </Link>
                  </div>

                  {status?.error_code ? (
                    <div>
                      <span className="font-medium">ErrorCode:</span>{" "}
                      {status.error_code}
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
      <div className="rounded-lg border bg-white p-4">
        <form action={sendReply} className="space-y-3">
          <input type="hidden" name="conversationId" value={conversation.id} />
          <textarea
            name="body"
            placeholder="Type your reply…"
            className="w-full rounded border px-3 py-2"
            rows={3}
            required
          />
          <div className="flex flex-wrap items-center gap-3">
            <button
              type="submit"
              className="rounded bg-black px-4 py-2 text-white disabled:opacity-50"
              disabled={DISABLE_OUTBOUND_SMS}
              title={DISABLE_OUTBOUND_SMS ? "Outbound SMS disabled (A2P pending)" : "Send SMS"}
            >
              {DISABLE_OUTBOUND_SMS ? "Send (disabled)" : "Send"}
            </button>
            {DISABLE_OUTBOUND_SMS && (
              <span className="text-xs text-gray-600">
                Outbound disabled — messages will be saved as “[not sent – A2P pending]”
              </span>
            )}
          </div>
        </form>
      </div>

      {/* Actions row (Close Case will be added next step after we pick an approach) */}
    </div>
  );
}
