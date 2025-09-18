// app/api/web-chat/message/route.ts
import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { createClient } from "@supabase/supabase-js";

// Force Node runtime (supabase-js + service role works best here)
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE!, // per your env naming
  { auth: { persistSession: false } }
);

export async function POST(req: NextRequest) {
  try {
    const { content } = await req.json();
    if (!content || typeof content !== "string" || !content.trim()) {
      return NextResponse.json({ ok: false, error: "content required" }, { status: 400 });
    }

    const jar = await cookies();
    let cookieId = jar.get("wt_web_cookie")?.value as string | undefined;

    if (!cookieId) {
      cookieId = crypto.randomUUID();
      // 30-day cookie
      jar.set("wt_web_cookie", cookieId, {
        httpOnly: true,
        sameSite: "lax",
        path: "/",
        maxAge: 60 * 60 * 24 * 30,
      });
    }

    // Try to find existing mapping
    let conversationId: string | null = null;
    {
      const { data, error } = await supabaseAdmin
        .from("web_conversation_cookies")
        .select("conversation_id")
        .eq("cookie_id", cookieId)
        .maybeSingle();

      if (error) {
        return NextResponse.json(
          { ok: false, stage: "select-mapping", error: error.message },
          { status: 500 }
        );
      }
      conversationId = data?.conversation_id ?? null;
    }

    // Create conversation + mapping if missing
    if (!conversationId) {
      const { data: conv, error: convErr } = await supabaseAdmin
        .from("conversations")
        .insert({}) // assumes defaults; if your schema requires cols, we’ll adjust in next step
        .select("id")
        .single();

      if (convErr || !conv) {
        return NextResponse.json(
          { ok: false, stage: "insert-conversation", error: convErr?.message ?? "no data" },
          { status: 500 }
        );
      }

      conversationId = conv.id;

      const { error: mapErr } = await supabaseAdmin
        .from("web_conversation_cookies")
        .insert({ cookie_id: cookieId, conversation_id: conversationId });

      if (mapErr) {
        return NextResponse.json(
          { ok: false, stage: "insert-mapping", error: mapErr.message },
          { status: 500 }
        );
      }
    }

    // Insert user message
    const { error: msgErr } = await supabaseAdmin
      .from("conversation_messages")
      .insert({
        conversation_id: conversationId,
        role: "user",
        content: content.trim(),
        message_sid: null,
      });

    if (msgErr) {
      return NextResponse.json(
        { ok: false, stage: "insert-message", error: msgErr.message },
        { status: 500 }
      );
    }

    return NextResponse.json({ ok: true, conversation_id: conversationId });
  } catch (e: any) {
    return NextResponse.json(
      { ok: false, stage: "handler", error: e?.message ?? "unexpected" },
      { status: 500 }
    );
  }
}
