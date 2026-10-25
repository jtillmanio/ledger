import { NextResponse } from "next/server";
import { timingSafeEqual } from "crypto";
import { SESSION_COOKIE, issueToken } from "@/lib/auth";

export const runtime = "nodejs";

function matches(given: string, expected: string) {
  const a = Buffer.from(given), b = Buffer.from(expected);
  return a.length === b.length && timingSafeEqual(a, b);
}

// Every refusal waits the same second, so guessing is slow (D-36). The wait is
// in the handler and keeps nothing between requests: a serverless instance
// forgets a counter and another instance never sees it.
const FAILED_SIGN_IN_DELAY_MS = 1000;

async function refuse(req: Request) {
  await new Promise((resolve) => setTimeout(resolve, FAILED_SIGN_IN_DELAY_MS));
  return NextResponse.redirect(new URL(`/login?error=1`, req.url), 303);
}

export async function POST(req: Request) {
  let form: FormData;
  try {
    form = await req.formData();
  } catch {
    return refuse(req);
  }
  const passcode = String(form.get("passcode") ?? "");
  const next = String(form.get("next") ?? "/");

  if (!matches(passcode, process.env.APP_PASSCODE!)) return refuse(req);

  const res = NextResponse.redirect(new URL(next.startsWith("/") ? next : "/", req.url), 303);
  res.cookies.set(SESSION_COOKIE, issueToken(process.env.OWNER_ID!), {
    httpOnly: true, secure: true, sameSite: "lax", path: "/",
    maxAge: 60 * 60 * 24 * 365,
  });
  return res;
}
