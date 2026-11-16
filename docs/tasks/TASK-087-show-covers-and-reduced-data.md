---
id: TASK-087
title: 4.3 Covers in the UI (3 of 3) — Show covers, and no image requested when data is reduced
status: In progress
depends_on: [TASK-085, TASK-086, TASK-045]
size: M
model: sonnet
autonomy: attended
ui: true
plan_status: approved
planned_at_commit: b92a2b3
---

# TASK-087 — 4.3 Covers in the UI (3 of 3) — Show covers, and no image requested when data is reduced

## Goal

Covers can be turned off in Settings, and with them off, or with the device asking for reduced data, every cover is the plain placeholder and no image is downloaded.

## Context

- Roadmap: `docs/05-roadmap.md` § 4.3 Covers in the UI (M16). The entry and its **Check:** are the contract. Feature F-33. This part's merge ticks the entry.
- **Split, 3 of 3.** TASK-085 and TASK-086 put covers everywhere; this part switches them off.
- **The setting**: **Settings → Appearance → Show covers**, default on, beside 6.11's density toggle (6.11 isn't built; the plan places it where the `settings` mockup frame draws it, `powershell -NoProfile -File scripts/screen.ps1 settings`). *From TASK-045 (2.0, PR #193)*: 2.0 shipped Settings without it (owner, 2026-11-04), because nothing read it before covers were in the UI. `src/app/settings/page.tsx` has *Reading pace* and *Data* sections today and no *Appearance*.
- **Stop and ask at plan time: where *Show covers* is stored.** `reading_settings.show_covers boolean NOT NULL DEFAULT true` already exists (`src/db/schema.ts`), so the stored option needs no schema change; the other is a per-device cookie (turning covers off to save data is arguably a per-device choice). `docs/03-data-model.md` § 4.1 leaves it to this task. *Ambient colour* (`data-ambient="off"`) is stored wherever *Show covers* is, but arrives with the art tone, which stays deferred.
- **Off, or `prefers-reduced-data: reduce`**: every cover renders the placeholder (TASK-085's neutral box) and **no image is requested**: no `<img src>` in the markup, not merely hidden. Server-rendered rows can't see a media query, so the plan says how the reduced-data case requests nothing (for example a client hint, a cookie set on first visit, or rendering the `<img>` only after a client check), and the test emulates the media feature.
- Decisions: D-40, D-94. Hard rule 6.
- *From TASK-085 (4.3 part 1, PR #269):* every row now draws `RowCover` (`src/components/Cover.tsx`): a plain hotlinked `<img>` in a 28×42 box on the spine, the Library and the next-issue strip (D-154), so *Show covers* off and reduced data swap that one component's `<img>` for its placeholder. A cover that fails to load leaves an empty `--sunk` box with no text; on the dev Library 63 of 295 covers failed in one run (Open Library URLs that redirect to archive.org) and none in the next. When the plan makes the row cover check something on the client, a text fallback on a broken image (`onError`) belongs beside it. The run routes' Lighthouse budgets rose in 085 for the lazy images; with covers off they have the room.

## Acceptance criteria

- [ ] AC-1 (roadmap **Check:**, verbatim; this part proves *with `prefers-reduced-data: reduce` emulated, or Show covers off, the spine makes zero image requests*. TASK-085 and TASK-086 prove the rest): Lighthouse CLS under 0.1 on the books page. No cover placeholder
renders a gradient or an identity hue, and no row renders both an `.edge` and a
`.tag .sq`. On the spine, a row whose issue has a `cover_url` renders one
`<img loading="lazy" alt="">` inside a 28×42 box, and a row without one renders
the issue number in the same box. Swapping one for the other changes no row's
height (CLS under 0.1 on a 381-row spine). With `prefers-reduced-data: reduce`
emulated, or *Show covers* off, the spine makes zero image requests. No cover
element carries a `box-shadow` that resolves to `--halo`.
- [ ] AC-2: With *Show covers* off, a spine with covers, the Library and both dashboards make zero requests to any image host (counted in the browser), and every cover slot renders its placeholder at the same size; turning it back on shows the covers after a reload.
- [ ] AC-3: With `prefers-reduced-data: reduce` emulated and *Show covers* on, the spine makes zero image requests and renders placeholders.
- [ ] AC-4: The setting is a real switch (`role="switch"` or a checkbox) named *Show covers* in Settings → Appearance, default on; its value survives a reload and is stored where the plan gate settled (on `reading_settings.show_covers`, or a per-device cookie).
- [ ] AC-5: The Appearance section meets the UX floor (`docs/04-design.md` § 10. The UX floor): the switch 44px on the phone, its state not shown by colour alone, its saving and failed states drawn as Settings' other controls draw them; text 4.5:1 in both themes; axe reports no new violations; screenshots at 360px, 834px and 1280px, light and dark.

## Out of scope

- *Ambient colour* and the art tone (deferred with the tone columns).
- 6.11's density toggle.
- Lazy-loading or sizing rules (TASK-085, TASK-086).

## Files likely touched

- `src/app/settings/page.tsx` — the Appearance section.
- `src/lib/settings.ts`, `src/app/api/settings/route.ts` — reading and writing the switch (if stored on `reading_settings`).
- `src/components/Cover.tsx` — no `src` when off or reduced.
- `test/settings.test.tsx`, `test/e2e/settings.spec.ts`, `test/e2e/covers.spec.ts`.

## Verification

- Automated: `test/settings.test.tsx` (AC-4), `test/e2e/covers.spec.ts` (AC-1's clause, AC-2, AC-3 with `prefers-reduced-data` emulated and image requests counted), `test/e2e/settings.spec.ts` (AC-5's axe).
- Manual: on the preview, turn *Show covers* off, open a long spine with the network panel open → no image requests; turn it on → covers return.

## Follow-ups

_Work noticed during this task and deliberately left out. Each bullet ends `→ <path> § <section>` (where it was placed) or `→ not tracked: <reason>`. See `.claude/skills/track-follow-ups/classify.md`; the PR's Follow-ups section is copied from here._

- `reading_settings.show_covers` is left unused now that *Show covers* is a per-device cookie: say so in the data model and drop it with 6.18's column cleanup (approved at plan) → `docs/03-data-model.md` § 4.1, at close-out.
- Candidate decision: *Show covers* is per device, a cookie, with the reduced-data signals (`prefers-reduced-data`, Save-Data) checked on the client; covers render only after hydration (approved at plan; decisions mode `propose`, so the wording is shown at close-out) → `docs/review/decisions.md`, at close-out.

## Plan

*Approved 2026-11-16 (attended, Opus planning session; the owner chose Sonnet to implement).*

### Settled at the plan gate (owner, 2026-11-16)

- *Show covers* is stored in a **per-device cookie**, not `reading_settings.show_covers`. Cookie `ledger_covers`, value `off` when switched off; absent (or anything else) means on, the default. Same pattern as `ledger_medium` (`src/lib/last-medium.ts`, R1-13). Not `httpOnly` (the client reads it), `path=/`, `SameSite=Lax`, a year's `max-age`.
- Reduced data is **`(prefers-reduced-data: reduce)` or `navigator.connection.saveData`** (Save-Data is the signal browsers actually ship; no stable browser ships the media query yet).

### Approach

The server cannot see a media query, and covers render inside client components (`IssueRow`, `QueueShelf`), so the gate is on the client. One small client component draws every cover image: the server HTML always carries the placeholder and **no `<img>`**; after hydration it draws the `<img>` only when covers are on and the device is not asking for reduced data. `useSyncExternalStore` with a server snapshot of *not allowed* keeps hydration free of mismatches. A broken image (`onError`) falls back to the placeholder text (TASK-085's note).

### Steps

1. `src/lib/covers.ts` (new): `COVERS_COOKIE = "ledger_covers"`, its max-age, `coversOffIn(cookieString)` (parses `document.cookie`), `reducedData(win)` (the media query or `navigator.connection?.saveData === true`, each guarded for a missing `matchMedia` / `connection`), `coversAllowed(win, cookieString)`, and the `subscribe`/`getSnapshot`/`getServerSnapshot` trio for `useSyncExternalStore` (listens to the media query's `change`, and to a custom `ledger:covers` window event the switch dispatches after writing the cookie). Unit-testable without React.
2. `src/components/CoverImage.tsx` (new, `"use client"`): props `{ url, width, height, placeholder }`; renders `placeholder` when not allowed or after `onError`, else `<img src alt="" width height loading="lazy" decoding="async">`. `RowCover`, `ArtCover` and `Cover` in `src/components/Cover.tsx` route their `<img>` through it inside the same box, so on/off/broken changes no box size (the placeholder classes keep the 28×42 / 2:3 geometry: `RowCover` swaps `cv rcv` ↔ `cv rcv none` with its text; `ArtCover` `cv art` ↔ `cv none`; `Cover` `img.cv` ↔ `span.cv.none`). Keep the class each state already uses so existing CSS and tests hold; if a wrapper class has to move to the client component, do it there, not in CSS.
3. `src/components/ShowCovers.tsx` (new, `"use client"`): `<button type="button" role="switch" aria-checked className="switch">` named *Show covers* (visible label `.k`, as the mockup's `frow`), 44px (`.switch` already has `min-height:44px`); the knob's position shows the state, not colour alone. Initial state from the cookie read on the server (`cookies()` in the page, passed as a prop). A press flips it at once (optimistic, as the pace steppers), writes the cookie, reads it back, dispatches `ledger:covers`; if the cookie did not stick it reverts and raises the app's failed-write line with Retry (`useUndo().fail`, as `PaceSettings`). No separate saving state: the write is synchronous, the same optimistic draw the steppers use.
4. `src/app/settings/page.tsx`: an **Appearance** section (`<h2 className="s">Appearance</h2>` + `.group` + one `.frow` holding `ShowCovers`), placed where the `settings` mockup draws it: after *Reading pace* on the phone, above *Data* in the right column from 1024px. Theme and Density stay out (not this task; 6.11). Update the page's doc comment.
5. Tests (write each first and see it fail):
   - `test/covers.test.tsx` (new, vitest/jsdom): `coversOffIn` (absent/`off`/other), `reducedData` (media query match, `saveData: true`, neither, no `matchMedia`), `coversAllowed`; server HTML (`renderToStaticMarkup`) of `RowCover`/`ArtCover`/`Cover` with a url has **no `<img`** and has the placeholder; a client render (`@testing-library/react`) draws exactly one `<img loading="lazy" alt="">` when allowed, the placeholder when the cookie is `off`, when reduced data matches, and after the image's `error` event.
   - `test/spine.test.tsx`: TASK-085's *"a row whose issue has a cover_url renders exactly one 28×42 lazy decorative `<img>`"* reads server HTML; change it to *server HTML has the placeholder box and no `<img>`*, with the `<img>` attributes proved by the client render in `test/covers.test.tsx` and in the browser by `test/e2e/covers.spec.ts` (the roadmap Check still holds in the browser). Check `test/add-book-sheet.test.tsx:617` and `test/issue-search.test.tsx:215` still pass (client renders; `matchMedia` absent in jsdom must read as *allowed*).
   - `test/settings.test.tsx` (AC-4): the switch renders `role="switch"` named *Show covers*, `aria-checked="true"` with no cookie, `false` with `ledger_covers=off`; a press writes/clears the cookie and flips `aria-checked`; a cookie that doesn't stick reverts and calls the failed line.
   - `test/e2e/covers.spec.ts`: AC-2: set the cookie `ledger_covers=off` (or press the switch), then on a spine with covers, the Library, `/comics` and `/books`, count requests with `resourceType() === "image"` to any non-app host (`page.on("request")`) after scrolling the page end to end: zero, and every cover slot is its placeholder at the same box size; clear it (switch back on), reload, covers draw. AC-1 clause / AC-3: in a `test.describe` with `test.use({ launchOptions: { args: ["--enable-blink-features=PrefersReducedData"] } })` (stock Chromium ignores the feature even under DevTools emulation; probed 2026-11-16), emulate via CDP `Emulation.setEmulatedMedia` `features: [{ name: "prefers-reduced-data", value: "reduce" }]` with covers on: the spine makes zero image requests and draws placeholders. Also a Save-Data case (`addInitScript` defining `navigator.connection.saveData = true`).
   - `test/e2e/settings.spec.ts` (AC-5): the Appearance section with axe (no new violations), the switch's box ≥ 44px tall at 360px, the label 4.5:1 in both themes, a press survives a reload, screenshots at 360, 834 and 1280px light and dark.
6. Grep `test/`, `etl/test_*.py`, `etl/test_views.sql` for anything pinning the cover markup (`img.cv`, `cv rcv`, `<img`) and fix what the change moves. `docs/COMMANDS.md`/`kit.json` need no change.

### Files

- `src/lib/covers.ts` (new) — the cookie and the reduced-data gate.
- `src/components/CoverImage.tsx` (new) — the one client component that may draw a cover `<img>`.
- `src/components/Cover.tsx` — `RowCover`, `ArtCover`, `Cover` draw through it.
- `src/components/ShowCovers.tsx` (new) — the switch. *(not in Files likely touched)*
- `src/app/settings/page.tsx` — the Appearance section.
- `src/app/globals.css` — only if the Appearance row needs a rule the existing `.frow` / `.switch` don't give. *(not in Files likely touched)*
- `test/covers.test.tsx` (new), `test/spine.test.tsx`, `test/settings.test.tsx`, `test/e2e/covers.spec.ts`, `test/e2e/settings.spec.ts`.
- Not touched: `src/lib/settings.ts` and `src/app/api/settings/route.ts` (the cookie needs no route); no schema change; `design/mockups.html` already draws *Show covers* in Appearance, so no redraw.

### Test strategy

- AC-1 (this part's clause: reduced data or off → zero image requests on the spine): `test/e2e/covers.spec.ts` *with Show covers off …* and *with prefers-reduced-data emulated …*.
- AC-2: `test/e2e/covers.spec.ts` *with Show covers off, the spine, the Library and both dashboards request no image and draw placeholders at the same size; on again after a reload, covers draw*.
- AC-3: `test/e2e/covers.spec.ts` *with prefers-reduced-data: reduce emulated and covers on, the spine requests no image*; unit cover in `test/covers.test.tsx`.
- AC-4: `test/settings.test.tsx` *the Show covers switch* (default on, cookie stored, survives); `test/e2e/settings.spec.ts` reload case.
- AC-5: `test/e2e/settings.spec.ts` (axe, 44px, contrast, screenshots); failed state in `test/settings.test.tsx`.

### Risks / open questions

- Covers now arrive after hydration, not in the server HTML. On `/books` the hero cover may be the LCP element; it is already `loading="lazy"`. The Lighthouse gate decides; if a budget breaks, say so rather than raising it silently.
- The reduced-data browser test needs the `PrefersReducedData` Blink feature at launch; a per-file `test.use({ launchOptions })` forces its own worker. If the e2e harness's fixtures fight it, ask before adding a Playwright project.
- `useSyncExternalStore`'s server snapshot is *not allowed*, so the first client render after hydration flips to images: no hydration warning expected; check the console in the e2e run.
- **Size:** 4–5 source files and 5 test files, UI only, no schema. Over the 8-file line counting tests; kept whole because it is part 3 of 3 of an already-split entry (owner approved at the gate).

## Review log

_Filled by /implement-task. One line per round._

## Blocked

_Only if status is Blocked: what failed, what was tried, best hypothesis, decision needed._

## Metrics

- Verify rounds:
- Review rounds:
- First-pass AC FAILs:
- Plan revisions after approval:
