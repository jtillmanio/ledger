// Task 4.3, part 2 of 3 (TASK-086, F-33; D-40, STYLE_GUIDE § 4.2, § 7): covers at the feel pass's sizes on the
// dashboards, in a browser. The books hero (`--cover-hero`: 112px, 150 from 768, 168 from 1280), *Between books*
// (the last finish at 72, the offer at 36), the Up next shelves on both dashboards (`--cover-shelf` 112), the
// On deck, comics queue and books quarter rows (`--cover-row` 36): each a 2:3 box with the radius and the lift
// of a cover, the image lazy with explicit `width` and `height` and `alt=""`, or the neutral placeholder in the
// same box, so a cover arriving moves nothing. A cover is data: no gradient, no identity hue, nothing that
// resolves to `--halo`, never tinted, in light and dark (every project). Every state with covers and with
// placeholders is screenshotted in every project; reduced motion is its own project, reduced transparency and
// the 1440px content box run once. No outside request is made: the cover host is fake, answered by `page.route`.
//
// The dashboards read the whole user, so the books are made here under `e2e-dc-` ids and removed after each
// test; any in-progress book is parked as To read and put back after (as books-dashboard.spec.ts does).
import { expect, test, type Locator, type Page } from "@playwright/test";
import { E2E_USER } from "../../scripts/lib/e2e.mjs";
import { today } from "../../src/lib/finish-date";
import { testSql, type TestSql } from "../db";
import { contrastFailures, expectNoAxeViolations, expectNoHorizontalScroll, screenshot, tokenColour } from "./helpers";

// A check with no layout in it, or one that sets its own viewport: runs once, in w390-light.
const ONCE = { tag: "@at-w390-light" };

const AXE = [
  "image-alt", "button-name", "link-name", "color-contrast", "aria-allowed-attr", "aria-hidden-focus", "landmark-unique",
  "duplicate-id-aria", "target-size", "heading-order", "list", "listitem",
];

const HOST = "https://covers.e2e.test";
// A one-pixel PNG: what the fake cover host answers every cover request with.
const PIXEL = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==", "base64",
);

const DAY = today();
const YEAR = Number(DAY.slice(0, 4));
const Q = Math.floor((Number(DAY.slice(5, 7)) - 1) / 3) + 1;
const PERIOD = `${YEAR}-Q${Q}`;
const daysAgo = (n: number) => new Date(Date.parse(`${DAY}T12:00:00Z`) - n * 86_400_000).toISOString().slice(0, 10);

type State = "reading" | "listening" | "between" | "never";
const STATES: State[] = ["reading", "listening", "between", "never"];

async function withSql<T>(work: (sql: TestSql) => Promise<T>): Promise<T> {
  const sql = testSql();
  try {
    return await work(sql);
  } finally {
    await sql.end();
  }
}

const RUNS = ["e2e-dc-run-1", "e2e-dc-run-2", "e2e-dc-run-3"];

const clean = () => withSql(async (sql) => {
  await sql`DELETE FROM run_queue WHERE user_id = ${E2E_USER} AND run_id = ANY(${RUNS}::text[])`;
  await sql`DELETE FROM run_issues WHERE run_id = ANY(${RUNS}::text[])`;
  await sql`DELETE FROM issues WHERE id LIKE 'e2e-dc-%'`;
  await sql`DELETE FROM runs WHERE id = ANY(${RUNS}::text[])`;
  await sql`DELETE FROM books WHERE id LIKE 'e2e-dc-%'`;
});

let parked: { book_id: string; status: string }[] = [];
test.beforeAll(async () => {
  await clean();
  parked = await withSql(async (sql) => {
    const rows = await sql<{ book_id: string; status: string }[]>`
      SELECT book_id, status FROM book_status WHERE user_id = ${E2E_USER} AND status IN ('reading', 'listening')`;
    await sql`UPDATE book_status SET status = 'to_read' WHERE user_id = ${E2E_USER} AND status IN ('reading', 'listening')`;
    return rows;
  });
});
test.afterAll(async () => {
  await clean();
  await withSql(async (sql) => {
    for (const p of parked) await sql`UPDATE book_status SET status = ${p.status} WHERE user_id = ${E2E_USER} AND book_id = ${p.book_id}`;
  });
});
test.afterEach(clean);

