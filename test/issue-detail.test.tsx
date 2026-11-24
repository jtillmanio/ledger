// @vitest-environment happy-dom
// Task 3.5, 3 of 3 (TASK-080): what the issue sheet and the issue page draw,
// from an `issueDetail` row. Credits are selective: Writer and Penciller, Inker
// only when there is one, Cover only when it isn't the penciller, Colorist and
// Letterer only inside *More credits*, a real `aria-expanded` button (AC-3,
// AC-6). *Dates*: *Cover date* in `Mon YYYY`, *Published* only when a store
// date exists and differs, and an undated issue draws no group and no `—`
// (AC-4). *Your record*: one row per run, a green ✓ with the date or a grey ○,
// each a toggle named with its run and position, *this run* marked (AC-2,
// AC-6). The query is test/issue-detail-query.test.ts; the sheet in a browser
// is test/e2e/issue-detail.spec.ts.
import { readFileSync } from "node:fs";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import type { IssueDetail as Issue, IssuePlacement } from "../src/db/queries";

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn(), replace: vi.fn(), refresh: vi.fn(), back: vi.fn() }),
  usePathname: () => "/comics/byrne/issue/x",
}));

const { default: IssueDetail, IssueDetailSkeleton } = await import("../src/components/IssueDetail");
const { UndoProvider } = await import("../src/components/Undo");

const PLACE = (p: Partial<IssuePlacement>): IssuePlacement => ({
  placement_id: 1, run_id: "r", run_title: "Run", sequence: 1, run_total: 1,
  completed: false, read_when: null, this_run: false, ...p,
});

function issue(over: Partial<Issue> = {}): Issue {
  return {
    id: "x", run_id: "claremont", label: "Uncanny X-Men (1963) #142", story_title: "Days of Future Past, part two",
    story_arc: "Days of Future Past", cover_date: "1981-02-01", store_date: "1980-11-04", cover_url: null, pending: false,
    credits: [
      { role: "writer", name: "Chris Claremont" }, { role: "artist", name: "John Byrne" },
      { role: "inker", name: "Terry Austin" }, { role: "colorist", name: "Glynis Wein" },
      { role: "letterer", name: "Tom Orzechowski" }, { role: "cover", name: "John Byrne" },
    ],
    placements: [
      PLACE({ placement_id: 11, run_id: "claremont", run_title: "Claremont — Uncanny X-Men", sequence: 43, run_total: 381, this_run: true }),
      PLACE({ placement_id: 12, run_id: "days", run_title: "Days of Future Past (event)", sequence: 6, run_total: 10,
        completed: true, read_when: "Mar 2025" }),
      PLACE({ placement_id: 13, run_id: "byrne", run_title: "Byrne — X-Men", sequence: 12, run_total: 60 }),
    ],
    ...over,
  };
}

function render(i: Issue, as: "sheet" | "page" = "page") {
  const html = renderToStaticMarkup(createElement(UndoProvider, null, createElement(IssueDetail, { issue: i, as })));
  return new DOMParser().parseFromString(html, "text/html");
}

const text = (el: Element | null) => (el?.textContent ?? "").replace(/\s+/g, " ").trim();
const rows = (doc: Document, sel: string) =>
  [...doc.querySelectorAll(`${sel} .frow`)].map((r) => [text(r.querySelector(".k")), text(r.querySelector(".v"))]);

