import { NextResponse, type NextRequest } from "next/server";
import { MEDIUM_COOKIE, pickMedium } from "@/lib/last-medium";

// `/` has no page: it opens the medium you last touched (R1-13), comics for a
// first visit or a value it doesn't know. src/proxy.ts has already sent a
// signed-out request to /login.
export function GET(req: NextRequest) {
  const medium = pickMedium(req.cookies.get(MEDIUM_COOKIE)?.value);
  return NextResponse.redirect(new URL(`/${medium}`, req.url), 307);
}
