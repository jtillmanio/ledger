# Feel pass — implementation checklist

Work top to bottom. Each step is one PR-sized change with its own commit. "Done when" is the acceptance test.

Spec references: STYLE_GUIDE §14 (screens and behaviour), §15 (copy), §16 (departures), §6 (contrast). Mockups: `mockups/Ledger Feel Review.dc.html`. Open it in a browser; section numbers below refer to it.

## 0 · Record
**Status:** done with D-40 (`chore/feel-pass-d40`). The palette swaps and the contrast report stayed in `design/handoff/`, where D-40 names them.

- [ ] Copy `design/handoff/` contents into the repo's `design/` (tokens.css, STYLE_GUIDE.md, mockups/, palette-swaps.css, contrast-report.md, contrast-metrics.json).
- [ ] Append D-40 (`D-40.md`) to decisions.md, with the palette letter filled in.
- [ ] Update `docs/DESIGN.md` (the D-31 index) to list the feel-pass files.

**Done when** decisions.md has D-40 and DESIGN.md points at §14–§16.

## 1 · Tokens
**Status:** done with D-40. The ±0.05 check widens to ±1.2% above about 4:1, because the report measured oklch sources and 8-bit hex moves high ratios by up to 1% (`scripts/check-tokens.mjs`).

- [ ] Merge `design/tokens.css` into `src/app/globals.css`. Keep every existing name and add the new ones: `--display`, `--art`, `--sh-cover`, `--r-cover`, `--r-hero`, `--dur-hold`, `--dur-fill`, `--toast-muted`, `--fs-hero-name`, `--fs-hero-num`, `--cover-hero`, `--cover-shelf`, `--cover-row`. Add the 768px `--cover-hero` step.
- [ ] If the palette isn't 1b, swap the two colour blocks plus `--halo` and `--glass-bg` from `palette-swaps.css`.
- [ ] `npm run test:tokens`. Add pairs for `--toast-muted` on `--toast-bg`, plus a check that `--ink`, `--ink-2` and `--muted` keep 4.5 on the clamp extremes of `--art` (dark `oklch(.30 .06 h)`, light `oklch(.92 .035 h)`, sweeping h every 30°).

**Done when** the tests are green and the numbers match `contrast-report.md` to ±0.05.

## 2 · Fonts
**Status:** done with D-40, as `@font-face` in `globals.css` (bundled into `/_next/static/media`, outside the passcode gate), not `next/font/local`, which renames the families.

- [ ] Self-host IBM Plex Sans (400/500/600/700), IBM Plex Mono (400/500/600) and Newsreader (opsz variable, 400/500, roman and italic) as woff2, latin subset. All three are OFL: commit the licence files.
- [ ] Load them with `next/font/local` (or `@font-face` in globals.css) and point `--sans`, `--mono` and `--display` at them. Use `font-display: swap`, and preload Plex Sans 400/600 only.
- [ ] Remove Inter Tight and JetBrains Mono.

**Done when** a production build makes zero requests to fonts.googleapis.com, fonts.gstatic.com or any other external host. Check the network panel.

## 3 · Icons
**Now in:** TASKS 1.8 (inline sprite). `src/` has no icons yet, so the grep is already empty.

- [ ] Replace every CDN icon mask with a local sprite (`public/icons.svg` with `<symbol>`s) or inline SVG components. The set: search, check, chevron-left, ellipsis, book-open, book, tv, calendar, activity, settings, plus any already in use. Lucide is ISC: keep the notice.
- [ ] Icons are `aria-hidden`, and their buttons keep their `aria-label`s.

**Done when** `grep -r "unpkg\|lucide-static\|cdn" src/` is empty.

## 4 · Cover art tone (`--art`)
**Now in:** TASKS 4.3 (issues) and 4.2 (books). A schema change, deferred by the owner: asked again there.

- [ ] At cover ingest, never at render: downsample the cover (about 32 × 48), average in OKLab while skipping near-black (L < .12) and near-white (L > .95) pixels, then convert to oklch.
- [ ] Clamp to two strings: dark `oklch(min(L,.30) min(C,.06) h)` and light `oklch(max(L,.92) min(C,.035) h)`. Store them with the cover record (for example `art_d`, `art_l`; follow the schema conventions). If either is missing, render nothing and let `--surface` take over.
- [ ] Add a one-off backfill for covers already stored.
- [ ] Unit-test the clamp, including greyscale and missing art.
- [ ] Add a setting or attribute for `data-ambient="off"` on `.app`.

