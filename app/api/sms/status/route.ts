// app/api/sms/status/route.ts
import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import twilio from "twilio";

export const runtime = "nodejs";

function getAdminClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
  return createClient(url, serviceKey, { auth: { persistSession: false } });
}

export async function POST(req: NextRequest) {
  // Read raw body first (needed both for parsing and signature validation)
  const rawBody = await req.text();
  const form = new URLSearchParams(rawBody);

  try {
    // ----- 1) Verify Twilio signature (optional but recommended)
    const signature = req.headers.get("x-twilio-signature") || "";
    const authToken = process.env.TWILIO_AUTH_TOKEN!;
    const fullUrl = req.nextUrl.href; // must be the exact public URL Twilio POSTs to

    const params: Record<string, string> = {};
    for (const [k, v] of form.entries()) params[k] = v;

    const valid = twilio.validateRequest(authToken, signature, fullUrl, params);
    if (!valid) {
      console.warn("[/api/sms/status] Invalid Twilio signature, ignoring.");
      // Still return 200 so Twilio doesn’t hammer retries, but do NOT insert.
      return NextResponse.json({ ok: true }, { status: 200 });
    }

    // ----- 2) Pull fields we care about
    const messageSid = form.get("MessageSid") || null;
    const messageStatus = form.get("MessageStatus") || null;
    const toNumber = form.get("To") || null;
    const fromNumber = form.get("From") || null;
    const errorCode = form.get("ErrorCode") || null;
    const errorMessage = form.get("ErrorMessage") || null;

    // Store entire payload for diagnostics
    const payload: Record<string, string> = params;

    // Optional dedupe guard: Twilio may deliver duplicates. We’ll treat
    // (sid, status, error_code) as a unique-ish tuple and skip if the newest
    // identical event already exists.
    const supabase = getAdminClient();

    // insert, best-effort; if you prefer hard dedupe, add a unique index (see SQL below)
    await supabase.from("sms_events").insert({
      message_sid: messageSid,
      to_number: toNumber,
      from_number: fromNumber,
      message_status: messageStatus,
      error_code: errorCode,
      error_message: errorMessage,
      payload,
    });

    return NextResponse.json({ ok: true }, { status: 200 });
  } catch (err) {
    console.error("[/api/sms/status] error:", err);
    // Always 200 to stop Twilio retries
    return NextResponse.json({ ok: true }, { status: 200 });
  }
}

export function GET() {
  return NextResponse.json({ ok: true }, { status: 200 });
}
