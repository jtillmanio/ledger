# Mockup screen index

`design/mockups.html` is ~540KB for 39 screens (phone + desktop, light + dark).
Don't `@mention` or `Read` the whole file for one screen — use
`scripts/screen.sh <id>` (or `scripts/screen.ps1 <id>` on native PowerShell),
which greps the live file for `data-id="<id>"` and prints just that
`<section>...</section>`, notes included.

This table is for humans — which id is which screen. The scripts always
compute the line range fresh from the file, so it can't go stale even if the
line numbers below drift after an edit.

| id | Screen | Approx. lines (v4 + Sept 2026, may drift) |
|---|---|---|
| `home` | Comics dashboard — the Up next cover shelf and *Ready when you are* (roadmap 1.10); 360px and 834px frames (roadmap 1.8) | 655–1001 |
| `runs` | Run list | 1004–1090 |
| `spine` | Run detail — per-run "read in …" hints; spine v2 gutter, Hide read, covers, dates, next-issue strip; the two-line undo toast (desktop frame, roadmap 1.2); 360px and 834px frames (roadmap 1.8); the hero's span line, *Started Mar 2026* (task 1.17) | 1562–1763 |
| `range` | Range marking; its undo toast in the two-line form (roadmap 1.2); the count with its optionals, *Adopt*'s fifth option *Original dates*, and the desktop anchor and pill (roadmap 1.1) | 1348–1466 |
| `addsearch` | Add issues — search (Metron); searches as you type, a *Metron* tag on each Metron row (task 1.22) | 1882–2025 |
| `bulk` | Add issues — type it (bulk) | 1576–1680 |
| `newrun` | New run | 1545–1647 |
| `ai` | AI review | 1650–1745 |
| `bdash` | Books dashboard; 360px and 834px frames, and the desktop's, redrawn from the feel pass (task 2.2, D-40): the five slots (Now, *Up next in Q4*, *This quarter*, *On deck*, *2026 so far*); reading at 390 and 834 and on the desktop, listening at 360 (the headphones glyph), *Between books* at 390, 360, 834 and on the desktop (past capacity: the figure amber, *52k over*, and the strip drawn as the plan rail on its side, task 2.2b: its blocks `button.qb`, the part of the last block past the rule hatched), never finished with nothing planned at 360; no position, meter or sittings until 2.1b (Q1); *Plan* revealed on hover with a fine pointer on the desktop; *Next in* under the hero on the reading frames and *Or keep going* (three books with **Start**, two at 360) under the offer between books (task 2.2d, D-108) | 2457–2874 |
| `status` | Status — in flight, up next, done (all media); 360px and 834px frames (roadmap 1.8); books In flight with **Finished** on each row, 360 (before and after, the toast with *Keep going?*), 834 and desktop frames (task 2.2f); Done rows carry a run's span and a book's dates (notes, task 1.17); books In flight under *Reading*, then *Listening*, and the headphones glyph on a row with a listen (notes, task 1.23) | 2645–2810 |
| `plan` | Plan by quarter; *Place them* (2.8), its last phone frame, moved here from `bdash` (task 2.2: the capacity card and *Place them* are on `/books/plan` only) | 3117–3278 |
| `moveplan` | Move / add to a quarter | 2169–2326 |
| `blist` | Library (the master list); the *Unlisted · N* chip after *Read* and an Unlisted row, grey badge and *Add to Someday* (task 1.21); the box searches as you type, *Searching…* (task 1.22); a row's *Started …* and days taken, the date line, and *Started* refusing a start after the finish (third frame, task 1.17); *Listening* beside *Reading* in the control, a Listening row and a row with a listen carrying the headphones glyph, and *Read 2× · Listened 1×* (task 1.23); named *Library*, its *Sort* select and direction link (*↓ Longest first*) beside the status filters at every width, the rows longest first, and a tablet frame with *Library* current on the rail (task 2.2e) | 3117–3328 |
| `follow` | *Follow…* — a Library row's `⋯` menu and the sheet it opens, headed by the book's title: its series, subseries, author, universe and shelves, each with *Reading · Tracking · Not following* and `read / total`; the middle option reads *On hold* on something part-read and *Tracking* otherwise, `tracking` stored both ways (D-118); *Not following* on a series, subseries or universe kept as `off` (D-117); a book with no series, and the undo toast live over the sheet; 360, 834 and desktop frames (task 2.2c, D-108; task 2.2h) | 3473–3652 |
| `finishoffer` | The finish offer — a finish from *Reading* or *Listening* follows the series, subseries and universe (D-117): the toast after *Read* gains *Now reading*, one 44px chip each that turns that one to *Not following*, then *Keep going?* for the author and shelves; a taken chip's own toast with the chips left; *Done with Mistborn* on the last unread book; a past read from *To read* follows nothing and keeps 2.2c's chips; F6 into the toast (D-116); 360, 834 and desktop frames (task 2.2c, D-108; task 2.2h) | 3655–3777 |
| `add` | Add books — search (Hardcover, task 1.4f); searches as you type, one place or source tag a row (task 1.22); the headphones glyph beside a listened book's tag (task 1.23) | 3315–3433 |
| `shelves` | Shelves | 2528–2624 |
| `top` | Top books | 2627–2713 |
| `search` | Search | 2716–2826 |
| `stats` | Stats | 2830–3076 |
| `capture` | Quick capture | 3079–3176 |
| `watchlist` | Watch dashboard | 3180–3431 |
| `franchise` | Franchises | 3434–3560 |
| `watchadd` | Search and add | 3563–3675 |
| `bookdetail` | Book detail — a sheet, not a hover | 3678–3835 |
| `titledetail` | Show detail — seasons | 3838–3984 |
| `settings` | Settings | 3987–4108 |
| `telescope` | Telescope — floor, overflow, two-rail, empty, dense | 4110–4443 |
| `tracks` | Tracks | 4444–4490 |
| `queue` | Comics Up next (queue), Done → Stopped, empty queue | 4491–4555 |
| `path` | Why blocked? and unlock preview | 4556–4608 |
| `issuedetail` | Issue detail — sheet | 4609–4655 |
| `krakoa` | Run detail — 641 issues, minimap, copy menu | 4656–4703 |
| `batch` | Batch sheet; its undo toast in the two-line form with the 2px countdown bar (roadmap 1.2, 1.8b). The 834px thumb bars of every screen are 48px controls with 12px above and below (D-78) | 4704–4749 |
| `session` | Reading sessions | 4750–4802 |
| `dashextras` | Dashboard extras — tonight, since, inbox, timer chip | 4803–4850 |
| `states` | Offline, loading, empty, metadata pending, all read here, covers in a row | 4851–4942 |
| `apistates` | Live-API states — loading, rate-limited, error | 4943–5000 |
| `rebalance` | Rebalance sheet and the settled stretch year | 5001–5052 |
| `planmonth` | Plan rail — estimates, stacks, drag (month retired, D-38) | 5053–5106 |
| `watchempty` | Watch — first run | 5107–5152 |
| `palette` | Ctrl K — search and verbs | 5153–5203 |

