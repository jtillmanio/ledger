import type { Metadata, Viewport } from "next";
import Link from "next/link";
import { preload } from "react-dom";
import "./globals.css";
import { UndoProvider } from "@/components/Undo";

// Fonts are self-hosted @font-face rules in globals.css (D-40): no request
// leaves the app. Only the two Plex Sans weights every screen draws with are
// preloaded; the rest load on first use (font-display: swap).
const PRELOAD = [
  new URL("./fonts/ibm-plex-sans-latin-400-normal.woff2", import.meta.url).href,
  new URL("./fonts/ibm-plex-sans-latin-600-normal.woff2", import.meta.url).href,
];

export const metadata: Metadata = { title: "Ledger" };
export const viewport: Viewport = { width: "device-width", initialScale: 1 };

export default function RootLayout({ children }: { children: React.ReactNode }) {
  for (const href of PRELOAD) preload(href, { as: "font", type: "font/woff2", crossOrigin: "anonymous" });
  return (
    <html lang="en">
      <body>
        <nav className="bar">
          <div className="bar-inner">
            <Link href="/" className="home">Ledger</Link>
            <Link href="/comics">Comics</Link>
            <Link href="/books">Books</Link>
            {/* A plain link: <Link> prefetches, and a prefetch of a route handler
                runs it, so every page view built the whole export (task 0.9). */}
            <a href="/api/export">Export</a>
          </div>
        </nav>
        {/* App-wide: the spine, the queue (1.10) and the add flows (1.3c, 1.4c)
            all push onto the one undo stack (task 1.2). */}
        <UndoProvider>{children}</UndoProvider>
      </body>
    </html>
  );
}
