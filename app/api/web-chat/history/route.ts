// app/api/web-chat/history/route.ts
import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { createClient } from "@supabase/supabase-js";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE!,
  { auth: { persistSession: false } }
);

// Cookie names used across the web chat:
// - wt_web_cookie: anonymous visitor cookie (uuid); maps to conversation via web_conversation_cookies
// - wt_conversation_id: direct conversation id cookie (set by /api/web-chat/message)
const WEB_COOKIE = "wt_web_cookie";
const CONV_COOKIE = "wt_conversation_id";

export async function GET(_req: NextRequest) {
  try {
    const jar = await cookies();

    // Try primary path: anonymous web cookie -> mapping table
    const webCookieId = jar.get(WEB_COOKIE)?.value || null;

    let conversationId: string | null = null;

    if (webCookieId) {
      const { data: map, error: mapErr } = await supabaseAdmin
        .from("web_conversation_cookies")
        .select("conversation_id")
        .eq("cookie_id", webCookieId)
        .maybeSingle();

      if (mapErr) {
        return NextResponse.json(
          { ok: false, stage: "select-mapping", error: mapErr.message },
          { status: 500 }
        );
      }
      if (map?.conversation_id) {
        conversationId = map.conversation_id as string;
      }
    }

    // Fallback path: use the direct conversation cookie set by /api/web-chat/message
    if (!conversationId) {
      const convCookie = jar.get(CONV_COOKIE)?.value || null;
      if (convCookie) {
        conversationId = convCookie;
      }
    }

    if (!conversationId) {
      // No mapping yet and no conversation cookie — first visit or no prior messages
      return NextResponse.json({ ok: true, conversation_id: null, messages: [] }, { status: 200 });
    }

    // Pull ordered history for this conversation
    const { data: rows, error: msgErr } = await supabaseAdmin
      .from("conversation_messages")
      .select("role, content, created_at")
      .eq("conversation_id", conversationId)
      .order("created_at", { ascending: true });

    if (msgErr) {
      return NextResponse.json(
        { ok: false, stage: "select-messages", error: msgErr.message },
        { status: 500 }
      );
    }

    // Normalize payload for the chat UI
    const messages = (rows ?? []).map((r) => ({
      role: r.role === "assistant" ? "assistant" : "user",
      content: r.content ?? "",
      created_at: r.created_at,
    }));

    return NextResponse.json(
      { ok: true, conversation_id: conversationId, messages },
      { status: 200 }
    );
  } catch (e: any) {
    return NextResponse.json(
      { ok: false, stage: "handler", error: e?.message ?? "unexpected" },
      { status: 500 }
    );
  }
}
