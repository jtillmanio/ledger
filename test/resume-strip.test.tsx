// Task 1.6: the spine hero. Above *Resume* sits the next-issue strip, one link
// named *Next: n of N, label, note*; the only --brand in the hero is the Resume
// button (STYLE_GUIDE §9 *Next-issue strip*, mockups `spine` and `krakoa`). A
// fully read run shows the grey `✓ read · date` badge instead.
import { readFileSync } from "node:fs";
import { renderToStaticMarkup } from "react-dom/server";
import { Window } from "happy-dom";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { requireTestUrl } from "../scripts/lib/testdb.mjs";
import { markRead, testSql, truncateAll } from "./db";

const USER = "test-user";
const CSS = readFileSync(new URL("../src/app/globals.css", import.meta.url), "utf8");

const sql = testSql();
let q: typeof import("../src/db/queries");
let RunSpine: typeof import("../src/components/IssueRow").default;
let UndoProvider: typeof import("../src/components/Undo").UndoProvider;
let appSql: { end: () => Promise<void> };

beforeAll(async () => {
  // src/db reads DATABASE_URL at import time: point it at the TEST database first.
  process.env.DATABASE_URL = requireTestUrl();
  q = await import("../src/db/queries");
  RunSpine = (await import("../src/components/IssueRow")).default;
  UndoProvider = (await import("../src/components/Undo")).UndoProvider;
  appSql = (await import("../src/db")).sql;
});

afterAll(async () => {
  await appSql.end();
  await sql.end();
});

/** A run of the given labels in order; `notes` by position, 1-based. */
async function run(id: string, labels: string[], notes: Record<number, string> = {}) {
  await sql`INSERT INTO runs (id, title) VALUES (${id}, ${"Run " + id})`;
  for (const [n, label] of labels.entries()) {
    const issue = `${id}-${n + 1}`;
    await sql`INSERT INTO issues (id, label) VALUES (${issue}, ${label})`;
    await sql`INSERT INTO run_issues (run_id, sequence, issue_id, notes)
              VALUES (${id}, ${n + 1}, ${issue}, ${notes[n + 1] ?? null})`;
  }
}

beforeEach(async () => {
  await truncateAll(sql);
  await sql`INSERT INTO users (id, name) VALUES (${USER}, 'Test')`;
  // AC-1: issues 1-5 and 7 read; 6 also sits in run `other`.
  await run("a", Array.from({ length: 9 }, (_, n) => `Issue ${n + 1}`), { 6: "Part six" });
  await sql`INSERT INTO runs (id, title) VALUES ('other', 'Other')`;
  await sql`INSERT INTO run_issues (run_id, sequence, issue_id) VALUES ('other', 1, 'a-6')`;
  for (const n of [1, 2, 3, 4, 5, 7]) await markRead(sql, USER, "a", `a-${n}`);
});

type Theme = "light" | "dark";

/** The run's hero, rendered as the run page renders it, styled by globals.css. */
async function hero(runId: string, theme: Theme = "light") {
  const detail = (await q.runDetail(USER, runId))!;
  const html = renderToStaticMarkup(
    <UndoProvider>
      <RunSpine runId={detail.run.id} title={detail.run.title} issues={detail.issues}
        lastRead={detail.run.last_read_when} />
    </UndoProvider>,
  );
  // happy-dom's own types, read as the DOM's. It cascades the stylesheet and
  // resolves var(), so a computed colour is the token's value in that theme.
  const win = new Window() as unknown as typeof globalThis;
  const doc = win.document;
  const style = doc.createElement("style");
  style.textContent = CSS;
  doc.head.append(style);
  doc.documentElement.setAttribute("data-theme", theme);
  doc.body.innerHTML = html;
  const el = doc.querySelector(".runhero");
  if (!el) throw new Error("no .runhero");
  const resume = [...el.querySelectorAll("a, button")].find((e) => e.textContent!.startsWith("Resume"));
  const css = (e: Element) => win.getComputedStyle(e);
  const brand = css(doc.documentElement).getPropertyValue("--brand").trim().toLowerCase();
  return { el, strip: el.querySelector("a.nextis"), resume, badge: el.querySelector(".bdg"), doc, css, brand };
}

