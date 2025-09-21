// app/api/cases/heartbeat-list/route.ts
import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseServer";

/**
 * Returns the most recent message id & timestamp across all conversations.
 * Used by /cases list as a polling heartbeat when realtime auth isn't present.
 */
export async function GET() {
  try {
    const supabase = supabaseAdmin();

    const { data, error } = await supabase
      .from("conversation_messages")
      .select("id, created_at")
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (error) {
      return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
    }

    return NextResponse.json({
      ok: true,
      latest_id: data?.id ?? null,
      latest_created_at: data?.created_at ?? null,
    });
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: e?.message || "Unknown error" }, { status: 500 });
  }
}
