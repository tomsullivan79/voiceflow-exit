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

export async function GET(_req: NextRequest) {
  try {
    const jar = await cookies();
    const cookieId = jar.get("wt_web_cookie")?.value;
    if (!cookieId) {
      // no cookie yet: first visit
      return NextResponse.json({ ok: true, messages: [] }, { status: 200 });
    }

    // Find conversation for this cookie
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
      // cookie exists but no mapping yet
      return NextResponse.json({ ok: true, messages: [] }, { status: 200 });
    }

    // Pull ordered history
    const { data: rows, error: msgErr } = await supabaseAdmin
      .from("conversation_messages")
      .select("role, content, created_at")
      .eq("conversation_id", map.conversation_id)
      .order("created_at", { ascending: true });

    if (msgErr) {
      return NextResponse.json(
        { ok: false, stage: "select-messages", error: msgErr.message },
        { status: 500 }
      );
    }

    // Normalize payload for the chat UI
    const messages = (rows ?? []).map(r => ({
      role: r.role === "assistant" ? "assistant" : "user",
      content: r.content ?? "",
      created_at: r.created_at,
    }));

    return NextResponse.json({ ok: true, messages }, { status: 200 });
  } catch (e: any) {
    return NextResponse.json(
      { ok: false, stage: "handler", error: e?.message ?? "unexpected" },
      { status: 500 }
    );
  }
}
