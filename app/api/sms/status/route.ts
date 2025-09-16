import { NextRequest } from "next/server";
export const runtime = "nodejs";

export async function POST(req: NextRequest) {
  // Twilio posts x-www-form-urlencoded here; we can ignore or log it later
  try { await req.text(); } catch {}
  return new Response("", { status: 200 });
}

// (handy to test quickly in the browser)
export async function GET() {
  return new Response("ok", { status: 200 });
}
