import { NextRequest, NextResponse } from "next/server";
import { getCuratedInstructions } from "@/lib/tools/curatedInstructions";
import { runDeterministic } from "@/lib/agent/runLLM"; // same export name used for Option A deterministic
import { headers } from "next/headers";

export const dynamic = "force-dynamic";

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

    // Curated file (tone-aware) — computed first, later injected into blocks by Option A
    const curated = await getCuratedInstructions(bus);

    const useDeterministic = force === "false" || !hasKey;
    const result = await runDeterministic(bus, { curated }); // Option A remains the parity baseline

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
