import { NextRequest, NextResponse } from 'next/server';
import OpenAI from 'openai';

export const runtime = 'nodejs';

export async function GET(req: NextRequest) {
  try {
    const apiKey = process.env.OPENAI_API_KEY;
    const model = process.env.OPENAI_MODEL || 'gpt-4o-mini'; // safe default
    const client = new OpenAI({ apiKey });

    const r = await client.chat.completions.create({
      model,
      messages: [{ role: 'user', content: 'ping' }],
      max_tokens: 5,
    });

    return NextResponse.json({
      ok: true,
      model: r.model,
      id: r.id,
      usage: r.usage,
    });
  } catch (e: any) {
    // Return sanitized diagnostics (no secrets)
    return NextResponse.json(
      {
        ok: false,
        error: e?.message || 'openai request failed',
        type: e?.name || null,
        status: e?.status ?? null,
        code: e?.code ?? null,
      },
      { status: 200 }
    );
  }
}