describe("credits (AC-3)", () => {
  it("draws Writer, Penciller and Inker, no Cover when the cover artist is the penciller", () => {
    const doc = render(issue());
    expect(rows(doc, ".issue-credits")).toEqual([
      ["Writer", "Chris Claremont"], ["Penciller", "John Byrne"], ["Inker", "Terry Austin"],
    ]);
  });

  it("draws Cover when the cover artist differs from the penciller", () => {
    const doc = render(issue({ credits: [
      { role: "writer", name: "Chris Claremont" }, { role: "artist", name: "John Byrne" },
      { role: "cover", name: "John Byrne" }, { role: "cover", name: "Terry Austin" },
    ] }));
    expect(rows(doc, ".issue-credits")).toEqual([
      ["Writer", "Chris Claremont"], ["Penciller", "John Byrne"], ["Cover", "John Byrne, Terry Austin"],
    ]);
  });

  it("draws no Inker row for an issue with no inker credit, and joins two writers", () => {
    const doc = render(issue({ credits: [
      { role: "writer", name: "Chris Claremont" }, { role: "writer", name: "John Byrne" }, { role: "artist", name: "John Byrne" },
    ] }));
    expect(rows(doc, ".issue-credits")).toEqual([["Writer", "Chris Claremont, John Byrne"], ["Penciller", "John Byrne"]]);
  });

  it("puts Colorist and Letterer only inside More credits, a real button with aria-expanded", () => {
    const doc = render(issue());
    const more = doc.querySelector("button.issue-more")!;
    expect(more).not.toBeNull();
    expect(more.getAttribute("type")).toBe("button");
    expect(more.getAttribute("aria-expanded")).toBe("false");
    expect(text(more)).toBe("More credits");
    const panel = doc.getElementById(more.getAttribute("aria-controls")!)!;
    expect(panel.hasAttribute("hidden")).toBe(true);
    expect(rows(doc, ".issue-more-credits")).toEqual([["Colorist", "Glynis Wein"], ["Letterer", "Tom Orzechowski"]]);
    // Nowhere else.
    expect(text(doc.querySelector(".issue-credits"))).not.toMatch(/Colorist|Letterer|Glynis|Orzechowski/);
  });

  it("draws no More credits without a colorist or letterer, and no Credits at all without a credit", () => {
    expect(render(issue({ credits: [{ role: "writer", name: "Chris Claremont" }] })).querySelector(".issue-more")).toBeNull();
    const doc = render(issue({ credits: [] }));
    expect(doc.querySelector(".issue-credits")).toBeNull();
    expect([...doc.querySelectorAll("h2.s")].map(text)).not.toContain("Credits");
  });
});

describe("dates (AC-4)", () => {
  it("an issue with cover_date 1981-01-01 renders Cover date Jan 1981", () => {
    const doc = render(issue({ cover_date: "1981-01-01", store_date: null }));
    expect(rows(doc, ".issue-dates")).toEqual([["Cover date", "Jan 1981"]]);
    expect([...doc.querySelectorAll("h2.s")].map(text)).toContain("Dates");
  });

  it("renders Published when the store date differs, in its own month", () => {
    expect(rows(render(issue()), ".issue-dates")).toEqual([["Cover date", "Feb 1981"], ["Published", "Nov 1980"]]);
  });

  it("renders no Published when the store date falls in the cover's month", () => {
    expect(rows(render(issue({ cover_date: "1981-02-01", store_date: "1981-02-17" })), ".issue-dates"))
      .toEqual([["Cover date", "Feb 1981"]]);
  });

  it("an undated issue renders no Dates group and no —", () => {
    const doc = render(issue({ cover_date: null, store_date: null }));
    expect(doc.querySelector(".issue-dates")).toBeNull();
    expect([...doc.querySelectorAll("h2.s")].map(text)).not.toContain("Dates");
    expect(doc.body.textContent).not.toMatch(/Cover date|Published/);
    // No value anywhere stands in for a missing date (the run titles' own dashes aside).
    for (const v of doc.querySelectorAll(".frow .v, .detail-by, .detail-tags .tag")) expect(text(v)).not.toMatch(/^—$|· —/);
    // The hero names no date either.
    expect(text(doc.querySelector(".detail-by"))).toBe("Days of Future Past, part two");
  });

  it("the date values are grey", () => {
    for (const v of render(issue()).querySelectorAll(".issue-dates .v")) expect(v.classList.contains("muted")).toBe(true);
  });
});

