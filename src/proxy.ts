import { NextResponse, type NextRequest } from "next/server";

// The passcode gate (Next 16 renamed middleware to proxy; it runs on Node).
// Presence check only: the signature is verified in lib/auth, where every
// page and route handler reads the session.
export function proxy(req: NextRequest) {
  if (req.cookies.has("rt_session")) return NextResponse.next();
  const url = req.nextUrl.clone();
  url.pathname = "/login";
  url.searchParams.set("next", req.nextUrl.pathname);
  return NextResponse.redirect(url);
}

// api/health is Release's smoke test and returns no data (app/api/health).
export const config = {
  matcher: ["/((?!login|api/login|api/health|_next|favicon.ico).*)"],
};