### Viewport frames (roadmap 1.8)

The sidebar's **Phone · 360 · 834 · Desktop** toggle picks the frame. `home`, `spine`,
`bdash` and `status` carry all four; every other screen has a phone and a
desktop frame only, so the 360 and 834 views of those are empty.

- **360** (`data-w="p360"`): the phone frame at 360px. The media bar fits
  *Ledger · Comics · Books · Watch* and the search icon with *Watch* untruncated.
  The search icon is a drawn magnifier, never U+26B2.
- **The tab row** (task 2.2i, D-120), on the phone and 360 frames of `home`, `runs`,
  `addsearch`, `bdash`, `status`, `blist`, `add`, `capture` (the Inbox screen),
  `watchlist` and `settings`: below 768px, under the media bar and sticky with it,
  the medium's enabled items then *Inbox*, 44px tall, the current one by weight and
  underline. `bdash` draws every books item on, past the frame's edge, because the
  row scrolls sideways; `capture` and `settings` draw the last medium's items.
- **A stepper's number is typed or held** (task 2.0b, D-123), in the `settings`
  frame: the number is a button named for its row (*Edit minutes a day*) and a tap
  swaps it for a numeric input of the same width and height; *Minutes a day* is
  drawn with the input open (brand outline), the other two closed. Holding − or +
  repeats. `design/STYLE_GUIDE.md` § 9 follows from the design tool.
