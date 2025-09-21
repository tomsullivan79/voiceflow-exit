// app/api/web-chat/message/route.ts
import { NextResponse } from "next/server";
import { cookies, headers } from "next/headers";
import { supabaseAdmin } from "@/lib/supabaseServer";
import { ORG_SLUG } from "@/lib/config";
import { detectSpeciesSlugFromText, resolvePolicyForSpecies } from "@/lib/policy";

const MAX_MSGS = 3;
const WINDOW_SEC = 30;

// normalize small things for duplicate protection
const norm = (s: string) => s.trim().replace(/\s+/g, " ").toLowerCase();

export async function POST(req: Request) {
  const started = Date.now();
  try {
    const supabase = supabaseAdmin();
    const body = await req.json();
    const content: string = String(body?.content ?? "");

    if (!content.trim()) {
      return NextResponse.json({ ok: false, error: "empty" }, { status: 400 });
    }

    // Identify browser/IP (used only before a conversation_id exists)
    const h = headers();
    const ip =
      h.get("x-forwarded-for")?.split(",")[0]?.trim() ||
      h.get("x-real-ip") ||
      "0.0.0.0";

    // Conversation cookie (your existing flow should set/return this id)
    const jar = cookies();
    const convId = jar.get("wt_conversation_id")?.value ?? body?.conversation_id ?? null;

    // --- RATE LIMIT: 3 user msgs / 30s per conversation (or per IP if no conv yet) ---
    const sinceIso = new Date(Date.now() - WINDOW_SEC * 1000).toISOString();

    if (convId) {
      const { count, error: cErr } = await supabase
        .from("conversation_messages")
        .select("id", { count: "exact", head: true })
        .eq("conversation_id", convId)
        .eq("role", "user")
        .gte("created_at", sinceIso);

      if (cErr) {
        // soft-fail: don't block the user if count query errors
        console.warn("[rate] count error:", cErr.message);
      } else if ((count ?? 0) >= MAX_MSGS) {
        return tooMany();
      }
    } else {
      // no conversation yet → approximate per-IP rate
      const { count, error: cErr } = await supabase
        .from("conversation_messages")
        .select("id", { count: "exact", head: true })
        .eq("source_ip", ip) // requires nullable column; if you don't have it yet, see note below
        .eq("role", "user")
        .gte("created_at", sinceIso);

      if (!cErr && (count ?? 0) >= MAX_MSGS) {
        return tooMany();
      }
    }
    // -------------------------------------------------------------------------------

    // Create conversation (if needed) & persist user message
    // NOTE: this assumes your existing implementation; keep your current logic here.
    // Minimal example (adapt to your code):
    const conversation_id = await ensureConversationId(convId, supabase, jar, ip);

    const { data: insertMsg, error: insErr } = await supabase
      .from("conversation_messages")
      .insert({
        conversation_id,
        role: "user",
        content,
        source: "web",
        source_ip: ip, // safe to set; if column doesn't exist, remove this line
      })
      .select("id")
      .maybeSingle();

    if (insErr) {
      return NextResponse.json({ ok: false, stage: "insert", error: insErr.message }, { status: 500 });
    }

    // Policy detection
    const speciesSlug = detectSpeciesSlugFromText(content);
    let policy = null as any;
    if (speciesSlug) {
      policy = await resolvePolicyForSpecies(speciesSlug, ORG_SLUG);
    }

    // Done
    return NextResponse.json(
      { ok: true, conversation_id, speciesSlug, policy, ms: Date.now() - started },
      { status: 200 }
    );
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: e?.message || "unknown" }, { status: 500 });
  }
}

function tooMany() {
  return new NextResponse(
    JSON.stringify({
      ok: false,
      error: "rate_limited",
      message: `Too many messages — please wait a moment and try again.`,
      retry_after_sec: WINDOW_SEC,
    }),
    {
      status: 429,
      headers: {
        "Content-Type": "application/json",
        "Retry-After": String(WINDOW_SEC),
      },
    }
  );
}

async function ensureConversationId(
  convId: string | null,
  supabase: ReturnType<typeof supabaseAdmin>,
  jar: ReturnType<typeof cookies>,
  ip: string
): Promise<string> {
  if (convId) return convId;

  // Minimal insert — only fields we know exist.
  const { data, error } = await supabase
    .from("conversations")
    .insert({ title: null, created_ip: ip }) // ← removed `source`
    .select("id")
    .maybeSingle();

  if (error || !data?.id) throw new Error(error?.message || "conv-create-failed");

  // Persist cookie for subsequent requests
  jar.set("wt_conversation_id", data.id, {
    httpOnly: true,
    sameSite: "lax",
    secure: true,
    path: "/",
    maxAge: 60 * 60 * 24 * 14, // 14 days
  });

  return data.id;
}

