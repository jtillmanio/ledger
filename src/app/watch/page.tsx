import type { Metadata } from "next";
import Link from "next/link";
import DashboardBar from "@/components/nav/DashboardBar";
import { requireUserId } from "@/lib/auth";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Watch · Ledger" };

// The shell and nothing more (task 1.8): the nav is the first thing to link here.
// Watch is built in 8.x; it opens on Search alone and, when TMDB has nothing,
// falls back to Save to inbox (D-28).
export default async function Watch() {
  await requireUserId();
  return (
    <>
      <main>
        <div className="titlerow">
          <h1>Watch</h1>
          <span className="unit">time · seasons</span>
        </div>
        <div className="slate">
          <p><b>Nothing to watch yet.</b> A show someone mentioned, a film you meant to see: save it to the inbox and sort it out later.</p>
          <Link href="/inbox" className="btn sec">Save to inbox</Link>
        </div>
      </main>
      <DashboardBar verb={{ label: "Save to inbox", href: "/inbox" }} />
    </>
  );
}
