import { NextResponse, type NextRequest } from "next/server";

// Edge-safe gate: presence check only. Signature verification happens in
// lib/auth on the Node runtime, where crypto is available.
export function middleware(req: NextRequest) {
  if (req.cookies.has("rt_session")) return NextResponse.next();
  const url = req.nextUrl.clone();
  url.pathname = "/login";
  url.searchParams.set("next", req.nextUrl.pathname);
  return NextResponse.redirect(url);
}

export const config = {
  matcher: ["/((?!login|api/login|_next|favicon.ico).*)"],
};
