/**
 * *This or that* (task 3.4b, D-101; the sorter 9.4 shares): place one new item
 * into a ranked list, best first, by binary insertion. Each pick compares the
 * new item with one ranked item, so a list of n places it in at most
 * ⌈log₂(n+1)⌉ picks (34 → 6, six → 3), and an empty list asks nothing and
 * places it at 1. Pure: the sorter sheet drives it with the answers it gets,
 * a test with scripted ones.
 *
 * The search keeps `[lo, hi]`, the 0-based places still possible. A pick asks
 * about the ranked item at `mid`: the new one is better (`new`), so it goes at
 * or above it, or worse (`old`), so below it. When one place is left, that is
 * the rank (1-based). `skip` ends the sort with no rank: nothing is written.
 */
export type Sort = {
  readonly lo: number;
  readonly hi: number;
  /** Picks answered so far. */
  readonly picks: number;
  /** Where the sort ended: a rank from 1, null for Skip; undefined while it is still asking. */
  readonly rank?: number | null;
};

export type Answer = "new" | "old" | "skip";

/** At most this many picks place a new item among `n` ranked ones. */
export function maxPicks(n: number): number {
  return Math.ceil(Math.log2(n + 1));
}

/** A sort of a new item into `n` ranked items. With none ranked it is already done, at 1. */
export function start(n: number): Sort {
  if (!Number.isInteger(n) || n < 0) throw new Error("rank-insert: n is a whole number from 0");
  return n === 0 ? { lo: 0, hi: 0, picks: 0, rank: 1 } : { lo: 0, hi: n, picks: 0 };
}

/** True once the sort has ended, placed or skipped. */
export function done(s: Sort): boolean {
  return s.rank !== undefined;
}

/** The 0-based index of the ranked item the next pick compares with, or null once the sort is done. */
export function next(s: Sort): number | null {
  return done(s) ? null : Math.floor((s.lo + s.hi) / 2);
}

/** The sort after one answer. An answer to a finished sort changes nothing. */
export function answer(s: Sort, a: Answer): Sort {
  const mid = next(s);
  if (mid === null) return s;
  if (a === "skip") return { ...s, rank: null };
  const picks = s.picks + 1;
  const [lo, hi] = a === "new" ? [s.lo, mid] : [mid + 1, s.hi];
  return lo === hi ? { lo, hi, picks, rank: lo + 1 } : { lo, hi, picks };
}