describe("Your record (AC-2, AC-6)", () => {
  it("lists one row per run: a green tick and its date for the read one, grey rings for the others, this run marked", () => {
    const doc = render(issue());
    const items = [...doc.querySelectorAll(".irec > li")];
    expect(items).toHaveLength(3);
    expect(items.map((li) => text(li.querySelector(".irec-run")))).toEqual([
      "Claremont — Uncanny X-Men", "Days of Future Past (event)", "Byrne — X-Men",
    ]);
    expect(items.map((li) => text(li.querySelector(".irec-pos")))).toEqual([
      "issue 43 of 381 · this run", "issue 6 of 10", "issue 12 of 60",
    ]);
    expect(items.map((li) => li.getAttribute("data-read"))).toEqual(["false", "true", "false"]);
    // Glyph and text, not colour alone.
    expect(items.map((li) => text(li.querySelector(".irec-glyph")))).toEqual(["○", "✓", "○"]);
    expect(items.map((li) => text(li.querySelector("button")))).toEqual(["○ Mark read", "✓ read · Mar 2025", "○ Mark read"]);
    expect(text(doc.querySelector(".irec-count"))).toBe("1 of 3 runs read");
  });

  it("each row's toggle is a real button named with its run and position, aria-pressed by its state", () => {
    const buttons = [...render(issue()).querySelectorAll(".irec button")];
    expect(buttons.map((b) => [b.getAttribute("type"), b.getAttribute("aria-pressed"), b.getAttribute("aria-label")])).toEqual([
      ["button", "false", "Mark read in Claremont — Uncanny X-Men, issue 43 of 381"],
      ["button", "true", "Mark read in Days of Future Past (event), issue 6 of 10"],
      ["button", "false", "Mark read in Byrne — X-Men, issue 12 of 60"],
    ]);
  });

  it("has no mark-all: one toggle per placement and nothing else in the record", () => {
    const doc = render(issue());
    expect(doc.querySelectorAll(".irec button")).toHaveLength(3);
    const controls = [...doc.querySelectorAll("button, a")].map((c) => `${text(c)} ${c.getAttribute("aria-label") ?? ""}`);
    expect(controls.filter((c) => /mark all|mark every|all runs/i.test(c))).toEqual([]);
    // The mockup's line says so, in words.
    expect(text(doc.querySelector(".irec-lede"))).toBe("Each run keeps its own mark. There is no mark all.");
  });

  it("a read with no date says read, with no date", () => {
    const doc = render(issue({ placements: [PLACE({ completed: true, read_when: null, this_run: true })] }));
    expect(text(doc.querySelector(".irec button"))).toBe("✓ read");
  });

  it("the tick is --ready and the ring grey; no literal colours", () => {
    const css = readFileSync("src/app/globals.css", "utf8");
    const rule = (sel: RegExp) => (css.match(sel) ?? []).join("\n");
    expect(rule(/\.irec-row\[data-read="true"\] \.irec-glyph\s*\{[^}]*\}/g)).toContain("var(--ready)");
    expect(rule(/\.irec-glyph\s*\{[^}]*\}/g)).toContain("var(--muted)");
    expect(rule(/\.irec[^{]*\{[^}]*\}/g)).not.toMatch(/#[0-9a-fA-F]{3,8}\b/);
  });
});

describe("the hero and the layout", () => {
  it("heads the page with the label under an h1, the story title and cover date beneath, the arc and run count as tags", () => {
    const doc = render(issue());
    expect(text(doc.querySelector("h1.detail-title"))).toBe("Uncanny X-Men (1963) #142");
    expect(text(doc.querySelector(".detail-by"))).toBe("Days of Future Past, part two · Feb 1981");
    expect([...doc.querySelectorAll(".detail-tags .tag")].map(text)).toEqual(["arc · Days of Future Past", "in 3 runs"]);
    expect(doc.querySelector(".detail")!.getAttribute("data-detail")).toBe("page");
  });

  it("splits several arcs into one tag each, and draws one placement as in 1 run", () => {
    const doc = render(issue({ story_arc: "Dark Phoenix; Brood Saga", placements: [PLACE({ this_run: true })] }));
    expect([...doc.querySelectorAll(".detail-tags .tag")].map(text)).toEqual(["arc · Dark Phoenix", "arc · Brood Saga", "in 1 run"]);
  });

  it("a pending issue's cover box is marked pending and says metadata pending", () => {
    const doc = render(issue({ pending: true }));
    expect(doc.querySelector(".detail-cover")!.getAttribute("data-enrich")).toBe("pending");
    expect(doc.body.textContent).toContain("metadata pending");
  });

  it("the skeleton keeps the loaded sections' places and says Loading issue", () => {
    const html = renderToStaticMarkup(createElement(IssueDetailSkeleton, { as: "page" }));
    const doc = new DOMParser().parseFromString(html, "text/html");
    expect(doc.querySelector(".detail")!.getAttribute("aria-busy")).toBe("true");
    expect(text(doc.querySelector("h1"))).toBe("Loading issue");
    expect([...doc.querySelectorAll(".s")].map(text)).toEqual(["Dates", "Credits", "Your record"]);
  });

  it("the error states are neutral: a grey × and a line, never red, and a way to try again", async () => {
    for (const path of ["../src/app/comics/[runId]/issue/[issueId]/error", "../src/app/@modal/(.)comics/[runId]/issue/[issueId]/error"]) {
      const { default: Err } = await import(path);
      const html = renderToStaticMarkup(createElement(Err, { error: new Error("x"), reset: () => {} }));
      const doc = new DOMParser().parseFromString(html, "text/html");
      expect(text(doc.querySelector('[role="alert"]'))).toBe("× Couldn't load this issue. Nothing was changed.");
      expect(text(doc.querySelector("button"))).toBe("Try again");
      expect(doc.querySelector(".detail-error")).not.toBeNull();
    }
  });
});
