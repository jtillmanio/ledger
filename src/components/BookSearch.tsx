"use client";

import { useEffect, useId, useRef, useState } from "react";
import type { BookSearchAnswer } from "@/app/api/books/search/route";
import Cover, { Pending } from "@/components/Cover";
import type { LibraryHit } from "@/db/queries";
import { addTo, type Target } from "@/lib/book-add";
import { Headphones } from "@/components/nav/Icons";
import { listenGlyph, placeTag } from "@/lib/format";
import type { HardcoverBook } from "@/lib/hardcover";
import { useSearch } from "@/lib/use-search";

/** What a result's button says once its add is done, by result key. */
export type Outcome = "added" | "there";

/** A result tapped *Add to …*: a library book, or a Hardcover book. */
export type Pick = { kind: "library"; book: LibraryHit } | { kind: "hardcover"; book: HardcoverBook };

const shelfCount = (n: number) => `on ${n} ${n === 1 ? "shelf" : "shelves"}`;
const thousands = (words: number) => `${Math.round(words / 1000)}k`;
export const pickKey = (p: Pick) => (p.kind === "library" ? `lib:${p.book.id}` : `hc:${p.book.hardcoverId}`);
/** *A*, *A and B*, *A, B and C*: every author Hardcover names. */
export const authorList = (names: string[]) =>
  (names.length < 2 ? names.join("") : `${names.slice(0, -1).join(", ")} and ${names[names.length - 1]}`);

/**
 * Add books, *Search* (task 1.4c, 1.4f, 1.22; mockups `add`, `apistates`). It
 * searches as you type (`useSearch`: 3 characters and a 500 ms pause, or Enter
 * at once): your library first, then Hardcover, through
 * `POST /api/books/search`. Every result's primary button names where it goes
 * (*Add to Someday*), then the book, subtitle and all. Each row has one tag
 * saying where it came from, in text and in the row's name: a library book
 * where it sits (*Someday*, *Q1 2027*, *Unlisted · Calibre*), a Hardcover book
 * *Hardcover*. A Hardcover book's subtitle follows its title, muted. Loading,
 * rate-limited, not set up and error are each a `role="status"` line, once per
 * request; rate-limited counts Hardcover's wait down, holds the search, and
 * retries once at 0. *Add it by hand* always works, with the query carried
 * over as the title.
 * `initialQuery` pre-fills the field (an inbox note's text, task 1.4b) and
 * searches nothing until it is typed in or submitted.
 */
