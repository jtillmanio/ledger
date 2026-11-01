"use client";

import { useEffect, useRef, useState } from "react";
import type { BookSearchAnswer } from "@/app/api/books/search/route";
import Cover, { Pending } from "@/components/Cover";
import type { LibraryHit } from "@/db/queries";
import { addTo, type Target } from "@/lib/book-add";
import type { HardcoverBook } from "@/lib/hardcover";

type State =
  | { phase: "idle" }
  | { phase: "loading"; q: string }
  | { phase: "failed"; q: string }
  | { phase: "answered"; q: string; answer: BookSearchAnswer };

/** What a result's button says once its add is done, by result key. */
export type Outcome = "added" | "there";

/** A result tapped *Add to …*: a library book, or a Hardcover book. */
export type Pick = { kind: "library"; book: LibraryHit } | { kind: "hardcover"; book: HardcoverBook };

const STATUS: Record<string, string> = { to_read: "to read", reading: "reading", read: "read", dnf: "did not finish" };
const shelfCount = (n: number) => `on ${n} ${n === 1 ? "shelf" : "shelves"}`;
const thousands = (words: number) => `${Math.round(words / 1000)}k`;
export const pickKey = (p: Pick) => (p.kind === "library" ? `lib:${p.book.id}` : `hc:${p.book.hardcoverId}`);
/** *A*, *A and B*, *A, B and C*: every author Hardcover names. */
export const authorList = (names: string[]) =>
  (names.length < 2 ? names.join("") : `${names.slice(0, -1).join(", ")} and ${names[names.length - 1]}`);

/**
 * Add books, *Search* (task 1.4c, 1.4f; mockups `add`, `apistates`). A search
 * runs when it is submitted, never per keystroke: your library first, then
 * Hardcover, through `POST /api/books/search`. Every result's primary button
 * names where it goes (*Add to Someday*), then the book, subtitle and all; a
 * library book says where it already is. A Hardcover book's subtitle follows
 * its title, muted. Loading, rate-limited, not set up and error are each a
 * `role="status"` line; rate-limited counts Hardcover's wait down and retries
 * once at 0. *Add it by hand* always works, with the query carried over as the
 * title.
 * `initialQuery` pre-fills the field (an inbox note's text, task 1.4b) and
 * searches nothing until it is submitted.
 */
