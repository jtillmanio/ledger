// @vitest-environment node
// Task 2.2b (F-22, D-37, D-38, M-07): the plan rail. The layout function and the names are pure
// (AC-2, AC-3), tested with no browser and no database; the roadmap's Check (AC-1) is read against
// the TEST database, rendered with the component and parsed back with happy-dom. Figures in the
// fixture are the fixture's own (D-7): what is asserted is a relationship to the quarter's capacity.
import { Window } from "happy-dom";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { requireTestUrl } from "../scripts/lib/testdb.mjs";
import {
  genreHue, kWords, layoutColumn, layoutLane, periodName, railName, stackLabel, stackName, type RailBook,
} from "../src/lib/plan-rail";
import { testSql, truncateAll } from "./db";

const book = (id: string, words: number, o: Partial<RailBook> = {}): RailBook => ({
  id, title: id.toUpperCase(), words, estimated: false, period: "2027-Q1", genre: null, status: "to_read", ...o,
});

/** The phone's column: 230px stands for 1000k, so a word is 0.00023px. */
const PHONE = { length: 230, scale: 1_000_000 };
const px = (words: number) => words * (230 / 1_000_000);

describe("the layout (AC-2)", () => {
  it("sizes each block at the rail's scale, 1000k filling the column, and stacks them end to end", () => {
    const items = layoutColumn([book("a", 300_000), book("b", 200_000), book("c", 150_000)], { ...PHONE, capacity: 760_000 });
    expect(items.map((i) => i.kind)).toEqual(["block", "block", "block"]);
    expect(items.map((i) => i.size)).toEqual([px(300_000), px(200_000), px(150_000)].map((n) => expect.closeTo(n, 6)));
    // Words decide: a block starts where the words before it end, so the gap never moves anything.
    expect(items.map((i) => i.start)).toEqual([0, px(300_000), px(500_000)].map((n) => expect.closeTo(n, 6)));
  });

  it("marks a block over when its end passes capacity, and only that part: a block wholly past it is wholly over", () => {
    const items = layoutColumn(
      [book("a", 300_000), book("b", 200_000), book("c", 150_000), book("d", 110_000), book("e", 132_000)],
      { ...PHONE, capacity: 760_000 },
    );
    // d ends exactly on the rule: it fits. e starts on it: all of e is over.
    expect(items.map((i) => i.over)).toEqual([false, false, false, false, true]);
    const e = items[4];
    expect(e.overSize).toBeCloseTo(px(132_000), 6);
    expect(e.split).toBeNull();
  });

  it("splits a block that straddles the rule at the rule: plain below it, over above it", () => {
    const [a, b, c] = layoutColumn([book("a", 400_000), book("b", 300_000), book("c", 192_000)], { ...PHONE, capacity: 760_000 });
    expect([a.over, b.over, c.over]).toEqual([false, false, true]);
    // c starts at 700k; the rule is 60k into it, the other 132k is over.
    expect(c.split).toBeCloseTo(px(60_000), 6);
    expect(c.overSize).toBeCloseTo(px(132_000), 6);
    expect((c.split ?? 0) + c.overSize).toBeCloseTo(c.size, 6);
    // The rule is where the plain part ends: its start plus the split is capacity's height.
    expect(c.start + (c.split ?? 0)).toBeCloseTo(px(760_000), 6);
    expect(a.split).toBeNull();
  });

  it("over blocks are the highest ordinals, whatever the sizes", () => {
    const items = layoutColumn(
      [book("a", 120_000), book("b", 400_000), book("c", 120_000), book("d", 120_000), book("e", 120_000)],
      { ...PHONE, capacity: 700_000 },
    );
    const over = items.flatMap((i) => (i.kind === "block" && i.over ? [i.book.id] : []));
    expect(over).toEqual(["d", "e"]);
  });

  it("merges three adjacent blocks each under 24px into one +3 stack with their summed words", () => {
    // 50k, 40k and 60k are 11.5px, 9.2px and 13.8px at 230px / 1000k.
    const items = layoutColumn(
      [book("a", 400_000), book("s1", 50_000), book("s2", 40_000), book("s3", 60_000), book("z", 300_000)],
      { ...PHONE, capacity: 760_000 },
    );
    expect(items.map((i) => i.kind)).toEqual(["block", "stack", "block"]);
    const stack = items[1];
    if (stack.kind !== "stack") throw new Error("not a stack");
    expect(stack.books.map((b) => b.id)).toEqual(["s1", "s2", "s3"]);
    expect(stack.count).toBe(3);
    expect(stackLabel(stack)).toBe("+3 · 150k");
    expect(stack.words).toBe(150_000);
    // It keeps its drawn height (the sum) at its exact word position.
    expect(stack.size).toBeCloseTo(px(150_000), 6);
    expect(stack.start).toBeCloseTo(px(400_000), 6);
  });

  it("merges two, not one: a run of two small blocks is a +2 stack", () => {
    const items = layoutColumn([book("a", 300_000), book("s1", 50_000), book("s2", 50_000), book("b", 300_000)], { ...PHONE, capacity: 760_000 });
    expect(items.map((i) => i.kind)).toEqual(["block", "stack", "block"]);
    expect(items[1].kind === "stack" && items[1].count).toBe(2);
  });

  it("leaves one lone block under 24px unmerged, at its drawn height", () => {
    const items = layoutColumn([book("a", 400_000), book("s", 30_000), book("z", 300_000)], { ...PHONE, capacity: 760_000 });
    expect(items.map((i) => i.kind)).toEqual(["block", "block", "block"]);
    expect(items[1].size).toBeCloseTo(px(30_000), 6);
  });

  it("does not merge small blocks a larger one separates, and a block of exactly 24px is not small", () => {
    const apart = layoutColumn([book("s1", 30_000), book("big", 300_000), book("s2", 30_000)], { ...PHONE, capacity: 760_000 });
    expect(apart.map((i) => i.kind)).toEqual(["block", "block", "block"]);
    const words = 24 / (230 / 1_000_000);
    const edge = layoutColumn([book("a", words), book("b", words)], { ...PHONE, capacity: 760_000 });
    expect(edge.map((i) => i.kind)).toEqual(["block", "block"]);
  });

  it("a stack that holds the rule hatches exactly the words past it", () => {
    // 700k, then 40k + 40k + 40k: the stack runs 700k → 820k, capacity 760k.
    const items = layoutColumn(
      [book("a", 700_000), book("s1", 40_000), book("s2", 40_000), book("s3", 40_000)],
      { ...PHONE, capacity: 760_000 },
    );
    const stack = items[1];
    expect(stack.kind).toBe("stack");
    expect(stack.over).toBe(true);
    expect(stack.overSize).toBeCloseTo(px(60_000), 6);
    expect(stack.split).toBeCloseTo(px(60_000), 6);
  });

  it("lays the fifth lane out largest first, at the foot, and counts it against no capacity", () => {
    const items = layoutLane([book("small", 60_000), book("huge", 400_000), book("mid", 200_000)], PHONE);
    expect(items.map((i) => (i.kind === "block" ? i.book.id : "stack"))).toEqual(["huge", "mid", "small"]);
    expect(items[0].start).toBe(0);
    expect(items.some((i) => i.over)).toBe(false);
  });

  it("breaks a tie in the lane by title, then id, so it never reshuffles", () => {
    const items = layoutLane([book("b", 120_000, { title: "Same" }), book("a", 120_000, { title: "Same" }), book("c", 120_000, { title: "Alpha" })], PHONE);
    expect(items.map((i) => (i.kind === "block" ? i.book.id : "stack"))).toEqual(["c", "a", "b"]);
  });

  it("lays the strip out along its own length: the scale is the plan or the capacity, whichever is more", () => {
    // 812k planned against 760k: the strip stretches to 812k, so the rule sits at 760/812 of it.
    const items = layoutColumn([book("a", 600_000), book("b", 212_000)], { length: 296, scale: 812_000, capacity: 760_000 });
    expect(items[0].size + items[1].size).toBeCloseTo(296, 6);
    expect(items[1].over).toBe(true);
    expect(items[1].split).toBeCloseTo((160_000 / 812_000) * 296, 6);
  });
});

