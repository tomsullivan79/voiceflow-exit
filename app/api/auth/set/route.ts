// app/api/auth/set/route.ts
import { cookies } from "next/headers";
import { NextRequest, NextResponse } from "next/server";

type CookieOptions = {
  path?: string;
  httpOnly?: boolean;
  secure?: boolean;
  sameSite?: "lax" | "strict" | "none";
  maxAge?: number;
  expires?: string; // ISO string
};

/**
 * Helper: read a cookie by name (Next 15: cookies() is async)
 */
async function readCookie(name: string): Promise<string | null> {
  const reqCookies = await cookies();
  return reqCookies.get(name)?.value ?? null;
}

/**
 * Helper: set/clear a cookie via the response object
 */
function applyCookie(res: NextResponse, name: string, value: string | null, opts?: CookieOptions) {
  if (value === null) {
    // clear
    res.cookies.set({
      name,
      value: "",
      expires: new Date(0),
      path: opts?.path ?? "/",
    });
  } else {
    res.cookies.set({
      name,
      value,
      httpOnly: opts?.httpOnly ?? true,
      secure: opts?.secure ?? true,
      sameSite: opts?.sameSite ?? "lax",
      maxAge: opts?.maxAge,
      expires: opts?.expires ? new Date(opts.expires) : undefined,
      path: opts?.path ?? "/",
    });
  }
}

/**
 * GET /api/auth/set?name=...&value=...&maxAge=...&path=/...
 * - If value is provided → sets cookie and returns { ok:true, name, value }
 * - If value is omitted → reads cookie and returns { name, value }
 */
export async function GET(req: NextRequest) {
  const url = new URL(req.url);
  const name = url.searchParams.get("name");
  const value = url.searchParams.get("value"); // if missing → read only
  const path = url.searchParams.get("path") ?? undefined;
  const maxAgeStr = url.searchParams.get("maxAge");
  const maxAge = maxAgeStr ? Number(maxAgeStr) : undefined;

  if (!name) {
    return NextResponse.json({ ok: false, error: "Missing 'name'." }, { status: 400 });
  }

  if (value === null) {
    // read only
    const current = await readCookie(name);
    return NextResponse.json({ name, value: current });
  }

  const res = NextResponse.json({ ok: true, name, value });
  applyCookie(res, name, value, { path, maxAge });
  return res;
}

/**
 * POST /api/auth/set
 * Body: { name: string; value?: string; options?: CookieOptions }
 * - If value provided → sets cookie
 * - If value omitted → reads cookie
 */
export async function POST(req: NextRequest) {
  const body = (await req.json()) as {
    name?: string;
    value?: string;
    options?: CookieOptions;
  };

  if (!body?.name) {
    return NextResponse.json({ ok: false, error: "Missing 'name'." }, { status: 400 });
  }

  // If value missing → read instead of set
  if (typeof body.value === "undefined") {
    const current = await readCookie(body.name);
    return NextResponse.json({ name: body.name, value: current });
  }

  const res = NextResponse.json({ ok: true, name: body.name, value: body.value });
  applyCookie(res, body.name, body.value ?? null, body.options);
  return res;
}

/**
 * DELETE /api/auth/set
 * Body: { name: string; options?: { path?: string } }
 * - Clears the cookie
 */
export async function DELETE(req: NextRequest) {
  const body = (await req.json()) as { name?: string; options?: Pick<CookieOptions, "path"> };
  if (!body?.name) {
    return NextResponse.json({ ok: false, error: "Missing 'name'." }, { status: 400 });
  }
  const res = NextResponse.json({ ok: true, name: body.name, cleared: true });
  applyCookie(res, body.name, null, { path: body.options?.path });
  return res;
}
