import { NextRequest, NextResponse } from 'next/server';
import { enrichDispatchSteps } from '@/lib/tools/enrichDispatchSteps';
import { runOptionA } from '@/lib/agent/runOptionA';
import { runLLM } from '@/lib/agent/runLLM';

export const runtime = 'nodejs';

function makeReqId() {
  return (globalThis.crypto?.randomUUID?.() ?? Math.random().toString(36).slice(2));
}

// Normalize common UI titles + referral.validated
function normalizeBlocks(blocks: any[] = [], decision?: string) {
  for (const b of blocks) {
    if (b?.type === 'summary') b.title = 'Triage Summary';
    if (b?.type === 'steps') {
      b.title = decision === 'dispatch' ? 'Public Health — Do this now' : 'Do this next';
    }
    if (b?.type === 'referral') {
      b.title = b.title || 'Referral';
    }
  }
  // Also normalize referral.validated when a target exists
  const referral = blocks.find((b) => b?.type === 'referral');
  if (referral?.target && referral.validated !== true) referral.validated = true;
  return blocks;
}

function hasApiKey() {
  return !!process.env.OPENAI_API_KEY && process.env.OPENAI_API_KEY !== 'undefined';
}

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const ping = searchParams.get('ping');
  const reqId = makeReqId();

  if (ping === '1') {
    return new NextResponse(JSON.stringify({ ok: true, usedLLM: false, pong: true }), {
      status: 200,
      headers: { 'content-type': 'application/json', 'x-request-id': reqId },
    });
  }

  return new NextResponse(JSON.stringify({ ok: true }), {
    status: 200,
    headers: { 'content-type': 'application/json', 'x-request-id': reqId },
  });
}

export async function POST(req: NextRequest) {
  const reqId = makeReqId();
  try {
    const { searchParams } = new URL(req.url);
    const force = searchParams.get('force'); // expect 'false' for deterministic
    const useLLM = !(force === 'false') && hasApiKey();

    const { bus } = (await req.json()) as { bus: any };
    if (!bus) {
      return new NextResponse(JSON.stringify({ ok: false, error: 'Missing bus' }), {
        status: 400,
        headers: { 'content-type': 'application/json', 'x-request-id': reqId },
      });
    }

    // Race LLM with timeout (20s) when enabled; otherwise run Option A
    let usedLLM = false;
    let fallback: string | null = null;
    let result: { blocks: any[]; updatedBus?: any } = { blocks: [], updatedBus: bus };

    if (useLLM) {
      usedLLM = true;
      const timeout = new Promise<never>((_, rej) =>
        setTimeout(() => rej(new Error('llm_timeout')), 20_000)
      );
      try {
        // runLLM should return { blocks, updatedBus }
        result = await Promise.race([runLLM(bus), timeout]);
      } catch (e: any) {
        // Timeout or LLM fail → fallback to Option A
        result = await runOptionA(bus);
        fallback = e?.message === 'llm_timeout' ? 'llm_timeout' : 'llm_error';
        usedLLM = true; // we attempted LLM
      }
    } else {
      result = await runOptionA(bus);
    }

    // Normalize titles / referral.validated
    const decision: string | undefined = result?.updatedBus?.triage?.decision;
    result.blocks = normalizeBlocks(result.blocks, decision);

    // Enrich dispatch steps with local public health contact (zip>county)
    result.blocks = await enrichDispatchSteps(result.blocks, result.updatedBus ?? bus);

    return new NextResponse(
      JSON.stringify({ ok: true, usedLLM, fallback, result }),
      { status: 200, headers: { 'content-type': 'application/json', 'x-request-id': reqId } }
    );
  } catch (err: any) {
    const error = err?.message ?? 'Server error';
    return new NextResponse(JSON.stringify({ ok: false, error }), {
      status: 500,
      headers: { 'content-type': 'application/json', 'x-request-id': reqId },
    });
  }
}