**Done when** every run with a cover has both strings and the clamp tests pass.

## 5 · P1 + P3 — /comics (mockup §2, §10c for tablet)
**Now in:** TASKS 2.4, with 1.6 (the pointer) and 1.10 (the shelf). *Coming out* waits for 5.8.

- [ ] Rebuild slot 1 as the hero (§14.1): art band, cover, hero number, story, run, the *This stretch* lens (24 cells, one per issue, run-relative), the *Since Tuesday* stack and count, and *Also reading* as one row.
- [ ] Slot 2: the Up next shelf with numbered covers, unchanged badges, Start on the first card, and Reorder opening the existing drag or keyboard list.
- [ ] Slot 3: the telescope card, unchanged.
- [ ] Slot 4: *Ready when you are*, three rows at most.
- [ ] Slot 5: *2026 so far*.
- [ ] Remove *Rest of block 1*, *The frontier*, and the provenance line (move it to Stats).
- [ ] Empty states: *All caught up* (mockup §10a, FP-D13).

**Done when** it matches the mockup at 390 in dark and light, and the five slots are in order.

## 6 · P1 + P3 — /books and /watch (mockup §4, §5)
**Now in:** TASKS 2.2 (and 2.2b) and 8.7. Both carry open questions (DESIGN.md §9).

- [ ] Books: Now is the book in hand, or *Between books*. Position is the single-quarter strip (FP-D8). Then the Up next shelf, On deck, and the rollup.
- [ ] Watch: Now is a 16:9 still with the episode strip, then the shelf, the 2-rail telescope, grey *Paused* rows (untouched more than 4 weeks), and the rollup.

## 7 · P2 — the mark answers back (mockup §3, STYLE_GUIDE §14.3)
**Now in:** TASKS 1.8b, with 1.2's toast copy.

- [ ] One small client component around the thumb-bar mark button. It owns rest → press → confirm → next, holding confirm for `--dur-hold`. It calls the existing optimistic mark action.
- [ ] CSS keyframes for the lens fill, count tick, cover slide, toast enter and toast countdown, all on `--dur-*` and `--ease-out`.
- [ ] Toast: `role="status"`, two lines (`--toast-muted` for the second), Undo reversing every step, and an 8s countdown that pauses on hover or focus.
- [ ] Use it on the dashboard and on run detail.

**Done when** the states match the storyboard and, with reduced motion on, every state appears with no movement and the green hold is still visible.

## 8 · P6 — finished things stay visible (mockup §7, §10b)
**Now in:** TASKS 2.12 (new), `run_opens` in 2.6, read runs on the tracks page in 5.2.

- [ ] Run-complete state on the run page after the last mark: the rail fills once over `--dur-fill`, the badge is grey, plus *What this opened* and the closing line.
- [ ] **"What this opened" query:** runs that have the finished run as a prerequisite, and whose readiness (from the existing readiness view) is now `ready_hard` or `ready_all`. Order: same block first, then queue position, then track order. Return the count plus the first 3 for the screen. The *opens N* figure on run rows should come from the same query.
- [ ] Block-complete state (FP-D14), shown when the finished run was the block's last unread run.
- [ ] Read runs stay on the track page as a shelf.

## 9 · P7 — copy (STYLE_GUIDE §15)
**Now in:** each string's own task (DESIGN.md §9).

- [ ] Apply the table across dashboards, toasts, empty states and completion. Change no copy that isn't in the table.

## 10 · Tablet 768–1023 (D-33, mockup §10c, STYLE_GUIDE §14.5)
**Now in:** TASKS 1.8 and 2.4.

- [ ] The 72px rail, one column, the hero turned horizontal with a 150px cover, the side rail stacked below in two columns, and a 48px thumb bar. Pointer-gated hover only.

## 11 · Verify
**Now in:** the TASKS header's *feel-pass surface* rule, which each task above inherits.

- [ ] Every state at 360, 390, 412 and 768, in dark and light. The states: rest, mark storyboard, caught up, between books, run complete, block complete, offline, loading.
- [ ] Accessibility floor: 44px targets, `role="slider"` rails, names on every control, focus ring visible, text contrast per §6.
- [ ] Reduced motion and reduced transparency.
- [ ] No `--danger` on any dashboard, and no catalogue-wide progress.
- [ ] A Lighthouse or axe pass with no new violations.
