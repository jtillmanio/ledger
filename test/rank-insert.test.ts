// Task 3.4b, 3 of 3 (TASK-077, D-101): This or that's binary insertion, pure.
// A year of n ranked reads places a new one in at most ⌈log₂(n+1)⌉ picks, and
// the place it lands is the one the answers imply: above every read it was
// picked over, below every read picked over it. With none ranked it asks
// nothing and places at 1; Skip ends the sort with no rank.
import { describe, expect, it } from "vitest";
import { answer, done, maxPicks, next, start, type Answer, type Sort } from "../src/lib/rank-insert";

/** Answers as a reader who would put the new read at `rank` (1-based) among n. */
function placeAt(n: number, rank: number) {
  let s = start(n);
  while (!done(s)) s = answer(s, rank - 1 <= next(s)! ? "new" : "old");
  return s;
}

/** Every way a sort of n can be answered to the end: each answer path, and where it ended. */
function everyPath(n: number) {
  const out: { asked: { at: number; said: Answer }[]; end: Sort }[] = [];
  const walk = (s: Sort, asked: { at: number; said: Answer }[]) => {
    if (done(s)) {
      out.push({ asked, end: s });
      return;
    }
    const at = next(s)!;
    for (const said of ["new", "old"] as const) walk(answer(s, said), [...asked, { at, said }]);
  };
  walk(start(n), []);
  return out;
}

describe("the picks a placement takes (AC-2)", () => {
  it("bounds: six ranked reads take at most 3 picks, 34 take 6, and none takes 0", () => {
    expect(maxPicks(6)).toBe(3);
    expect(maxPicks(34)).toBe(6);
    expect(maxPicks(0)).toBe(0);
  });

  it("for every n from 0 to 40 and every place, asks at most ⌈log₂(n+1)⌉ and lands where the reader would put it", () => {
    for (let n = 0; n <= 40; n++) {
      for (let rank = 1; rank <= n + 1; rank++) {
        const end = placeAt(n, rank);
        expect(end.rank, `n=${n}, rank=${rank}`).toBe(rank);
        expect(end.picks, `n=${n}, rank=${rank}`).toBeLessThanOrEqual(Math.ceil(Math.log2(n + 1)));
      }
    }
  });

  it("for every n up to 6, every answer sequence ends within the bound at the place its answers imply", () => {
    for (let n = 1; n <= 6; n++) {
      const paths = everyPath(n);
      // Every place from 1 to n + 1 is reachable, by one sequence each.
      expect(paths.map((p) => p.end.rank).sort((a, b) => a! - b!)).toEqual(Array.from({ length: n + 1 }, (_, i) => i + 1));
      for (const { asked, end } of paths) {
        expect(asked.length).toBe(end.picks);
        expect(end.picks).toBeLessThanOrEqual(maxPicks(n));
        // Picked over the read at index i: above it (rank ≤ i + 1). Picked under it: below it (rank > i + 1).
        for (const { at, said } of asked) {
          if (said === "new") expect(end.rank!).toBeLessThanOrEqual(at + 1);
          else expect(end.rank!).toBeGreaterThan(at + 1);
        }
      }
    }
  });

  it("asks only about reads in the list, each once", () => {
    for (let n = 1; n <= 12; n++) {
      for (const { asked } of everyPath(n)) {
        const ats = asked.map((a) => a.at);
        expect(ats.every((i) => i >= 0 && i < n)).toBe(true);
        expect(new Set(ats).size).toBe(ats.length);
      }
    }
  });

  it("with 0 ranked reads it asks none and places at 1", () => {
    const s = start(0);
    expect(done(s)).toBe(true);
    expect(next(s)).toBeNull();
    expect(s.rank).toBe(1);
    expect(s.picks).toBe(0);
  });
});

describe("skipping", () => {
  it("ends the sort with no rank, at any pick", () => {
    expect(answer(start(6), "skip")).toMatchObject({ rank: null, picks: 0 });
    const once = answer(start(6), "new");
    expect(done(once)).toBe(false);
    expect(answer(once, "skip")).toMatchObject({ rank: null, picks: 1 });
  });

  it("an answer after the end changes nothing", () => {
    const end = placeAt(3, 2);
    expect(answer(end, "old")).toBe(end);
    const skipped = answer(start(3), "skip");
    expect(answer(skipped, "new")).toBe(skipped);
  });

  it("refuses a negative or fractional n", () => {
    expect(() => start(-1)).toThrow();
    expect(() => start(1.5)).toThrow();
  });
});
