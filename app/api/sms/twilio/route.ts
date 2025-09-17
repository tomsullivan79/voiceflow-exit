// app/api/sms/twilio/route.ts
import "server-only";
import twilio from "twilio";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Best-effort logger: inserts a 'received' row in public.sms_events
 * using the Supabase service role. Never throws.
 */
async function logReceivedEvent(params: Record<string, any>) {
  try {
    const { createClient } = await import("@supabase/supabase-js");
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
    const service = process.env.SUPABASE_SERVICE_ROLE!;
    if (!url || !service) return;

    const supabase = createClient(url, service, { auth: { persistSession: false } });

    await supabase.from("sms_events").insert({
      message_sid: params.MessageSid ?? null,
      to_number: params.To ?? null,
      from_number: params.From ?? null,
      message_status: "received",
      error_code: null,
      error_message: null,
      payload: params, // store full Twilio payload
    });
  } catch {
    // swallow — logging must not break the webhook
  }
}

export async function POST(request: Request) {
  // 1) Parse Twilio form-encoded payload
  const form = await request.formData();
  const params: Record<string, string> = {};
  for (const [k, v] of form.entries()) params[k] = String(v);

  // 2) Validate X-Twilio-Signature
  const sig = request.headers.get("x-twilio-signature") || "";
  const authToken = process.env.TWILIO_AUTH_TOKEN || "";
  const valid = authToken
    ? twilio.validateRequest(authToken, sig, request.url, params)
    : false;

  if (!valid) {
    // Always 401 on invalid signature
    return new Response("Invalid signature", { status: 401 });
  }

  // 3) Log a 'received' event (best-effort, non-blocking)
  await logReceivedEvent(params);

  // 4) (Optional) Place for any additional inbound handling you may add later
  //    e.g., creating/associating conversations + messages in your DB.

  // 5) Respond 200 OK with empty TwiML
  // Twilio is happy with an empty <Response/>
  return new Response("<Response></Response>", {
    status: 200,
    headers: { "Content-Type": "text/xml" },
  });
}

// For safety, reject non-POST
export async function GET() {
  return new Response("Method Not Allowed", { status: 405 });
}
