// app/api/web-chat/message/route.ts
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
    if (!content || typeof content !== "string" || !content.trim()) {
      return NextResponse.json({ ok: false, error: "content required" }, { status: 400 });
    }

    const ownerUserId = process.env.WEB_CHAT_OWNER_USER_ID;
    if (!ownerUserId) {
      return NextResponse.json(
        { ok: false, stage: "config", error: "WEB_CHAT_OWNER_USER_ID not set" },
        { status: 500 }
      );
    }

    const jar = await cookies();
    let cookieId = jar.get("wt_web_cookie")?.value as string | undefined;

    if (!cookieId) {
      cookieId = crypto.randomUUID();
      jar.set("wt_web_cookie", cookieId, {
        httpOnly: true,
        sameSite: "lax",
        path: "/",
        maxAge: 60 * 60 * 24 * 30, // 30 days
      });
    }

    // Lookup mapping
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

    // Create conversation + mapping if needed
    if (!conversationId) {
      const { data: conv, error: convErr } = await supabaseAdmin
        .from("conversations")
        .insert({
          user_id: ownerUserId,         // satisfy NOT NULL
          source: "web",                // add if your schema has this column (ignored if it doesn't)
          title: "Web Chat",            // add if present (ignored if not)
        })
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

    // Insert USER message
    {
      const { error: msgErr } = await supabaseAdmin
        .from("conversation_messages")
        .insert({
          conversation_id: conversationId!,
          role: "user",
          content: content.trim(),
          message_sid: null,
        });

      if (msgErr) {
        return NextResponse.json(
          { ok: false, stage: "insert-message-user", error: msgErr.message },
          { status: 500 }
        );
      }
    }

    // Call your existing /api/chat to get an assistant text
    const host = req.headers.get("host")!;
    const proto = req.headers.get("x-forwarded-proto") || "https";
    const baseUrl = `${proto}://${host}`;

    const chatRes = await fetch(`${baseUrl}/api/chat`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      // If your /api/chat streams, we still consume as text here
      body: JSON.stringify({ input: content, remember: false }),
      cache: "no-store",
    });

    if (!chatRes.ok) {
      const t = await chatRes.text();
      // Still return ok=false so the client can show an error
      return NextResponse.json(
        { ok: false, stage: "agent", error: t || `HTTP ${chatRes.status}`, conversation_id: conversationId },
        { status: 500 }
      );
    }

    const assistantText = (await chatRes.text()) || "(no response)";

    // Insert ASSISTANT message
    {
      const { error: aErr } = await supabaseAdmin
        .from("conversation_messages")
        .insert({
          conversation_id: conversationId!,
          role: "assistant",
          content: assistantText,
          message_sid: null,
        });

      if (aErr) {
        return NextResponse.json(
          { ok: false, stage: "insert-message-assistant", error: aErr.message, conversation_id: conversationId },
          { status: 500 }
        );
      }
    }

    return NextResponse.json({
      ok: true,
      conversation_id: conversationId,
      assistant_text: assistantText,
    });
  } catch (e: any) {
    return NextResponse.json(
      { ok: false, stage: "handler", error: e?.message ?? "unexpected" },
      { status: 500 }
    );
  }
}
