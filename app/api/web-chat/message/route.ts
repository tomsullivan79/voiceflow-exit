// app/api/web-chat/message/route.ts
import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import crypto from "node:crypto";
import { supabaseAdmin } from "@/lib/supabaseServer";
import { detectSpeciesSlugFromText, resolvePolicyForSpecies } from "@/lib/policy";

/**
 * This route:
 * 1) Creates/reuses a conversation tied to a browser cookie (wt_web_cookie)
 * 2) Inserts the user's message into conversation_messages
 * 3) Detects species + resolves org policy
 * 4) Returns { ok, conversation_id, speciesSlug, policy }
 *
 * IMPORTANT: It does NOT call /api/chat or return assistant text.
 * The browser calls /api/chat separately and persists the assistant via /api/web-chat/assistant (your current flow).
 */

const COOKIE_NAME = "wt_web_cookie";

function getOrSetCookieId() {
  const jar = cookies();
  const existing = jar.get(COOKIE_NAME)?.value;
  if (existing) return existing;
  const id = crypto.randomUUID();
  // 1-year cookie, path=/ so it works across the app
  jar.set(COOKIE_NAME, id, { path: "/", maxAge: 60 * 60 * 24 * 365, httpOnly: false });
  return id;
}

export async function POST(req: Request) {
  const supa = supabaseAdmin();
  try {
    const body = await req.json().catch(() => ({} as any));
    const messageText: string = String(body?.content ?? "").trim();

    if (!messageText) {
      return NextResponse.json(
        { ok: false, stage: "validate", error: "Missing content" },
        { status: 400 }
      );
    }

    const cookieId = getOrSetCookieId();

    // 1) Look up or create conversation for this cookie
    const { data: mapRow, error: mapErr } = await supa
      .from("web_conversation_cookies")
      .select("conversation_id")
      .eq("cookie_id", cookieId)
      .maybeSingle();

    if (mapErr) {
      console.error("[web-chat/message] cookie map select error:", mapErr);
      return NextResponse.json(
        { ok: false, stage: "cookie-select", error: mapErr.message },
        { status: 500 }
      );
    }

    let conversationId = mapRow?.conversation_id as string | null;

    if (!conversationId) {
      const ownerId = process.env.WEB_CHAT_OWNER_USER_ID;
      if (!ownerId) {
        return NextResponse.json(
          { ok: false, stage: "config", error: "WEB_CHAT_OWNER_USER_ID missing" },
          { status: 500 }
        );
      }

      const { data: convIns, error: convErr } = await supa
        .from("conversations")
        .insert({
          user_id: ownerId,
          source: "web",
          title: "Web Chat",
        })
        .select("id")
        .single();

      if (convErr || !convIns?.id) {
        console.error("[web-chat/message] conversation insert error:", convErr);
        return NextResponse.json(
          { ok: false, stage: "conversation-insert", error: convErr?.message || "insert failed" },
          { status: 500 }
        );
      }

      conversationId = convIns.id as string;

      const { error: mapInsErr } = await supa
        .from("web_conversation_cookies")
        .insert({ cookie_id: cookieId, conversation_id: conversationId });

      if (mapInsErr) {
        console.error("[web-chat/message] cookie map insert error:", mapInsErr);
        // Non-fatal; we still have a conversation — but return 500 to be explicit
        return NextResponse.json(
          { ok: false, stage: "cookie-insert", error: mapInsErr.message },
          { status: 500 }
        );
      }
    }

    // 2) Insert the user's message
    const { error: msgErr } = await supa.from("conversation_messages").insert({
      conversation_id: conversationId,
      role: "user",
      content: messageText,
    });

    if (msgErr) {
      console.error("[web-chat/message] message insert error:", msgErr);
      return NextResponse.json(
        { ok: false, stage: "message-insert", error: msgErr.message },
        { status: 500 }
      );
    }

    // 3) Detect species + resolve policy
    const speciesSlug = await detectSpeciesSlugFromText(messageText);
    let policy = null as any;
    if (speciesSlug) {
      policy = await resolvePolicyForSpecies(speciesSlug);
    }

    // TEMP debug to Vercel logs (remove later)
    console.log("[web-chat/message] species/policy:", { speciesSlug, hasPolicy: !!policy });

    // 4) Return result — NO assistant text here
    return NextResponse.json({
      ok: true,
      conversation_id: conversationId,
      speciesSlug: speciesSlug ?? null,
      policy, // consumed by app/chat/page.tsx
    });
  } catch (err: any) {
    console.error("[web-chat/message] fatal error:", err);
    return NextResponse.json(
      { ok: false, stage: "route", error: err?.message || String(err) },
      { status: 500 }
    );
  }
}
