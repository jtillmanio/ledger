"use client";

import { useEffect,useImperativeHandle, useRef, useState, type Ref } from "react";
import type { SearchAnswer } from "@/app/api/metron/search/route";
import { coverMonth, type SearchResult } from "@/lib/issue-search";

type State =
  | { phase: "idle" }
  | { phase: "loading"; q: string }
  | { phase: "failed"; q: string }
  | { phase: "answered"; q: string; answer: SearchAnswer };

/** What Add issues can ask of the search. */
export type IssueSearchHandle = {
  /** After an insert: the last search again (from the cache), so its rows read *already in this run*. */
  rerun: () => void;
};

/** `in 1 run · Thor Tales`, as the mockup has it; `in 3 runs` past one. */
const runCount = (n: number, titles: string[]) =>
  n === 1 && titles[0] ? `in 1 run · ${titles[0]}` : `in ${n} ${n === 1 ? "run" : "runs"}`;

/**
 * Add issues, the *Search* half (task 1.3b). A search runs when it is
 * submitted, never per keystroke: your catalog first, then Metron, through
 * `POST /api/metron/search`. Each result is tapped **Add** to stage it in the
 * shared review; the catalog's own rows say where they already are, and one
 * already in this run has no Add. Loading, rate-limited and error are each a
 * `role="status"` line; rate-limited counts Metron's wait down and retries once
 * at 0. *Type it instead* always works, with the query carried over.
 */
export default function IssueSearch({ ref, runId, staged, onToggle, onAnswer, onTypeInstead }: {
  ref?: Ref<IssueSearchHandle>;
  runId: string;
  /** Keys of the staged results. */
  staged: Set<string>;
  onToggle: (result: SearchResult) => void;
  onAnswer: (answer: SearchAnswer) => void;
  onTypeInstead: (query: string) => void;
}) {
  const [q, setQ] = useState("");
  const [state, setState] = useState<State>({ phase: "idle" });
  const [left, setLeft] = useState(0);
  const retried = useRef(false);
  const last = useRef<string | null>(null);
  const input = useRef<HTMLInputElement>(null);

  const timer = useRef<ReturnType<typeof setInterval> | null>(null);

  function stopTimer() {
    if (timer.current) clearInterval(timer.current);
    timer.current = null;
  }

  async function search(query: string, retry = false) {
    stopTimer();
    retried.current = retry;
    setLeft(0);
    last.current = query;
    setState({ phase: "loading", q: query });
    try {
      const res = await fetch("/api/metron/search", {
        method: "POST", headers: { "content-type": "application/json" },
        body: JSON.stringify({ q: query, runId }),
      });
      if (!res.ok) throw new Error(String(res.status));
      const answer = await res.json() as SearchAnswer;
      setState({ phase: "answered", q: query, answer });
      onAnswer(answer);
      if (answer.status !== "rate_limited") return;
      // Metron's wait, counted down each second; at 0 Search works again, and the search is retried once.
      const until = Date.now() + (answer.retryIn ?? 60) * 1000;
      setLeft(answer.retryIn ?? 60);
      timer.current = setInterval(() => {
        const n = Math.max(0, Math.ceil((until - Date.now()) / 1000));
        setLeft(n);
        if (n > 0) return;
        stopTimer();
        if (!retried.current) void search(query, true);
      }, 1000);
    } catch {
      setState({ phase: "failed", q: query });
    }
  }

  useImperativeHandle(ref, () => ({
    rerun: () => {
      if (last.current) void search(last.current);
    },
  }));
  useEffect(() => stopTimer, []);
  const waiting = left > 0;
  const answered = state.phase === "answered" ? state : null;

  function submit(e: React.FormEvent) {
    e.preventDefault();
    if (waiting || state.phase === "loading") return;
    const query = q.trim();
    if (!query) {
      input.current?.focus();
      return;
    }
    void search(query);
  }

  const typeInstead = (
    <button type="button" className="btn sec sm" onClick={() => onTypeInstead(answered?.q ?? q)}>Type it instead</button>
  );
  const answer = answered?.answer;
  const catalog = answer?.catalog ?? [];
  const metron = answer?.metron ?? [];

  let line: React.ReactNode = null;
  let tone = "";
  if (state.phase === "loading") {
    line = <><span className="spin" aria-hidden="true" />Searching your catalog, then Metron…</>;
  } else if (state.phase === "failed" || answer?.status === "error") {
    tone = "err";
    line = (
      <>
        <span className="x" aria-hidden="true">×</span>
        <span>{answer?.unconfigured
          ? "Metron isn't set up here, so only your catalog was searched. Nothing was added."
          : "Metron did not answer. Nothing was added."}</span>
        {!answer?.unconfigured && (
          <button type="button" className="btn sec sm" onClick={() => last.current && void search(last.current)}>Try again</button>
        )}
        {typeInstead}
      </>
    );
  } else if (answer?.status === "rate_limited") {
    tone = "wait";
    line = waiting ? (
      <>
        <span aria-hidden="true">⏳</span>
        <span>Metron is busy. Retrying in <b className="mono">{left}s</b>.</span>
        {typeInstead}
      </>
    ) : (
      <><span>Metron is busy. Search again when you&apos;re ready.</span>{typeInstead}</>
    );
  } else if (answer?.status === "too_many") {
    line = <><span>Up to 10 issues a search. <i>Type it</i> takes any range.</span>{typeInstead}</>;
  } else if (answer?.status === "empty") {
    line = <span>Type a series, then a number or a range: <span className="mono">thor 337-340</span>.</span>;
  } else if (answer?.status === "ok" && catalog.length + metron.length === 0) {
    line = <><span>Nothing in your catalog or on Metron for <b>{answered!.q}</b>.</span>{typeInstead}</>;
  }

  return (
    <>
      <form className="isearch" role="search" onSubmit={submit}>
        <label htmlFor="issue-q" className="add-label">Series and number</label>
        <div className="isearch-row">
          <input id="issue-q" ref={input} type="search" className="txt" enterKeyHint="search" autoComplete="off"
            spellCheck={false} placeholder="thor 337-340" value={q} onChange={(e) => setQ(e.target.value)} />
          <button type="submit" className="btn" aria-disabled={waiting || state.phase === "loading" ? true : undefined}
            aria-describedby={waiting ? "search-wait" : undefined}>Search</button>
        </div>
      </form>
      <p className="small muted seg-note">Your catalog first, then Metron. Searches when you press Enter.</p>
      <div role="status" aria-live="polite" id="search-wait">
        {line && <div className={`statusline${tone ? ` ${tone}` : ""}`}>{line}</div>}
      </div>

      {state.phase === "loading" && (
        <div className="group results" aria-hidden="true">
          {[0, 1].map((i) => (
            <div key={i} className="row res">
              <span className="cv sk" /><div className="rb"><span className="sk l1" /><span className="sk l2" /></div>
            </div>
          ))}
        </div>
      )}
      {catalog.length > 0 && (
        <Results title="In your catalog" more={String(catalog.length)} rows={catalog} staged={staged} onToggle={onToggle} />
      )}
      {metron.length > 0 && (
        <Results title="From Metron" more={`${metron.length} new`} rows={metron} staged={staged} onToggle={onToggle} />
      )}
      {answer && catalog.length + metron.length > 0 && (
        <p className="small muted fallback">Not what you meant? {typeInstead} The query carries over.</p>
      )}
    </>
  );
}

