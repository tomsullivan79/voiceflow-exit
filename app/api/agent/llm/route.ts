// app/api/agent/llm/route.ts
import { NextRequest, NextResponse } from "next/server";
import { headers } from "next/headers";
import { getCuratedInstructions } from "@/lib/tools/curatedInstructions";

export const dynamic = "force-dynamic";

// Late-bind the deterministic runner so we can tolerate different export shapes.
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

    // Resolve curated instructions (tone-aware) first; injected by runner.
    const curated = await getCuratedInstructions(bus);

    // Keep parity: Option A (deterministic) is the baseline for severity/decision.
    const useDeterministic = force === "false" || !hasKey;
    const runDeterministic = await loadDeterministicRunner();
    const result = await runDeterministic(bus, { curated });

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
