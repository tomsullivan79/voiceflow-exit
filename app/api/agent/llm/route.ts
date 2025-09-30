// app/api/agent/llm/route.ts
import { NextRequest, NextResponse } from "next/server";
import { VariableBus } from "@/types/variableBus";
import { runLLMAgent } from "@/lib/agent/runLLM";
import { runOptionA } from "@/lib/agent/runOptionA";
import { routeDecision } from "@/lib/agent/router";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function parseForce(req: NextRequest, bodyForce: unknown): boolean | undefined {
  const q = new URL(req.url).searchParams.get("force");
  if (q === "true") return true;
  if (q === "false") return false;
  if (typeof bodyForce === "boolean") return bodyForce;
  return undefined;
}

function withTimeout<T>(p: Promise<T>, ms: number): Promise<T> {
  return new Promise((resolve, reject) => {
    const t = setTimeout(() => reject(new Error(`timeout after ${ms}ms`)), ms);
    p.then(
      (v) => { clearTimeout(t); resolve(v); },
      (e) => { clearTimeout(t); reject(e); }
    );
  });
}

function severity(decision?: string): number {
  switch (decision) {
    case "dispatch": return 4;
    case "referral": return 3;
    case "bring_in": return 2;
    case "self_help": return 1;
    case "monitor":
    case "unknown":
    default: return 0;
  }
}

// Shallow merge sufficient for routing parity checks
function mergeBus(base: VariableBus, patch: Partial<VariableBus> | undefined): VariableBus {
  if (!patch) return base;
  return {
    ...base,
    ...patch,
    animal: { ...(base.animal ?? {}), ...(patch as any).animal },
    species_flags: { ...(base.species_flags ?? {}), ...(patch as any).species_flags },
    triage: { ...(base.triage ?? {}), ...(patch as any).triage },
    referral: { ...(base.referral ?? {}), ...(patch as any).referral },
    org: { ...(base.org ?? {}), ...(patch as any).org },
    system: { ...(base.system ?? {}), ...(patch as any).system },
  };
}

// Health check
export async function GET(req: NextRequest) {
  const ping = new URL(req.url).searchParams.get("ping");
  if (ping) return NextResponse.json({ ok: true, pong: true });
  return NextResponse.json({ ok: false, error: "POST a bus to this endpoint." }, { status: 405 });
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}));
    const bus = (body?.bus || {}) as VariableBus;
    const force = parseForce(req, body?.force);

    const openAIConfigured = !!process.env.OPENAI_API_KEY;
    const tryLLM = openAIConfigured && force !== false;

    let result: Awaited<ReturnType<typeof runOptionA>>;
    let usedLLM = false;
    let fallback: "llm_timeout" | "llm_guardrail" | undefined;

    if (tryLLM) {
      try {
        // 20s guard around the LLM path
        result = await withTimeout(runLLMAgent(bus), 20000);
        usedLLM = true;
      } catch (err: any) {
        const msg = (err && (err.message || String(err))) ?? "";
        if (/timeout/i.test(msg)) {
          // Graceful fallback on timeout
          fallback = "llm_timeout";
          result = await runOptionA(bus);
          usedLLM = false;
        } else {
          console.error("LLM error:", msg);
          return NextResponse.json({ ok: false, error: msg || "llm_error" }, { status: 500 });
        }
      }
    } else {
      result = await runOptionA(bus);
    }

    // --- Guardrail: never allow weaker decision than router ---
    const merged = mergeBus(bus, result?.updatedBus);
    const routed = routeDecision(merged);
    const llmDecision = result?.updatedBus?.triage?.decision ?? "unknown";
    if (severity(llmDecision) < severity(routed.decision)) {
      result = await runOptionA(merged);
      usedLLM = false;
      fallback = (fallback ?? "llm_guardrail") as "llm_guardrail";
    }
    // --- End guardrail ---

    // Normalize referral.validated immutably if a target is present & needed
    const r: any = result?.updatedBus?.referral;
    if (r && typeof r === "object" && r.needed && r.target) {
      result.updatedBus = {
        ...result.updatedBus,
        referral: { ...r, validated: true },
      };
    }

    // --- Optional polish: normalize block titles for consistent UI ---
    if (Array.isArray(result?.blocks)) {
      const decision = result?.updatedBus?.triage?.decision;
      const stepsTitle = decision === "dispatch" ? "Public Health — Do this now" : "Do this next";
      result.blocks = result.blocks.map((b: any) => {
        if (b?.type === "summary" && !b.title) {
          return { ...b, title: "Triage Summary" };
        }
        if (b?.type === "steps" && !b.title) {
          return { ...b, title: stepsTitle };
        }
        return b;
      });
    }
    // --- End polish ---

    return NextResponse.json({ ok: true, usedLLM, ...(fallback ? { fallback } : {}), result });
  } catch (err: any) {
    const msg = (err && (err.message || String(err))) ?? "unknown_error";
    return NextResponse.json({ ok: false, error: msg }, { status: 500 });
  }
}