function Results({ title, more, rows, staged, onToggle }: {
  title: string; more: string; rows: SearchResult[]; staged: Set<string>; onToggle: (r: SearchResult) => void;
}) {
  return (
    <>
      <h3 className="s">{title}<span className="more">{more}</span></h3>
      <ul className="group results" aria-label={title}>
        {rows.map((r) => {
          const on = staged.has(r.key);
          const when = coverMonth(r.coverDate);
          return (
            <li key={r.key} className="row res" data-staged={on || undefined}>
              {r.coverUrl
                // A Metron CDN thumbnail, drawn as it comes: decorative beside the label.
                // eslint-disable-next-line @next/next/no-img-element
                ? <img className="cv" src={r.coverUrl} alt="" width={40} height={60} loading="lazy" decoding="async" />
                : <span className="cv none" aria-hidden="true" />}
              <div className="rb">
                <span className="rh"><span className="rt">{r.label}</span>{when && <span className="rm mono">{when}</span>}</span>
                <div className="res-tags">
                  {r.inThisRun ? <span className="tag">already in this run</span>
                    : r.issueId !== null ? <span className="tag">{runCount(r.runs, r.runTitles)}</span> : null}
                  {r.unparseable && <span className="tag">not in the label grammar</span>}
                  {r.idTaken && <span className="tag">id taken</span>}
                </div>
              </div>
              {!r.inThisRun && (
                <button type="button" className="btn sm res-add" aria-pressed={on} aria-label={`Add ${r.label}`}
                  onClick={() => onToggle(r)}>
                  {on ? "✓ Added" : "Add"}
                </button>
              )}
            </li>
          );
        })}
      </ul>
    </>
  );
}
