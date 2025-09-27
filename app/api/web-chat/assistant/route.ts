// app/api/web-chat/assistant/route.ts
import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { supabaseAdmin } from "../../../../lib/supabaseServer";
import { detectSpeciesSlugFromText, resolvePolicyForSpecies } from "../../../../lib/policy";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const CONV_COOKIE = "wt_conversation_id";
const ORG_SLUG = process.env.ORG_SLUG || "wrc-mn";

// --- helpers (mirror message route) ---
function normalizeWhitespace(s: string) { return s.replace(/\s+/g, " ").trim(); }
function sentenceCase(s: string) { return s ? s[0].toUpperCase() + s.slice(1) : s; }
function extractSlug(d: any): string | null {
  if (!d) return null;
  if (typeof d === "string") return d || null;
  if (typeof d.slug === "string" && d.slug) return d.slug;
  if (typeof d.speciesSlug === "string" && d.speciesSlug) return d.speciesSlug;
  if (typeof d.value === "string" && d.value) return d.value;
  if (Array.isArray(d)) for (const v of d) { const s = extractSlug(v); if (s) return s; }
  return null;
}

// Short, empathetic, policy-aware reply (same as message route)
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
    if (labels.length) lines.push(`Referrals: ${labels.join(" • ")}`);
  }

  return lines.filter(Boolean).slice(0, 3).join("\n");
}

async function getLatestUserAndAssistant(admin: ReturnType<typeof supabaseAdmin>, conversationId: string) {
  const { data: lastUser, error: e1 } = await admin
    .from("conversation_messages")
    .select("id, content, created_at")
    .eq("conversation_id", conversationId)
    .eq("role", "user")
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (e1) throw new Error(e1.message);

  let lastAssistantAfterUser: any = null;
  if (lastUser?.created_at) {
    const { data, error } = await admin
      .from("conversation_messages")
      .select("id, content, created_at")
      .eq("conversation_id", conversationId)
      .eq("role", "assistant")
      .gt("created_at", lastUser.created_at)
      .order("created_at", { ascending: true })
      .limit(1)
      .maybeSingle();
    if (error) throw new Error(error.message);
    lastAssistantAfterUser = data || null;
  }

  return { lastUser, lastAssistantAfterUser };
}

// --- handler ---
export async function POST() {
  try {
    const jar = await cookies();
    const conversationId = jar.get(CONV_COOKIE)?.value || null;
    if (!conversationId) {
      return NextResponse.json({ ok: false, error: "no_conversation", stage: "cookies" }, { status: 400 });
    }

    const admin = supabaseAdmin();

    // 1) If an assistant reply already exists after the latest user message, return it (idempotent)
    const { lastUser, lastAssistantAfterUser } = await getLatestUserAndAssistant(admin, conversationId);
    if (lastAssistantAfterUser?.content) {
      return NextResponse.json({
        ok: true,
        conversation_id: conversationId,
        content: lastAssistantAfterUser.content,
        reused: true
      });
    }

    // 2) Otherwise, compute a policy-aware reply from the latest user message
    const userText = (lastUser?.content || "").toString();
    let content = "How can I assist you today?"; // fallback

    if (userText.trim()) {
      const detected = await detectSpeciesSlugFromText(userText);
      const speciesSlug = extractSlug(detected);
      const policy = speciesSlug ? await resolvePolicyForSpecies(speciesSlug, ORG_SLUG) : null;

      if (policy) {
        const assistant = buildPolicyReply(policy);
        if (assistant) content = assistant;
      }
    }

    // 3) Persist the assistant reply we decided on
    const { error: insErr } = await admin.from("conversation_messages").insert({
      conversation_id: conversationId,
      role: "assistant",
      content
    });
    if (insErr) {
      return NextResponse.json(
        { ok: false, error: insErr.message, stage: "persist_assistant" },
        { status: 500 }
      );
    }

    return NextResponse.json({ ok: true, conversation_id: conversationId, content, reused: false });
  } catch (err: any) {
    return NextResponse.json(
      { ok: false, error: err?.message || String(err), stage: "unhandled" },
      { status: 500 }
    );
  }
}

// Optional: block GET if your client never uses it
export async function GET() {
  return NextResponse.json({ ok: false, error: "method_not_allowed" }, { status: 405 });
}
