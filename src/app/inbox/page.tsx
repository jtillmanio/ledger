import type { Metadata } from "next";
import Link from "next/link";
import Capture, { ResolvePick, WriteNote } from "@/components/Capture";
import { lastTouchedRun, unresolvedNotes } from "@/db/queries";
import { requireUserId } from "@/lib/auth";
import { jotted, resolveHref } from "@/lib/inbox";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Inbox · Ledger" };

/**
 * The quick-capture inbox (task 1.4b; ARCHITECTURE §4 `/inbox`; mockup
 * `capture`): the capture field, then the notes still waiting, newest first,
 * each with **Resolve** into the add flow its kind names. Side by side from
 * 1024px, so jotting a note and clearing one are the same visit. Both queries
 * go out together (task 0.9).
 */
export default async function Inbox() {
  const userId = await requireUserId();
  const [notes, lastRun] = await Promise.all([unresolvedNotes(userId), lastTouchedRun(userId)]);
  const noRun = "No run to add issues to yet";

  return (
    <main>
      <div className="inbox-2up">
        <div>
          <h1 className="t">Capture</h1>
          <p className="lede">Jot it now, sort it out later.</p>
          <Capture />
        </div>
        <div>
          <h2 className="s">Unresolved<span className="more">{notes.length}</span></h2>
          {notes.length === 0 ? (
            <div className="slate">
              <p><b>Nothing waiting.</b> A run someone mentioned, a book a video name-dropped: jot it above and sort it out later.</p>
              <WriteNote />
            </div>
          ) : (
            <ul className="group notes" aria-label="Unresolved notes">
              {notes.map((n) => {
                const note = { id: n.id, text: n.raw_text };
                const href = n.kind === null ? null : resolveHref(note, n.kind, lastRun);
                return (
                  <li key={n.id} className="row note">
                    <span className="rb">
                      <span className="rh"><span className="rt">{n.raw_text}</span></span>
                      <span className="rs">
                        <span className="bdg dn">{n.kind ?? "unsure"}</span>{" "}
                        <time dateTime={new Date(n.created_at).toISOString()}>{jotted(n.created_at)}</time>
                      </span>
                    </span>
                    {n.kind === null ? (
                      <ResolvePick id={n.id} text={n.raw_text} links={[
                        { label: "Books", href: resolveHref(note, "books", lastRun) },
                        { label: "Comics", href: resolveHref(note, "comics", lastRun) },
                        { label: "Watch", href: resolveHref(note, "watch", lastRun) },
                      ]} />
                    ) : href ? (
                      <Link prefetch={false} href={href} className="btn sec sm" aria-label={`Resolve: ${n.raw_text}`}>Resolve</Link>
                    ) : (
                      <span className="resolve">
                        <button type="button" className="btn sec sm" aria-disabled="true" aria-describedby={`why-${n.id}`}
                          aria-label={`Resolve: ${n.raw_text}`}>Resolve</button>
                        <span id={`why-${n.id}`} className="small muted">{noRun}</span>
                      </span>
                    )}
                  </li>
                );
              })}
            </ul>
          )}
          {/* Until New Run (3.2), a comics note resolves into Add issues (owner, 2026-10-09). */}
          <p className="lede inbox-foot">
            Resolving a comics note opens Add issues. A books note opens Add books, pre-filled with the text as a search.
          </p>
        </div>
      </div>
    </main>
  );
}