describe("a column holds 1000k: what runs past its top folds into one +N more stack", () => {
  it("keeps the scale and folds the books that would pass the top, from the first one that does", () => {
    // 400k, 300k, 200k fill 900k; 150k would end at 1050k and 120k after it: both fold. The rule stays at 760k.
    const items = layoutColumn(
      [book("a", 400_000), book("b", 300_000), book("c", 200_000), book("d", 150_000), book("e", 120_000)],
      { ...PHONE, capacity: 760_000 },
    );
    expect(items.map((i) => i.kind)).toEqual(["block", "block", "block", "stack"]);
    const more = items[3];
    if (more.kind !== "stack") throw new Error("not a stack");
    expect(more.fold).toBe(true);
    expect(more.books.map((b) => b.id)).toEqual(["d", "e"]);
    expect(more.count).toBe(2);
    expect(more.words).toBe(270_000);
    expect(stackLabel(more)).toBe("+2 more · 270k");
    // It stands where its first book starts and runs to the top of the column.
    expect(more.start).toBeCloseTo(px(900_000), 6);
    expect(more.start + more.size).toBeCloseTo(230, 6);
    // The blocks before it are drawn at their words, as ever.
    expect(items[0].size).toBeCloseTo(px(400_000), 6);
  });

  it("hatches a folded stack only where it passes the rule, up to the top of the column", () => {
    const items = layoutColumn(
      [book("a", 400_000), book("b", 400_000), book("c", 300_000), book("d", 200_000)],
      { ...PHONE, capacity: 760_000 },
    );
    const more = items[2];
    expect(more.kind === "stack" && more.fold).toBe(true);
    // c starts at 800k, past the 760k rule: all of what is drawn of it is over.
    expect(more.over).toBe(true);
    expect(more.overSize).toBeCloseTo(more.size, 6);
    expect(more.split).toBeNull();
  });

  it("keeps a lone book past the top as its own block, clipped there, so it keeps its name and its tap", () => {
    const items = layoutColumn([book("a", 900_000), book("b", 150_000)], { ...PHONE, capacity: 760_000 });
    expect(items.map((i) => i.kind)).toEqual(["block", "block"]);
    const b = items[1];
    if (b.kind !== "block") throw new Error("not a block");
    expect(b.book.id).toBe("b");
    // It is drawn from where its words start to the top of the column, not to the end of its words.
    expect(b.start).toBeCloseTo(px(900_000), 6);
    expect(b.start + b.size).toBeCloseTo(230, 6);
    // Past the rule all the way: what is drawn of it is over.
    expect(b.over).toBe(true);
    expect(b.overSize).toBeCloseTo(b.size, 6);
  });

  it("clips a lone straddling book's hatch to what is drawn: the rule is still where its words cross it", () => {
    // 600k, then 500k: it starts under the 760k rule and would end past the top at 1100k.
    const [, b] = layoutColumn([book("a", 600_000), book("b", 500_000)], { ...PHONE, capacity: 760_000 });
    expect(b.split).toBeCloseTo(px(160_000), 6);
    expect(b.overSize).toBeCloseTo(px(240_000), 6);
    expect(b.split! + b.overSize).toBeCloseTo(b.size, 6);
  });

  it("folds a fifth lane taller than the column, smallest last, and counts it against no capacity", () => {
    const lane = [book("l1", 455_000), book("l2", 400_000), book("l3", 204_000), book("l4", 191_000), book("l5", 60_000)];
    const items = layoutLane(lane, PHONE);
    expect(items.map((i) => (i.kind === "block" ? i.book.id : "more"))).toEqual(["l1", "l2", "more"]);
    const more = items[2];
    expect(more.kind === "stack" && more.books.map((b) => b.id)).toEqual(["l3", "l4", "l5"]);
    expect(more.over).toBe(false);
  });

  it("leaves a column that fits alone: nothing folds at exactly 1000k", () => {
    const items = layoutColumn([book("a", 500_000), book("b", 500_000)], { ...PHONE, capacity: 760_000 });
    expect(items.map((i) => i.kind)).toEqual(["block", "block"]);
  });
});