/** The fake host answers every cover; nothing leaves the machine. */
async function fakeCovers(page: Page) {
  await page.route(`${HOST}/**`, (route) => route.fulfill({ status: 200, contentType: "image/png", body: PIXEL }));
}

/**
 * The books fixture, by state. The quarter holds three books (not in `never`: an empty shelf), two more are On
 * deck, and the state adds the hero (reading, listening) or the last finish (between). `cover` gives every book
 * a cover url, or none.
 */
async function seedBooks(state: State, cover: boolean) {
  await withSql(async (sql) => {
    const book = (id: string, title: string) =>
      sql`INSERT INTO books (id, title, word_count, word_count_source, page_count, cover_url)
          VALUES (${id}, ${title}, 90000, 'stated', 300, ${cover ? `${HOST}/${id}.png` : null})`;
    const status = (id: string, s: string, started: string | null = null) =>
      sql`INSERT INTO book_status (user_id, book_id, status, started_on, started_on_precision)
          VALUES (${E2E_USER}, ${id}, ${s}, ${started}, ${started ? "exact" : "none"})`;
    const plan = (id: string, period: string, ordinal: number | null) =>
      sql`INSERT INTO reading_plan (user_id, book_id, period, ordinal) VALUES (${E2E_USER}, ${id}, ${period}, ${ordinal})`;

    if (state !== "never") {
      for (const n of [1, 2, 3]) {
        await book(`e2e-dc-q${n}`, `E2E DC Quarter ${n} and the Long Title`);
        await status(`e2e-dc-q${n}`, "to_read");
        await plan(`e2e-dc-q${n}`, PERIOD, n);
      }
    }
    for (const n of [1, 2]) {
      await book(`e2e-dc-deck-${n}`, `E2E DC Deck ${n}`);
      await status(`e2e-dc-deck-${n}`, "to_read");
      await plan(`e2e-dc-deck-${n}`, "on_deck", null);
    }
    if (state === "reading" || state === "listening") {
      await book("e2e-dc-hero", "E2E DC Hero");
      await status("e2e-dc-hero", state, daysAgo(14));
    }
    if (state === "between") {
      await book("e2e-dc-last", "E2E DC Last Finish");
      await sql`INSERT INTO read_events (user_id, book_id, finished_on, finished_on_precision, started_on, started_on_precision, format)
                VALUES (${E2E_USER}, 'e2e-dc-last', ${daysAgo(2)}, 'exact', ${daysAgo(11)}, 'exact', 'text')`;
      await sql`INSERT INTO book_status (user_id, book_id, status, finished_on, finished_on_precision)
                VALUES (${E2E_USER}, 'e2e-dc-last', 'read', ${daysAgo(2)}, 'exact')`;
    }
  });
}

/**
 * The comics fixture: three queued runs of two issues each. Run 1's first issue has no cover and its second
 * has one (the run's cover is the first placement with one, so the second); run 2's first has one; run 3 has
 * none. `cover` false drops every cover.
 */
async function seedComics(cover: boolean) {
  await withSql(async (sql) => {
    for (const [i, id] of RUNS.entries()) {
      await sql`INSERT INTO runs (id, title) VALUES (${id}, ${`E2E DC Run ${i + 1}`})`;
      for (const n of [1, 2]) {
        const url = cover && ((i === 0 && n === 2) || (i === 1 && n === 1)) ? `${HOST}/dc-run-${i + 1}-${n}.png` : null;
        await sql`INSERT INTO issues (id, label, cover_url) VALUES (${`e2e-dc-i${i + 1}-${n}`}, ${`E2E DC Comic ${i + 1} (2003) #${n}`}, ${url})`;
        await sql`INSERT INTO run_issues (run_id, sequence, issue_id) VALUES (${id}, ${n}, ${`e2e-dc-i${i + 1}-${n}`})`;
      }
      await sql`INSERT INTO run_queue (user_id, run_id, ordinal) VALUES (${E2E_USER}, ${id}, ${i + 1})`;
    }
  });
}

