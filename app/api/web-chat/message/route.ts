// app/api/web-chat/message/route.ts
import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { supabaseAdmin } from "../../../../lib/supabaseServer";
import { detectSpeciesSlugFromText, resolvePolicyForSpecies } from "../../../../lib/policy";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const CONV_COOKIE = "wt_conversation_id";
const WEB_COOKIE = "wt_web_cookie";

// Conversation cookie: 14 days is fine (session continuity)
const CONV_COOKIE_MAX_AGE = 60 * 60 * 24 * 14; // 14 days
// Web cookie (anonymous visitor id) can be longer-lived
const WEB_COOKIE_MAX_AGE = 60 * 60 * 24 * 365; // 365 days

// Environment
const ORG_SLUG = process.env.ORG_SLUG || "wrc-mn";
const OWNER_USER_ID = process.env.WEB_CHAT_OWNER_USER_ID || "";

// Normalize detector output to a string slug (or null)
function extractSlug(d: any): string | null {
  if (!d) return null;
  if (typeof d === "string") return d || null;
  if (typeof (d as any).slug === "string" && (d as any).slug) return (d as any).slug;
  if (typeof (d as any).speciesSlug === "string" && (d as any).speciesSlug) return (d as any).speciesSlug;
  if (typeof (d as any).value === "string" && (d as any).value) return (d as any).value;
  if (Array.isArray(d)) {
    for (const v of d) {
      const s = extractSlug(v);
      if (s) return s;
    }
  }
  return null;
}

// Best-effort IP (for auditing)
function getSourceIp(req: Request): string | null {
  const xf = req.headers.get("x-forwarded-for");
  if (xf) return xf.split(",")[0]?.trim() || null;
  return req.headers.get("x-real-ip") || null;
}

export async function POST(req: Request) {
  const startedAt = Date.now();

  try {
    const body = await req.json().catch(() => null);
    const content = (body?.content ?? "").toString();

    if (!content || !content.trim()) {
      return NextResponse.json(
        { ok: false, error: "empty_content", stage: "validate" },
        { status: 400 }
      );
    }

    // --- (Optional) rate-limit hook here if/when re-enabled ---

    const jar = await cookies();
    const source_ip = getSourceIp(req);
    const admin = supabaseAdmin();

    // Read/create conversation id
    let conversationId = jar.get(CONV_COOKIE)?.value || null;

    if (!conversationId) {
      if (!OWNER_USER_ID) {
        return NextResponse.json(
          { ok: false, error: "missing_OWNER_USER_ID_env", stage: "ensureConversation" },
          { status: 500 }
        );
      }
      const { data, error } = await admin
        .from("conversations")
        .insert({
          user_id: OWNER_USER_ID,
          title: "Web Chat",
          created_ip: source_ip ?? null,
        })
        .select("id")
        .single();

      if (error || !data?.id) {
        return NextResponse.json(
          { ok: false, error: error?.message || "conversation_insert_failed", stage: "ensureConversation" },
          { status: 500 }
        );
      }
      conversationId = data.id as string;
    }

    // 🔁 NEW: Ensure legacy mapping cookie + row stay in sync
    let webCookieId = jar.get(WEB_COOKIE)?.value || null;
    if (!webCookieId) {
      // Create a fresh anonymous cookie id
      webCookieId = crypto.randomUUID();
    }

    // Upsert mapping row (cookie_id is PK)
    {
      const { error: mapErr } = await admin
        .from("web_conversation_cookies")
        .upsert(
          { cookie_id: webCookieId, conversation_id: conversationId },
          { onConflict: "cookie_id" }
        );
      if (mapErr) {
        // Non-fatal: mapping is a convenience for legacy paths, but log by returning header
        // We still continue, since /chat uses wt_conversation_id primarily.
      }
    }

    // Persist user message
    {
      const { error } = await admin.from("conversation_messages").insert({
        conversation_id: conversationId,
        role: "user",
        content,
        source_ip: source_ip ?? null,
      });
      if (error) {
        return NextResponse.json(
          { ok: false, error: error.message, stage: "persist_user" },
          { status: 500 }
        );
      }
    }

    // Species detection + policy resolution (normalized)
    const detected = await detectSpeciesSlugFromText(content);
    const speciesSlug = extractSlug(detected);
    const policy = speciesSlug
      ? await resolvePolicyForSpecies(speciesSlug, ORG_SLUG)
      : null;

    // Build response
    const res = NextResponse.json(
      {
        ok: true,
        conversation_id: conversationId,
        speciesSlug, // string | null
        policy,      // object | null
        ms: Date.now() - startedAt,
      },
      { status: 200 }
    );

    // Set/refresh conversation cookie
    res.cookies.set({
      name: CONV_COOKIE,
      value: conversationId,
      httpOnly: true,
      sameSite: "lax",
      secure: true,
      path: "/",
      maxAge: CONV_COOKIE_MAX_AGE,
    });

    // Set/refresh web cookie (anon id)
    res.cookies.set({
      name: WEB_COOKIE,
      value: webCookieId,
      httpOnly: true,
      sameSite: "lax",
      secure: true,
      path: "/",
      maxAge: WEB_COOKIE_MAX_AGE,
    });

    // Debug header
    res.headers.set("x-policy-debug", `species=${speciesSlug ?? "null"}`);

    return res;
  } catch (err: any) {
    return NextResponse.json(
      { ok: false, error: err?.message || String(err), stage: "unhandled" },
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
