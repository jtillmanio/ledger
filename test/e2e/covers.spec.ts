// Task 4.3, part 1 of 3 (TASK-085, F-33): a real cover in every row, in a browser. A spine row, a Library row
// and the next-issue strip each draw one fixed box (28×42, 20×30 in compact), the cover when there is one and a
// plain placeholder when there is none, so a cover arriving moves no row: no row's height changes, and a 381-row
// spine scrolled end to end with every image arriving shifts the layout by under 0.1 (the roadmap Check).
// No outside request is made: the cover host is fake, and `page.route` answers it with a one-pixel image.
// The runs and books are made here under `e2e-cv-` ids the rest of the suite doesn't use, removed after the last
// test. The zero-request clause (reduced data, Show covers off) is TASK-087's.
import { expect, test, type Page } from "@playwright/test";
import { E2E_USER } from "../../scripts/lib/e2e.mjs";
import { testSql, type TestSql } from "../db";
import { contrastFailures, expectNoAxeViolations, expectNoHorizontalScroll, hydrated, screenshot, tokenColour } from "./helpers";

// A check with no layout in it: runs once, in w390-light.
const ONCE = { tag: "@at-w390-light" };

const AXE = ["image-alt", "color-contrast", "link-name", "button-name", "aria-allowed-attr", "duplicate-id-aria", "target-size"];

const HOST = "https://covers.e2e.test";
// A one-pixel PNG: what the fake cover host answers every cover request with.
const PIXEL = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==", "base64",
);

const BIG = "e2e-cv-big";
const BIG_ROWS = 381;
const WITH = "e2e-cv-with";       // two issues, the first has a cover: the strip draws it
const WITHOUT = "e2e-cv-without"; // two issues, the first has none: the strip draws its number
const RUNS = [BIG, WITH, WITHOUT];

const BOOKS = [
  { id: "e2e-cv-book-cover", title: "E2E Cover The Way of Kings", cover: `${HOST}/book-1.png`, hardcover: 9_901_001 },
  { id: "e2e-cv-book-none", title: "E2E Cover Memory of Light", cover: null, hardcover: 9_901_002 },
  { id: "e2e-cv-book-pending", title: "E2E Cover Pending Book", cover: null, hardcover: null },
];
const bookIds = BOOKS.map((b) => b.id);

async function withSql<T>(work: (sql: TestSql) => Promise<T>): Promise<T> {
  const sql = testSql();
  try {
    return await work(sql);
  } finally {
    await sql.end();
  }
}

const clean = () => withSql(async (sql) => {
  await sql`DELETE FROM run_issues WHERE run_id = ANY(${RUNS}::text[])`;
  await sql`DELETE FROM issues WHERE id LIKE 'e2e-cv-%'`;
  await sql`DELETE FROM runs WHERE id = ANY(${RUNS}::text[])`;
  await sql`DELETE FROM book_status WHERE book_id = ANY(${bookIds}::text[])`;
  await sql`DELETE FROM books WHERE id = ANY(${bookIds}::text[])`;
});