export default function BookSearch({ level, target, outcomes, busy, onAdd, onByHand, initialQuery = "" }: {
  /** The section heading level: 2 under the page's h1, 3 under the sheet's h2. */
  level: 2 | 3;
  initialQuery?: string;
  target: Target;
  outcomes: Record<string, Outcome>;
  /** The key of the result being added. */
  busy: string | null;
  onAdd: (pick: Pick) => void;
  onByHand: (title: string) => void;
}) {
  const H = level === 2 ? "h2" : "h3";
  const [q, setQ] = useState(initialQuery);
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
      const res = await fetch("/api/books/search", {
        method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ q: query }),
      });
      if (!res.ok) throw new Error(String(res.status));
      const answer = await res.json() as BookSearchAnswer;
      setState({ phase: "answered", q: query, answer });
      if (answer.status !== "rate_limited") return;
      // Hardcover's wait, counted down each second; at 0 the search is retried once.
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

  const byHand = (
    <button type="button" className="btn sec sm" onClick={() => onByHand(answered?.q ?? q.trim())}>Add it by hand</button>
  );
  const answer = answered?.answer;
  const library = answer?.library ?? [];
  const hardcover = answer?.hardcover ?? [];

  let line: React.ReactNode = null;
  let tone = "";
  if (state.phase === "loading") {
    line = <><span className="spin" aria-hidden="true" />Searching your library, then Hardcover…</>;
  } else if (answer?.status === "unconfigured") {
    tone = "err";
    line = (
      <>
        <span className="x" aria-hidden="true">×</span>
        <span>Hardcover isn&apos;t set up here, so only your library was searched. Nothing was added.</span>
        {byHand}
      </>
    );
  } else if (state.phase === "failed" || answer?.status === "error") {
    tone = "err";
    line = (
      <>
        <span className="x" aria-hidden="true">×</span>
        <span>{state.phase === "failed" ? "The search did not answer. Nothing was added." : "Hardcover did not answer. Nothing was added."}</span>
        <button type="button" className="btn sec sm" onClick={() => last.current && void search(last.current)}>Try again</button>
        {byHand}
      </>
    );
  } else if (answer?.status === "rate_limited") {
    tone = "wait";
    line = waiting ? (
      <>
        <span aria-hidden="true">⏳</span>
        <span>Hardcover is busy. Retrying in <b className="mono">{left}s</b>.</span>
        {byHand}
      </>
    ) : (
      <><span>Hardcover is busy. Search again when you&apos;re ready.</span>{byHand}</>
    );
  } else if (answer?.status === "ok" && library.length + hardcover.length === 0) {
    line = <><span>Nothing in your library or on Hardcover for <b>{answered!.q}</b>.</span>{byHand}</>;
  }

  const row = (pick: Pick) => {
    const key = pickKey(pick);
    const done = outcomes[key];
    const { book } = pick;
    const lib = pick.kind === "library" ? pick.book : null;
    const hc = pick.kind === "hardcover" ? pick.book : null;
    const year = lib ? lib.published_year : hc!.year;
    const pages = lib ? lib.page_count : hc!.pages;
    const series = lib ? lib.series : hc!.series;
    const position = lib ? lib.series_position : hc!.position;
    const sub = [lib ? lib.author : authorList(hc!.authors), series && `${series}${position != null ? ` #${position}` : ""}`,
      pages && `${pages} pages`].filter(Boolean).join(" · ");
    const subtitle = hc?.subtitle ?? null;
    const label = addTo(target);
    const says = done === "added" ? label.replace(/^Add/, "Added") : done === "there" ? "Already there"
      : busy === key ? "Adding…" : label;
    return (
      <li key={key} className="row res">
        <Cover url={lib ? lib.cover_url : hc!.coverUrl} pending={lib ? lib.pending : false} />
        <div className="rb">
          <span className="rh">
            {/* One run of text: the subtitle follows the title and wraps with it. */}
            <span><span className="rt">{book.title}</span>{subtitle && <> <span className="rsub muted">{subtitle}</span></>}</span>
            {year && <span className="rm mono">{year}</span>}
          </span>
          {sub && <div className="rs">{sub}</div>}
          {lib ? (
            <div className="res-tags">
              {lib.status && <span className="tag">{STATUS[lib.status] ?? lib.status}</span>}
              {lib.shelves > 0 && <span className="tag">{shelfCount(lib.shelves)}</span>}
              {lib.pending && <Pending />}
            </div>
          ) : (
            <div className="rs faint">
              Hardcover{hc!.pages && answer ? ` · est ${thousands(hc!.pages * answer.wordsPerPage)} words` : ""}
            </div>
          )}
          <div className="btnrow res-btns">
            {/* The name starts with what the button says, then whose button it is. */}
            <button type="button" className="btn sm res-add" aria-label={`${says}: ${book.title}${subtitle ? `: ${subtitle}` : ""}`}
              aria-disabled={done || busy !== null ? true : undefined} onClick={() => { if (!done && busy === null) onAdd(pick); }}>
              {done && <span aria-hidden="true">✓ </span>}{says}
            </button>
          </div>
        </div>
      </li>
    );
  };

  return (
    <>
      <form className="isearch" role="search" onSubmit={submit}>
        <label htmlFor="book-q" className="add-label">Title or author</label>
        <div className="isearch-row">
          <input id="book-q" ref={input} type="search" className="txt" enterKeyHint="search" autoComplete="off"
            spellCheck={false} placeholder="the blade itself" value={q} onChange={(e) => setQ(e.target.value)} />
          <button type="submit" className="btn" aria-disabled={waiting || state.phase === "loading" ? true : undefined}
            aria-describedby={waiting ? "book-search-wait" : undefined}>Search</button>
        </div>
      </form>
      <p className="small muted seg-note">Matched against your library first, then Hardcover. Searches when you press Enter.</p>
      <div role="status" aria-live="polite" id="book-search-wait">
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
      {library.length > 0 && (
        <>
          <H className="s">In your library<span className="more">{library.length}</span></H>
          <ul className="group results" aria-label="In your library">
            {library.map((book) => row({ kind: "library", book }))}
          </ul>
        </>
      )}
      {hardcover.length > 0 && (
        <>
          <H className="s">From Hardcover<span className="more">{`${hardcover.length} new`}</span></H>
          <ul className="group results" aria-label="From Hardcover">
            {hardcover.map((book) => row({ kind: "hardcover", book }))}
          </ul>
        </>
      )}
      {answer && library.length + hardcover.length > 0 && (
        <p className="small muted fallback">Not here? {byHand} The search carries over as the title.</p>
      )}
    </>
  );
}
