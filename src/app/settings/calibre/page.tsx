import type { Metadata } from "next";
import Link from "next/link";
import { calibreReports, calibreRuns, createdBookAuthors, notInCalibre, waitingDecisions, type CalibreRun } from "@/db/queries";
import type { SyncReport } from "@/db/calibre-sync";
import CalibreDecide from "@/components/CalibreDecide";
import {
  BOOK_CAP, byBook, changedNothing, columnLabel, normalizeReport, ranWhen, SKIPPED_COLUMNS_LABEL, WAITING_WORDS, type BookEntry, type Change,
} from "@/lib/calibre-log";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Calibre · Ledger" };

/** Runs whose details are read and drawn: the newest few. Older runs keep their counts. */
const DETAIL_RUNS = 10;

function Lines({ changes }: { changes: Change[] }) {
  return (
    <ul className="clines">
      {changes.map((c, n) => (
        <li key={n}>
          <span className="cfield">{c.label}</span>{" "}
          {c.from === null ? <span>{c.to}</span> : <span>{c.from} <span aria-hidden="true">→</span><span className="sr-only"> to </span> {c.to}</span>}
        </li>
      ))}
    </ul>
  );
}

function Books({ entries, side, authors }: { entries: BookEntry[]; side: "came" | "went"; authors: Map<string, string | null> }) {
  const shown = entries.filter((e) => e[side].length > 0);
  if (shown.length === 0) return null;
  return (
    <>
      <ul className="cbooks">
        {shown.slice(0, BOOK_CAP).map((e) => (
          <li key={e.bookId}>
            <span className="ctitle">{e.title}</span>
            {e.created && <span className="ctag"> · new</span>}
            {e.created && authors.get(e.bookId) && <span className="cby"> · {authors.get(e.bookId)}</span>}
            <Lines changes={e[side]} />
          </li>
        ))}
      </ul>
      {shown.length > BOOK_CAP && <p className="cmore">and {shown.length - BOOK_CAP} more books</p>}
    </>
  );
}

function Section({ title, n, children }: { title: string; n?: number; children: React.ReactNode }) {
  return (
    <section className="csec">
      <h3 className="chead">{title}{n !== undefined && <span className="mono n"> {n}</span>}</h3>
      {children}
    </section>
  );
}

/** What the page can decide: a near spelling or one title under another author. A second Calibre book for one Ledger book is mended in Calibre: neither answer clears it. */
const DECIDABLE = new Set(["near spelling", "same title"]);

function RunDetails({ report: stored, authors, decisions }: {
  report: SyncReport; authors: Map<string, string | null>; decisions?: Map<number, "merge" | "separate">;
}) {
  const report = normalizeReport(stored);
  const entries = byBook(report);
  const came = entries.filter((e) => e.came.length);
  const went = entries.filter((e) => e.went.length);
  const reasons = new Map<string, number>();
  for (const s of report.skipped) reasons.set(s.reason, (reasons.get(s.reason) ?? 0) + 1);
  const unusual = report.skipped.filter((s) => s.reason !== "comic");
  return (
    <div className="cbody">
      {changedNothing(report) && <p className="cnone">Nothing changed.</p>}
      {came.length > 0 && <Section title="Came in from Calibre" n={came.length}><Books entries={entries} side="came" authors={authors} /></Section>}
      {went.length > 0 && <Section title="Went out to Calibre" n={went.length}><Books entries={entries} side="went" authors={authors} /></Section>}
      {report.waiting.length > 0 && (
        <Section title="Waiting" n={report.waiting.length}>
          <ul className="cbooks">
            {report.waiting.slice(0, BOOK_CAP).map((w) => (
              <li key={w.calibreId}>
                <span className="ctitle">{w.title}</span>{w.author && <span className="cby"> · {w.author}</span>}
                <p className="cwhy">{WAITING_WORDS[w.kind] ?? w.kind}: <span className="ctitle">{w.bookTitle}</span></p>
                {decisions && DECIDABLE.has(w.kind) && (
                  <CalibreDecide
                    calibreId={w.calibreId} title={w.title} bookId={w.bookId} bookTitle={w.bookTitle}
                    decided={decisions.get(w.calibreId) ?? null}
                  />
                )}
              </li>
            ))}
          </ul>
          <p className="cmore">
            {decisions && report.waiting.some((w) => DECIDABLE.has(w.kind))
              ? "Merge or keep separate; the next sync carries out the answer, and you can change it until then."
              : decisions
                ? "A second Calibre book for one Ledger book is mended in Calibre: remove or retitle the copy."
                : "A near spelling waited for a merge or separate decision."}
          </p>
        </Section>
      )}
      {report.gone.length > 0 && (
        <Section title="Gone from Calibre" n={report.gone.length}>
          <ul className="cbooks">
            {report.gone.slice(0, BOOK_CAP).map((g) => <li key={g.bookId}><span className="ctitle">{g.title}</span></li>)}
          </ul>
        </Section>
      )}
      {reasons.size > 0 && (
        <Section title="Skipped" n={report.skipped.length}>
          <p className="cwhy">{[...reasons].map(([reason, n]) => `${n} ${reason}`).join(" · ")}</p>
          {unusual.length > 0 && <ul className="cbooks">{unusual.slice(0, BOOK_CAP).map((s) => <li key={s.calibreId}><span className="ctitle">{s.title}</span></li>)}</ul>}
        </Section>
      )}
      {report.skippedColumns.length > 0 && (
        <Section title={SKIPPED_COLUMNS_LABEL}>
          <p className="cwhy">{report.skippedColumns.map(columnLabel).join(", ")}</p>
        </Section>
      )}
      {report.notes.length > 0 && (
        <Section title="Notes"><ul className="cbooks">{report.notes.map((n, i) => <li key={i}>{n}</li>)}</ul></Section>
      )}
    </div>
  );
}