const openBooks = async (page: Page) => {
  await page.goto("/books");
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("Books");
};
const openComics = async (page: Page) => {
  await page.goto("/comics");
  await expect(page.getByRole("heading", { level: 2, name: "Up next" })).toBeVisible();
};

const heroWidth = (page: Page) => {
  const w = page.viewportSize()!.width;
  return w >= 1280 ? 168 : w >= 768 ? 150 : 112;
};

/** A box's size, rounded to a hundredth. */
async function size(loc: Locator) {
  await loc.waitFor({ state: "visible" });
  const b = await loc.boundingBox();
  if (!b) throw new Error("no box");
  return { width: Math.round(b.width * 100) / 100, height: Math.round(b.height * 100) / 100 };
}

/** A 2:3 box `w` wide. */
async function expectCoverBox(loc: Locator, w: number, what: string) {
  const got = await size(loc);
  expect(got.width, `${what} width`).toBeCloseTo(w, 1);
  expect(got.height, `${what} height`).toBeCloseTo(w * 1.5, 0);
}

/** A cover image: lazy, async, decorative, its width and height set so the browser reserves the box. */
async function expectCoverImg(img: Locator, w: number, what: string) {
  await expect(img, what).toHaveCount(1);
  await expect(img, what).toHaveAttribute("loading", "lazy");
  await expect(img, what).toHaveAttribute("decoding", "async");
  await expect(img, what).toHaveAttribute("alt", "");
  await expect(img, what).toHaveAttribute("width", String(w));
  await expect(img, what).toHaveAttribute("height", String(w * 1.5));
}

/** One slot's cover: the image in the box with a cover, the neutral placeholder in the same box without. */
async function expectSlot(box: Locator, w: number, cover: boolean, what: string, attr = w) {
  await expectCoverBox(box, w, what);
  const cv = box.locator(".cv");
  await expect(cv, `${what}: one cover box`).toHaveCount(1);
  if (cover) {
    await expect(cv).toHaveClass(/\bart\b/);
    await expectCoverImg(cv.locator("img"), attr, what);
  } else {
    await expect(cv).toHaveClass(/\bnone\b/);
    await expect(cv.locator("img"), `${what}: no image`).toHaveCount(0);
  }
}

/** A computed `box-shadow` value for a token, as the page resolves it. */
function shadowOf(page: Page, token: string) {
  return page.evaluate((t) => {
    const probe = document.createElement("i");
    probe.style.boxShadow = `var(${t})`;
    document.body.append(probe);
    const resolved = getComputedStyle(probe).boxShadow;
    probe.remove();
    return resolved;
  }, token);
}

/**
 * A cover is data (STYLE_GUIDE § 7): every cover box and image on the page, in the page's own theme, has no
 * gradient, a background that is --sunk or none (never an identity hue), no filter, blend or fade, and no
 * shadow containing --halo's; the boxes that lift a cover carry --sh-cover.
 */
