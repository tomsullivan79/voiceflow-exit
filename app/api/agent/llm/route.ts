// app/api/agent/llm/route.ts
import { NextRequest, NextResponse } from "next/server";
import { VariableBus } from "@/types/variableBus";
import { runLLMAgent } from "@/lib/agent/runLLM";
import { runOptionA } from "@/lib/agent/runOptionA";

export const runtime = "nodejs";

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => ({}));
  const bus = (body?.bus || {}) as VariableBus;

  // If no API key, fall back to deterministic runner so prod never breaks
  const useLLM = !!process.env.OPENAI_API_KEY && (body?.force !== false);

  const result = useLLM ? await runLLMAgent(bus) : await runOptionA(bus);
  return NextResponse.json({ ok: true, usedLLM: useLLM, result });
}