- **834** (`data-w="tab"`): the tablet. The 72px navigation rail replaces the
  top bar (the media switch, the medium's items, Inbox with its count, Search
  and Settings at the foot; each item a 56px target, an icon over an 11px
  label), one column with 32px padding, the 40/44 Newsreader title and a 48px
  thumb bar spanning the column. The bodies follow the feel pass (STYLE_GUIDE
  § 14.5, Feel Review § 10c; roadmap 1.8e). `home` matches
  `design/screenshots/tablet/` in arrangement at the wider 834 column: the
  horizontal hero around a 150 × 225 cover, *Since Tuesday* | *Also reading*
  in one row, a five-cover shelf with a 16px gap, the horizontal telescope at
  W = 612 with its ladder in three columns, and *Ready when you are* | *2026 so
  far* below it as two columns, 1.5 : 1. `bdash` follows the books feel pass
  (§ 4, desktop § 11c) the same way: the horizontal hero, *Up next in Q4*, the
  *This quarter* strip, and *On deck* | *2026 so far* below. `spine` and
  `status` keep their bodies, because § 14.5 names nothing for them beyond the
  rail, column and thumb bar; the run detail's own redraw is 4.3 (the art band)
  and 2.5b (the telescope above the spine). Covers are the neutral placeholder
  until 4.3.

Average screen is ~120 lines / ~12KB — reading one instead of the whole file
is a ~20x cut for the single most common lookup in this repo (every task in
`docs/05-roadmap.md` that touches a screen references this file).

If you add a 41st screen, give its `<section>` a `data-id="..."` like the
others and add a row here — the id is all `scripts/screen.*` needs; the line
numbers are decoration.

## Sept 2026 audit pass (`UI_AUDIT_REPORT.md`)

Every audit item is either in `mockups.html`, in the docs, or listed under
*Not shown* below with the reason. IDs are the audit's `UX-C##` / `UX-E##`; each
is folded into the `docs/05-roadmap.md` task it belongs to.

### Drawn in `mockups.html`

