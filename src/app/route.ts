import { NextResponse, type NextRequest } from "next/server";
import { MEDIUM_COOKIE, START_COOKIE, startMedium } from "@/lib/last-medium";

// `/` has no page: it opens the medium *Start on* names (task 6.25, D-178), else the one you last touched
// (R1-13), comics for a first visit or a value it doesn't know. src/proxy.ts has already sent a signed-out
// request to /login.
export function GET(req: NextRequest) {
  const medium = startMedium(req.cookies.get(START_COOKIE)?.value, req.cookies.get(MEDIUM_COOKIE)?.value);
  return NextResponse.redirect(new URL(`/${medium}`, req.url), 307);
}
