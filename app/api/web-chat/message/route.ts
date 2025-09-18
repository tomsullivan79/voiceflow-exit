// app/api/web-chat/message/route.ts
import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { createClient } from "@supabase/supabase-js";

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE!, // per your env naming convention
  { auth: { persistSession: false } }
);

export async function POST(req: NextRequest) {
  try {
    const { content } = await req.json();
    if (!content || typeof content !== "string" || !content.trim()) {
      return NextResponse.json({ error: "content required" }, { status: 400 });
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

    // Find existing mapping
    let conversationId: string | null = null;

    {
      const { data, error } = await supabaseAdmin
        .from("web_conversation_cookies")
        .select("conversation_id")
        .eq("cookie_id", cookieId)
        .maybeSingle();

      if (error) {
        console.error("select mapping error", error);
        return NextResponse.json({ error: "db error (select mapping)" }, { status: 500 });
      }
      conversationId = data?.conversation_id ?? null;
    }

    // If no mapping, create a new conversation and mapping
    if (!conversationId) {
      // Insert a conversation with default values; most schemas allow this.
      // If your schema requires fields, see the note in Test & Verify.
      const { data: conv, error: convErr } = await supabaseAdmin
        .from("conversations")
        .insert({})
        .select("id")
        .single();

      if (convErr) {
        console.error("create conversation error", convErr);
        return NextResponse.json({ error: "db error (create conversation)" }, { status: 500 });
      }

      conversationId = conv!.id;

      const { error: mapErr } = await supabaseAdmin
        .from("web_conversation_cookies")
        .insert({ cookie_id: cookieId, conversation_id: conversationId });

      if (mapErr) {
        console.error("insert mapping error", mapErr);
        return NextResponse.json({ error: "db error (map cookie)" }, { status: 500 });
      }
    }

    // Insert the user's web message into conversation_messages
    const { error: msgErr } = await supabaseAdmin
      .from("conversation_messages")
      .insert({
        conversation_id: conversationId,
        role: "user",       // aligns with your cases UI
        content,            // text body
        message_sid: null,  // SMS-only; keep null for web
      });

    if (msgErr) {
      console.error("insert message error", msgErr);
      return NextResponse.json({ error: "db error (insert message)" }, { status: 500 });
    }

    return NextResponse.json({ ok: true, conversation_id: conversationId });
  } catch (e: any) {
    console.error("web-chat/message POST error", e);
    return NextResponse.json({ error: "unexpected" }, { status: 500 });
  }
}
