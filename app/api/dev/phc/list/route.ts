import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

export const runtime = 'nodejs';

function admin() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const key = process.env.SUPABASE_SERVICE_ROLE!;
  if (!url || !key) throw new Error('Missing Supabase env');
  return createClient(url, key, { auth: { persistSession: false } });
}

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const limit = Math.min(parseInt(searchParams.get('limit') || '200', 10) || 200, 500);

    const supabase = admin();
    const { data, error } = await supabase
      .from('public_health_contacts')
      .select('id, region_type, region_value, name, phone, url, hours, notes, priority, active, created_at, updated_at')
      .order('region_type', { ascending: true })
      .order('region_value', { ascending: true })
      .order('priority', { ascending: true })
      .limit(limit);

    if (error) throw error;

    return NextResponse.json({ ok: true, count: data?.length || 0, rows: data ?? [] }, { status: 200 });
  } catch (err: any) {
    return NextResponse.json({ ok: false, error: err?.message || 'list failed' }, { status: 500 });
  }
}
