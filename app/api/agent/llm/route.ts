// app/api/agent/llm/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { enrichDispatchSteps } from '@/lib/tools/enrichDispatchSteps';
import { runOptionA } from '@/lib/agent/runOptionA';
import { normalizeResult } from '@/lib/agent/normalizeResult';
import { loadCuratedSteps, applyCuratedPlaceholders } from '@/lib/tools/curatedInstructions';

export const runtime = 'nodejs';

function makeReqId() {
  return globalThis.crypto?.randomUUID?.() ?? Math.random().toString(36).slice(2);
}

// Resolve runLLM regardless of export shape (named or default)
async function getRunLLM(): Promise<(bus: any) => Promise<{ blocks: any[]; updatedBus?: any }>> {
  const mod: any = await import('@/lib/agent/runLLM');
  const fn = mod?.runLLM ?? mod?.default;
  if (typeof fn !== 'function') throw new Error('runLLM_not_found');
  return fn;
}

// Titles + referral.validated normalization for blocks
function normalizeBlocks(blocks: any[] = [], decision?: string) {
  for (const b of blocks) {
    if (b?.type === 'summary') b.title = 'Triage Summary';
    if (b?.type === 'steps') {
      b.title = decision === 'dispatch' ? 'Public Health — Do this now' : 'Do this next';
    }
    if (b?.type === 'referral') b.title = b.title || 'Referral';
  }
  const referral = blocks.find((b) => b?.type === 'referral');
  if (referral?.target && referral.validated !== true) referral.validated = true;
  return blocks;
}

function hasApiKey() {
  return !!process.env.OPENAI_API_KEY && process.env.OPENAI_API_KEY !== 'undefined';
}

// Merge base bus + updatedBus so enrichment/curation have full context
function mergeForEnrich(base: any, patch: any) {
  if (!patch) return base;
  return {
    ...base,
    ...patch,
    caller: { ...(base?.caller || {}), ...(patch?.caller || {}) },
    triage: { ...(base?.triage || {}), ...(patch?.triage || {}) },
    referral: { ...(base?.referral || {}), ...(patch?.referral || {}) },
    exposure: { ...(base?.exposure || {}), ...(patch?.exposure || {}) },
    org: { ...(base?.org || {}), ...(patch?.org || {}) },
    system: { ...(base?.system || {}), ...(patch?.system || {}) },
    species_flags: { ...(base?.species_flags || {}), ...(patch?.species_flags || {}) },
  };
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
    const force = searchParams.get('force');          // 'false' => deterministic
    const debug = searchParams.get('debug') === '1';  // include llm_error_detail / curatedSource
    const useLLM = !(force === 'false') && hasApiKey();

    const { bus } = (await req.json()) as { bus: any };
    if (!bus) {
      return new NextResponse(JSON.stringify({ ok: false, error: 'Missing bus' }), {
        status: 400,
        headers: { 'content-type': 'application/json', 'x-request-id': reqId },
      });
    }

    let usedLLM = false;
    let fallback: string | null = null;
    let result: { blocks: any[]; updatedBus?: any } = { blocks: [], updatedBus: bus };
    let llm_error_detail: any = null;

    if (useLLM) {
      usedLLM = true;
      const timeout = new Promise<never>((_, rej) => setTimeout(() => rej(new Error('llm_timeout')), 20_000));
      try {
        const runLLM = await getRunLLM();
        result = await Promise.race([runLLM(bus), timeout]);
      } catch (e: any) {
        result = await runOptionA(bus);
        fallback = e?.message === 'llm_timeout' ? 'llm_timeout' : 'llm_error';
        if (debug && fallback === 'llm_error') {
          llm_error_detail = {
            name: e?.name ?? null,
            status: e?.status ?? null,
            code: e?.code ?? null,
            message: e?.message ?? String(e),
          };
        }
      }
    } else {
      result = await runOptionA(bus);
    }

    // Normalize block titles/referral.validated
    const decision: string | undefined = result?.updatedBus?.triage?.decision;
    result.blocks = normalizeBlocks(result.blocks, decision);

    // Normalize shapes in updatedBus + referral URLs/titles
    result = normalizeResult(result, bus);

    // Curated steps injection (Markdown → steps.lines), track source for debug
    const mergedBusForContent = mergeForEnrich(bus, result.updatedBus);
    const curated = await loadCuratedSteps(mergedBusForContent);
    let curatedSource: string | null = null;
    if (curated) {
      curatedSource = curated.source;
      let steps = result.blocks.find((b) => b?.type === 'steps');
      if (!steps) {
        steps = {
          type: 'steps',
          title: decision === 'dispatch' ? 'Public Health — Do this now' : 'Do this next',
          lines: []
        };
        result.blocks.push(steps);
      }
      // Apply placeholders to curated lines
      const filled = applyCuratedPlaceholders(curated.lines, mergedBusForContent);
      steps.lines = Array.isArray(steps.lines) ? filled : filled;
      if (curated.title) steps.title = curated.title;
    }

    // Public-health contact enrichment last (appends neatly)
    result.blocks = await enrichDispatchSteps(result.blocks, mergedBusForContent);

    // Build response; expose curatedSource only when debug=1
    const payload: any = { ok: true, usedLLM, fallback, result };
    if (llm_error_detail) payload.llm_error_detail = llm_error_detail;
    if (debug) payload.curatedSource = curatedSource;

    return new NextResponse(JSON.stringify(payload), {
      status: 200,
      headers: { 'content-type': 'application/json', 'x-request-id': reqId },
    });
  } catch (err: any) {
    const error = err?.message ?? 'Server error';
    return new NextResponse(JSON.stringify({ ok: false, error }), {
      status: 500,
      headers: { 'content-type': 'application/json', 'x-request-id': reqId },
    });
  }
}
