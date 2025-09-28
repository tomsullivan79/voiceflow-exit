// app/api/version/route.ts
import { NextResponse } from "next/server";

const BUILT_AT_ISO = new Date().toISOString(); // evaluated at build time

function formatCT(d: Date) {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Chicago",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).formatToParts(d).reduce((a, p) => ((a[p.type] = p.value), a), {} as any);
  return `${parts.year}-${parts.month}-${parts.day} ${parts.hour}:${parts.minute} CT`;
}

export async function GET() {
  const commit =
    process.env.VERCEL_GIT_COMMIT_SHA?.slice(0, 7) ||
    process.env.NEXT_PUBLIC_COMMIT?.slice(0, 7) ||
    "local-dev";
  const built_at = formatCT(new Date(BUILT_AT_ISO));
  return NextResponse.json({ commit, built_at });
}
