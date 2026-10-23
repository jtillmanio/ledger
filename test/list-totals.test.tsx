// Task 1.8c: the list screens keep R2's honest counts after the move one level
// down (R2-05, R2-06, R2-08, S-L6). A page of rows is not the list: the line
// above it prints the query's total, never the number of rows it was handed.
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import { UndoProvider } from "../src/components/Undo";

vi.mock("next/navigation", () => ({ useRouter: () => ({ push: vi.fn(), refresh: vi.fn() }) }));
vi.mock("@/lib/auth", () => ({ requireUserId: async () => "test-user" }));

const run = (id: string, state: "unread" | "reading" | "read") => ({
  id, title: `Run ${id}`, writers: null, series_issues: null, start_year: 2000, end_year: 2001, dated_issues: 1,
  tier: null, why: null, spine: false, tracks: ["Main"], total_issues: 10, read_issues: state === "unread" ? 0 : 4,
  pct: state === "unread" ? 0 : 0.4, state, readiness: "ready_all" as const, hard_left: 0, soft_left: 0,
});
const book = (id: string, total: number) => ({
  id, title: `Book ${id}`, author: null, series: null, series_position: null, genre: null, word_count: null,
  cover_url: null, pending: false, status: "to_read", read_year: null, finished_on: null,
  finished_on_precision: "none", rating: null, plan_year: null, total,
});

vi.mock("@/db/queries", () => ({
  // Five runs in the catalog, two of them being read.
  listRuns: async () => [run("a", "reading"), run("b", "reading"), run("c", "unread"), run("d", "unread"), run("e", "read")],
  trackSummary: async () => [],
  // listBooks caps its page: two rows came back of five that match.
  listBooks: async () => [book("x", 5), book("y", 5)],
  yearSummary: async () => [],
  seriesProgress: async () => [],
  readWithoutYear: async () => 0,
  inboxCount: async () => 0,
}));

describe("list totals (AC-1)", () => {
  it("/books/list prints the query's total, not the rows it holds", async () => {
    const { default: Books } = await import("../src/app/books/list/page");
    const html = renderToStaticMarkup(createElement(UndoProvider, null, await Books({ searchParams: Promise.resolve({}) })));
    expect(html).toContain("2 of 5 shown");
    expect(html).not.toContain("2 shown");
  });

  it("/comics/runs prints the whole list as its denominator when a filter narrows it", async () => {
    const { default: Runs } = await import("../src/app/comics/runs/page");
    // The run list's rows carry + Up next (task 1.10), which pushes onto the undo stack.
    const html = renderToStaticMarkup(createElement(UndoProvider, null, await Runs({ searchParams: Promise.resolve({ state: "reading" }) })));
    expect(html).toContain("2 of 5 shown");
  });
});
