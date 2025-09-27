// app/api/web-chat/message/route.ts
import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { supabaseAdmin } from "../../../../lib/supabaseServer";
import { detectSpeciesSlugFromText, resolvePolicyForSpecies } from "../../../../lib/policy";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const CONV_COOKIE = "wt_conversation_id";
const WEB_COOKIE  = "wt_web_cookie";

const CONV_COOKIE_MAX_AGE = 60 * 60 * 24 * 14;  // 14 days
const WEB_COOKIE_MAX_AGE  = 60 * 60 * 24 * 365; // 365 days

// Env
const ORG_SLUG      = process.env.ORG_SLUG || "wrc-mn";
const OWNER_USER_ID = process.env.WEB_CHAT_OWNER_USER_ID || "";

// Rate-limit config (debug headers + optional enforcement)
const RL_LIMIT       = parseInt(process.env.WEBCHAT_RL_LIMIT ?? "3", 10);
const RL_WINDOW_SEC  = parseInt(process.env.WEBCHAT_RL_WINDOW_SEC ?? "30", 10);
const RL_ENABLED     = (process.env.WEBCHAT_RL_ENABLED ?? "false").toLowerCase() === "true";

// --- Helpers -----------------------------------------------------------------

function normalizeWhitespace(s: string) {
  return s.replace(/\s+/g, " ").trim();
}

function sentenceCase(s: string) {
  if (!s) return s;
  return s[0].toUpperCase() + s.slice(1);
}

/** Create a short, readable title from the first user message. */
function makeTitleFromContent(content: string) {
  const base = sentenceCase(normalizeWhitespace(content || "").replace(/[\r\n]+/g, " "));
  // Prefer up to first period/question/exclamation; otherwise clamp to ~48 chars
  const punct = base.search(/[.!?]/);
  let slice = punct > -1 ? base.slice(0, punct + 1) : base.slice(0, 48);
  if (slice.length < base.length && !/[.!?]$/.test(slice)) slice = slice.trimEnd() + "…";
  // Guard: fallback if empty
  return slice || "Web Chat";
}

// Normalize detector output to a string slug (or null)
function extractSlug(d: any): string | null {
  if (!d) return null;
  if (typeof d === "string") return d || null;
  if (typeof d.slug === "string" && d.slug) return d.slug;
  if (typeof d.speciesSlug === "string" && d.speciesSlug) return d.speciesSlug;
  if (typeof d.value === "string" && d.value) return d.value;
  if (Array.isArray(d)) {
    for (const v of d) {
      const s = extractSlug(v);
      if (s) return s;
    }
  }
  return null;
}

function getSourceIp(req: Request): string | null {
  const xf = req.headers.get("x-forwarded-for");
  if (xf) return xf.split(",")[0]?.trim() || null;
  return req.headers.get("x-real-ip") || null;
}

// -----------------------------------------------------------------------------

export async function POST(req: Request) {
  const startedAt = Date.now();

  try {
    const body = await req.json().catch(() => null);
    const content = (body?.content ?? "").toString();

    if (!content || !content.trim()) {
      return NextResponse.json({ ok: false, error: "empty_content", stage: "validate" }, { status: 400 });
    }

    const jar = await cookies();
    const source_ip = getSourceIp(req);
    const admin = supabaseAdmin();

    // Conversation id (create if needed)
    let conversationId = jar.get(CONV_COOKIE)?.value || null;
    let createdNow = false;

    if (!conversationId) {
      if (!OWNER_USER_ID) {
        return NextResponse.json(
          { ok: false, error: "missing_OWNER_USER_ID_env", stage: "ensureConversation" },
          { status: 500 }
        );
      }

      // NEW: set a descriptive title on creation based on the user's first message
      const title = makeTitleFromContent(content);

      const { data, error } = await admin
        .from("conversations")
        .insert({
          user_id: OWNER_USER_ID,
          title,
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
      createdNow = true;
    }

    // Keep legacy mapping in sync (cookie + upsert)
    let webCookieId = jar.get(WEB_COOKIE)?.value || null;
    if (!webCookieId) webCookieId = crypto.randomUUID();

    await admin
      .from("web_conversation_cookies")
      .upsert({ cookie_id: webCookieId, conversation_id: conversationId }, { onConflict: "cookie_id" });

    // --- Rate-limit count BEFORE insert (for headers + optional enforcement)
    let countBefore = 0;
    try {
      const cutoffIso = new Date(Date.now() - RL_WINDOW_SEC * 1000).toISOString();
      const { count } = await admin
        .from("conversation_messages")
        .select("id", { count: "exact", head: true })
        .eq("conversation_id", conversationId)
        .eq("role", "user")
        .gt("created_at", cutoffIso);
      countBefore = count ?? 0;
    } catch { /* ignore */ }

    if (RL_ENABLED && countBefore >= RL_LIMIT) {
      const res429 = NextResponse.json(
        { ok: false, error: "rate_limited", stage: "rate_limit" },
        { status: 429 }
      );
      res429.headers.set("x-conversation-id", conversationId);
      res429.headers.set("x-rate-limit-limit", String(RL_LIMIT));
      res429.headers.set("x-rate-limit-window-sec", String(RL_WINDOW_SEC));
      res429.headers.set("x-rate-limit-count-before", String(countBefore));
      res429.headers.set("x-rate-limit-remaining-after", "0");
      return res429;
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

    // Species detection + policy resolution
    const detected = await detectSpeciesSlugFromText(content);
    const speciesSlug = extractSlug(detected);
    const policy = speciesSlug ? await resolvePolicyForSpecies(speciesSlug, ORG_SLUG) : null;

    // Build json response
    const res = NextResponse.json(
      { ok: true, conversation_id: conversationId, speciesSlug, policy, createdNow, ms: Date.now() - startedAt },
      { status: 200 }
    );

    // Set/refresh cookies
    res.cookies.set({
      name: CONV_COOKIE, value: conversationId, httpOnly: true, sameSite: "lax", secure: true, path: "/", maxAge: CONV_COOKIE_MAX_AGE,
    });
    res.cookies.set({
      name: WEB_COOKIE, value: webCookieId, httpOnly: true, sameSite: "lax", secure: true, path: "/", maxAge: WEB_COOKIE_MAX_AGE,
    });

    // Debug headers
    const remainingAfter = Math.max(0, RL_LIMIT - (countBefore + 1));
    res.headers.set("x-policy-debug", `species=${speciesSlug ?? "null"}`);
    res.headers.set("x-conversation-id", conversationId);
    res.headers.set("x-rate-limit-limit", String(RL_LIMIT));
    res.headers.set("x-rate-limit-window-sec", String(RL_WINDOW_SEC));
    res.headers.set("x-rate-limit-count-before", String(countBefore));
    res.headers.set("x-rate-limit-remaining-after", String(remainingAfter));
    res.headers.set("x-rate-limit-enabled", String(RL_ENABLED));

    return res;
  } catch (err: any) {
    return NextResponse.json(
      { ok: false, error: err?.message || String(err), stage: "unhandled" },
      { status: 500 }
    );
  }
}

// GET → 405 (intentional; POST-only)
export async function GET() {
  return NextResponse.json({ ok: false, error: "method_not_allowed" }, { status: 405 });
}
