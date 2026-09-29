import { NextResponse } from "next/server";
import { timingSafeEqual } from "crypto";
import { SESSION_COOKIE, issueToken } from "@/lib/auth";

export const runtime = "nodejs";

function matches(given: string, expected: string) {
  const a = Buffer.from(given), b = Buffer.from(expected);
  return a.length === b.length && timingSafeEqual(a, b);
}

export async function POST(req: Request) {
  const form = await req.formData();
  const passcode = String(form.get("passcode") ?? "");
  const next = String(form.get("next") ?? "/");

  if (!matches(passcode, process.env.APP_PASSCODE!)) {
    return NextResponse.redirect(new URL(`/login?error=1`, req.url), 303);
  }

  const res = NextResponse.redirect(new URL(next.startsWith("/") ? next : "/", req.url), 303);
  res.cookies.set(SESSION_COOKIE, issueToken(process.env.OWNER_ID!), {
    httpOnly: true, secure: true, sameSite: "lax", path: "/",
    maxAge: 60 * 60 * 24 * 365,
  });
  return res;
}
