"use client";

import { useEffect, useId, useImperativeHandle, useRef, useState, type Ref } from "react";
import type { SearchAnswer } from "@/app/api/metron/search/route";
import Cover, { Pending } from "@/components/Cover";
import { coverMonth, type SearchResult } from "@/lib/issue-search";
import { useSearch } from "@/lib/use-search";

/** What Add issues can ask of the search. */
export type IssueSearchHandle = {
  /** After an insert: the last search again (from the cache), so its rows read *already in this run*. */
  rerun: () => void;
};

/** `in 1 run · Thor Tales`, as the mockup has it; `in 3 runs` past one. */
const runCount = (n: number, titles: string[]) =>
  n === 1 && titles[0] ? `in 1 run · ${titles[0]}` : `in ${n} ${n === 1 ? "run" : "runs"}`;

/**
 * Add issues, the *Search* half (task 1.3b, 1.22). It searches as you type
 * (`useSearch`: 3 characters and a 500 ms pause, or Enter at once): your
 * catalog first, then Metron, through `POST /api/metron/search`, which asks
 * Metron nothing for a label that doesn't parse. Each result is tapped **Add**
 * to stage it in the shared review; the catalog's own rows say where they
 * already are (*in 2 runs*), one already in this run has no Add, and a row only
 * Metron has says *Metron*. Each row is named by its label and that tag.
 * Loading, rate-limited and error are each a `role="status"` line, once per
 * request; rate-limited counts Metron's wait down, holds the search, and
 * retries once at 0. *Type it instead* always works, with the query carried
 * over.
 * `initialQuery` pre-fills the field (an inbox note's text, task 1.4b) and
 * searches nothing until it is typed in or submitted.
 */
export default function IssueSearch({ ref, runId, staged, onToggle, onAnswer, onTypeInstead, initialQuery = "" }: {
  ref?: Ref<IssueSearchHandle>;
  runId: string;
  initialQuery?: string;
  /** Keys of the staged results. */
  staged: Set<string>;
  onToggle: (result: SearchResult) => void;
  onAnswer: (answer: SearchAnswer) => void;
  onTypeInstead: (query: string) => void;
}) {
  const [left, setLeft] = useState(0);
  const retried = useRef(false);
  /** The next search is the countdown's own retry. */
  const auto = useRef(false);
  const input = useRef<HTMLInputElement>(null);
  const timer = useRef<ReturnType<typeof setInterval> | null>(null);
  const waiting = left > 0;

  function stopTimer() {
    if (timer.current) clearInterval(timer.current);
    timer.current = null;
  }

  const search = useSearch<SearchAnswer>(async (query, signal) => {
    const res = await fetch("/api/metron/search", {
      method: "POST", headers: { "content-type": "application/json" },
      body: JSON.stringify({ q: query, runId }), signal,
    });
    if (!res.ok) throw new Error(String(res.status));
    return await res.json() as SearchAnswer;
  }, {
    initialQuery,
    hold: waiting,
    onSearch: () => {
      stopTimer();
      setLeft(0);
      retried.current = auto.current;
      auto.current = false;
    },
    onAnswer: (answer, query) => {
      onAnswer(answer);
      if (answer.status === "rate_limited") countDown(answer.retryIn ?? 60, query);
    },
  });
  const { q, state } = search;

  /** Metron's wait, counted down each second; at 0 Search works again, and the search is retried once. */
  function countDown(seconds: number, query: string) {
    const until = Date.now() + seconds * 1000;
    setLeft(seconds);
    timer.current = setInterval(() => {
      const n = Math.max(0, Math.ceil((until - Date.now()) / 1000));
      setLeft(n);
      if (n > 0) return;
      stopTimer();
      if (retried.current) return;
      auto.current = true;
      search.run(query);
    }, 1000);
  }

  useImperativeHandle(ref, () => ({
    rerun: () => {
      if (state.phase !== "idle") search.run(state.q);
    },
  }));
  useEffect(() => stopTimer, []);
  const answered = state.phase === "answered" ? state : null;
  // Enter on the query already out does nothing; on a newer one it searches at once.
  const busySearching = state.phase === "loading" && state.q === q.trim();

  function submit(e: React.FormEvent) {
    e.preventDefault();
    if (waiting || busySearching) return;
    if (!search.submit()) input.current?.focus();
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
          <button type="button" className="btn sec sm" onClick={() => search.run(state.phase === "failed" ? state.q : answered!.q)}>Try again</button>
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
            spellCheck={false} placeholder="thor 337-340" value={q} onChange={(e) => search.change(e.target.value)} />
          <button type="submit" className="btn" aria-disabled={waiting || busySearching ? true : undefined}
            aria-describedby={waiting ? "search-wait" : undefined}>Search</button>
        </div>
      </form>
      <p className="small muted seg-note">Your catalog first, then Metron. Searches as you type.</p>
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
  const uid = useId();
  return (
    <>
      {/* h2: the page's next level under its h1, beside Staged and Where they land (task 1.22, axe heading-order). */}
      <h2 className="s">{title}<span className="more">{more}</span></h2>
      <ul className="group results" aria-label={title}>
        {rows.map((r, i) => {
          const on = staged.has(r.key);
          const when = coverMonth(r.coverDate);
          // Named by its label and its first tag: where it came from (task 1.22).
          const id = `${uid}${i}`;
          return (
            <li key={r.key} className="row res" data-staged={on || undefined} aria-labelledby={`${id}t ${id}g`}>
              <Cover url={r.coverUrl} pending={r.pending === true} />
              <div className="rb">
                <span className="rh"><span className="rt" id={`${id}t`}>{r.label}</span>{when && <span className="rm mono">{when}</span>}</span>
                <div className="res-tags">
                  {r.inThisRun ? <span className="tag" id={`${id}g`}>already in this run</span>
                    : r.issueId !== null ? <span className="tag" id={`${id}g`}>{runCount(r.runs, r.runTitles)}</span>
                      : <span className="tag" id={`${id}g`}>Metron</span>}
                  {r.unparseable && <span className="tag">not in the label grammar</span>}
                  {r.idTaken && <span className="tag">id taken</span>}
                  {r.pending && <Pending />}
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