async function expectCoversAreData(page: Page) {
  const sunk = await tokenColour(page, "--sunk");
  const halo = await shadowOf(page, "--halo");
  const lift = await shadowOf(page, "--sh-cover");
  const identity = await Promise.all([1, 2, 3, 4, 5, 6, 7, 8].flatMap((n) => [tokenColour(page, `--t${n}`), tokenColour(page, `--g${n}`)]));
  expect(halo).not.toBe("none");
  const found = await page.evaluate(({ sunkColour, haloShadow, identityColours }) => {
    const bad: string[] = [];
    const els = [...document.querySelectorAll("main .cv, main .cv img, .now-cover, .between-cover, .shelf .cover")];
    for (const el of els) {
      const cs = getComputedStyle(el);
      const name = `${el.tagName.toLowerCase()}.${el.className}`;
      if (cs.backgroundImage !== "none") bad.push(`${name} background-image ${cs.backgroundImage}`);
      if (!["rgba(0, 0, 0, 0)", sunkColour].includes(cs.backgroundColor)) bad.push(`${name} background ${cs.backgroundColor}`);
      if (identityColours.includes(cs.backgroundColor)) bad.push(`${name} identity hue ${cs.backgroundColor}`);
      if (cs.boxShadow.includes(haloShadow)) bad.push(`${name} halo`);
      if (el.tagName === "IMG" && (cs.filter !== "none" || cs.mixBlendMode !== "normal" || cs.opacity !== "1")) bad.push(`${name} tinted`);
    }
    return { checked: els.length, bad };
  }, { sunkColour: sunk, haloShadow: halo, identityColours: identity });
  expect(found.checked, "there are covers on the page").toBeGreaterThan(0);
  expect(found.bad, "every cover is data").toEqual([]);
  return lift;
}

/** The boxes that lift a cover draw --sh-cover and the cover's radius. */
async function expectLift(loc: Locator, lift: string, radius: number) {
  const cs = await loc.first().evaluate((el) => {
    const s = getComputedStyle(el);
    return { shadow: s.boxShadow, radius: parseFloat(s.borderTopLeftRadius) };
  });
  expect(cs.shadow).toBe(lift);
  expect(cs.radius).toBe(radius);
}

/** Every element's drawn colours: none is --danger's (§12: nothing on a dashboard is red). */
async function expectNoDanger(page: Page) {
  const danger = await tokenColour(page, "--danger");
  const hits = await page.evaluate((red) => {
    const props = ["color", "background-color", "border-top-color", "border-right-color", "border-bottom-color",
      "border-left-color", "outline-color", "fill", "stroke"];
    const out: string[] = [];
    for (const el of document.body.querySelectorAll("*")) {
      const cs = getComputedStyle(el);
      if (cs.display === "none") continue;
      for (const p of props) {
        if (cs.getPropertyValue(p) !== red) continue;
        if (p.startsWith("border") && parseFloat(cs.getPropertyValue(p.replace("color", "width"))) === 0) continue;
        if (p === "outline-color" && cs.outlineStyle === "none") continue;
        out.push(`${el.tagName.toLowerCase()}.${el.className} ${p}`);
      }
    }
    return out;
  }, danger);
  expect(hits, "nothing resolves to --danger").toEqual([]);
}

async function floor(page: Page) {
  await expectNoHorizontalScroll(page);
  await expectNoDanger(page);
  await expectNoAxeViolations(page, AXE);
  expect(await contrastFailures(page)).toEqual([]);
}

