// app/api/sms/status/route.ts
import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export const runtime = "nodejs"; // status callbacks can be frequent; keep on Node

function getAdminClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
  if (!url || !serviceKey) {
    throw new Error("Missing Supabase env vars for admin client.");
  }
  return createClient(url, serviceKey, { auth: { persistSession: false } });
}

export async function POST(req: NextRequest) {
  try {
    // Twilio sends application/x-www-form-urlencoded by default
    const bodyText = await req.text();
    const form = new URLSearchParams(bodyText);

    // Common Twilio fields
    const messageSid = form.get("MessageSid") || form.get("MessageSid[]") || null;
    const messageStatus = form.get("MessageStatus") || null;
    const toNumber = form.get("To") || null;
    const fromNumber = form.get("From") || null;
    const errorCode = form.get("ErrorCode") || null;
    const errorMessage = form.get("ErrorMessage") || null;

    // Store entire payload for debugging/forensics
    const payload: Record<string, string> = {};
    for (const [k, v] of form.entries()) payload[k] = v;

    const supabase = getAdminClient();
    await supabase.from("sms_events").insert({
      message_sid: messageSid,
      to_number: toNumber,
      from_number: fromNumber,
      message_status: messageStatus,
      error_code: errorCode,
      error_message: errorMessage,
      payload,
    });

    // Always 200 so Twilio stops retrying
    return NextResponse.json({ ok: true }, { status: 200 });
  } catch (err) {
    // Swallow errors (still 200) so Twilio doesn't retry forever
    console.error("[/api/sms/status] insert error:", err);
    return NextResponse.json({ ok: true }, { status: 200 });
  }
}

export function GET() {
  // Twilio may occasionally validate endpoints; keep this benign.
  return NextResponse.json({ ok: true }, { status: 200 });
}
