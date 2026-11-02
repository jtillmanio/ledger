"use client";

import { useRouter } from "next/navigation";
import { useEffect, useRef, useState, useTransition } from "react";
import { MIN_CHARS, PAUSE_MS } from "@/lib/use-search";

/**
 * The master list's search box (task 1.22, D-84): the same 3 characters and
 * 500 ms pause as the add flows, or Enter at once. A search replaces `?q=` in
 * the URL, keeping the filters already chosen, so the server still narrows the
 * list and a reload shows it; `router.replace` adds no history entry, so one
 * Back leaves the list rather than taking letters off. Under 3 characters a
 * search there was is cleared, and the whole list shows again. *Searching…* is
 * said once a search in a polite live region. `q` is the URL's: when a chip
 * link drops it, the box follows.
 */
export default function BookListSearch({ q }: { q: string }) {
  const router = useRouter();
  const [text, setText] = useState(q);
  const [pending, startTransition] = useTransition();
  /** The query this box last put in the URL. */
  const [sent, setSent] = useState(q);
  const [seen, setSeen] = useState(q);
  const pause = useRef<ReturnType<typeof setTimeout> | null>(null);

  // The URL changed under the box (a chip, Back): take its query, unless it is the one just sent.
  if (q !== seen) {
    setSeen(q);
    if (q !== sent) {
      setSent(q);
      setText(q);
    }
  }

  useEffect(() => () => {
    if (pause.current) clearTimeout(pause.current);
  }, []);

  function cancelPause() {
    if (pause.current) clearTimeout(pause.current);
    pause.current = null;
  }

  function go(query: string) {
    cancelPause();
    if (query === sent) return;
    setSent(query);
    const params = new URLSearchParams(window.location.search);
    if (query) params.set("q", query);
    else params.delete("q");
    const search = params.toString();
    startTransition(() => router.replace(`/books/list${search ? `?${search}` : ""}`, { scroll: false }));
  }

  function change(value: string) {
    setText(value);
    cancelPause();
    const query = value.trim();
    if (query.length < MIN_CHARS) {
      // Back under the floor: a search there was is cleared at once; none, nothing is asked.
      if (sent) go("");
      return;
    }
    pause.current = setTimeout(() => go(query), PAUSE_MS);
  }

  return (
    <>
      <form action="/books/list" role="search" className="filters" style={{ width: "100%" }}
        onSubmit={(e) => { e.preventDefault(); go(text.trim()); }}>
        <input type="search" name="q" value={text} onChange={(e) => change(e.target.value)} enterKeyHint="search"
          autoComplete="off" spellCheck={false} placeholder="Search title or author" aria-label="Search books" />
      </form>
      <p role="status" aria-live="polite" className="small muted list-searching">{pending ? "Searching…" : ""}</p>
    </>
  );
}