function Summary({ run, now }: { run: CalibreRun; now: Date }) {
  return (
    <span className="cmeta">
      <span className="cwhen">{ranWhen(run.ranAt, now)}</span>
      <span className="ccounts mono">{run.in} in · {run.out} out · {run.waiting} waiting</span>
    </span>
  );
}

/**
 * The *Calibre* page (task 4.4, D-133; Settings → Calibre): every sync run newest first, each a
 * native `<details>` whose summary is its Eastern date and time and its counts in, out and waiting,
 * the newest open. A run's details list each change by book: what came in, what went out, what
 * waits (the newest run's near spelling and same-title entries carry *Merge* and *Keep separate*,
 * task 4.6; an older run's stay text), the books gone from Calibre, and what the run skipped. *Not in Calibre* lists the live
 * books with no `calibre_id`. Nothing here runs a sync: the command on the PC is the only trigger.
 */
export default async function CalibrePage() {
  const now = new Date();
  // One wave: the runs and their counts, the newest runs' reports, a created book's author as it stands
  // today (so a stray new spelling shows) and the books with no Calibre id.
  const [runs, missing, detailed, authors, decisions] = await Promise.all([
    calibreRuns(), notInCalibre(), calibreReports(DETAIL_RUNS), createdBookAuthors(DETAIL_RUNS), waitingDecisions(),
  ]);
  const reports = new Map(detailed.map((d) => [d.id, d.report]));

  return (
    <main className="settings calibre">
      <h1 className="t">Calibre</h1>
      <p className="lede"><Link href="/settings" className="clink">Settings</Link> · every sync run, newest first</p>

      <h2 className="s">Sync runs</h2>
      {runs.length === 0 ? (
        <div className="cempty" data-state="empty">
          <b>No sync yet.</b>
          <p>Run <code className="mono">npm run calibre:sync</code> on your PC. Each run is listed here.</p>
        </div>
      ) : (
        <div className="group cruns">
          {runs.map((run, n) => {
            const report = n < DETAIL_RUNS ? reports.get(run.id) : null;
            return report ? (
              <details key={run.id} className="crun" open={n === 0}>
                <summary><Summary run={run} now={now} /></summary>
                <RunDetails report={report} authors={authors} decisions={n === 0 ? decisions : undefined} />
              </details>
            ) : (
              <div key={run.id} className="crun crun-flat"><div className="csum"><Summary run={run} now={now} /></div></div>
            );
          })}
        </div>
      )}

      <h2 className="s">Not in Calibre <span className="mono n">{missing.length}</span></h2>
      <div className="group">
        <details className="crun" data-section="not-in-calibre">
          <summary>
            <span className="cmeta cmeta-one"><span className="cwhen">Books with no Calibre id</span><span className="ccounts mono">{missing.length}</span></span>
          </summary>
          {missing.length === 0 ? (
            <p className="cnone">Every book is in Calibre.</p>
          ) : (
            <ul className="cbooks cmissing">
              {missing.map((b) => (
                <li key={b.id}><span className="ctitle">{b.title}</span>{b.author && <span className="cby"> · {b.author}</span>}</li>
              ))}
            </ul>
          )}
        </details>
      </div>
    </main>
  );
}
