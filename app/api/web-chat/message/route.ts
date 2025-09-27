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

const ORG_SLUG      = process.env.ORG_SLUG || "wrc-mn";
const OWNER_USER_ID = process.env.WEB_CHAT_OWNER_USER_ID || "";

const RL_LIMIT       = parseInt(process.env.WEBCHAT_RL_LIMIT ?? "3", 10);
const RL_WINDOW_SEC  = parseInt(process.env.WEBCHAT_RL_WINDOW_SEC ?? "30", 10);
const RL_ENABLED     = (process.env.WEBCHAT_RL_ENABLED ?? "false").toLowerCase() === "true";

// ---------- helpers ----------
function normalizeWhitespace(s: string) { return s.replace(/\s+/g, " ").trim(); }
function sentenceCase(s: string) { return s ? s[0].toUpperCase() + s.slice(1) : s; }
function makeTitleFromContent(content: string) {
  const base = sentenceCase(normalizeWhitespace((content || "").replace(/[\r\n]+/g, " ")));
  const punct = base.search(/[.!?]/);
  let slice = punct > -1 ? base.slice(0, punct + 1) : base.slice(0, 48);
  if (slice.length < base.length && !/[.!?]$/.test(slice)) slice = slice.trimEnd() + "…";
  return slice || "Web Chat";
}
function extractSlug(d: any): string | null {
  if (!d) return null;
  if (typeof d === "string") return d || null;
  if (typeof d.slug === "string" && d.slug) return d.slug;
  if (typeof d.speciesSlug === "string" && d.speciesSlug) return d.speciesSlug;
  if (typeof d.value === "string" && d.value) return d.value;
  if (Array.isArray(d)) for (const v of d) { const s = extractSlug(v); if (s) return s; }
  return null;
}
function getSourceIp(req: Request): string | null {
  const xf = req.headers.get("x-forwarded-for");
  if (xf) return xf.split(",")[0]?.trim() || null;
  return req.headers.get("x-real-ip") || null;
}

// Build a short, policy-aware reply (1–3 lines, empathetic, concrete)
function buildPolicyReply(policy: any): string {
  if (!policy || typeof policy !== "object") return "";
  const type = policy.type as string | undefined;
  const msg  = (policy.public_message as string | undefined) || "";
  const refs = Array.isArray(policy.referrals) ? policy.referrals as Array<{type?: string; label?: string}> : [];

  const lines: string[] = [];
  if (msg) lines.push(msg);

  if (type === "out_of_scope") {
    lines.push("We can’t admit this animal, but we’ll help you find the right place fast.");
  } else if (type === "not_supported") {
    lines.push("We don’t admit this species, but we’ll guide you on what to do next.");
  } else if (type === "conditional") {
    lines.push("We may admit in certain situations. A couple quick checks can help decide.");
  } else if (type === "supported") {
    lines.push("We may be able to help. Here’s what to do right now:");
  }

  if (refs.length) {
    const labels = refs.map(r => r?.label).filter(Boolean) as string[];
    if (labels.length) {
      lines.push(`Referrals: ${labels.join(" • ")}`);
    }
  }

  // Keep it tight—no walls of text
  return lines.filter(Boolean).slice(0, 3).join("\n");
}

async function ensureConversationId(admin: ReturnType<typeof supabaseAdmin>, wantId: string | null, title: string, source_ip: string | null) {
  if (!OWNER_USER_ID) throw new Error("missing_OWNER_USER_ID_env");
  if (wantId) {
    const { data, error } = await admin
      .from("conversations")
      .select("id")
      .eq("id", wantId)
      .maybeSingle();
    if (!error && data?.id) return { id: data.id as string, createdNow: false };
  }
  const { data, error } = await admin
    .from("conversations")
    .insert({ user_id: OWNER_USER_ID, title, created_ip: source_ip ?? null })
    .select("id")
    .single();
  if (error || !data?.id) throw new Error(error?.message || "conversation_insert_failed");
  return { id: data.id as string, createdNow: true };
}

// ---------- handler ----------
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

    const cookieConvId = jar.get(CONV_COOKIE)?.value || null;
    const { id: conversationId, createdNow } = await ensureConversationId(
      admin,
      cookieConvId,
      makeTitleFromContent(content),
      source_ip
    );

    // Map cookie → conversation
    let webCookieId = jar.get(WEB_COOKIE)?.value || null;
    if (!webCookieId) webCookieId = crypto.randomUUID();
    await admin
      .from("web_conversation_cookies")
      .upsert({ cookie_id: webCookieId, conversation_id: conversationId }, { onConflict: "cookie_id" });

    // Rate-limit count BEFORE insert
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
    } catch {}

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

    // Insert user message (with FK safety retry)
    async function insertUserMessage(targetConvId: string) {
      const { error } = await admin.from("conversation_messages").insert({
        conversation_id: targetConvId,
        role: "user",
        content,
        source_ip: source_ip ?? null,
      });
      return error;
    }

    let persistError = await insertUserMessage(conversationId);
    if (persistError && (persistError.code === "23503" || /foreign key/i.test(persistError.message))) {
      const fallback = await ensureConversationId(admin, null, makeTitleFromContent(content), source_ip);
      await admin
        .from("web_conversation_cookies")
        .upsert({ cookie_id: webCookieId, conversation_id: fallback.id }, { onConflict: "cookie_id" });
      persistError = await insertUserMessage(fallback.id);
      if (!persistError) (jar as any)._forceConvId = fallback.id;
    }
    if (persistError) {
      return NextResponse.json(
        { ok: false, error: persistError.message, stage: "persist_user" },
        { status: 500 }
      );
    }

    // Species detection + policy
    const detected = await detectSpeciesSlugFromText(content);
    const speciesSlug = extractSlug(detected);
    const policy = speciesSlug ? await resolvePolicyForSpecies(speciesSlug, ORG_SLUG) : null;

    // NEW: inject a short assistant reply when policy is present
    if (policy) {
      const assistant = buildPolicyReply(policy);
      if (assistant) {
        await admin.from("conversation_messages").insert({
          conversation_id: ((jar as any)._forceConvId as string) || conversationId,
          role: "assistant",
          content: assistant,
        });
      }
    }

    const effectiveConvId = ((jar as any)._forceConvId as string) || conversationId;

    // Response
    const res = NextResponse.json(
      { ok: true, conversation_id: effectiveConvId, speciesSlug, policy, createdNow, ms: Date.now() - startedAt },
      { status: 200 }
    );

    // Cookies
    res.cookies.set({
      name: CONV_COOKIE,
      value: effectiveConvId,
      httpOnly: true, sameSite: "lax", secure: true, path: "/", maxAge: CONV_COOKIE_MAX_AGE,
    });
    res.cookies.set({
      name: WEB_COOKIE,
      value: webCookieId,
      httpOnly: true, sameSite: "lax", secure: true, path: "/", maxAge: WEB_COOKIE_MAX_AGE,
    });

    // Debug headers
    const remainingAfter = Math.max(0, RL_LIMIT - (countBefore + 1));
    res.headers.set("x-policy-debug", `species=${speciesSlug ?? "null"}`);
    res.headers.set("x-conversation-id", effectiveConvId);
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

export async function GET() {
  return NextResponse.json({ ok: false, error: "method_not_allowed" }, { status: 405 });
}
