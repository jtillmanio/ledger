"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

// The app header. Not on /login: a signed-out visitor can open none of these,
// and each <Link> prefetches its route, which the passcode gate answers with a
// redirect back to /login, so the sign-in page fetched four pages it could not
// show (and went over its Lighthouse budget).
export default function AppNav() {
  if (usePathname() === "/login") return null;
  return (
    <nav className="bar">
      <div className="bar-inner">
        <Link href="/" className="home">Ledger</Link>
        <Link href="/comics">Comics</Link>
        {/* Straight to the list: /books redirects there until 2.2, and a prefetch of a redirect is a wasted hop (task 1.8c). */}
        <Link href="/books/list">Books</Link>
        {/* Capture from anywhere (task 1.4b) until 1.8's shell puts Inbox (N) in its sidebar. */}
        <Link href="/inbox">Inbox</Link>
        {/* A plain link: <Link> prefetches, and a prefetch of a route handler
            runs it, so every page view built the whole export (task 0.9). */}
        <a href="/api/export">Export</a>
      </div>
    </nav>
  );
}