| Audit | Where |
|---|---|
| C01 | `.emeter` on every era and block meter, so `.frame[data-w="desk"] .bar{display:none}` no longer hides them |
| C02–C07 | `telescope` (five variants) and the regenerated telescopes on `home` and `watchlist`: floor, overflow stubs, read segments, computed ticks, `42 / 381 · #141` labels, 11.5px text, focusable cells, `<desc>`, ladder `role="list"`, two-rail, empty, 641-issue |
| C08–C10 | Five-state badges everywhere; `reading` carries no prerequisite badge; phone and desktop telecard match; frontier tile and run-list switch (*Show 27 hard-blocked*) |
| C11 | Telecard foot row: unnamed X-Men block 3 with **Name it** |
| C12–C13 | One phone media bar; per-medium sidebar with Inbox, neutral icons and the sync pill |
| C14 | `tracks` |
| C15 | `moveplan` on 760k figures with an amber over-capacity preview |
| C16–C17 | `rebalance` (four peers, settled state); legacy red classes deleted |
| C18–C20 | Plan-rail blocks are buttons (`bdash`, `plan`, `planmonth`); estimated treatment; stack buttons; legend tag (C20's month view retired, D-38) |
| C21 | Spine: era buttons, collapsed finished era, named `.chk`, hint hidden on rows read here, `+N` button |
| C22 | `issuedetail` |
| C23 | Thumb bars lead with the mark verb; 44px buttons; `batch` behind **+ batch** |
| C24 | `batch` |
| C25 | Status tablist; comics Up next queue, keyboard-operable handle, row menu, Ready-not-queued, Stopped (`queue`) |
| C26 | Andor is mid-show everywhere; one hue per franchise; neutral genre chips |
| C27 | `watchempty` |
| C28–C29 | `DIAGRAMS §8b`, `data model 2.5b`, `etl/views.sql` (`run_state`, `run_read_segments`); `show_progress.dropped` is specified in roadmap 8.1 because the tables do not exist yet |
| C30–C31 | Bulk count fixed (9, not 42); insertion preview on `bulk` and `addsearch` |
| C32 | `apistates` |
| C33 | Sync pill in the desktop sidebar; offline strip on the phone (`states`) |
| C34 | Skeletons (`states`) |
| C35 | Metadata-pending treatment (`states`) |
| C36 | `session`, linked from Settings **14 sessions** |
| C37 | Tokens: `--faint #606979`, `--faint-deco`, `--blocked #8a560c`, dark `--faint`, checkbox ring, `--rule-2` (see the contrast note below) |
| C38 | `h1`, `.more` links, stretched-link rows (`article.row > a.row-link`), ARIA roles on chips, segmented controls, `.opts`, steppers and switches, SVG colours as classes or `style` |
| C39 | Volume map "67 rules · 61 series"; master-list note |
| E01 | Annotated only (see *Not shown*) |
| E02, E03, E13, E23 | `krakoa` and the spine era chips, copy menu, time to finish |
| E04, E05 | `path` |
| E06, E07, E15 | `dashextras` (tonight, timer chip, since-last-visit, inbox chip) |
| E08 | **Adopt 2 prior reads** in the spine hero |
| E09, E14 | Saved views on `runs` and `blist`; **Fits Q2 · 56k** and **Pick one** on `blist` |
| E10 | `palette` |
| E11 | Density row in Settings |
| E12 | Ghost block and `dropdelta` readout in `planmonth` (desktop) |
| E16 | Watch in the Quick capture kind control |
| E17, E18 | **Watched through** stepper and **Start S1**; franchise toggle above the tree, linked rows |
| E19, E20 | Empty slates in `states` and `queue`; toast is a live region |
| E21 | Medium accents on the tab underline and a `.unit` badge beside each dashboard `h1`; `--g1`–`--g8` genre family. Accent hexes are provisional until 6.9 |
| E22 | Rail captions: *Track rail · prerequisite order*, *Franchise rail · release order* |

The AI review screen has the diff-view columns (Kind · Change · Why · Check ·
Decision) as a real grid on the desktop frame.

### Not shown, and why

One line each. None is silently dropped.

1. **Rail scrubbing (E01).** Drag or arrow-key movement along a telescope rail is an interaction; a static file cannot show it. Specified in roadmap 2.5 (`role="slider"`, release navigates to `#p-[ordinal]`).
2. **Drag-and-drop reorder, keyboard lift/move/drop (C25, E12).** Same reason. The lifted row, announcer text and open menu are drawn as states; the sequence is a roadmap 1.10 test.
3. ~~Scroll-snap behaviour of the month view (C20).~~ Retired with the month view (D-38).
4. **Real `<button>` elements for chips, segmented controls, `.opts` and switches (C38).** The mockup's CSS targets `span` and `b`, so they carry `role`, `aria-pressed`/`aria-checked` and `tabindex` instead. Production must use real buttons (roadmap 1.8); the axe check will fail otherwise.
5. **The estimated-count `~` on plan *rows* and the master-list `.rm` value (C19).** Drawn on rail blocks, the legend, the Words field and the metadata-pending frame; rows reuse the same prefix but the existing row markup was not regenerated.
6. ~~**Empty slates for the books and watch status tabs.** Only comics is drawn; the copy for all nine is in design §14 and differs by wording, not layout.~~ Comics and books are drawn (task 1.9, the second `states` frame, *Status*: *Nothing in flight. Books you start land here.* **Open To read** · *Nothing planned. The plan starts empty; nothing is added for you.* **Add a book** · *Nothing finished yet. Finished books land here, by year.* **Go to In flight**); Watch's three wait for 8.8, and differ by wording, not layout.
7. **Phone sync pill inside the media bar (C33).** The bar is at its width limit, so the offline state is a strip beneath it. Decision recorded in `states`.
8. **A "read elsewhere" *segment kind* in the data (C04).** Drawn in the telescope. `etl/views.sql` cannot compute it until task 0.8 makes `issue_progress` per placement; `run_read_segments` documents the change.
9. **`show_progress` with `dropped` (C28).** Documented in `data model 2.5b`, `DIAGRAMS 8b` and roadmap 8.1, and stubbed as a comment in `etl/views.sql`, because the watch tables land with task 8.1.
10. **The measured checks (C37, C18, C02).** Contrast, 24px targets and 14px cells are tests in roadmap 1.8, 2.2 and 2.5. Contrast was computed once while building the mockups: `--faint` as the audit specified it (`#6f7888`) was 4.45:1 on `--surface` and 3.9:1 on `--page`, so it is `#606979` here.
11. ~~**The dark theme of the new screens** was not reviewed.~~ Closed by task 1.8a (UX-X04): the dark phone and desktop frames of `telescope`, `queue`, `planmonth`, `rebalance`, `path`, `session` and `palette` are captured in `design/captures/1.8a/`, listed under *Oct 2026, feel pass* below.
12. **Batch and rebalance for other media.** Batch on books reads *Log pages*; watch has no batch. Described in the notes, not drawn.
13. **Figures on the tracks, path and session screens** are illustrative, not the seed.
14. **The credits line on `addsearch` result rows** (*Walter Simonson · Sal Buscema*). Search results carry no credits: they arrive with enrichment (0.7, 4.1), so task 1.3b draws each row with its label, cover date and *in N runs* only.
15. **The books review after *Check N lines* on `add`, and what `add` does not draw.** The mockup ends the paste half at *Check 3 lines*; the review that follows is the `bulk` screen's, unchanged: the same five-column rows, with books' checks (*in library*, *new*, *similar 0.78*) and decisions (*Skip*, *Add · Drop*, *Create new · Use that · Drop*), and *Add N books* in the sticky bar. Since 1.4c (TASK-008, PR #77) the drawn layout is back: *Search · Paste a list · By hand* first, then *Add to*, then the search, with *Or paste a list* under its results on a phone and beside them from 1024px on the full page; *Paste a list* shows the paste alone and *By hand* the form alone (title and author required; series, #, pages and words optional), neither of which is drawn. From Books it opens as a sheet, one column at every width. On the full page the title, the control and *Add to* span both columns, because *Add to* governs the paste too; the desktop frame draws them over the left column only. Two more differences from the frame: the paste lede reads *Matched against your library first. You confirm anything ambiguous.*, without *then Open Library*, because the paste check asks only your library (owner, at TASK-008's plan gate); and a result row has its *Add to <destination>* button only, the secondary *Year or quarter…* arriving with 2.3's picker. *Add N books* adds to *Add to*'s destination and pushes an undo; on the full page it then goes to the master list's *To read* (owner, PR #76), and in the sheet it closes it.
16. **The tab row on the other phone frames (task 2.2i).** Every screen below 768px has it, but only the screens its items open are redrawn (*The tab row*, above): the rest keep the media bar alone, and the row sits under it the same way. The row's sideways scroll, and the current item scrolled into view, are interactions a static frame cannot show; `test/e2e/tab-row.spec.ts` holds them.

## Review M pass, 2026-09-24 (`docs/review/M-findings.md`)

| Finding | What changed |
|---|---|
| M-01 (D-24) | `--t2` fuchsia, `--t3` lime, `--t4` gold, `--m-books` cyan, `--m-watch` pink, both themes, here and in `globals.css`. `npm run test:tokens` keeps every identity hue ΔE2000 ≥ 15 from ready/blocked/danger |
| M-02 | `--on-brand`, `--on-ready`, `--on-danger`, `--on-muted`, `--toast-link`: dark text on dark-mode fills; no `color:#fff` on a control |
| M-03 (D-25) | Thumb-bar note rewritten; search slot named and added to `queue` and `batch`; `krakoa` desktop gains the bar |
| M-04 | `◐ 42 / 381` on the `home` telecard and `spine` hero; `⊘ N runs first` on `search` |
| M-05 (D-26) | `.meter` fills `--ready` everywhere; `.meter.rg` removed; shelves note |
| M-06 | *room*, *stated* and *ok* badges grey; the `moveplan` preview neutral |
| M-07 | `bdash`, `plan`, `planmonth` rails are one markup: `button.qb`, `.over`, `.un`, `--hue`; one hue per book; fifth lane and footer badges on `planmonth` |
| M-08 | `home` Up next rows use the queue's `button.drag` and `⋯` menu; `top` handles are buttons |
| M-09 | `spine` note: no hint on a row read here |
| M-10 | `krakoa` and the dense telescope name the issue (*X-Men #8*), not the ordinal |
| M-11 | `states` empty dashboard: *Pick from 41 ready runs* when the queue is empty too |
| M-12 | Desktop `home` lede no longer repeats the catalogue total |
| M-13 | `blist` second frame: *Finished* — Today · Pick a date · Year only · No date |
| L-01…L-07 | Scrim literal; named `.chk`, close and segmented controls; `status` medium; `addsearch` desktop preview; `moveplan` chips and *Accept*; queue toast and *Stopped*; `bdash` third frame for 2.8 (now on `plan`, task 2.2) |
| D-28, D-29 | `watchadd` second frame: TMDB error → *Save to inbox*; `tracks` and `stats` draw each track as a row of its blocks |
| Out of horizon | Watch genre chips grey; *Start S{n}*; watch telescope titles; TMDB attribution on `watchlist` and `watchadd`; stats and shelves notes |

Item 11 above is now partly covered: `test:tokens` checks dark-mode token contrast, and the dark captures of `home`, `bdash`, `watchlist` and `blist` were reviewed.

## Oct 2026, spine v2

Five additions to the run detail, from a comparison with another reading-order app. The specs are in `STYLE_GUIDE.md` §5.1 and §9, and the departures are D13–D15. The tasks are in `docs/05-roadmap.md`.

| Addition | What changed | Where |
|---|---|---|
| Ordinal gutter | A leading mono column with the placement's ordinal (`42`), in `--brand-ink` on the next row; `aria-hidden`, with the ordinal in the row's name; rows carry `id="p-42"` | `spine` (both frames), `krakoa`, `states`; roadmap 3.6b, 2.5 |
| Hide read | A neutral chip beside the era chips (on: phone `spine`, both `krakoa` frames; off: desktop `spine`); a dashed `+3 read · Show` stub per hidden stretch; the *All 381 read in this run* slate | `spine`, `krakoa`, `states`; roadmap 3.6c |
| Real covers | 28×42 row covers (D13) mixed with the text fallback; a loading skeleton; a cover-states frame (loading, loaded, none, pending, reduced data); `krakoa`'s tile now shows the issue number (D14) | `spine`, `krakoa`, `states`; roadmap 4.3 |
| Release date | A grey mono `Mon YYYY` column on the desktop rows only; *Dates* (cover date, publication date) in the issue sheet | `spine` (desk), `issuedetail`; roadmap 3.6b, 3.5 |
| Next-issue strip | A tonal well in the hero above *Resume #141*: cover, *NEXT · 42 / 381*, the label and its note; the fully read hero in `states` | `spine` (both frames), `states`; roadmap 1.6 |
| Considered, not adopted | A per-row outbound *Read* button and a condensed display face | `STYLE_GUIDE.md` §12 |

## Oct 2026, feel pass (D-40)

The feel pass is drawn in `design/Ledger Feel Review.dc.html`, not here, and every frame is also a PNG in `design/screenshots/` (palette 1c, dark and light; phone, tablet and desktop). Where it draws a surface it beats this file on layout and copy (D-40 amends D-31), so these frames are **superseded until their task redraws them** from the feel pass, in the same PR (standing rule 6). Its covers are striped placeholders; the redrawn frames use the neutral placeholder until 4.3.

| Frame here | Superseded by (Feel Review) | Redrawn by |
|---|---|---|
| `home` | §2 comics, §3 the mark, §11 desktop (the 834 frame is already redrawn, roadmap 1.8e) | 2.4 (with 1.10's shelf and 1.8b's mark; 1.8 for the desktop shell) |
| `states` (empty dashboard) | §10a *All caught up* | 2.4 |
| `bdash` | §4 books, reading and *Between books*, §11 desktop (the 834 frame is already redrawn, roadmap 1.8e) | 2.2 (**redrawn**, TASK-049); the past-capacity strip, 2.2b (**redrawn**, TASK-051); 2.2d adds *Next in* and *Or keep going* (TASK-050) |
| `watchlist` | §5 watch (open questions: roadmap 8.7) | 8.7 |
| `spine`, `krakoa` (hero only) | §6 run detail (art band, telescope above the spine) | 4.3 (band), 2.5b (telescope) |
| — (new) | §7 run complete, §10b block complete, §11 desktop | 2.12 |
| `dashextras` (*Since Tuesday* line) | §2 (*Since Tuesday* is a cover stack in the hero) | 2.4 |

Unchanged: every other frame, the spine rows (28×42 covers, SG-D13), and the five-slot order. The token blocks in this file already carry palette 1c, and its font link loads IBM Plex Sans, Plex Mono and Newsreader.

### Task 1.8a: dark captures and the redraw

The mockup re-rendered on the current tokens (palette 1c), with the control-state matrix, the 11px floor, the `--faint-deco` control outlines (D-71), `--sh-1` on the telecard and the dark `--rule` rings (STYLE_GUIDE §4.1, §7). Captures of each whole screen section, dark theme, in `design/captures/1.8a/` (a phone file shows every phone frame of that screen side by side):

| Screen | Phone | Desktop |
|---|---|---|
| `telescope` | `telescope-phone-dark.png` | `telescope-desk-dark.png` |
| `queue` | `queue-phone-dark.png` | `queue-desk-dark.png` |
| `planmonth` | `planmonth-phone-dark.png` | `planmonth-desk-dark.png` |
| `rebalance` | `rebalance-phone-dark.png` | `rebalance-desk-dark.png` |
| `path` | `path-phone-dark.png` | `path-desk-dark.png` |
| `session` | `session-phone-dark.png` | `session-desk-dark.png` |
| `palette` | `palette-phone-dark.png` | `palette-desk-dark.png` |
