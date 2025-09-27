// app/api/cases/close/route.ts
import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "../../../../lib/supabaseServer";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  try {
    const { conversation_id } = await req.json();
    if (!conversation_id) {
      return NextResponse.json({ ok: false, error: "missing_conversation_id" }, { status: 400 });
    }
    const admin = supabaseAdmin();
    const { error } = await admin
      .from("conversations")
      .update({ closed_at: new Date().toISOString() })
      .eq("id", conversation_id);
    if (error) {
      return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
    }
    return NextResponse.json({ ok: true });
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: e?.message ?? "unexpected" }, { status: 500 });
  }
}

export async function GET() {
  return NextResponse.json({ ok: false, error: "method_not_allowed" }, { status: 405 });
}