describe("the names (AC-3)", () => {
  it("name the title, the words to the k, estimated when the count is, and the period", () => {
    expect(railName(book("pir", 65_000, { title: "Piranesi", estimated: true }))).toBe("Piranesi, 65k words, estimated, Q1 2027");
  });

  it("a stated count leaves out the word", () => {
    expect(railName(book("pir", 65_400, { title: "Piranesi" }))).toBe("Piranesi, 65k words, Q1 2027");
  });

  it("a fifth-lane book ends with the bare year", () => {
    expect(railName(book("y", 191_000, { title: "A Fire Upon the Deep", period: "2027" }))).toBe("A Fire Upon the Deep, 191k words, 2027");
  });

  it("a stack says how many books and how many words", () => {
    const books = [book("a", 30_000), book("b", 30_000), book("c", 24_000)];
    expect(stackName(books)).toBe("3 books, 84k words");
  });

  it("the period reads as the plan says it", () => {
    expect(periodName("2027-Q4")).toBe("Q4 2027");
    expect(periodName("2027")).toBe("2027");
  });

  it("a million words and over read as M, as the strip said them", () => {
    expect(kWords(615_000)).toBe("615k");
    expect(kWords(1_200_000)).toBe("1.2M");
    expect(kWords(1_000_000)).toBe("1M");
  });
});

