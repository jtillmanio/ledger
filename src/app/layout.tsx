import type { Metadata, Viewport } from "next";
import { Inter_Tight, JetBrains_Mono } from "next/font/google";
import Link from "next/link";
import "./globals.css";

const sans = Inter_Tight({ subsets: ["latin"], variable: "--font-sans", display: "swap" });
const mono = JetBrains_Mono({ subsets: ["latin"], variable: "--font-mono", display: "swap" });

export const metadata: Metadata = { title: "Ledger" };
export const viewport: Viewport = { width: "device-width", initialScale: 1 };

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${sans.variable} ${mono.variable}`}>
      <body>
        <nav className="bar">
          <div className="bar-inner">
            <Link href="/" className="home">Ledger</Link>
            <Link href="/comics">Comics</Link>
            <Link href="/books">Books</Link>
            <Link href="/api/export">Export</Link>
          </div>
        </nav>
        {children}
      </body>
    </html>
  );
}
