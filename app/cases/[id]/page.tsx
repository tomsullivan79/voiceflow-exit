// app/cases/[id]/page.tsx
import "server-only";
import { createClient } from "@supabase/supabase-js";
import { redirect } from "next/navigation";
import twilio from "twilio";

// ===== Supabase admin client =====
function getAdminClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
  if (!url || !serviceKey) throw new Error("Missing Supabase env vars.");
  return createClient(url, serviceKey, { auth: { persistSession: false } });
}

// ===== ENV =====
const DISABLE_OUTBOUND_SMS = process.env.DISABLE_OUTBOUND_SMS === "true";
const TWILIO_ACCOUNT_SID = process.env.TWILIO_ACCOUNT_SID!;
const TWILIO_AUTH_TOKEN = process.env.TWILIO_AUTH_TOKEN!;
const TWILIO_MESSAGING_SERVICE_SID = process.env.TWILIO_MESSAGING_SERVICE_SID!;

// ===== Types (adjust if your schema differs) =====
type Conversation = {
  id: string;
  title?: string | null;
  /** E.164 recipient number (human). Change if your column is named differently. */
  participant_phone?: string | null;
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

async function getLatestSmsStatus(messageSid: string) {
  if (!messageSid) return null;
  const supabase = getAdminClient();
  const { data, error } = await supabase
    .from("sms_events")
    .select("*")
    .eq("message_sid", messageSid)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error) return null;
  return data as
    | {
        message_status: string | null;
        error_code: string | null;
        error_message: string | null;
        created_at: string;
      }
    | null;
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
  for (const row of data) {
    map.set(row.message_sid, row);
  }
  return map;
}

// ===== Server action: sendReply =====
export async function sendReply(formData: FormData) {
  "use server";
  const supabase = getAdminClient();

  const conversationId = String(formData.get("conversationId") || "");
  const body = String(formData.get("body") || "").trim();
  if (!conversationId || !body) return;

  const { conversation } = await getConversationAndMessages(conversationId);

  // Update this line if your recipient field is different
  const to = (conversation.participant_phone || "").trim();
  const initialContent = DISABLE_OUTBOUND_SMS
    ? `${body}\n\n[not sent – A2P pending]`
    : body;

  // Insert assistant message first (we’ll update message_sid after sending)
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

  // Respect A2P gate or missing number
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
      // If your Messaging Service doesn’t already set this:
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

// --- Twilio error explainer (place above export default) ---
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


// ===== Page (server component) =====
export default async function CasePage({ params }: { params: { id: string } }) {
  const { conversation, messages } = await getConversationAndMessages(params.id);

  // Collect all assistant SIDs and batch-load latest statuses via the view
  const sids = messages
    .filter((m) => m.role === "assistant" && m.message_sid)
    .map((m) => m.message_sid!) as string[];

  const statusBySid = await getLatestStatusesFor(Array.from(new Set(sids)));

  return (
    <div className="mx-auto max-w-3xl p-6 space-y-6">
      <h1 className="text-2xl font-semibold">
        Case: {conversation.title || conversation.id}
      </h1>

      <div className="space-y-4">
        {messages.map((message) => {
          const status =
            message.role === "assistant" && message.message_sid
              ? statusBySid.get(message.message_sid)
              : null;

          return (
            <div key={message.id} className="rounded-md border p-3">
              <div className="text-sm text-gray-500">
                {message.role.toUpperCase()} •{" "}
                {new Date(message.created_at).toLocaleString()}
              </div>

              <div className="mt-2 whitespace-pre-wrap">{message.content}</div>

              {/* Delivery status footer for assistant messages with SID */}
              {message.role === "assistant" && message.message_sid ? (
                <div className="mt-3 text-xs text-gray-600 border-t pt-2">
                  <div>
                    <span className="font-medium">Delivery:</span>{" "}
                    {status?.message_status ?? "—"}
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

                  <div className="text-[11px] text-gray-500">
                    SID: {message.message_sid} • Updated:{" "}
                    {status?.created_at
                      ? new Date(status.created_at).toLocaleString()
                      : "—"}
                  </div>
                </div>
              ) : null}
            </div>
          );
        })}
      </div>

      {/* Simple reply form */}
      <form action={sendReply} className="mt-6 space-y-2">
        <input type="hidden" name="conversationId" value={conversation.id} />
        <textarea
          name="body"
          placeholder="Type your reply…"
          className="w-full rounded-md border p-2"
          rows={3}
          required
        />
        <div className="flex items-center gap-3">
          <button
            type="submit"
            className="rounded-md bg-black px-4 py-2 text-white disabled:opacity-50"
            disabled={DISABLE_OUTBOUND_SMS}
            title={
              DISABLE_OUTBOUND_SMS
                ? "Outbound SMS disabled (A2P pending)"
                : "Send SMS"
            }
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
  );
}