describe("a book's hue (decision: one book, one hue)", () => {
  it("is the same for the same genre, whatever its case or spacing", () => {
    expect(genreHue("Fantasy")).toBe(genreHue("  fantasy "));
    expect(genreHue("Science Fiction")).toBe(genreHue("science fiction"));
  });

  it("is one of the seven genre hues, and a book with no genre is the eighth", () => {
    for (const g of ["Fantasy", "Mystery", "Horror", "Romance", "History", "Poetry", "Memoir", "Thriller", "Classics"]) {
      expect(genreHue(g)).toMatch(/^--g[1-7]$/);
    }
    expect(genreHue(null)).toBe("--g8");
    expect(genreHue("")).toBe("--g8");
    expect(genreHue("   ")).toBe("--g8");
  });

  it("does not put every genre on one hue", () => {
    const hues = new Set(["Fantasy", "Mystery", "Horror", "Romance", "History", "Poetry", "Memoir", "Thriller", "Classics", "Essays"].map(genreHue));
    expect(hues.size).toBeGreaterThan(2);
  });
});

// ── The Check, on the TEST database ──────────────────────────────────────────────────────────

const USER = "test-user";
const sql = testSql();
let q: typeof import("../src/db/queries");
let w: typeof import("../src/db/writes");
let appSql: { end: () => Promise<void> };

beforeAll(async () => {
  // src/db reads DATABASE_URL at import time: point it at the TEST database first.
  process.env.DATABASE_URL = requireTestUrl();
  q = await import("../src/db/queries");
  w = await import("../src/db/writes");
  appSql = (await import("../src/db")).sql;
});

afterAll(async () => {
  await appSql.end();
  await sql.end();
});

/**
 * 2027-Q1, in the owner's order: 906,500 words against the default quarter (45 min × 185 wpm). Every
 * book is over 105k words, so none is under 24px on the phone and none folds into a stack.
 */
const Q1: [string, { words?: number; pages?: number; genre?: string }][] = [
  ["f1", { words: 200_000, genre: "Fantasy" }],
  ["f2", { words: 150_000, genre: "Fantasy" }],
  ["f3", { words: 140_000, genre: "Mystery" }],
  ["f4", { words: 140_000, genre: "Mystery" }],
  ["f5", { words: 150_000, genre: "Horror" }],
  ["f6", { pages: 460 }], // 460 pages at 275 words a page: 126,500, estimated
];
const WORDS: Record<string, number> = { f1: 200_000, f2: 150_000, f3: 140_000, f4: 140_000, f5: 150_000, f6: 126_500 };

/** The oracle: a book is over when its cumulative words, in this order, pass the capacity. */
const overBy = (order: string[], capacity: number) => {
  let run = 0;
  return order.flatMap((id) => ((run += WORDS[id]) > capacity ? [id] : []));
};

