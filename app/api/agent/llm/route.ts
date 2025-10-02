import { NextRequest, NextResponse } from "next/server";
import { headers } from "next/headers";
import { getCuratedInstructions } from "@/lib/tools/curatedInstructions";

export const dynamic = "force-dynamic";

// Late-bind deterministic runner so we tolerate any export shape.
// Accepts: named runDeterministic, named runLLM, or default export.
type Runner = (bus: any, extras?: any) => Promise<any> | any;

async function loadDeterministicRunner(): Promise<Runner> {
  const mod: any = await import("@/lib/agent/runLLM");
  const fn: any = mod?.runDeterministic || mod?.runLLM || mod?.default;
  if (typeof fn !== "function") {
    throw new Error("runDeterministic_not_found");
  }
  return fn as Runner;
}

/** Convert simple Markdown into a steps block structure. */
function markdownToSteps(md: string): { title: string; lines: string[] } {
  const lines = md.split(/\r?\n/);
  let title = "Do this next";
  const out: string[] = [];

  for (let i = 0; i < lines.length; i++) {
    const raw = lines[i].trim();
    if (!raw) continue;

    // First heading becomes title
    const h = raw.match(/^#{1,6}\s*(.+)$/);
    if (h && title === "Do this next") {
      title = h[1].trim();
      continue;
    }

    // Strip list markers: -, *, 1), 1., etc.
    const list = raw.replace(/^\s*([-*]|\d+[\.\)])\s+/, "").trim();
    // Strip leftover markdown emphasis markers
    const text = list.replace(/\*\*(.+?)\*\*/g, "$1").replace(/\*(.+?)\*/g, "$1");

    if (text) out.push(text);
  }

  // Fallback: if we only had paragraphs (no lists), keep them as individual lines
  return { title, lines: out.length ? out : lines.filter(Boolean) };
}

/** Inject/replace a steps block in `result.blocks` with curated Markdown. */
function injectCuratedSteps(result: any, curatedMd: string, decision?: string) {
  if (!result || !Array.isArray(result.blocks)) return;

  const { title, lines } = markdownToSteps(curatedMd);
  if (!lines.length) return;

  // Find an existing steps block to replace; otherwise insert before 'referral' block, else at top.
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

  // If decision is dispatch, we want supportive/curated steps to appear
  // *before* any public-health enrichment lines already present.
  // The above logic already handles that by unshifting when no steps exist.
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
    const bus = body?.bus ?? {};
    const hasKey = !!process.env.OPENAI_API_KEY;

    // Resolve curated file (tone-aware).
    const curated = await getCuratedInstructions(bus);

    // Keep parity: Option A (deterministic) is baseline for decision/severity.
    const useDeterministic = force === "false" || !hasKey;
    const runDeterministic = await loadDeterministicRunner();
    const result = await runDeterministic(bus, { curated });

    // 🔧 Route-level merge: if we found curated Markdown, inject into steps.
    if (curated?.content) {
      const decision =
        bus?.triage?.decision ||
        (result?.updatedBus?.triage?.decision as string | undefined);
      injectCuratedSteps(result, curated.content, decision || undefined);
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
