// app/api/web-chat/assistant/route.ts
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

export async function POST(req: NextRequest) {
  try {
    const { content } = await req.json();
    if (!content || typeof content !== "string") {
      return NextResponse.json({ ok: false, error: "content required" }, { status: 400 });
    }

    const jar = await cookies();
    const cookieId = jar.get("wt_web_cookie")?.value;
    if (!cookieId) {
      return NextResponse.json({ ok: false, error: "no cookie mapping" }, { status: 400 });
    }

    // Find the mapped conversation
    const { data: map, error: mapErr } = await supabaseAdmin
      .from("web_conversation_cookies")
      .select("conversation_id")
      .eq("cookie_id", cookieId)
      .maybeSingle();

    if (mapErr) {
      return NextResponse.json(
        { ok: false, stage: "select-mapping", error: mapErr.message },
        { status: 500 }
      );
    }
    if (!map?.conversation_id) {
      return NextResponse.json({ ok: false, error: "no conversation for cookie" }, { status: 404 });
    }

    // Insert assistant message
    const { error: insErr } = await supabaseAdmin
      .from("conversation_messages")
      .insert({
        conversation_id: map.conversation_id,
        role: "assistant",
        content,
        message_sid: null,
      });

    if (insErr) {
      return NextResponse.json(
        { ok: false, stage: "insert-message-assistant", error: insErr.message },
        { status: 500 }
      );
    }

    return NextResponse.json({ ok: true, conversation_id: map.conversation_id });
  } catch (e: any) {
    return NextResponse.json(
      { ok: false, stage: "handler", error: e?.message ?? "unexpected" },
      { status: 500 }
    );
  }
}