for (const cover of [true, false]) {
  const variant = cover ? "covers" : "placeholders";

  test.describe(`books dashboard, ${variant}`, () => {
    for (const state of STATES) {
      test(`${state}: every cover slot is its box, the image or the placeholder, and a cover is data (AC-2, AC-3, AC-4, AC-5)`, async ({ page }, info) => {
        await seedBooks(state, cover);
        await fakeCovers(page);
        await openBooks(page);
        const lift = await expectCoversAreData(page);

        if (state === "reading" || state === "listening") {
          await expect(page.locator(".now-kick")).toHaveText(state === "reading" ? "Reading now" : "Listening now");
          const hero = page.locator(".now-cover");
          await expectSlot(hero, heroWidth(page), cover, "hero", 112);
          await expectLift(hero, lift, 4);
        }
        if (state === "between") {
          const last = page.locator(".between-cover");
          await expectSlot(last, page.viewportSize()!.width >= 768 ? 112 : 72, cover, "last finish", 72);
          await expectLift(last, lift, 4);
          const offer = page.locator(".between-offer > .cv");
          await expect(offer).toHaveCount(1);
          await expectCoverBox(offer, 36, "offer");
          await expect(offer.locator("img")).toHaveCount(cover ? 1 : 0);
          if (cover) await expectCoverImg(offer.locator("img"), 36, "offer");
          await expectLift(offer, lift, 4);
        }
        if (state === "never") {
          await expect(page.locator(".between-cover")).toHaveCount(0);
          await expect(page.locator('[data-slot="next"] .slate')).toBeVisible();   // the shelf is empty
          await expect(page.locator(".shelf .card")).toHaveCount(0);
        } else {
          const cards = page.locator('[data-slot="next"] .shelf .card .cover');
          await expect(cards).toHaveCount(3);
          for (const c of await cards.all()) {
            await expectSlot(c, 112, cover, "shelf");
            await expectLift(c, lift, 4);
          }
        }
        const rows = page.locator(".deck-row");
        await expect(rows).toHaveCount(2);
        for (const r of await rows.all()) {
          const cv = r.locator(".cv");
          await expectCoverBox(cv, 36, "On deck row");
          await expect(cv.locator("img")).toHaveCount(cover ? 1 : 0);
          if (cover) await expectCoverImg(cv.locator("img"), 36, "On deck row");
          await expectLift(cv, lift, 4);
        }
        await floor(page);
        await screenshot(page, info, `dc-books-${state}-${variant}`);
      });
    }

    test("the books status screen's quarter rows draw the book's cover or the placeholder at 36px (AC-3)", async ({ page }, info) => {
      await seedBooks("reading", cover);
      await fakeCovers(page);
      await page.goto("/books/status?tab=next");
      const rows = page.locator(".qrow").filter({ hasText: "E2E DC Quarter" });
      await expect(rows).toHaveCount(3);
      for (const r of await rows.all()) {
        const cv = r.locator(".cv");
        await expectCoverBox(cv, 36, "quarter row");
        await expect(cv.locator("img")).toHaveCount(cover ? 1 : 0);
        if (cover) await expectCoverImg(cv.locator("img"), 36, "quarter row");
      }
      await expectCoversAreData(page);
      await expectNoHorizontalScroll(page);
      await screenshot(page, info, `dc-books-status-${variant}`);
    });
  });

  test.describe(`comics dashboard, ${variant}`, () => {
    test("the Up next shelf draws each run's cover at 112px and the queue rows at 36px (AC-3, AC-4, AC-5)", async ({ page }, info) => {
      await seedComics(cover);
      await fakeCovers(page);
      await openComics(page);
      const lift = await expectCoversAreData(page);

      const cards = page.locator(".shelf .card").filter({ hasText: "E2E DC Run" });
      await expect(cards).toHaveCount(3);
      // The run's cover is its first placement with one: run 1's second issue, run 2's first, run 3 none.
      const urls = [`${HOST}/dc-run-1-2.png`, `${HOST}/dc-run-2-1.png`, null];
      for (const [i, card] of (await cards.all()).entries()) {
        const box = card.locator(".cover");
        const has = cover && urls[i] !== null;
        await expectSlot(box, 112, has, `shelf card ${i + 1}`);
        await expectLift(box, lift, 4);
        if (has) await expect(box.locator("img")).toHaveAttribute("src", urls[i]!);
      }
      await floor(page);
      await screenshot(page, info, `dc-comics-shelf-${variant}`);

      await page.goto("/comics/status?tab=next");
      const rows = page.locator(".qrow").filter({ hasText: "E2E DC Run" });
      await expect(rows).toHaveCount(3);
      for (const [i, row] of (await rows.all()).entries()) {
        const cv = row.locator(".cv");
        const has = cover && urls[i] !== null;
        await expectCoverBox(cv, 36, `queue row ${i + 1}`);
        await expect(cv.locator("img")).toHaveCount(has ? 1 : 0);
        if (has) {
          await expectCoverImg(cv.locator("img"), 36, `queue row ${i + 1}`);
          await expect(cv.locator("img")).toHaveAttribute("src", urls[i]!);
        }
        await expectLift(cv, lift, 4);
      }
      await expectCoversAreData(page);
      await expectNoHorizontalScroll(page);
      await screenshot(page, info, `dc-comics-queue-${variant}`);
    });
  });
}

