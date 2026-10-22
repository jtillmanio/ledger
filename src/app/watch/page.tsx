import type { Metadata } from "next";
import { DashboardVerbs, HeaderVerbs, ThumbBar } from "@/components/ThumbBar";
import { requireUserId } from "@/lib/auth";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Watch · Ledger" };

// The shell and nothing more (task 1.8): the nav is the first thing to link here.
// Watch is built in 8.x; it opens on Search alone and, when TMDB has nothing,
// falls back to Save to inbox (D-28). Nothing is in hand yet, so the thumb bar
// holds the empty state's verbs (task 1.8b): Search and Save to inbox. 8.7 puts
// Mark S2 watched and + Add there once a show can be watched.
export default async function Watch() {
  await requireUserId();
  return (
    <DashboardVerbs config={{ kind: "empty", verb: { label: "Save to inbox", href: "/inbox" } }}>
      <main>
        <header className="pagehead">
          <div className="titlerow">
            <h1>Watch</h1>
            <span className="unit">time · seasons</span>
          </div>
          <HeaderVerbs />
        </header>
        <div className="slate">
          <p><b>Nothing to watch yet.</b> A show someone mentioned, a film you meant to see: save it to the inbox and sort it out later.</p>
        </div>
      </main>
      <ThumbBar variant="dash" />
    </DashboardVerbs>
  );
}
