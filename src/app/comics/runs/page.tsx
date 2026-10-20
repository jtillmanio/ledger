import Link from "next/link";
import { requireUserId } from "@/lib/auth";
import { listRuns, trackSummary } from "@/db/queries";
import { yearSpan } from "@/lib/format";

export const dynamic = "force-dynamic";

type Search = { track?: string; readiness?: string; state?: string };

export default async function Comics({
  searchParams,
}: { searchParams: Promise<Search> }) {
  const { track, readiness, state } = await searchParams;
  const userId = await requireUserId();
  const [tracks, all] = await Promise.all([trackSummary(userId), listRuns(userId, track)]);

  const runs = all.filter(
    (r) => (!readiness || r.readiness === readiness) && (!state || r.state === state),
  );

  return (
    <main>
      <h1>Runs</h1>
      <p className="muted small mono">{runs.length} of {all.length} shown</p>

      {/* A query-string chip is not prefetched: Next 16.4 fetches each one on
          load, about 40 requests here, and a tap re-renders this same route. */}
      <div className="filters">
        <Link href="/comics/runs" className="chip" aria-current={!track && !readiness && !state}>
          Everything
        </Link>
        <Link prefetch={false} href="/comics/runs?readiness=ready_all&state=unread" className="chip"
              aria-current={readiness === "ready_all"}>
          Unlocked
        </Link>
        <Link prefetch={false} href="/comics/runs?state=reading" className="chip" aria-current={state === "reading"}>
          In progress
        </Link>
        <Link prefetch={false} href="/comics/runs?state=read" className="chip" aria-current={state === "read"}>
          Finished
        </Link>
      </div>

      <div className="filters">
        {tracks.map((t) => (
          <Link key={t.track_id} prefetch={false} href={`/comics/runs?track=${t.track_id}`} className="chip"
                aria-current={track === t.track_id}>
            {t.track_name} <span className="mono">{t.runs_read}/{t.total_runs}</span>
          </Link>
        ))}
      </div>

      <div className="rows">
        {runs.length === 0 && <div className="empty">No runs match that filter.</div>}
        {runs.map((r) => (
          <Link key={r.id} href={`/comics/${r.id}`}
                className={`row state-${r.readiness === "blocked" ? "blocked" : "open"}`}>
            <span className="row-head">
              <span className="row-title">{r.title}</span>
              <span className="row-meta mono">
                {r.read_issues > 0 ? `${r.read_issues}/${r.total_issues}` : `${r.total_issues} iss`}
              </span>
            </span>
            <span className="row-sub">
              {[r.writers, r.tracks.join(", "), yearSpan(r.start_year, r.end_year)]
                .filter(Boolean).join(" · ")}
            </span>
            {r.readiness === "blocked" && (
              <span className="row-sub tag-held">
                {r.hard_left} required {r.hard_left === 1 ? "run" : "runs"} still unread
              </span>
            )}
            {r.read_issues > 0 && r.pct < 1 && (
              <span className="measure"><span style={{ width: `${Math.round(r.pct * 100)}%` }} /></span>
            )}
          </Link>
        ))}
      </div>
    </main>
  );
}
