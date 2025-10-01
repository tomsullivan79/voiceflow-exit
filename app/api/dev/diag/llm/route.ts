import { NextResponse } from 'next/server';

export const runtime = 'nodejs';

export async function GET() {
  const v = process.env.OPENAI_API_KEY;
  const hasKey = !!v && v !== 'undefined';
  return NextResponse.json({
    ok: true,
    hasKey,
    keyLen: v ? v.length : 0,     // no value revealed
    runtime: process.env.VERCEL ? 'vercel' : 'local',
    region: process.env.VERCEL_REGION ?? null
  });
}
