// app/api/cases/heartbeat/route.ts
import { NextRequest, NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const conversation_id = req.nextUrl.searchParams.get("conversation_id");
  return NextResponse.json(
    {
      ok: true,
      conversation_id: conversation_id || null,
      ts: new Date().toISOString(),
    },
    { status: 200 }
  );
}
