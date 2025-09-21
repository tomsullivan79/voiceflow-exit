// app/api/web-chat/message/route.ts
import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { supabaseAdmin } from "../../../../lib/supabaseServer";
import { detectSpeciesSlugFromText, resolvePolicyForSpecies } from "../../../../lib/policy";

const COOKIE_NAME = "wt_conversation_id";
const COOKIE_MAX_AGE = 60 * 60 * 24 * 14; // 14 days

// Environment
const ORG_SLUG = process.env.ORG_SLUG || "wrc-mn";
const OWNER_USER_ID = process.env.WEB_CHAT_OWNER_USER_ID || "";

// Normalize detector output to a string slug (or null)
function extractSlug(d: any): string | null {
  if (!d) return null;
  if (typeof d === "string") return d || null;
  if (typeof d.slug === "string" && d.slug) return d.slug;
  if (typeof d.speciesSlug === "string" && d.speciesSlug) return d.speciesSlug;
  if (typeof d.value === "string" && d.value) return d.value;
  // Array of candidates? take the first string-like
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

    // --- (Optional) rate-limit hook (kept out of the way for now)
    // If you want to re-enable your limiter, call it here and return 429 when blocked.

    // Conversation cookie
    const cookieStore = cookies();
    let conversationId = cookieStore.get(COOKIE_NAME)?.value || null;

    const source_ip = getSourceIp(req);
    const admin = supabaseAdmin();

    // Ensure conversation exists
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
      name: COOKIE_NAME,
      value: conversationId,
      httpOnly: true,
      sameSite: "lax",
      secure: true,
      path: "/",
      maxAge: COOKIE_MAX_AGE,
    });

    // Optional quick debug header (handy in DevTools)
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