/** Elements of the hero whose colour, background or border computes to --brand. */
function brandPainted({ el, css, brand }: Awaited<ReturnType<typeof hero>>): Element[] {
  return [el, ...el.querySelectorAll("*")].filter((e) => {
    const s = css(e);
    return [s.color, s.backgroundColor, s.borderTopColor, s.borderBottomColor, s.outlineColor]
      .some((v) => (v ?? "").trim().toLowerCase() === brand);
  });
}

function luminance(hex: string) {
  const full = hex.length === 4 ? `#${[...hex.slice(1)].map((c) => c + c).join("")}` : hex;
  const [r, g, b] = [1, 3, 5].map((i) => parseInt(full.slice(i, i + 2), 16) / 255)
    .map((c) => (c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4));
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

function contrast(a: string, b: string) {
  for (const c of [a, b]) expect(c, "a computed hex colour").toMatch(/^#([0-9a-f]{3}|[0-9a-f]{6})$/i);
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (hi + 0.05) / (lo + 0.05);
}

/* ------------------------------------------------------------------ tests */

describe("the next-issue strip (AC-1, AC-5)", () => {
  it("names issue 6 with its ordinal and its placement note, as one link", async () => {
    const { strip } = await hero("a");
    expect(strip).toBeTruthy();
    expect(strip!.querySelector(".nk")!.textContent).toBe("Next · 6 / 9");
    expect(strip!.querySelector(".lbl")!.textContent).toBe("Issue 6");
    expect(strip!.querySelector(".inote")!.textContent).toBe("Part six");
    expect(strip!.getAttribute("aria-label")).toBe("Next: 6 of 9, Issue 6, Part six");
    expect(strip!.querySelectorAll("a, button")).toHaveLength(0);
  });

  it("still names 6 once 6 is read in another run", async () => {
    await markRead(sql, USER, "other", "a-6");
    const { strip } = await hero("a");
    expect(strip!.getAttribute("aria-label")).toMatch(/^Next: 6 of /);
  });

  it("links to the pointer's row on the spine", async () => {
    const { strip, doc } = await hero("a");
    const target = doc.getElementById(strip!.getAttribute("href")!.replace(/^#/, ""));
    expect(target?.getAttribute("data-next")).toBe("true");
    expect(target!.querySelector(".lbl")!.textContent).toBe("Issue 6");
    expect(doc.querySelectorAll("[data-next]")).toHaveLength(1);
  });

  it("leaves the note out of the name when the placement has none", async () => {
    await markRead(sql, USER, "a", "a-6");
    const { strip } = await hero("a");
    expect(strip!.getAttribute("aria-label")).toBe("Next: 8 of 9, Issue 8");
    expect(strip!.querySelector(".inote")).toBeNull();
  });

  it.each(["light", "dark"] as const)("has no element painted --brand in the hero but Resume (%s)", async (theme) => {
    // Adopt shows too: a secondary button beside Resume must not be blue.
    await markRead(sql, USER, "other", "a-6");
    const h = await hero("a", theme);
    expect(h.resume).toBeTruthy();
    expect(h.el.textContent).toContain("Adopt 1 prior read");
    expect(brandPainted(h)).toEqual([h.resume]);
  });

  it("gives way to the fully-read badge once every placement is read", async () => {
    // The latest *dated* read wins: an undated one has no date to show.
    await sql`DELETE FROM issue_progress`;
    for (let n = 1; n <= 7; n++) await markRead(sql, USER, "a", `a-${n}`, { at: "2024-01-05T12:00:00Z" });
    await markRead(sql, USER, "a", "a-8", { at: "2025-03-14T12:00:00Z" });
    await markRead(sql, USER, "a", "a-9", { precision: "none" });
    const { strip, resume, badge, doc } = await hero("a");
    expect(strip).toBeNull();
    expect(resume).toBeUndefined();
    expect(doc.querySelectorAll("[data-next]")).toHaveLength(0);
    expect(badge!.textContent).toBe("✓ read · Mar 2025");
    expect(badge!.getAttribute("aria-label")).toBe("Read, finished Mar 2025");
  });

  it("takes an exact read over a guessed one at the same moment", async () => {
    await sql`DELETE FROM issue_progress`;
    for (let n = 1; n <= 9; n++) {
      await markRead(sql, USER, "a", `a-${n}`,
        { at: "2025-07-01T00:00:00Z", precision: n % 2 ? "approximate" : "exact" });
    }
    const { badge } = await hero("a");
    expect(badge!.textContent).toBe("✓ read · Jul 2025");
  });

  it("says ✓ read with no date when every read in the run is undated", async () => {
    await sql`DELETE FROM issue_progress`;
    for (let n = 1; n <= 9; n++) await markRead(sql, USER, "a", `a-${n}`, { precision: "none" });
    const { badge } = await hero("a");
    expect(badge!.textContent).toBe("✓ read");
    expect(badge!.getAttribute("aria-label")).toBe("Read");
  });

  it("shows neither strip nor badge on a run with no live placements", async () => {
    await sql`UPDATE run_issues SET deleted_at = now() WHERE run_id = 'a'`;
    const { strip, resume, badge } = await hero("a");
    expect([strip, resume, badge]).toEqual([null, undefined, null]);
  });
});

describe("Resume (AC-4)", () => {
  it("names the number alone on a single-series run", async () => {
    await run("uxm", ["Uncanny X-Men (1963) #139", "Uncanny X-Men (1963) #140", "Uncanny X-Men (1963) #141"]);
    await markRead(sql, USER, "uxm", "uxm-1");
    await markRead(sql, USER, "uxm", "uxm-2");
    const h = await hero("uxm");
    expect(h.resume!.textContent).toBe("Resume #141");
    expect(h.resume!.getAttribute("href")).toBe("#p-3");
    expect(h.doc.getElementById("p-3")!.querySelector(".lbl")!.textContent).toBe("Uncanny X-Men (1963) #141");
    expect(brandPainted(h)).toEqual([h.resume]);
  });

  it("names the full label on a run spanning two series", async () => {
    await run("krakoa", ["House of X (2019) #1", "X-Men (2019) #8"]);
    await markRead(sql, USER, "krakoa", "krakoa-1");
    const h = await hero("krakoa");
    expect(h.resume!.textContent).toBe("Resume X-Men (2019) #8");
    expect(h.resume!.getAttribute("href")).toBe("#p-2");
    expect(h.doc.getElementById("p-2")!.querySelector(".lbl")!.textContent).toBe("X-Men (2019) #8");
    expect(brandPainted(h)).toEqual([h.resume]);
  });

  it("is a real link at least 44px tall", async () => {
    const { resume, css } = await hero("a");
    expect(resume!.tagName).toBe("A");
    expect(css(resume!).minHeight).toBe("44px");
  });
});

describe("contrast (AC-5)", () => {
  it.each(["light", "dark"] as const)("kicker, label and note are at least 4.5:1 on --raise (%s)", async (theme) => {
    const { strip, css, doc } = await hero("a", theme);
    const raise = css(doc.documentElement).getPropertyValue("--raise").trim();
    expect(css(strip!).backgroundColor).toBe(raise);
    for (const sel of [".nk", ".lbl", ".inote"]) {
      const text = strip!.querySelector(sel)!;
      expect(contrast(css(text).color, raise), `${sel} on --raise, ${theme}`).toBeGreaterThanOrEqual(4.5);
    }
  });

  it.each(["light", "dark"] as const)("the fully-read badge is grey, glyph and text, at least 4.5:1 (%s)", async (theme) => {
    for (let n = 6; n <= 9; n++) if (n !== 7) await markRead(sql, USER, "a", `a-${n}`);
    const { badge, css, doc } = await hero("a", theme);
    const root = css(doc.documentElement);
    expect(badge!.textContent).toMatch(/^✓ read/);
    expect(css(badge!).backgroundColor).toBe(root.getPropertyValue("--sunk").trim());
    expect(css(badge!).color).toBe(root.getPropertyValue("--muted").trim());
    expect(contrast(css(badge!).color, css(badge!).backgroundColor)).toBeGreaterThanOrEqual(4.5);
  });
});