export default function BookSearch({ level, target, outcomes, wheres, busy, onAdd, onPlan, onByHand, initialQuery = "" }: {
  /** The section heading level: 2 under the page's h1, 3 under the sheet's h2. */
  level: 2 | 3;
  initialQuery?: string;
  target: Target;
  outcomes: Record<string, Outcome>;
  /** Where a result was added when that wasn't `target` (its own *Year or quarter…*); read only once it has an outcome. */
  wheres: Record<string, Target>;
  /** The key of the result being added. */
  busy: string | null;
  onAdd: (pick: Pick) => void;
  /** *Year or quarter…* on a result (task 2.3): the plan picker for this book, its words as the sheet will add them. */
  onPlan: (pick: Pick, words: number | null, opener: HTMLElement) => void;
  onByHand: (title: string) => void;
}) {
  const H = level === 2 ? "h2" : "h3";
  const uid = useId();
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

  const search = useSearch<BookSearchAnswer>(async (query, signal) => {
    const res = await fetch("/api/books/search", {
      method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ q: query }), signal,
    });
    if (!res.ok) throw new Error(String(res.status));
    return await res.json() as BookSearchAnswer;
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
      if (answer.status === "rate_limited") countDown(answer.retryIn ?? 60, query);
    },
  });
  const { q, state } = search;

  /** Hardcover's wait, counted down each second; at 0 the search is retried once. */
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

  useEffect(() => stopTimer, []);
  const answered = state.phase === "answered" ? state : null;
  // Enter on the query already out does nothing; on a newer one it searches at once.
  const busySearching = state.phase === "loading" && state.q === q.trim();

  function submit(e: React.FormEvent) {
    e.preventDefault();
    if (waiting || busySearching) return;
    if (!search.submit()) input.current?.focus();
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
        <button type="button" className="btn sec sm" onClick={() => search.run(state.phase === "failed" ? state.q : answered!.q)}>Try again</button>
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

  const row = (pick: Pick, i: number) => {
    const key = pickKey(pick);
    // The row is named by its title and its tag: where it came from is part of what it is.
    const id = `${uid}${pick.kind}${i}`;
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
    const label = addTo(done ? (wheres[key] ?? target) : target);
    // The words a plan total would gain: the stated count, else pages at your words per page (50 or more).
    const words = lib?.word_count ?? (pages && pages >= 50 && answer ? pages * answer.wordsPerPage : null);
    const says = done === "added" ? label.replace(/^Add/, "Added") : done === "there" ? "Already there"
      : busy === key ? "Adding…" : label;
    return (
      <li key={key} className="row res" aria-labelledby={`${id}t ${id}g`}>
        <Cover url={lib ? lib.cover_url : hc!.coverUrl} pending={lib ? lib.pending : false} />
        <div className="rb">
          <span className="rh">
            {/* One run of text: the subtitle follows the title and wraps with it. */}
            <span id={`${id}t`}><span className="rt">{book.title}</span>{subtitle && <> <span className="rsub muted">{subtitle}</span></>}</span>
            {year && <span className="rm mono">{year}</span>}
          </span>
          {sub && <div className="rs">{sub}</div>}
          {/* One tag a row, where it came from; the rest is plain text beside it. */}
          <div className="res-tags">
            <span className="tag" id={`${id}g`}>{lib ? placeTag(lib) : "Hardcover"}</span>
            {/* Beside the tag, not in it: the glyph is its own image, named (task 1.23). */}
            {lib && listenGlyph(lib.status, lib.listened) && <Headphones label={listenGlyph(lib.status, lib.listened)!} />}
            {lib && lib.shelves > 0 && <span className="small faint">{shelfCount(lib.shelves)}</span>}
            {hc?.pages && answer ? <span className="small faint">{`est ${thousands(hc.pages * answer.wordsPerPage)} words`}</span> : null}
            {lib?.pending && <Pending />}
          </div>
          <div className="btnrow res-btns">
            {/* The name starts with what the button says, then whose button it is. */}
            <button type="button" className="btn sm res-add" aria-label={`${says}: ${book.title}${subtitle ? `: ${subtitle}` : ""}`}
              aria-disabled={done || busy !== null ? true : undefined} onClick={() => { if (!done && busy === null) onAdd(pick); }}>
              {done && <span aria-hidden="true">✓ </span>}{says}
            </button>
            {/* The secondary route to a year or a quarter (task 2.3); the primary adds to the Add to chip. */}
            <button type="button" className="btn sec sm res-plan" aria-haspopup="dialog"
              aria-label={`Year or quarter…: ${book.title}${subtitle ? `: ${subtitle}` : ""}`}
              aria-disabled={done || busy !== null ? true : undefined}
              onClick={(e) => { if (!done && busy === null) onPlan(pick, words, e.currentTarget); }}>
              Year or quarter…
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
            spellCheck={false} placeholder="the blade itself" value={q} onChange={(e) => search.change(e.target.value)} />
          <button type="submit" className="btn" aria-disabled={waiting || busySearching ? true : undefined}
            aria-describedby={waiting ? "book-search-wait" : undefined}>Search</button>
        </div>
      </form>
      <p className="small muted seg-note">Matched against your library first, then Hardcover. Searches as you type.</p>
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
            {library.map((book, i) => row({ kind: "library", book }, i))}
          </ul>
        </>
      )}
      {hardcover.length > 0 && (
        <>
          <H className="s">From Hardcover<span className="more">{`${hardcover.length} new`}</span></H>
          <ul className="group results" aria-label="From Hardcover">
            {hardcover.map((book, i) => row({ kind: "hardcover", book }, i))}
          </ul>
        </>
      )}
      {answer && library.length + hardcover.length > 0 && (
        <p className="small muted fallback">Not here? {byHand} The search carries over as the title.</p>
      )}
    </>
  );
}