test("a cover arriving moves nothing: the hero, the shelf and the On deck list are the same height with and without covers (AC-2)", async ({ page }) => {
  await seedBooks("reading", true);
  await fakeCovers(page);
  const measure = async () => {
    await openBooks(page);
    await expect(page.locator(".now-cover .cv")).toHaveCount(1);
    return {
      band: (await size(page.locator(".now-band"))).height,
      hero: (await size(page.locator(".now-hero"))).height,
      shelf: (await size(page.locator(".shelf"))).height,
      deck: (await size(page.locator(".deck-list"))).height,
      cover: await size(page.locator(".now-cover")),
    };
  };
  const withCover = await measure();
  await expect(page.locator(".now-cover img")).toHaveCount(1);
  await withSql((sql) => sql`UPDATE books SET cover_url = NULL WHERE id LIKE 'e2e-dc-%'`);
  const without = await measure();
  await expect(page.locator(".now-cover img")).toHaveCount(0);
  expect(without).toEqual(withCover);
  expect(withCover.cover.width).toBe(heroWidth(page));
});

// Sets its own viewport: runs once. At 360px a three-line title makes the text band taller than the cover.
test("a long title wrapping beside the hero does not stretch the cover off 2:3 (AC-2)", ONCE, async ({ page }) => {
  await page.setViewportSize({ width: 360, height: 780 });
  await seedBooks("reading", true);
  await withSql((sql) => sql`UPDATE books SET title = ${"E2E DC Hero and a Title Long Enough to Wrap Over Many Lines Beside the Cover at Phone Width and Then Some More"} WHERE id = 'e2e-dc-hero'`);
  await fakeCovers(page);
  await openBooks(page);
  const cover = page.locator(".now-cover");
  await expectCoverBox(cover, heroWidth(page), "hero beside a long title");
  // The text band is taller than the cover at phone width, so the band is what could stretch it.
  const band = await size(page.locator(".now-band"));
  expect(band.height).toBeGreaterThanOrEqual((await size(cover)).height);
});

// Sets its own viewport: runs once. The UX floor's reduced-transparency pass: the glass is solid --surface and
// the covers are drawn the same, on both dashboards.
test("reduced transparency: the glass is solid --surface and the covers are still data, at 390 and 1280 (AC-5)", ONCE, async ({ page, context }, info) => {
  await seedBooks("reading", true);
  await seedComics(true);
  await fakeCovers(page);
  const cdp = await context.newCDPSession(page);
  await cdp.send("Emulation.setEmulatedMedia", { features: [{ name: "prefers-reduced-transparency", value: "reduce" }] });
  for (const [width, glass] of [[390, ".bar"], [1280, ".pagehead"]] as const) {
    await page.setViewportSize({ width, height: 900 });
    for (const [name, open] of [["books", openBooks], ["comics", openComics]] as const) {
      await open(page);
      const surface = await tokenColour(page, "--surface");
      await expect.poll(() => page.locator(glass).first().evaluate((el) => getComputedStyle(el).backgroundColor)).toBe(surface);
      expect(await page.locator(glass).first().evaluate((el) => getComputedStyle(el).backdropFilter)).toBe("none");
      await expectCoversAreData(page);
      await expectNoHorizontalScroll(page);
      await screenshot(page, info, `dc-${name}-reduced-transparency-${width}`);
    }
  }
});

// Sets its own viewport: runs once. At 1440 the content box stays 1056px with the covers in it.
test("at 1440 the content box is 1056px with covers on both dashboards (AC-5)", ONCE, async ({ page }, info) => {
  await seedBooks("reading", true);
  await seedComics(true);
  await fakeCovers(page);
  await page.setViewportSize({ width: 1440, height: 900 });
  for (const [name, open] of [["books", openBooks], ["comics", openComics]] as const) {
    await open(page);
    expect((await page.locator(".content").boundingBox())!.width, name).toBe(1056);
    await expectNoHorizontalScroll(page);
    await screenshot(page, info, `dc-${name}-1440`);
  }
});
