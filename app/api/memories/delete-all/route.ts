// app/api/memories/delete-all/route.ts
import { NextRequest } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseServer";
import { supabaseServerAuth } from "@/lib/supabaseServerAuth";

export const runtime = "nodejs";

export async function POST(req: NextRequest) {
  try {
    const { confirm } = await req.json();
    if (confirm !== "YES") {
      return Response.json({ ok: false, error: "confirmation required" }, { status: 400 });
    }

    const sbAuth = await supabaseServerAuth();
    const { data: { user } } = await sbAuth.auth.getUser();
    if (!user) return Response.json({ ok: false, error: "unauthorized" }, { status: 401 });

    const sb = supabaseAdmin();
    const { error } = await sb.from("memory").delete().eq("user_id", user.id);
    if (error) return Response.json({ ok: false, error: error.message }, { status: 500 });

    return Response.json({ ok: true });
  } catch (e: any) {
    return Response.json({ ok: false, error: String(e?.message || e) }, { status: 500 });
  }
}
