import { NextRequest, NextResponse } from "next/server";
import { headers } from "next/headers";
import { getCuratedInstructions } from "@/lib/tools/curatedInstructions";
import { getAgentInstructions } from "@/lib/tools/agentInstructions";

export const dynamic = "force-dynamic";

type Runner = (bus: any, extras?: any) => Promise<any> | any;
async function loadDeterministicRunner(): Promise<Runner> {
  const mod: any = await import("@/lib/agent/runLLM");
  const fn: any = mod?.runDeterministic || mod?.runLLM || mod?.default;
  if (typeof fn !== "function") throw new Error("runDeterministic_not_found");
  return fn as Runner;
}

// (keep your normalizeBus, markdownToSteps, injectCuratedSteps helpers if you already have them)
// Below assumes they exist exactly as in your current route.
// If not present, paste your existing implementations back in.

function markdownToSteps(md: string): { title: string; lines: string[] } {
  const lines = md.split(/\r?\n/);
  let title = "Do this next";
  const out: string[] = [];
  for (const raw0 of lines) {
    const raw = raw0.trim();
    if (!raw) continue;
    const h = raw.match(/^#{1,6}\s*(.+)$/);
    if (h && title === "Do this next") { title = h[1].trim(); continue; }
    const list = raw.replace(/^\s*([-*]|\d+[\.\)])\s+/, "").trim();
    const text = list.replace(/\*\*(.+?)\*\*/g, "$1").replace(/\*(.+?)\*/g, "$1");
    if (text) out.push(text);
  }
  return { title, lines: out.length ? out : lines.filter(Boolean) };
}

function injectCuratedSteps(result: any, curatedMd: string) {
  if (!result || !Array.isArray(result.blocks)) return;
  const { title, lines } = markdownToSteps(curatedMd);
  if (!lines.length) return;
  const blocks = result.blocks as Array<any>;
  const idxSteps = blocks.findIndex((b) => b?.type === "steps");
  const idxReferral = blocks.findIndex((b) => b?.type === "referral");
  const newSteps = { type: "steps", title, lines };
  if (idxSteps >= 0) blocks[idxSteps] = newSteps;
  else if (idxReferral >= 0) blocks.splice(idxReferral, 0, newSteps);
  else blocks.unshift(newSteps);
}

function normalizeBus(raw: any) {
  const bus = raw && typeof raw === "object" ? raw : {};
  bus.mode = bus.mode || "triage";
  bus.triage = bus.triage || {};
  bus.overlays = bus.overlays || {};
  bus.animal = bus.animal || {};
  bus.caller = bus.caller || {};
  bus.org = bus.org || {};
  bus.system = bus.system || {};
  bus.species_flags = {
    dangerous: false, rabies_vector: false, referral_required: false,
    intervention_needed: false, after_hours_allowed: false,
    ...(bus.species_flags || {})
  };
  return bus;
}

export async function POST(req: NextRequest) {
  try {
    const url = new URL(req.url);
    const debug = url.searchParams.get("debug") === "1";
    const ping = url.searchParams.get("ping") === "1";
    const force = url.searchParams.get("force");
    const hdrs = headers();
    const xreq = hdrs.get("x-request-id") || undefined;

    if (ping) return NextResponse.json({ ok: true, ping: "pong", x_request_id: xreq });

    const body = await req.json();
    const bus = normalizeBus(body?.bus);
    const hasKey = !!process.env.OPENAI_API_KEY;

    // Load agent instructions (NEW) and curated steps (existing)
    const [agent, curated] = await Promise.all([
      getAgentInstructions(bus),
      getCuratedInstructions(bus),
    ]);

    const useDeterministic = force === "false" || !hasKey;
    const runDeterministic = await loadDeterministicRunner();
    const result = await runDeterministic(bus, { curated });

    // Inject curated steps as before
    if (curated?.content) injectCuratedSteps(result, curated.content);

    // Attach agent instructions to meta (traceable, parity-safe)
    (result.meta ??= {});
    result.meta.agent_instructions = agent?.content ?? null;

    const payload: any = {
      ok: true,
      usedLLM: !useDeterministic && hasKey ? true : false,
      result,
    };

    if (debug) {
      payload.curatedSource = curated.sourcePath;
      payload.placeholderApplied = curated.placeholderApplied;
      payload.agentInstructionsSource = agent.sourcePath;
      payload.agentPlaceholderApplied = agent.placeholderApplied;
      payload.x_request_id = xreq;
    }

    return NextResponse.json(payload);
  } catch (err: any) {
    return NextResponse.json({ ok: false, error: err?.message || "unknown_error" }, { status: 500 });
  }
}
