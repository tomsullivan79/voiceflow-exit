import { NextRequest, NextResponse } from "next/server";
import { headers } from "next/headers";
import { getCuratedInstructions } from "@/lib/tools/curatedInstructions";

export const dynamic = "force-dynamic";

// Late-bind deterministic runner so we tolerate any export shape.
type Runner = (bus: any, extras?: any) => Promise<any> | any;

async function loadDeterministicRunner(): Promise<Runner> {
  const mod: any = await import("@/lib/agent/runLLM");
  const fn: any = mod?.runDeterministic || mod?.runLLM || mod?.default;
  if (typeof fn !== "function") throw new Error("runDeterministic_not_found");
  return fn as Runner;
}

/** Defensive defaults so downstream logic never crashes on missing fields. */
function normalizeBus(raw: any) {
  const bus = raw && typeof raw === "object" ? raw : {};

  bus.mode = bus.mode || "triage";
  bus.triage = bus.triage || {};
  bus.overlays = bus.overlays || {};
  bus.animal = bus.animal || {};
  bus.caller = bus.caller || {};
  bus.org = bus.org || {};
  bus.system = bus.system || {};

  // species_flags: ensure all expected booleans exist
  const sf = bus.species_flags || {};
  bus.species_flags = {
    dangerous: false,
    rabies_vector: false,
    referral_required: false,
    intervention_needed: false,
    after_hours_allowed: false,
    ...sf,
  };

  return bus;
}

/** Convert simple Markdown into a steps block structure. */
function markdownToSteps(md: string): { title: string; lines: string[] } {
  const lines = md.split(/\r?\n/);
  let title = "Do this next";
  const out: string[] = [];

  for (let i = 0; i < lines.length; i++) {
    const raw = lines[i].trim();
    if (!raw) continue;

    const h = raw.match(/^#{1,6}\s*(.+)$/);
    if (h && title === "Do this next") {
      title = h[1].trim();
      continue;
    }

    const list = raw.replace(/^\s*([-*]|\d+[\.\)])\s+/, "").trim();
    const text = list.replace(/\*\*(.+?)\*\*/g, "$1").replace(/\*(.+?)\*/g, "$1");
    if (text) out.push(text);
  }

  return { title, lines: out.length ? out : lines.filter(Boolean) };
}

/** Inject/replace a steps block in `result.blocks` with curated Markdown. */
function injectCuratedSteps(result: any, curatedMd: string) {
  if (!result || !Array.isArray(result.blocks)) return;
  const { title, lines } = markdownToSteps(curatedMd);
  if (!lines.length) return;

  const blocks = result.blocks as Array<any>;
  const idxSteps = blocks.findIndex((b) => b?.type === "steps");
  const idxReferral = blocks.findIndex((b) => b?.type === "referral");
  const newSteps = { type: "steps", title, lines };

  if (idxSteps >= 0) {
    blocks[idxSteps] = newSteps;
  } else if (idxReferral >= 0) {
    blocks.splice(idxReferral, 0, newSteps);
  } else {
    blocks.unshift(newSteps);
  }
}

export async function POST(req: NextRequest) {
  try {
    const url = new URL(req.url);
    const debug = url.searchParams.get("debug") === "1";
    const ping = url.searchParams.get("ping") === "1";
    const force = url.searchParams.get("force"); // "false" => deterministic
    const hdrs = headers();
    const xreq = hdrs.get("x-request-id") || undefined;

    if (ping) {
      return NextResponse.json({ ok: true, ping: "pong", x_request_id: xreq });
    }

    const body = await req.json();
    const bus = normalizeBus(body?.bus);

    const hasKey = !!process.env.OPENAI_API_KEY;

    // Resolve curated file (tone- & mode-aware).
    const curated = await getCuratedInstructions(bus);

    // Parity: Option A (deterministic) is baseline for decision/severity.
    const useDeterministic = force === "false" || !hasKey;
    const runDeterministic = await loadDeterministicRunner();
    const result = await runDeterministic(bus, { curated });

    // Route-level merge: if curated Markdown exists, inject into steps.
    if (curated?.content) {
      injectCuratedSteps(result, curated.content);
    }

    const payload: any = {
      ok: true,
      usedLLM: !useDeterministic && hasKey ? true : false,
      result,
    };

    if (debug) {
      payload.curatedSource = curated.sourcePath;
      payload.placeholderApplied = curated.placeholderApplied;
      payload.x_request_id = xreq;
    }

    return NextResponse.json(payload);
  } catch (err: any) {
    return NextResponse.json(
      { ok: false, error: err?.message || "unknown_error" },
      { status: 500 }
    );
  }
}
