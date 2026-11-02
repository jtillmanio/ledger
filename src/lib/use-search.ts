"use client";

import { useEffect, useRef, useState } from "react";

/** A search starts once the query is this long (D-84). */
export const MIN_CHARS = 3;
/** …and typing has paused this long (D-84). */
export const PAUSE_MS = 500;

export type SearchState<T> =
  | { phase: "idle" }
  | { phase: "loading"; q: string }
  | { phase: "failed"; q: string }
  | { phase: "answered"; q: string; answer: T };

type Options<T> = {
  /** The box's starting text (an inbox note's, task 1.4b): searched only once it is typed in or submitted. */
  initialQuery?: string;
  /** A rate-limited wait: typing changes the text and searches nothing, and Enter does nothing. */
  hold?: boolean;
  /** A request starts, by any route. */
  onSearch?: (q: string) => void;
  /** The answer to the newest query, never a late one. */
  onAnswer?: (answer: T, q: string) => void;
};

/**
 * The search every box shares (task 1.22, D-84): it searches once the query is
 * at least 3 characters and typing has paused for 500 ms, and Enter searches at
 * once, whatever its length. Under 3 characters the results clear and nothing
 * is sent. A newer query aborts the older one's request, and an answer to an
 * older query that arrives anyway is dropped. A pause on the query already
 * shown asks nothing again. `run` searches a query now: *Try again*, a
 * countdown's retry, a rerun after an insert.
 *
 * The fetcher gets the trimmed query and the request's `AbortSignal`.
 */
export function useSearch<T>(fetcher: (q: string, signal: AbortSignal) => Promise<T>, options: Options<T> = {}) {
  const { initialQuery = "", hold = false } = options;
  const [q, setQ] = useState(initialQuery);
  const [state, setState] = useState<SearchState<T>>({ phase: "idle" });
  const latest = useRef({ fetcher, options });
  const controller = useRef<AbortController | null>(null);
  const seq = useRef(0);
  const pause = useRef<ReturnType<typeof setTimeout> | null>(null);
  /** The query loading or answered: a pause on it again asks nothing. */
  const shown = useRef<string | null>(null);

  useEffect(() => {
    latest.current = { fetcher, options };
  });
  useEffect(() => () => {
    if (pause.current) clearTimeout(pause.current);
    controller.current?.abort();
  }, []);

  function cancelPause() {
    if (pause.current) clearTimeout(pause.current);
    pause.current = null;
  }

  async function run(query: string) {
    cancelPause();
    controller.current?.abort();
    const c = new AbortController();
    controller.current = c;
    const id = ++seq.current;
    shown.current = query;
    setState({ phase: "loading", q: query });
    latest.current.options.onSearch?.(query);
    try {
      const answer = await latest.current.fetcher(query, c.signal);
      if (id !== seq.current) return;
      setState({ phase: "answered", q: query, answer });
      latest.current.options.onAnswer?.(answer, query);
    } catch {
      if (id !== seq.current) return;
      shown.current = null;
      setState({ phase: "failed", q: query });
    }
  }

  function clear() {
    cancelPause();
    controller.current?.abort();
    controller.current = null;
    seq.current++;
    shown.current = null;
    setState({ phase: "idle" });
  }

  /** The box's onChange. */
  function change(text: string) {
    setQ(text);
    cancelPause();
    if (hold) return;
    const query = text.trim();
    if (query.length < MIN_CHARS) {
      if (shown.current !== null || controller.current) clear();
      return;
    }
    if (query === shown.current) return;
    pause.current = setTimeout(() => void run(query), PAUSE_MS);
  }

  /** The form's submit (Enter): false when there is nothing to search, so the box can take focus. */
  function submit(): boolean {
    const query = q.trim();
    if (!query) return false;
    if (!hold) void run(query);
    return true;
  }

  return { q, state, change, submit, run: (query: string) => void run(query) };
}
