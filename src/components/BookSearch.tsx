"use client";

import { useEffect, useRef, useState } from "react";
import type { BookSearchAnswer, OpenLibraryResult } from "@/app/api/books/search/route";
import Cover, { Pending } from "@/components/Cover";
import type { LibraryHit } from "@/db/queries";
import { addTo, type Target } from "@/lib/book-add";

type State =
  | { phase: "idle" }
  | { phase: "loading"; q: string }
  | { phase: "failed"; q: string }
  | { phase: "answered"; q: string; answer: BookSearchAnswer };

/** What a result's button says once its add is done, by result key. */
export type Outcome = "added" | "there";

/** A result tapped *Add to …*: a library book, or an Open Library work. */
export type Pick = { kind: "library"; book: LibraryHit } | { kind: "openLibrary"; book: OpenLibraryResult };

const STATUS: Record<string, string> = { to_read: "to read", reading: "reading", read: "read", dnf: "did not finish" };
const shelfCount = (n: number) => `on ${n} ${n === 1 ? "shelf" : "shelves"}`;
const thousands = (words: number) => `${Math.round(words / 1000)}k`;
export const pickKey = (p: Pick) => (p.kind === "library" ? `lib:${p.book.id}` : `ol:${p.book.openLibraryId}`);

/**
 * Add books, *Search* (task 1.4c; mockups `add`, `apistates`). A search runs
 * when it is submitted, never per keystroke: your library first, then Open
 * Library, through `POST /api/books/search`. Every result's primary button
 * names where it goes (*Add to Someday*), and a library book says where it
 * already is. Loading, rate-limited and error are each a `role="status"` line;
 * rate-limited counts Open Library's wait down and retries once at 0. *Add it
 * by hand* always works, with the query carried over as the title.
 */
export default function BookSearch({ level, target, outcomes, busy, onAdd, onByHand }: {
  /** The section heading level: 2 under the page's h1, 3 under the sheet's h2. */
  level: 2 | 3;
  target: Target;
  outcomes: Record<string, Outcome>;
  /** The key of the result being added. */
  busy: string | null;
  onAdd: (pick: Pick) => void;
  onByHand: (title: string) => void;
}) {
  const H = level === 2 ? "h2" : "h3";
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
      const res = await fetch("/api/books/search", {
        method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ q: query }),
      });
      if (!res.ok) throw new Error(String(res.status));
      const answer = await res.json() as BookSearchAnswer;
      setState({ phase: "answered", q: query, answer });
      if (answer.status !== "rate_limited") return;
      // Open Library's wait, counted down each second; at 0 the search is retried once.
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
  const openLibrary = answer?.openLibrary ?? [];

  let line: React.ReactNode = null;
  let tone = "";
  if (state.phase === "loading") {
    line = <><span className="spin" aria-hidden="true" />Searching your library, then Open Library…</>;
  } else if (state.phase === "failed" || answer?.status === "error") {
    tone = "err";
    line = (
      <>
        <span className="x" aria-hidden="true">×</span>
        <span>{state.phase === "failed" ? "The search did not answer. Nothing was added." : "Open Library did not answer. Nothing was added."}</span>
        <button type="button" className="btn sec sm" onClick={() => last.current && void search(last.current)}>Try again</button>
        {byHand}
      </>
    );
  } else if (answer?.status === "rate_limited") {
    tone = "wait";
    line = waiting ? (
      <>
        <span aria-hidden="true">⏳</span>
        <span>Open Library is busy. Retrying in <b className="mono">{left}s</b>.</span>
        {byHand}
      </>
    ) : (
      <><span>Open Library is busy. Search again when you&apos;re ready.</span>{byHand}</>
    );
  } else if (answer?.status === "ok" && library.length + openLibrary.length === 0) {
    line = <><span>Nothing in your library or on Open Library for <b>{answered!.q}</b>.</span>{byHand}</>;
  }

  const row = (pick: Pick) => {
    const key = pickKey(pick);
    const done = outcomes[key];
    const { book } = pick;
    const lib = pick.kind === "library" ? pick.book : null;
    const ol = pick.kind === "openLibrary" ? pick.book : null;
    const year = lib ? lib.published_year : ol!.year;
    const pages = lib ? lib.page_count : ol!.pages;
    const sub = [book.author, lib?.series && `${lib.series}${lib.series_position != null ? ` #${lib.series_position}` : ""}`,
      pages && `${pages} pages`].filter(Boolean).join(" · ");
    const label = addTo(target);
    const says = done === "added" ? label.replace(/^Add/, "Added") : done === "there" ? "Already there"
      : busy === key ? "Adding…" : label;
    return (
      <li key={key} className="row res">
        <Cover url={lib ? lib.cover_url : ol!.coverUrl} pending={lib ? lib.pending : false} />
        <div className="rb">
          <span className="rh"><span className="rt">{book.title}</span>{year && <span className="rm mono">{year}</span>}</span>
          {sub && <div className="rs">{sub}</div>}
          {lib ? (
            <div className="res-tags">
              {lib.status && <span className="tag">{STATUS[lib.status] ?? lib.status}</span>}
              {lib.shelves > 0 && <span className="tag">{shelfCount(lib.shelves)}</span>}
              {lib.pending && <Pending />}
            </div>
          ) : (
            <div className="rs faint">
              Open Library{ol!.pages && answer ? ` · est ${thousands(ol!.pages * answer.wordsPerPage)} words` : ""}
            </div>
          )}
          <div className="btnrow res-btns">
            {/* The name starts with what the button says, then whose button it is. */}
            <button type="button" className="btn sm res-add" aria-label={`${says}: ${book.title}`}
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
      <p className="small muted seg-note">Your library first, then Open Library. Searches when you press Enter.</p>
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
      {openLibrary.length > 0 && (
        <>
          <H className="s">From Open Library<span className="more">{`${openLibrary.length} new`}</span></H>
          <ul className="group results" aria-label="From Open Library">
            {openLibrary.map((book) => row({ kind: "openLibrary", book }))}
          </ul>
        </>
      )}
      {answer && library.length + openLibrary.length > 0 && (
        <p className="small muted fallback">Not here? {byHand} The search carries over as the title.</p>
      )}
    </>
  );
}
