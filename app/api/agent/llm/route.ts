// app/api/agent/llm/route.ts
import { NextRequest, NextResponse } from "next/server";
import { VariableBus } from "@/types/variableBus";
import { runLLMAgent } from "@/lib/agent/runLLM";
import { runOptionA } from "@/lib/agent/runOptionA";

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
    p.then((v) => { clearTimeout(t); resolve(v); }, (e) => { clearTimeout(t); reject(e); });
  });
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
    const useLLM = openAIConfigured && force !== false;

    const runner = useLLM
      ? withTimeout(runLLMAgent(bus), 20000) // 20s guard
      : runOptionA(bus);

    const result = await runner;
    return NextResponse.json({ ok: true, usedLLM: useLLM, result });
  } catch (err: any) {
    const msg = (err && (err.message || String(err))) ?? "unknown_error";
    return NextResponse.json({ ok: false, error: msg }, { status: 500 });
  }
}
