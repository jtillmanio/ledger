// Task 5.12, 2 of 2 (TASK-105; D-29, D-26): what a /progress row draws. Every kind but a track has a meter filled
// with --ready beside its `read / total`; a track is never drawn as one bar against the whole track (D-29), so its
// row keeps the count as text and has no meter. A row with no page (a subseries, a track) is text, not a link.
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import ProgressRows from "../src/components/ProgressRows";
import type { ProgressRow } from "../src/db/queries";

const row = (over: Partial<ProgressRow> & Pick<ProgressRow, "kind" | "id">): ProgressRow => ({
  medium: "books", name: over.id, read: 1, total: 4, next: null, parentKind: null, parentId: null,
  lastOn: null, finishedMonth: null, ...over,
});

const html = (rows: ProgressRow[], tab: "middle" | "completed" = "middle") =>
  renderToStaticMarkup(<ProgressRows rows={rows} tab={tab} label="Rows" />);
/** One row's own markup, by the kind it carries. */
const item = (markup: string, kind: string) =>
  new RegExp(`<li class="prog-li" data-kind="${kind}"[^>]*>(.*?)</div></li>`).exec(markup)![1];

describe("a row's meter (D-26, D-29)", () => {
  it("every kind but a track has a meter filled to its share, and its count as text", () => {
    const kinds = ["series", "subseries", "universe", "author", "shelf"] as const;
    const out = html([
      ...kinds.map((kind) => row({ kind, id: kind })),
      row({ kind: "run", id: "run", medium: "comics" }),
    ]);
    for (const kind of [...kinds, "run"]) {
      const one = item(out, kind);
      expect(one, kind).toContain('class="emeter"');
      expect(one, kind).toContain("width:25%");
      expect(one, kind).toContain("1 / 4");
    }
  });

  it("a track keeps read / total as text and draws no meter at all", () => {
    const out = html([row({ kind: "track", id: "krakoa", medium: "comics", read: 212, total: 641 })]);
    const one = item(out, "track");
    expect(one).toContain("212 / 641");
    expect(one).not.toContain("emeter");
    expect(one).not.toContain("width:");
  });

  it("a track nested among other rows leaves theirs drawn", () => {
    const out = html([row({ kind: "track", id: "t", medium: "comics" }), row({ kind: "series", id: "s" })]);
    expect(item(out, "series")).toContain("emeter");
    expect(item(out, "track")).not.toContain("emeter");
  });
});

describe("where a row opens", () => {
  it("a subseries and a track are text, a series is a link", () => {
    const out = html([
      row({ kind: "subseries", id: "sub" }), row({ kind: "track", id: "t", medium: "comics" }), row({ kind: "series", id: "s" }),
    ]);
    expect(item(out, "subseries")).not.toContain("<a ");
    expect(item(out, "track")).not.toContain("<a ");
    expect(item(out, "series")).toContain('href="/books/series/s"');
  });
});