beforeEach(async () => {
  await truncateAll(sql);
  await sql`INSERT INTO users (id, name) VALUES (${USER}, 'Reader')`;
  const rows: [string, { words?: number; pages?: number; genre?: string }, string, number | null][] = [
    ...Q1.map(([id, o], n) => [id, o, "2027-Q1", n + 1] as [string, typeof o, string, number | null]),
    ["q2a", { words: 120_000 }, "2027-Q2", 1],
    ["yr", { words: 120_000, genre: "Memoir" }, "2027", null],
    ["deck", { words: 80_000 }, "on_deck", null],
  ];
  for (const [id, o, period, ordinal] of rows) {
    await sql`INSERT INTO books (id, title, genre, word_count, word_count_source, page_count)
      VALUES (${id}, ${"Title " + id}, ${o.genre ?? null}, ${o.words ?? null}, ${o.words == null ? null : "stated"}, ${o.pages ?? null})`;
    await sql`INSERT INTO book_status (user_id, book_id, status) VALUES (${USER}, ${id}, 'to_read')`;
    await sql`INSERT INTO reading_plan (user_id, book_id, period, ordinal) VALUES (${USER}, ${id}, ${period}, ${ordinal})`;
  }
});

/** Renders the rail the way the page does, and parses it back. */
async function rail() {
  const { default: PlanRail } = await import("../src/components/PlanRail");
  const books = await q.planRail(USER, 2027);
  const { quarters } = await q.planCapacity(USER, 2027);
  const html = renderToStaticMarkup(createElement(PlanRail, { year: 2027, books, quarters }));
  const window = new Window();
  window.document.body.innerHTML = html;
  return { html, doc: window.document, quarters };
}

type Doc = Awaited<ReturnType<typeof rail>>["doc"];
const ids = (doc: Doc, selector: string) =>
  [...doc.querySelectorAll(selector)].map((el) => el.getAttribute("data-book"));
const cssVar = (el: { getAttribute(name: string): string | null } | null, name: string) => {
  const m = new RegExp(`${name}:\\s*([-\\d.]+)`).exec(el?.getAttribute("style") ?? "");
  return m ? Number(m[1]) : null;
};

