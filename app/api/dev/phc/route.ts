import { NextRequest, NextResponse } from 'next/server';
import { publicHealthLookup } from '@/lib/tools/publicHealthLookup';

export const runtime = 'nodejs';

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const zip = searchParams.get('zip') ?? undefined;
    const county = searchParams.get('county') ?? undefined;

    const result = await publicHealthLookup({ zip, county });

    return NextResponse.json(
      {
        ok: true,
        via: result.via,
        best: result.best,
      },
      { status: 200 }
    );
  } catch (err: any) {
    return NextResponse.json(
      { ok: false, error: err?.message ?? 'lookup failed' },
      { status: 500 }
    );
  }
}