test.beforeAll(async () => {
  await clean();
  await withSql(async (sql) => {
    for (const id of RUNS) await sql`INSERT INTO runs (id, title) VALUES (${id}, ${`E2E Covers ${id}`})`;
    // 381 placements: every odd issue has a cover, every even one has none; the first has neither a cover nor a
    // Metron record, so a pending row sits among them. Metron ids from 880000 on: none the test database holds.
    await sql`INSERT INTO issues (id, label, metron_id, cover_url)
              SELECT 'e2e-cv-big-' || n, 'E2E Cover (2001) #' || n,
                     CASE WHEN n = 1 THEN NULL ELSE 880000 + n END,
                     CASE WHEN n % 2 = 1 AND n > 1 THEN ${HOST} || '/issue-' || n || '.png' END
              FROM generate_series(1, ${BIG_ROWS}::int) n`;
    await sql`INSERT INTO run_issues (run_id, sequence, issue_id)
              SELECT ${BIG}, n, 'e2e-cv-big-' || n FROM generate_series(1, ${BIG_ROWS}::int) n`;
    for (const [run, first] of [[WITH, `${HOST}/strip.png`], [WITHOUT, null]] as const) {
      for (const n of [1, 2]) {
        await sql`INSERT INTO issues (id, label, metron_id, cover_url)
                  VALUES (${`e2e-cv-${run}-${n}`}, ${`E2E Strip ${run} (2002) #${n}`}, ${881000 + n},
                          ${n === 1 ? first : null})`;
        await sql`INSERT INTO run_issues (run_id, sequence, issue_id) VALUES (${run}, ${n}, ${`e2e-cv-${run}-${n}`})`;
      }
    }
    for (const b of BOOKS) {
      await sql`INSERT INTO books (id, title, cover_url, hardcover_id) VALUES (${b.id}, ${b.title}, ${b.cover}, ${b.hardcover})`;
      await sql`INSERT INTO book_status (user_id, book_id, status) VALUES (${E2E_USER}, ${b.id}, 'to_read')`;
    }
  });
});
test.afterAll(clean);

/** The fake host answers every cover; nothing leaves the machine. */
async function fakeCovers(page: Page, delayMs = 0) {
  await page.route(`${HOST}/**`, async (route) => {
    if (delayMs) await new Promise((r) => setTimeout(r, delayMs));
    await route.fulfill({ status: 200, contentType: "image/png", body: PIXEL });
  });
}

async function openSpine(page: Page, run: string) {
  await page.goto(`/comics/${run}`);
  await expect(page.locator(".iss").first()).toBeVisible();
}

async function openLibrary(page: Page) {
  await page.goto(`/books/list?q=${encodeURIComponent("E2E Cover")}`);
  await expect(page.locator(".book-row")).toHaveCount(BOOKS.length);
}

const box = async (loc: ReturnType<Page["locator"]>) => {
  await loc.waitFor({ state: "visible" });
  const b = await loc.boundingBox();
  if (!b) throw new Error("no box");
  return { width: Math.round(b.width * 100) / 100, height: Math.round(b.height * 100) / 100 };
};

test("a spine row with a cover has one lazy 28×42 <img>, one without has its number in the same box (AC-2)", async ({ page }) => {
  await fakeCovers(page);
  await openSpine(page, BIG);
  await expect(page.locator(".iss")).toHaveCount(BIG_ROWS);
  const covered = page.locator("#p-3");   // odd, > 1: a cover
  const bare = page.locator("#p-4");      // even: none
  const pending = page.locator("#p-1");   // no Metron record

  const img = covered.locator(".rcv img");
  await expect(img).toHaveCount(1);
  await expect(img).toHaveAttribute("loading", "lazy");
  await expect(img).toHaveAttribute("decoding", "async");
  await expect(img).toHaveAttribute("width", "28");
  await expect(img).toHaveAttribute("height", "42");
  await expect(img).toHaveAttribute("alt", "");
  await expect(bare.locator("img")).toHaveCount(0);
  await expect(bare.locator(".rcv")).toHaveText("4");
  await expect(pending.locator(".rcv")).toHaveAttribute("data-enrich", "pending");
  await expect(pending.locator(".enrich")).toHaveText("metadata pending");

  for (const row of [covered, bare, pending]) expect(await box(row.locator(".rcv"))).toEqual({ width: 28, height: 42 });
  // The same row height with and without a cover.
  expect((await box(covered)).height).toBe((await box(bare)).height);
  // One column: the box sits at the same x whether the ordinal beside it has one, two or three digits.
  const lefts: number[] = [];
  for (const id of ["#p-3", "#p-30", "#p-300"]) {
    await page.locator(id).scrollIntoViewIfNeeded();
    lefts.push((await page.locator(`${id} .rcv`).boundingBox())!.x);
  }
  expect(new Set(lefts.map((x) => Math.round(x))).size, `cover left edges ${lefts.join(", ")}`).toBe(1);
});

test("in compact density every cover box is 20×30 and the row keeps its height (AC-2)", async ({ page }) => {
  // Compact is the desktop's (globals.css: from 900px), so this sets its own width.
  await page.setViewportSize({ width: 1280, height: 800 });
  await fakeCovers(page);
  await openSpine(page, BIG);
  const heights = async () => [await box(page.locator("#p-3")), await box(page.locator("#p-4"))].map((b) => b.height);
  expect((await heights())[0]).toBe((await heights())[1]);
  await page.evaluate(() => { document.documentElement.dataset.density = "compact"; });
  for (const id of ["#p-1", "#p-3", "#p-4"]) {
    expect(await box(page.locator(`${id} .rcv`)), id).toEqual({ width: 20, height: 30 });
  }
  const [a, b] = await heights();
  expect(a).toBe(b);
});

test("a swap changes no row's height: a 381-row spine scrolled end to end, every image arriving, shifts under 0.1 (AC-1)", async ({ page }) => {
  await page.addInitScript(() => {
    (window as unknown as { shift: number }).shift = 0;
    new PerformanceObserver((list) => {
      for (const e of list.getEntries() as unknown as { value: number; hadRecentInput: boolean }[]) {
        if (!e.hadRecentInput) (window as unknown as { shift: number }).shift += e.value;
      }
    }).observe({ type: "layout-shift", buffered: true });
  });
  // A slow host, so the images arrive while the page scrolls rather than before.
  await fakeCovers(page, 150);
  await openSpine(page, BIG);
  await page.evaluate(async () => {
    for (let y = 0; y < document.documentElement.scrollHeight; y += window.innerHeight / 2) {
      window.scrollTo(0, y);
      await new Promise((r) => setTimeout(r, 30));
    }
  });
  // Every cover near the end has arrived.
  await expect.poll(() => page.locator(".rcv img").evaluateAll(
    (imgs) => imgs.filter((i) => (i as HTMLImageElement).complete && (i as HTMLImageElement).naturalWidth > 0).length,
  ), { timeout: 20_000 }).toBeGreaterThan(30);
  const shift = await page.evaluate(() => (window as unknown as { shift: number }).shift);
  expect(shift).toBeLessThan(0.1);
  // The cover rows and the bare rows are one height the whole way down. Not the first (pending: it carries
  // its line) and not the last (no bottom border).
  const heights = await page.locator(".iss").evaluateAll((rows) => [...new Set(
    rows.slice(1, -1).map((r) => Math.round(r.getBoundingClientRect().height)),
  )]);
  expect(heights).toHaveLength(1);
});

test("no cover box is a gradient, an identity hue or a halo; the loaded and the loading box are --sunk (AC-1, AC-5)", async ({ page }) => {
  await fakeCovers(page);
  for (const scheme of ["light", "dark"] as const) {
    await page.emulateMedia({ colorScheme: scheme });
    await openSpine(page, BIG);
    const sunk = await tokenColour(page, "--sunk");
    const halo = await page.evaluate(() => {
      const probe = document.createElement("i");
      probe.style.boxShadow = "var(--halo)";
      document.body.append(probe);
      const resolved = getComputedStyle(probe).boxShadow;
      probe.remove();
      return resolved;
    });
    const identity = await Promise.all([1, 2, 3, 4, 5, 6, 7, 8].flatMap((n) => [tokenColour(page, `--t${n}`), tokenColour(page, `--g${n}`)]));
    expect(halo).not.toBe("none");
    const found = await page.locator(".rcv").evaluateAll((els) => els.slice(0, 60).map((el) => {
      const cs = getComputedStyle(el);
      const ring = getComputedStyle(el, "::after");
      return { image: cs.backgroundImage, colour: cs.backgroundColor, shadow: cs.boxShadow, ring: ring.boxShadow };
    }));
    expect(found.length).toBeGreaterThan(10);
    for (const f of found) {
      expect(f.image, scheme).toBe("none");
      expect(f.colour, scheme).toBe(sunk);
      expect(identity, scheme).not.toContain(f.colour);
      expect(f.shadow, scheme).toBe("none");
      expect(f.ring, scheme).not.toBe(halo);
      expect(f.ring, scheme).toContain("inset");
    }
  }
});

test("the Library: a cover in the 28×42 box, initials without one, the dashed box and its line when pending (AC-3, AC-5)", async ({ page }) => {
  await fakeCovers(page);
  await openLibrary(page);
  const row = (title: string) => page.locator(".book-row").filter({ has: page.locator(".row-title", { hasText: title }) });

  const withCover = row("The Way of Kings");
  await expect(withCover.locator(".rcv img")).toHaveCount(1);
  await expect(withCover.locator(".rcv img")).toHaveAttribute("alt", "");
  await expect(withCover.locator(".rcv img")).toHaveAttribute("loading", "lazy");
  const none = row("Memory of Light");
  await expect(none.locator(".rcv")).toHaveText("ECM"); // "E2E Cover Memory of Light": the first three words
  const pending = row("Pending Book");
  await expect(pending.locator(".rcv")).toHaveAttribute("data-enrich", "pending");
  await expect(pending.locator(".enrich")).toHaveText("metadata pending");

  for (const r of [withCover, none, pending]) expect(await box(r.locator(".rcv"))).toEqual({ width: 28, height: 42 });
  // A book row carries an .edge or a .tag .sq, never both.
  const both = await page.locator(".book-row").evaluateAll((rows) => rows.filter((r) => r.querySelector(".edge") && r.querySelector(".tag .sq")).length);
  expect(both).toBe(0);
});

test("the next-issue strip draws the next placement's cover, its number when it has none (AC-4)", async ({ page }) => {
  await fakeCovers(page);
  await openSpine(page, WITH);
  const strip = page.locator(".nextis");
  await expect(strip.locator(".rcv img")).toHaveCount(1);
  await expect(strip.locator(".rcv img")).toHaveAttribute("alt", "");
  expect(await box(strip.locator(".rcv"))).toEqual({ width: 28, height: 42 });
  // The label beside it names the row; the cover is decorative.
  await expect(strip).toHaveAttribute("aria-label", /E2E Strip e2e-cv-with \(2002\) #1/);

  await openSpine(page, WITHOUT);
  await expect(strip.locator("img")).toHaveCount(0);
  await expect(strip.locator(".rcv")).toHaveText("1");
  expect(await box(strip.locator(".rcv"))).toEqual({ width: 28, height: 42 });
});

test("axe finds nothing on the spine, the Library or the strip; the placeholder text is 4.5:1 (AC-6)", async ({ page }) => {
  await fakeCovers(page);
  for (const scheme of ["light", "dark"] as const) {
    await page.emulateMedia({ colorScheme: scheme });
    // The boxes are on the page before axe runs, so a page without them cannot pass: the strip's cover and
    // the first row's, a placeholder with text, and (Library) a pending box.
    await openSpine(page, WITH);
    await expect(page.locator(".rcv img")).toHaveCount(2);   // the strip's and row 1's: #1 has a cover
    await expect(page.locator(".rcv.none")).toHaveText(["2"]); // row 2's placeholder, its number drawn
    await expectNoAxeViolations(page, AXE);
    expect(await contrastFailures(page), `spine ${scheme}`).toEqual([]);
    await openLibrary(page);
    await expect(page.locator(".rcv.none").first()).toHaveText(/\S/);
    await expect(page.locator(".rcv[data-enrich='pending']")).toHaveCount(1);
    await expectNoAxeViolations(page, AXE);
    expect(await contrastFailures(page), `library ${scheme}`).toEqual([]);
  }
});

// Sets its own viewports and themes: runs once, in w390-light.
test("the spine, the Library and the strip at 360, 834 and 1280px, light and dark (AC-6)", ONCE, async ({ page }, info) => {
  await fakeCovers(page);
  for (const colorScheme of ["light", "dark"] as const) {
    await page.emulateMedia({ colorScheme });
    for (const [width, height] of [[360, 780], [834, 1112], [1280, 800]]) {
      await page.setViewportSize({ width, height });
      await openSpine(page, WITH);
      await hydrated(page.locator(".iss .chk").first());
      await expectNoHorizontalScroll(page);
      // The box at every width, so the shots are of the covers: row 1 has one, row 2 its number, the strip's is row 1's.
      for (const sel of [".nextis .rcv", "#p-1 .rcv", "#p-2 .rcv"]) {
        expect(await box(page.locator(sel)), `${sel} at ${width}px`).toEqual({ width: 28, height: 42 });
      }
      await screenshot(page, info, `covers-spine-${width}-${colorScheme}`);
      await openLibrary(page);
      await expectNoHorizontalScroll(page);
      expect(await box(page.locator(".book-row .rcv").first()), `library cover at ${width}px`).toEqual({ width: 28, height: 42 });
      await screenshot(page, info, `covers-library-${width}-${colorScheme}`);
    }
  }
});
