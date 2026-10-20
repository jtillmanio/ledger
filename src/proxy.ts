import { NextResponse, type NextRequest } from "next/server";
import { MEDIUM_COOKIE, MEDIUM_MAX_AGE, mediumOf } from "@/lib/last-medium";

// The passcode gate (Next 16 renamed middleware to proxy; it runs on Node).
// Presence check only: the signature is verified in lib/auth, where every
// page and route handler reads the session.
export function proxy(req: NextRequest) {
  if (req.cookies.has("rt_session")) {
    const res = NextResponse.next();
    // The last-touched medium (R1-13). Written here because a server
    // component can't set a cookie; `/` reads it (src/app/route.ts).
    const medium = mediumOf(req.nextUrl.pathname);
    if (medium) {
      res.cookies.set(MEDIUM_COOKIE, medium, {
        httpOnly: true, sameSite: "lax", path: "/", maxAge: MEDIUM_MAX_AGE,
      });
    }
    return res;
  }
  const url = req.nextUrl.clone();
  url.pathname = "/login";
  url.searchParams.set("next", req.nextUrl.pathname);
  return NextResponse.redirect(url);
}

// api/health is Release's smoke test and returns no data (app/api/health).
//
// A <Link> prefetch is not a visit, and Next hides its headers from proxy(), so
// the matcher is the only place to tell them apart. Without this, the nav's
// prefetch of /books from /comics would write ledger_medium=books for someone
// who never went there. The pages still verify the session (lib/auth), so a
// prefetch skips only the presence check, never the signature check.
export const config = {
  matcher: [
    {
      source: "/((?!login|api/login|api/health|_next|favicon.ico).*)",
      missing: [
        { type: "header", key: "next-router-prefetch" },
        { type: "header", key: "next-router-segment-prefetch" },
      ],
    },
  ],
};