describe("the Check: a quarter past capacity hatches exactly the words past it (AC-1)", () => {
  it("hatches the blocks past capacity, and they are the quarter's highest ordinals", async () => {
    const { doc, quarters } = await rail();
    const q1 = quarters[0];
    expect(q1.plannedWords).toBeGreaterThan(q1.capacity);
    // The oracle: a book is over when its cumulative words, in order, pass the quarter's capacity.
    const expected = overBy(Q1.map(([id]) => id), q1.capacity);
    expect(expected).toEqual(["f5", "f6"]);
    expect(ids(doc, '.qcol[data-period="2027-Q1"] button.qb.over')).toEqual(expected);
    // The highest ordinals: the order the stack is drawn in is the order of the plan.
    expect(ids(doc, '.qcol[data-period="2027-Q1"] button.qb')).toEqual(Q1.map(([id]) => id));
    expect(expected).toEqual(Q1.slice(-expected.length).map(([id]) => id));
  });

  it("hatches a straddling block above the rule and leaves it plain below: the layer is exactly the words past capacity", async () => {
    const { doc, quarters } = await rail();
    const f5 = doc.querySelector('[data-book="f5"]');
    // f5 runs 630,000 → 780,000; the rule is at the quarter's capacity.
    const past = 780_000 - quarters[0].capacity;
    expect(past).toBeGreaterThan(0);
    expect(past).toBeLessThan(150_000);
    // The hatch layer is a child of the block and takes its share of the block from the block's --ov.
    expect(f5?.querySelector(".ov")).not.toBeNull();
    expect(cssVar(f5 ?? null, "--ov")).toBeCloseTo(past / 150_000, 3);
    // f4 ends before the rule and is plain; f6 is wholly over.
    expect(doc.querySelector('[data-book="f4"] .ov')).toBeNull();
    expect(doc.querySelector('[data-book="f6"] .ov')).not.toBeNull();
    expect(cssVar(doc.querySelector('[data-book="f6"]'), "--ov")).toBeCloseTo(1, 3);
  });

  it("moving the last hatched book to the top renders it plain and leaves the quarter's total unchanged", async () => {
    const before = await rail();
    const total = before.quarters[0].plannedWords;
    expect(await w.moveToTop(USER, "f6", "2027-Q1")).toBe(true);
    const after = await rail();
    expect(after.quarters[0].plannedWords).toBe(total);
    expect(ids(after.doc, '[data-period="2027-Q1"] button.qb')[0]).toBe("f6");
    expect(after.doc.querySelector('[data-book="f6"]')?.classList.contains("over")).toBe(false);
    expect(after.doc.querySelector('[data-book="f6"] .ov')).toBeNull();
    // What is over now is the end of the new order, by the same rule.
    const order = ["f6", "f1", "f2", "f3", "f4", "f5"];
    expect(ids(after.doc, '[data-period="2027-Q1"] button.qb.over')).toEqual(overBy(order, after.quarters[0].capacity));
  });

  it("a book with period 2027 is in the fifth lane and in no column; On deck is on the rail nowhere", async () => {
    const { doc } = await rail();
    expect(ids(doc, ".qcol.nq button.qb")).toEqual(["yr"]);
    expect(doc.querySelector(".qcol.nq")?.getAttribute("data-period")).toBe("2027");
    expect(doc.querySelectorAll(".qcol:not(.nq) [data-book=\"yr\"]")).toHaveLength(0);
    expect(doc.querySelectorAll('[data-book="deck"]')).toHaveLength(0);
    expect(doc.querySelector(".qcol.nq button.qb")?.classList.contains("un")).toBe(true);
  });

  it("every block is a real button with its name; an estimated one carries data-wc and the ~ label; nothing is a Month control", async () => {
    const { doc, html } = await rail();
    const f6 = doc.querySelector('[data-book="f6"]');
    expect(f6?.tagName).toBe("BUTTON");
    expect(f6?.getAttribute("data-wc")).toBe("estimated");
    expect(f6?.getAttribute("aria-label")).toBe("Title f6, 127k words, estimated, Q1 2027");
    expect(f6?.querySelector(".ql")?.textContent).toBe("~127k");
    expect(doc.querySelector('[data-book="f1"]')?.hasAttribute("data-wc")).toBe(false);
    expect(doc.querySelector('[data-book="yr"]')?.getAttribute("aria-label")).toBe("Title yr, 120k words, 2027");
    expect(html).not.toMatch(/month/i);
    expect(html).not.toContain('role="tablist"');
    // No colour of its own: custom properties and tokens only.
    expect(html).not.toMatch(/#[0-9a-f]{3,8}\b|danger/i);
  });

  it("its words add up to 2.1's figures: each quarter, and the quarters plus the fifth lane for the year", async () => {
    const rows = await q.planRail(USER, 2027);
    const { year, quarters } = await q.planCapacity(USER, 2027);
    const sum = (period: string) => rows.filter((r) => r.period === period).reduce((n, r) => n + r.words, 0);
    quarters.forEach((cap) => expect(sum(cap.period), cap.period).toBe(cap.plannedWords));
    expect(sum("2027") + quarters.reduce((n, cap) => n + sum(cap.period), 0)).toBe(year.plannedWords);
    // On deck is on no rail, and an estimate is flagged as one.
    expect(rows.some((r) => r.id === "deck")).toBe(false);
    expect(rows.find((r) => r.id === "f6")?.estimated).toBe(true);
    expect(rows.find((r) => r.id === "f1")?.estimated).toBe(false);
  });

  it("a soft-deleted book is on no rail and in no strip (Hard rule 4)", async () => {
    await sql`UPDATE books SET deleted_at = now() WHERE id IN ('f2', 'yr')`;
    expect((await q.planRail(USER, 2027)).some((r) => r.id === "yr" || r.id === "f2")).toBe(false);
    expect((await q.quarterBlocks(USER, "2027-Q1")).some((r) => r.id === "f2")).toBe(false);
  });

  it("each quarter's footer says its planned words, and an over one says what it is over, amber, never red", async () => {
    const { doc, quarters } = await rail();
    const over = quarters[0].plannedWords - quarters[0].capacity;
    const foot = doc.querySelector('.qcol[data-period="2027-Q1"] .qfoot');
    expect(foot?.textContent).toContain(kWords(quarters[0].plannedWords));
    expect(foot?.querySelector(".bdg.bl.phone")?.textContent).toBe(`+${kWords(over)}`);
    expect(foot?.querySelector(".bdg.bl.desk")?.textContent).toBe(`over ${kWords(over)}`);
    expect(foot?.querySelector(".bdg.dn")).toBeNull();
    // Q2 has room: only the desktop footer says so, and the phone's has no badge at all.
    const q2 = doc.querySelector('.qcol[data-period="2027-Q2"] .qfoot');
    const room = quarters[1].capacity - quarters[1].plannedWords;
    expect(q2?.querySelector(".bdg.dn.desk")?.textContent).toBe(`${kWords(room)} room`);
    expect(q2?.querySelector(".bdg.phone")).toBeNull();
  });
});

describe("a plan taller than the rail keeps the scale (decision: fixed 1000k, overflow folds)", () => {
  it("a 1.3M fifth lane folds into a +N more button and moves nothing in the four quarters", async () => {
    const { default: PlanRail } = await import("../src/components/PlanRail");
    const cap = (n: number, planned: number) => ({
      period: `2027-Q${n}`, year: 2027, quarter: n, capacity: 760_000, plannedWords: planned, statedWords: planned,
      estimatedWords: 0, books: 0, readBooks: 0, unknownBooks: 0, load: planned / 760_000, estimatedShare: 0,
    });
    const quarters = [1, 2, 3, 4].map((n) => cap(n, n === 1 ? 300_000 : 0));
    const lane = ["l1", "l2", "l3", "l4", "l5", "l6"].map((id, n) => book(id, [455_000, 300_000, 204_000, 191_000, 90_000, 60_000][n], { period: "2027" }));
    const render = (books: RailBook[]) => {
      const window = new Window();
      window.document.body.innerHTML = renderToStaticMarkup(createElement(PlanRail, { year: 2027, books, quarters }));
      return window.document;
    };
    const withLane = render([book("a", 300_000), ...lane]);
    const without = render([book("a", 300_000)]);
    // The quarter's block and the rule are where they were: the lane drives nothing.
    expect(cssVar(withLane.querySelector('[data-book="a"]'), "--sz")).toBe(cssVar(without.querySelector('[data-book="a"]'), "--sz"));
    expect(withLane.querySelector(".planrail")?.getAttribute("style")).toBe(without.querySelector(".planrail")?.getAttribute("style"));
    expect(cssVar(withLane.querySelector('[data-book="a"]'), "--sz")).toBeCloseTo(300_000 / 1_000_000, 4);
    // The lane's first books stand at the foot; the rest are one stack button that says what it holds.
    expect([...withLane.querySelectorAll(".qcol.nq button.qb:not(.stack)")].map((b) => b.getAttribute("data-book"))).toEqual(["l1", "l2", "l3"]);
    const more = withLane.querySelector(".qcol.nq button.stack");
    expect(more?.getAttribute("aria-label")).toBe("3 books, 341k words");
    expect(more?.querySelector(".ql")?.textContent).toBe("+3 more · 341k");
  });
});

describe("the strip's stacks", () => {
  const cap = {
    period: "2027-Q1", year: 2027, quarter: 1, capacity: 760_000, plannedWords: 360_000, statedWords: 360_000, estimatedWords: 0,
    books: 5, readBooks: 0, unknownBooks: 0, load: 0.47, estimatedShare: 0,
  };
  async function strip(books: RailBook[]) {
    const { default: PlanRail } = await import("../src/components/PlanRail");
    const window = new Window();
    window.document.body.innerHTML = renderToStaticMarkup(createElement(PlanRail, { axis: "row", year: 2027, books, quarters: [cap] }));
    return window.document;
  }

  it("a narrow stack says how many books, not their words, and the reason it does nothing is on the page", async () => {
    // 30k each is 12px of 296 at 760k: three of them are one 35px stack, too narrow for '+3 · 90k'.
    const doc = await strip([book("a", 200_000), book("s1", 30_000), book("s2", 30_000), book("s3", 30_000), book("z", 70_000)]);
    const stack = doc.querySelector("button.stack");
    expect(stack?.querySelector(".ql")?.textContent).toBe("+3");
    expect(stack?.getAttribute("aria-label")).toBe("3 books, 90k words");
    expect(stack?.getAttribute("aria-disabled")).toBe("true");
    expect(doc.querySelector(".qnote")?.textContent).toContain("opens its list with the plan editor");
    expect(doc.getElementById(stack?.getAttribute("aria-describedby") ?? "none")).toBe(doc.querySelector(".qnote"));
  });

  it("a strip with no stack has no reason to give", async () => {
    const doc = await strip([book("a", 200_000), book("b", 160_000)]);
    expect(doc.querySelector("button.stack")).toBeNull();
    expect(doc.querySelector(".qnote")).toBeNull();
  });

  it("a wide stack keeps its words", async () => {
    // Five 40k books at 760k scale are 15.6px each: one 78px stack, wide enough for '+5 · 200k'.
    const doc = await strip([book("a", 100_000), ...["s1", "s2", "s3", "s4", "s5"].map((id) => book(id, 40_000)), book("z", 120_000)]);
    expect(doc.querySelector("button.stack .ql")?.textContent).toBe("+5 · 200k");
  });
});

describe("the strip's tiny stacks", () => {
  it("a stack drawn under 24px has no chip: it would cover its neighbour's label, so its name carries the count", async () => {
    const { default: PlanRail } = await import("../src/components/PlanRail");
    const cap = {
      period: "2027-Q1", year: 2027, quarter: 1, capacity: 760_000, plannedWords: 190_000, statedWords: 190_000, estimatedWords: 0,
      books: 4, readBooks: 0, unknownBooks: 0, load: 0.25, estimatedShare: 0,
    };
    const window = new Window();
    // Two 8k books are 3px each of 296 at 760k: one 6px stack beside a 91k block.
    window.document.body.innerHTML = renderToStaticMarkup(createElement(PlanRail, {
      axis: "row", year: 2027, quarters: [cap],
      books: [book("a", 91_000), book("s1", 8_000), book("s2", 8_000), book("z", 83_000)],
    }));
    const stack = window.document.querySelector("button.stack");
    expect(stack?.getAttribute("aria-label")).toBe("2 books, 16k words");
    expect(stack?.querySelector(".ql")).toBeNull();
    expect(window.document.querySelector(".qnote")).not.toBeNull();
  });
});

describe("a stack in the markup (AC-3)", () => {
  it("is one button that says how many books and words it holds, and a lone small block stays its own button", async () => {
    const { default: PlanRail } = await import("../src/components/PlanRail");
    const cap = (period: string, quarter: number | null, planned: number) => ({
      period, year: 2027, quarter, capacity: 760_000, plannedWords: planned, statedWords: planned, estimatedWords: 0,
      books: 0, readBooks: 0, unknownBooks: 0, load: planned / 760_000, estimatedShare: 0,
    });
    const quarters = [1, 2, 3, 4].map((n) => cap(`2027-Q${n}`, n, n === 1 ? 500_000 : 0));
    const small = (id: string, words: number) => book(id, words, { title: `Small ${id}` });
    const books = [book("big", 300_000), small("s1", 30_000), small("s2", 30_000), small("s3", 24_000), book("big2", 100_000 + 20_000), small("lone", 30_000)];
    const window = new Window();
    window.document.body.innerHTML = renderToStaticMarkup(createElement(PlanRail, { year: 2027, books, quarters }));
    const stack = window.document.querySelector("button.qb.stack");
    expect(stack?.getAttribute("type")).toBe("button");
    // Until 2.3's list sheet it does nothing, and says why: aria-disabled, described by the legend's reason.
    expect(stack?.getAttribute("aria-disabled")).toBe("true");
    const reason = window.document.getElementById(stack?.getAttribute("aria-describedby") ?? "none");
    expect(reason?.textContent).toContain("opens its list with the plan editor");
    expect(stack?.getAttribute("aria-label")).toBe("3 books, 84k words");
    expect(stack?.querySelector(".ql")?.textContent).toBe("+3 · 84k");
    // The three small books are in the stack and have no button of their own; the lone one keeps its own.
    expect(window.document.querySelector('[data-book="s1"]')).toBeNull();
    expect(window.document.querySelector('[data-book="lone"]')?.getAttribute("aria-label")).toBe("Small lone, 30k words, Q1 2027");
  });
});
