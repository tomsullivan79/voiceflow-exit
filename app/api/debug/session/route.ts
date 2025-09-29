// app/api/debug/session/route.ts
import { cookies } from "next/headers";
import { NextRequest, NextResponse } from "next/server";

/**
 * GET /api/debug/session?name=<cookieName>
 * - If name is provided: returns { name, value } or { name, value: null } if missing
 * - If name is absent: returns { all: Array<{ name, value }> } for a quick snapshot
 */
export async function GET(req: NextRequest) {
  const cookieStore = await cookies(); // Next 15: async
  const url = new URL(req.url);
  const name = url.searchParams.get("name");

  if (name) {
    const value = cookieStore.get(name)?.value ?? null;
    return NextResponse.json({ name, value });
  }

  const all = cookieStore.getAll().map((c) => ({ name: c.name, value: c.value }));
  return NextResponse.json({ all });
}

/**
 * POST /api/debug/session
 * Body: { name: string; value: string; options?: { path?: string; httpOnly?: boolean; secure?: boolean; sameSite?: 'lax'|'strict'|'none'; maxAge?: number; expires?: string } }
 *
 * Note: In Next 15, set cookies via the response object.
 */
export async function POST(req: NextRequest) {
  const { name, value, options } = (await req.json()) as {
    name?: string;
    value?: string;
    options?: {
      path?: string;
      httpOnly?: boolean;
      secure?: boolean;
      sameSite?: "lax" | "strict" | "none";
      maxAge?: number;
      expires?: string;
    };
  };

  if (!name) {
    return NextResponse.json({ ok: false, error: "Missing 'name'." }, { status: 400 });
  }

  const res = NextResponse.json({ ok: true, name, value: value ?? "" });
  if (value === undefined || value === null) {
    // If value is undefined/null, clear cookie
    res.cookies.set({
      name,
      value: "",
      expires: new Date(0),
      path: options?.path ?? "/",
    });
  } else {
    res.cookies.set({
      name,
      value,
      httpOnly: options?.httpOnly ?? true,
      secure: options?.secure ?? true,
      sameSite: options?.sameSite ?? "lax",
      maxAge: options?.maxAge,
      expires: options?.expires ? new Date(options.expires) : undefined,
      path: options?.path ?? "/",
    });
  }
  return res;
}

/**
 * DELETE /api/debug/session
 * Body: { name: string; options?: { path?: string } }
 */
export async function DELETE(req: NextRequest) {
  const { name, options } = (await req.json()) as { name?: string; options?: { path?: string } };
  if (!name) {
    return NextResponse.json({ ok: false, error: "Missing 'name'." }, { status: 400 });
  }
  const res = NextResponse.json({ ok: true, name, cleared: true });
  res.cookies.set({
    name,
    value: "",
    expires: new Date(0),
    path: options?.path ?? "/",
  });
  return res;
}
