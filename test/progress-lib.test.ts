// Task 5.12, 2 of 2 (TASK-105; D-109, D-119): the /progress page's pure parts. The tab and the medium chip are
// the URL's `?tab=` and `?medium=`, a link keeps the other, a row opens its page only where one exists, and the
// rows nest one tree from `parentKind`/`parentId` (a child doesn't always sort directly beneath its parent).
import { describe, expect, it } from "vitest";
import type { ProgressRow } from "../src/db/queries";
import {
  byMedium, finishedLabel, nestRows, parseMedium, parseProgressTab, progressHref, rowHref,
} from "../src/lib/progress";

const row = (over: Partial<ProgressRow> & Pick<ProgressRow, "kind" | "id">): ProgressRow => ({
  medium: "books", name: over.id, read: 1, total: 3, next: null, parentKind: null, parentId: null,
  lastOn: null, finishedMonth: null, ...over,
});

describe("the tab and the chip", () => {
  it("parses ?tab=: In the middle of unless Completed is asked for", () => {
    expect(parseProgressTab(undefined)).toBe("middle");
    expect(parseProgressTab("completed")).toBe("completed");
    expect(parseProgressTab(["completed", "middle"])).toBe("completed");
    expect(parseProgressTab("nonsense")).toBe("middle");
  });

  it("parses ?medium=: All unless Books or Comics is asked for", () => {
    expect(parseMedium(undefined)).toBe("all");
    expect(parseMedium("books")).toBe("books");
    expect(parseMedium("comics")).toBe("comics");
    expect(parseMedium(["comics"])).toBe("comics");
    expect(parseMedium("watch")).toBe("all");
  });

  it("a link names only what differs from the default, and keeps the other choice", () => {
    expect(progressHref("middle", "all")).toBe("/progress");
    expect(progressHref("completed", "all")).toBe("/progress?tab=completed");
    expect(progressHref("middle", "books")).toBe("/progress?medium=books");
    expect(progressHref("completed", "comics")).toBe("/progress?tab=completed&medium=comics");
  });

  it("the Books chip drops the comics rows, Comics the books rows, All none", () => {
    const rows = [row({ kind: "series", id: "s" }), row({ kind: "run", id: "r", medium: "comics" })];
    expect(byMedium(rows, "all").map((r) => r.id)).toEqual(["s", "r"]);
    expect(byMedium(rows, "books").map((r) => r.id)).toEqual(["s"]);
    expect(byMedium(rows, "comics").map((r) => r.id)).toEqual(["r"]);
  });
});

describe("nesting (D-119)", () => {
  const ids = (nodes: ReturnType<typeof nestRows>): unknown[] =>
    nodes.map((n) => (n.children.length ? [n.row.id, ids(n.children)] : n.row.id));

  it("puts a series under the universe it lists, in list order, and a row with no parent stands alone", () => {
    const tree = nestRows([
      row({ kind: "series", id: "a", parentKind: "universe", parentId: "u" }),
      row({ kind: "author", id: "au" }),
      row({ kind: "universe", id: "u" }),
      row({ kind: "series", id: "b", parentKind: "universe", parentId: "u" }),
    ]);
    // The universe sorts after its first child but keeps its own place among the roots.
    expect(ids(tree)).toEqual(["au", ["u", ["a", "b"]]]);
  });

  it("nests a subseries under its series, which nests under its universe: two deep", () => {
    const tree = nestRows([
      row({ kind: "subseries", id: "sub", parentKind: "series", parentId: "s" }),
      row({ kind: "series", id: "s", parentKind: "universe", parentId: "u" }),
      row({ kind: "universe", id: "u" }),
    ]);
    expect(ids(tree)).toEqual([["u", [["s", ["sub"]]]]]);
  });

  it("a row whose parent isn't in the list stands on its own", () => {
    const tree = nestRows([row({ kind: "series", id: "lone", parentKind: "universe", parentId: "missing" })]);
    expect(ids(tree)).toEqual(["lone"]);
  });

  it("matches the parent by kind as well as id: a universe and a series may share an id", () => {
    const tree = nestRows([
      row({ kind: "series", id: "x" }),
      row({ kind: "universe", id: "x" }),
      row({ kind: "series", id: "kid", parentKind: "universe", parentId: "x" }),
    ]);
    expect(ids(tree)).toEqual(["x", ["x", ["kid"]]]);
  });
});

describe("where a row opens", () => {
  it("series, universe, author and shelf open their pages", () => {
    expect(rowHref(row({ kind: "series", id: "s 1" }), "middle")).toBe("/books/series/s%201");
    expect(rowHref(row({ kind: "universe", id: "u" }), "completed")).toBe("/books/universes/u");
    expect(rowHref(row({ kind: "author", id: "au" }), "middle")).toBe("/books/authors/au");
    expect(rowHref(row({ kind: "shelf", id: "sh" }), "middle")).toBe("/books/shelves/sh");
  });

  it("a run opens its spine, at the resume pointer on In the middle of only", () => {
    const next = { id: "i", label: "#4", ordinal: 4 };
    expect(rowHref(row({ kind: "run", id: "r", medium: "comics", next }), "middle")).toBe("/comics/r#p-4");
    expect(rowHref(row({ kind: "run", id: "r", medium: "comics" }), "middle")).toBe("/comics/r");
    expect(rowHref(row({ kind: "run", id: "r", medium: "comics", next }), "completed")).toBe("/comics/r");
  });

  it("a subseries and a track have no page yet: not links", () => {
    expect(rowHref(row({ kind: "subseries", id: "x" }), "middle")).toBeNull();
    expect(rowHref(row({ kind: "track", id: "t", medium: "comics" }), "middle")).toBeNull();
  });
});

describe("the finish's month", () => {
  it("reads finished Mon YYYY", () => {
    expect(finishedLabel("2026-03")).toBe("finished Mar 2026");
    expect(finishedLabel("2025-12")).toBe("finished Dec 2025");
  });
  it("is nothing with no dated read", () => {
    expect(finishedLabel(null)).toBeNull();
  });
});
