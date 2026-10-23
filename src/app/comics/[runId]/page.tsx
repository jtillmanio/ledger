import Link from "next/link";
import { notFound } from "next/navigation";
import { requireUserId } from "@/lib/auth";
import { runDetail } from "@/db/queries";
import RunSpine from "@/components/IssueRow";
import QueueButton from "@/components/QueueButton";
import { yearSpan } from "@/lib/format";

export const dynamic = "force-dynamic";

export default async function Run({ params }: { params: Promise<{ runId: string }> }) {
  const { runId } = await params;
  const userId = await requireUserId();
  const data = await runDetail(userId, decodeURIComponent(runId));
  if (!data) notFound();

  const { run, issues, prereqs } = data;
  const unread = prereqs.filter((p) => p.pct < 1);

  return (
    <main>
      <p className="small"><Link href="/comics/runs">All runs</Link></p>
      <h1>{run.title}</h1>
      <p className="muted small">
        {[run.writers, run.artists, run.tracks.join(", "), yearSpan(run.start_year, run.end_year)]
          .filter(Boolean).join(" · ")}
      </p>
      {run.series_issues && <p className="small mono muted">{run.series_issues}</p>}
      {run.dated_issues > 0 && run.dated_issues < run.total_issues && (
        <p className="small muted">
          Years from the {run.dated_issues} of {run.total_issues} issues with a cover date.
        </p>
      )}
      {Number(run.credited_issues) > 0 && Number(run.credited_issues) < Number(run.distinct_issues) && (
        <p className="small muted">
          Credits from the {run.credited_issues} of {run.distinct_issues} issues credited on Metron.
        </p>
      )}
      {run.why && <p>{run.why}</p>}
      {/* *+ Up next* appends, *Read next* goes to the top (task 1.10). A placeholder can't be queued. */}
      {!run.placeholder && (
        <p className="queue-line">
          <QueueButton runId={run.id} title={run.title} ordinal={run.queued_ordinal} top />
        </p>
      )}

      {/* The read count is drawn by RunSpine, beside the rows it counts, so a
          mark and its undo move it (task 1.2). */}
      <RunSpine runId={run.id} title={run.title} issues={issues} ranges={run.series_issues}
        blocked={run.readiness === "blocked"} lastRead={run.last_read_when}>
        {unread.length > 0 && (
          <>
            <h2>Read these first</h2>
            <p className="muted small">
              Including everything reachable through the prerequisite chain, not just
              direct links.
            </p>
            <div className="rows">
              {unread.map((p) => (
                <Link key={p.id} href={`/comics/${p.id}`} className="row">
                  <span className="row-head">
                    <span className="row-title">{p.title}</span>
                    <span className={`row-meta mono ${p.type === "hard" ? "tag-held" : ""}`}>
                      {p.type} · depth {p.depth}
                    </span>
                  </span>
                </Link>
              ))}
            </div>
          </>
        )}

        <h2>Issues</h2>
      </RunSpine>
    </main>
  );
}
