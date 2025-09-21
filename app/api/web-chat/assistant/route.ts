// app/api/web-chat/assistant/route.ts
import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { supabaseAdmin } from "../../../../lib/supabaseServer";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const WEB_COOKIE = "wt_web_cookie";         // anon visitor cookie → mapping table
const CONV_COOKIE = "wt_conversation_id";   // direct conversation id cookie set by /api/web-chat/message

export async function POST(req: Request) {
  try {
    const body = await req.json().catch(() => null);
    const content = (body?.content ?? "").toString();
    if (!content || !content.trim()) {
      return NextResponse.json({ ok: false, error: "empty_content", stage: "validate" }, { status: 400 });
    }

    const jar = await cookies();

    // 1) Try direct conversation cookie first (new flow)
    let conversationId: string | null = jar.get(CONV_COOKIE)?.value || null;

    // 2) Fallback to old mapping via wt_web_cookie
    if (!conversationId) {
      const webCookieId = jar.get(WEB_COOKIE)?.value || null;
      if (webCookieId) {
        const admin = supabaseAdmin();
        const { data: map, error: mapErr } = await admin
          .from("web_conversation_cookies")
          .select("conversation_id")
          .eq("cookie_id", webCookieId)
          .maybeSingle();

        if (mapErr) {
          return NextResponse.json(
            { ok: false, error: mapErr.message, stage: "select-mapping" },
            { status: 500 }
          );
        }
        if (map?.conversation_id) {
          conversationId = map.conversation_id as string;
        }
      }
    }

    if (!conversationId) {
      // No mapping and no conversation cookie — cannot persist assistant
      return NextResponse.json(
        { ok: false, error: "no_cookie_mapping", stage: "resolve" },
        { status: 400 }
      );
    }

    // 3) Persist assistant message
    const admin = supabaseAdmin();
    const { error: insErr } = await admin.from("conversation_messages").insert({
      conversation_id: conversationId,
      role: "assistant",
      content,
    });
    if (insErr) {
      return NextResponse.json(
        { ok: false, error: insErr.message, stage: "persist_assistant" },
        { status: 500 }
      );
    }

    return NextResponse.json({ ok: true, conversation_id: conversationId }, { status: 200 });
  } catch (e: any) {
    return NextResponse.json(
      { ok: false, error: e?.message ?? "unexpected", stage: "handler" },
      { status: 500 }
    );
  }
}

// GET → 405 (intentional; this endpoint is POST-only)
export async function GET() {
  return NextResponse.json(
    { ok: false, error: "method_not_allowed" },
    { status: 405 }
  );
}
