# Ledger — Style Guide & Data Presentation (Step 3)

**Status:** design proposal, 2026-09-30. **Updated 2026-10-05 by the feel pass** (decision D-40): palette 1c *After hours* (the owner's pick), IBM Plex Sans, Plex Mono and Newsreader, cover-led dashboards, mark-read feedback, and completion screens. The changes are folded into each section and listed in §10, with the new material in §14–§16. Nothing here touches `src/`. The 2026-09-30 text is kept at `design/archive/STYLE_GUIDE-2026-09-30.md`.

**Files in `design/`:**

| File | What it is |
|---|---|
| `tokens.css` | Light and dark tokens, drop-in for `src/app/globals.css`. Same names; additions are marked `+ NEW` and changed values `~`. |
| `Style Guide.dc.html` | Hub page, plus the **B specimen** in dark and light at 390 and 1000px. |
| `Telescope Spec.dc.html` | Workstream A1–A3: 7 variants × 390/1000 × dark/light, plus hover, focus and scrub. |
| `Plan Rail Spec.dc.html` | Workstream A4: quarter, settled, month and drag. |
| `Telescope.dc.html`, `PlanRail.dc.html`, `Specimen.dc.html` | The components the pages import. Geometry is computed by the real `allocate()` rule. |
| `Ledger Feel Review.dc.html` | **Feel pass (2026-10-05).** Diagnosis, palette decision aid, and phone mockups in dark and light: comics, mark-read storyboard, books (reading and between books), watch, run detail, run complete, comics all caught up, block complete, and the 768px tablet. |
| `LedgerComics.dc.html` | The comics dashboard component the review imports. Mark-read is live. |
| `ledger-feel-tokens.css` | All three palettes (1a, 1b, 1c) × dark and light, in oklch. These are the reference values; `tokens.css` carries 1c as hex; 1a and 1b are in `handoff/palette-swaps.css`. |
| `handoff/` | The Claude Code package: prompt, checklist, D-40 draft, palette swaps, and the contrast report. |

**Precedence.** `design/mockups.html` wins on layout and copy, and `globals.css` wins on token values. Every place this guide departs from either is listed in §12 *Proposed deviations*. The feel-pass departures FP-D1…FP-D14 (§16) were accepted by the owner on 2026-10-05, so where they touch layout or copy they override `mockups.html`.

---

## 1. Decisions

1. **The telescope is horizontal at every width, phone portrait included.** Rails run left to right and are stacked top to bottom (TRACK, BLOCK, RUN), with brackets between them. Reasons:
   - **Gesture.** A rail is a `role="slider"` (E01). On a phone a vertical rail's drag is the same gesture as page scroll, so it either steals scrolling or never scrubs. A horizontal drag has no competing gesture.
   - **Height.** The vertical SVG took about 354px of a 806px phone viewport. The horizontal telecard rails take **150px on phone and 176px on desktop**, which moves *Also in flight* and *Up next* above the fold.
   - **Width at 360px.** The run rail is 250px wide in a 360px frame, 282px at 390 and 832px at 1000. That is enough for the X-Men track (7 × 14 + 12 = 110px minimum) and a 5-run block (82px minimum). Overflow starts at 16 cells on a 360px phone.
   - **Thumb reach.** The rails sit in the upper-middle of the card, and scrubbing is a horizontal thumb swipe, the most comfortable one-handed motion. The mark verb stays in the bottom thumb bar.
   - **Same algorithm.** `allocate()` is unchanged; only the axis changes (H becomes W).
2. **Phone portrait is the same component, not a strip variant.** The only differences are `--tele-min` 14 vs 16, rail heights 18/24 vs 20/28, the gutter 44 vs 72, and fewer inline labels (§2.4). The ladder is a 3-row list on phone and a 3-column row on desktop.
3. **Dark is the hero theme.** It uses a near-black page and tonal elevation. `--sunk` moves *below* `--surface`, so empty cells and tracks read as recessed. The only glow in the system is `--halo` on the head cell, and it means position.
4. **Cover art is a run's identity** (feel pass P1). Covers lead the Now slot, the Up next shelf, the spine rows, run detail and completion. The art is content, not colour meaning: no state is ever carried by a cover or its ambient tone.
5. **The Now slot is the one hero** (P3). It is the only large thing on a dashboard, with `--r-hero` corners. Slots 2–5 get quieter in order, and the slot order is unchanged.

---

## 2. Workstream A — Telescope

### 2.1 Geometry sheet

| Property | Phone (≤ 899px) | Desktop (≥ 900px) | Token |
|---|---|---|---|
| Frame gutter / card padding | 16 / 16 | 24 / 20 | `--sp-4`, `--sp-6`, `--sp-5` |
| Rail key gutter (TRACK / BLOCK / RUN labels) | 44 | 72 | `--tele-gutter` |
| Rail width W (390 / 1000 frame; 360 → 250) | 282 | 832 | derived |
| Tier rail height (track, block) | 18 | 20 | `--tele-rail` |
| Run rail height | 24 | 28 | `--tele-run` |
| Bracket depth (rail to rail) | 16 | 20 | `--tele-bracket` |
| Cell min (`min`) | 14 | 16 | `--tele-min` |
| Gap between cells | 2 | 2 | `--tele-gap` |
| Cell radius | 3 | 3 | `--r-cell` |
| Cell edge | 1px inset `--faint-deco` (≥ 3:1) | same | — |
| Head cell | 1.5px inset `--brand` + `--halo` | same | `--halo` |
| Focus | 2px `--surface` gap + 2px `--brand` ring | same | `--focus-ring` |
| Stub | 14 / 16 wide, `--surface` fill, 1px dashed `--faint-deco` | same | — |
| Bracket | trapezoid, `--brand` 8% fill, 1px edges `--brand` 50% | same | — |
| Head marker | 2px `--ink` line, +4px above and below the run rail, 2px `--surface` halo | same | — |
| Head pill | 20px tall, mono 11/20 600, `--brand-soft` / `--brand-ink`, 1px `--brand` ring, centred on the head and clamped to the rail | same | — |
| Ticks | 1px `--faint-deco`, minor 3px, major (every 5th) 6px, 3px below the run rail | same | — |
| Read segment | full rail height, `--ready`, outer corners 3px | same | — |
| Read-elsewhere | inset 3px top and bottom, 1px dashed `--muted`, no fill | same | — |
| Text | 11px minimum, HTML only (no scaled SVG text), mono tabular for numbers | same | `--fs-kicker` |
| Total rail block height (3-rail) | 18+16+18+16+24+3+6+3+20 ≈ **150** | ≈ **176** | — |

### 2.2 `allocate()` results (computed, 2px gap)

`h = min + count/total × (avail − n·min)`, where `avail = W − gap·(n−1)`.

| Case | Phone W = 282, min 14 | Desktop W = 832, min 16 |
|---|---|---|
| **[6, 381]** on one rail | 6 → **17.9** · 381 → **262.1** (avail 280) | 6 → **28.4** · 381 → **801.6** (avail 830) |
| Block rail [66, **6**, 381, 47, 90] (A1.2) | 36.8 · **16.1** · 145.7 · 30.3 · 45.1 | 99.2 · **23.6** · 496.4 · 75.3 · 129.5 |
| X-Men track [664, 214, 301, 268, 352, 211, 170] | 66.4 · 30.9 · 37.7 · 35.1 · 41.8 · 30.6 · 27.4 | 231.6 · 85.5 · 113.8 · 103 · 130.3 · 84.5 · 71.2 |
| 60-run block, head = run 28 (A1.3), overflow | stub **+25 · 687** (14) · 24 · 49.5 · 79.6 · 20.9 · 68 · stub **+30 · 843** (14) | stub +25 · 687 (16) · 57.3 · 162 · 285.9 · 44.6 · 238.2 · stub +30 · 843 (16) |
| Ticks, 381 issues | niceStep(381/47) = **10** | niceStep(381/138) = **5** |
| Ticks, 641 issues (Krakoa) | niceStep(641/47) = **20** | niceStep(641/138) = **5** |

In every case the heights plus gaps sum to W within 0.5px.

### 2.3 Short run vs long run: telling them apart beyond size

- **Floored mark.** A cell is *floored* when its proportional share (`count/total × avail`) is under `min`. A floored cell carries a centred 4px dot (`--muted`, or `--on-ready` over a fill), and the legend reads *• shown at minimum width*. That is data honesty: the cell is legible and tappable, and it is labelled as not to scale.
- **Intact unit.** A floored cell keeps its full edge, radius and fill, so it never reads as a hairline or a stub. Stubs are dashed and floored cells are solid.
- **Fill.** A short run that is fully read fills solid `--ready` edge to edge. A long run's fill grows from the left with its own share read (track and block cells) or as segments (run rail).

### 2.4 Label rule

Candidates are tried longest first and the first that fits is used. Fit means `chars × 5.9px (sans) or 6.7px (mono) + 12px ≤ available width`.

| Rail | Candidates |
|---|---|
| Track | `1 · Foundations` → `1`; an unnamed block: `block 3` → `3`; no block: *no block* (italic) |
| Block | `Claremont · 381` → `Claremont` → `381` |

- **Partly filled cells.** The label starts after the fill (`padding-left = fillW + 6`), so text never straddles green and grey.
- **Fully filled cells.** Text is in `--on-ready`.
- **Nothing fits.** The cell carries no text. Its name lives in the ladder, the `<title>`, the `aria-label`, and the hover or focus popover.
- **Phone.** Inline labels are mostly numbers; the ladder carries the names.

### 2.5 Overflow and stubs

- **When.** `n·min > avail`. The head cell and ±2 neighbours stay at `min` or larger. When the head is near an edge, the window shifts so 5 cells are always kept.
- **Folding.** The rest fold into at most two stubs, one before and one after.
- **Stub.** 14/16px wide, dashed, `--surface` fill.
- **Stub accessible name.** *+25 runs · 687 issues — open list*.
- **Hover and focus.** The stub shows a popover (A3.2): *+30 runs after · 843 issues · Enter opens the block list sheet*.
- **Activation.** Opens the block's run list as a sheet (the intercepted route), scrolled to the first folded run.
- **Ladder.** The ladder's BLOCK row shows `run 28 of 60`.

### 2.6 Segments, head and verb

- **Read state is run-length segments.** Green means read here. A gap means unread. A dashed inset box means read in another run.
- **Worked example.** Ordinals 1–41 and 44–47 are green. Ordinal 42 is the head. Ordinal 43 (**#142**) is a dashed box inside a gap: read elsewhere, unread here.
- **Head label.** On both the rail and the ladder it reads `42 / 381 · #141`, ordinal first and label second.
- **Mark verb.** It always names the label: `Mark #141 read`, `Mark X-Men (2019) #8 read`, `Mark Black Panther (1998) #15 read`.

### 2.7 Variants

| Variant | Rule |
|---|---|
| **3-rail** (A1.1) | TRACK, bracket, BLOCK, bracket, RUN, ticks and head pill, legend, then the ladder (3 rows). |
| **2-rail** (A2.1, `data-rails="2"`) | The BLOCK rail and its bracket are removed. TRACK brackets straight to RUN with **the same bracket depth, cell height, gap, radius, tick rule and type** as 3-rail, so the component reads as shorter, not broken. The track rail's last cell is the italic *no block* group holding the 9 block-less runs, and it is the head cell. The ladder drops its BLOCK row entirely (no empty row, same row rhythm), and TRACK's meta reads *no block · 2 runs*. The same 2-rail geometry serves watch (franchise → show → seasons). |
| **Unnamed block** (A1.2) | The ladder's BLOCK row reads *block 3 · unnamed* with a 24px **Name it** button. The track cell label is `block 3`. It is not an error and not amber. |
| **Empty** (A2.2, `data-state="empty"`) | The track rail only: no head, no brackets, no run rail, no legend. The ladder shows TRACK (`81 / 2,180 read`, the track's own blocks) and NEXT. One primary button, **Start the top of Up next**. When the queue is empty too, the button reads *Pick from N ready runs* (M-11). |
| **Dense** (A1.4) | 641 issues. Ticks are computed (20 on phone, 5 on desktop), and the pill uses the label (`118 / 641 · X-Men (2019) #8`). Floored neighbours (4 and 22 issues) carry dots. |
| **Fully read** (A2.3) | The run rail is solid green with no head marker. The badge is grey `✓ read · Sep 2026`. The CTA is secondary, *Next in block · Claremont — Excalibur*. |
| **No eras vs eras** | The telescope is unaffected: eras live in the spine, not the rails. On the spine, a run with no eras is one flat group (the correct default, ARCH 2.10). A run with eras gets era headers as `button.era`, with `.emeter` 52×5, a mono count and a chevron. Finished eras over 100 issues are collapsed (*38 / 38 · all read · Show*). The dense frame's ladder can gain an ERA row (*DoFP · 4 / 22*) when eras exist. |

### 2.8 State matrix

Drawn on the Telescope Spec A3 rows and in the Specimen A3 panel.

| Element | Rest | Hover (pointer only) | Pressed | Focus-visible | Other |
|---|---|---|---|---|---|
| **Cell** | `--sunk`, 1px `--faint-deco` | `--raise`, 1px `--ink-2`, tooltip on `--overlay` (`--sh-2`) | `--line` fill, 1px down, 100ms | `--focus-ring` | **Head:** 1.5px `--brand` + `--halo`. **Floored:** dot. **Read share:** left `--ready` fill |
| **Stub** | `--surface`, dashed `--faint-deco` | `--raise` | as cell | `--focus-ring` + popover | Opens the list sheet |
| **Bracket** | `--brand` 8% fill, 1px 50% edge | — | — | — | While scrubbing, the lower edges follow the ghost head's cell (200ms, `--ease-out`) |
| **Head marker** | 2px `--ink` + pill | — | — | The rail's slider focus draws `--focus-ring` around the run rail | **Scrub:** dashed 2px `--brand` ghost plus a pill on `--overlay` reading `200 / 381 · #299`; the real head is unchanged until a mark. **Reduced motion:** the ghost jumps, with no easing and no transform |
| **Segment** | read: `--ready`; elsewhere: dashed `--muted`; unread: gap | — | — | — | On mark, the new segment grows 300ms `--ease-out`; instant under reduced motion |

**Accessibility.**

- Each rail is `role="slider"` with `aria-valuemin`, `aria-valuemax` and `aria-valuenow`, and is focusable. Arrow keys step one cell (run rail: 1 issue; Shift+arrow: 1 tick).
- Each cell is an `<a href>` with a `<title>` and an `aria-label`.
- The SVG brackets are `aria-hidden`.
- The ladder is `role="list"` and is the text alternative.

### 2.9 Badges on the telecard

The five-state partial, unchanged:

| State | Badge |
|---|---|
| `blocked` | `⊘ N runs first` (amber, and a button) |
| `ready_hard` | `○ ready · N soft unread` (green outline) |
| `ready_all` | `● ready` |
| `reading` | `◐ n / N`, with no prerequisite badge beside it |
| `read` | `✓ read · date` (grey) |

---

## 3. Workstream A4 — Plan rail

| Property | Phone | Desktop |
|---|---|---|
| Rail height (column) | 230 | 300 |
| Scale | 1000k = H (quarter); 450k = H (month) | same |
| Capacity rule | 1.5px dashed `--ink-2`, label `760k` / `253k / month` on `--surface` | same |
| Column gap | 6 | 10 |
| Fifth lane | 52px, 1px dashed `--blocked` left border, `.un` blocks (`--blocked-soft`, 1px dashed `--blocked`) | 150px, labelled *2027 · no quarter* |
| Block | `button.qb`, radius 3, `--reading-soft`, 1px `--rule` ring, 3px `--hue` left edge, gap 2 | same, with inline title (≥ 18px tall) and words (≥ 32px) |
| Estimated | 1.5px dotted `--muted` top edge; label `~65k` (`~` at 400 `--muted`) | same |
| Over capacity | The portion of a block above the rule gets `--hatch` over `--blocked-soft`, and the block's ring turns `--blocked`. Labels sit on a `--surface` chip over the hatch. | same |
| Settled (stretch year) | Hatch turns `--hatch-settled` (grey). The decision card becomes `.decide.settled`: *2027 accepted as a stretch year on 14 Sep.* plus **Undo**. | same |
| Stack | Two or more adjacent sub-24px blocks merge into one button: `--raise`, dashed `--faint-deco` (the telescope stub's vocabulary), `+N` over `Nk`, height = the sum or 24, whichever is larger. A single sub-24px block keeps its drawn height with a 24px `::after` hit area. | same |
| Footer | `Q1`, `892k` and an overage badge only (`+132k`, amber). Room is implied by the rule. | `Q1`, `892k / 760k`, and either `over 132k` (amber) or `56k room` (grey, M-06) |
| Month | 12 columns, 64px each, horizontal scroll-snap **inside the card** (`scroll-snap-type:x mandatory`), 253k rule | 12 columns plus the no-month lane, no scroll |
| Drag (desktop) | — | The ghost is rotated −1.5° on `--sh-2` with a 2px dashed `--brand` outline. The source keeps a dashed placeholder. `output.dropdelta` (`aria-live`) reads *Q3 +99k → 514k / 760k*. The Move sheet stays the keyboard and phone route. |
| Granularity control | Raised-pill segmented control on `--sunk` (`role="tablist"`) | same |

**Shared with the telescope:** radius 3, gap 2, dashed = folded, dotted = estimated, hatch = held, `--focus-ring`, 11px floor, mono tabular numbers.

---

## 4. B1 — Tokens

The full set is in `tokens.css`. The rules behind it follow.

### 4.1 Surfaces

Palette 1c, measured 2026-10-05:

| Order | Light (relative luminance) | Dark |
|---|---|---|
| Lowest | `--sunk` 0.8165 | `--sunk` 0.0019 |
| | `--page` 0.9065 | `--page` 0.0033 |
| | `--raise` 0.9466 | `--surface` 0.0073 |
| Highest | `--surface` = `--overlay` 1 (separated by shadow) | `--raise` 0.0128 → `--overlay` 0.0163 |

In dark, `--sunk` now sits below `--page` as well as below `--surface`, and each step is about .04 L in oklch (it was about .01).

Rules:

- **Bordered.** A surface sitting on `--page` gets a 1px inset `--rule` ring.
- **Tonal.** A surface inside a surface (a row header, a hover row, a well) changes tone and has no ring.
- **Neither.** A row inside a group has only a `--line` divider.

### 4.2 Shadows and glow

- **Light.** `--sh-1` is a hairline lift. `--sh-2` is for popovers and toasts. `--sh-3` is for sheets and dialogs.
- **Dark.** Depth comes from tone plus a 1px inner top highlight (`inset 0 1px 0 rgba(255,255,255,.03–.06)`). A drop shadow appears only from `--sh-2` up.
- **Glow.** `--halo` (a 3px ring plus a 14px bloom in dark) is used **only on the telescope head cell**, and on the head cell of the hero's *This stretch* lens. It is never decorative.
- **Covers.** `--sh-cover` lifts cover art off any surface. It carries a 1px edge, so a dark cover never merges into a dark card.
- **Ambient art tone.** `--art` is the per-run tone behind the hero, the run-detail band and completion (FP-D6). It is extracted from the cover at ingest and clamped (dark L ≤ .30, C ≤ .06; light L ≥ .92, C ≤ .035), so every text token keeps 4.5:1 on it. It falls back to `--surface`, and `data-ambient="off"` turns it off.

### 4.3 Scales

| Scale | Values |
|---|---|
| Radius | `--r-cell` 3 · `--r-cover` 4 (cover art) · `--r-sm` 6 (badges, tags) · `--r-md` 8 (buttons, inputs) · `--r-lg` 12 (groups, toasts, thumb-bar buttons) · `--r-xl` 16 (cards, sheets) · `--r-hero` 20 (the Now slot only) · `--r-full` |
| Spacing | 4px base: 2 · 4 · 6 · 8 · 12 · 16 · 20 · 24 · 32 · 40 (`--sp-*`) |
| Motion | `--dur-1` 100 (hover, press) · `--dur-2` 150 (check, chevron, tab indicator) · `--dur-3` 200 (menus, era expand, bracket) · `--dur-4` 300 (sheet enter, segment grow) · `--ease-out` `cubic-bezier(.2,.8,.2,1)` for enter · `--ease-in` `cubic-bezier(.4,0,1,1)` for exit at ~70% of the duration. `--dur-hold` 600 (the mark button holds *✓ read*) · `--dur-fill` 900 (a completion rail fills once). `prefers-reduced-motion` sets every movement duration to 0. `--dur-hold` is kept, because holding a colour is not movement. |

---

## 5. B2 — Typography

**Families (changed 2026-10-05, FP-D5):** **IBM Plex Sans** for the UI, **IBM Plex Mono** for labels, counts, ranges and keys (`font-variant-numeric: tabular-nums`; D-32 still holds, so counts stay mono), and **Newsreader** (`--display`) for names and moments only: screen titles, hero names, story titles, completion lines and empty-state headlines. All three are self-hosted, because rendering makes no external calls.

| Style | Size / LH | Weight | Tracking | Use |
|---|---|---|---|---|
| `kicker` / mono-label | 11/14 mono | 500 | +0.08em, caps | Card kickers, rail keys, ladder keys, frame tags |
| `caption` | 12/16 | 500 | 0 | Provenance, legends, timestamps |
| `body-sm` | 13/18 | 400 | 0 | `.rs` secondary lines, lede, notes |
| `body` | 14/20 | 400 | −0.003em | UI body, buttons (600), menu items |
| `row-title` | 15/20 (.9375rem) | 600 | −0.006em | `.rt`, run and book titles |
| `h3.s` section | 12/16 | 600 | +0.06em, caps, `--ink-2`; count in mono 11 `--muted` | Section heads. They are distinguished from rows by treatment, not size. |
| `h1.t` / `h2.t` screen title | 32/36 phone · 40/44 tablet and desk, **Newsreader** | 500 | −0.015em | One per page |
| `hero-name` | 26/30 Newsreader (run detail h1 28/30, completion 40–44) | 500 | −0.01em | The run or book named in a hero |
| `hero-num` | 44/48 mono (56/60 tablet) | 500 | −0.04em | The issue number in the Now slot |
| `story` | 19/23 Newsreader italic | 400 | 0 | Story or arc title under the hero number |
| `line` | 18/26 Newsreader italic | 400 | 0 | One closing line on completion and empty states |
| `display` | 40/40 phone · 48/48 desk, mono | 500 | −0.04em | `.capnum`, `.pace .big`, `.timer-big` |

**Numbers.**

- Counts, ranges and labels are tabular mono: `381`, `42 / 381`, `#141`, `#337–340`, `760k`.
- An estimate keeps the number's weight and sets `~` at 400 in `--muted` (`~65k`).
- A catalogue figure appears only as grey provenance.

**Truncation.** A label is split into `series` (`min-width:0; overflow:hidden; text-overflow:ellipsis`) and `number` (`flex:none`). So `Astonishing X-Men (2004) Annual #1` truncates to `Astonishing X-Men (20… #1`, and the issue number is never lost.

**Density.** Comfortable rows are 48px (`--row-h`; `.chk` 3rem, 20px ring). Compact is **desktop only**, 32px rows, a 16px ring and 13/18 mono labels (`.app[data-density="compact"]`). For 381-row spines:

- Row dividers are `--line`, and era headers are `--raise` bands.
- There is no zebra striping: the green ticks are the rhythm.
- Sticky era chips sit under the header at `top: var(--bar-h)`.

---

## 6. Contrast and ΔE2000 (measured 2026-10-05, palette 1c)

Measured from the oklch sources: gamut-mapped to sRGB, WCAG 2.x contrast, ΔE2000 in CIELAB. All three palettes pass, and their full tables are in `design/handoff/contrast-report.md`; the tables below are palette 1c, the one D-40 adopts. Fixes made by this pass: light `--ready` L .51 → .50 (ΔE against `--t3` was 11.8 in 1c, and text on `--sunk` was under 4.5); dark `--blocked` hue 80 → 72 (ΔE against `--t4` was 12.1); light `--brand` L .52 → .49 (text on `--sunk` was 4.29, and on glass 4.30).

**Glass note.** `--ready` *text* on light glass over black reaches only 4.52:1, so ready-coloured text is still not allowed on glass chrome (SG-D12).

### Text tokens on every surface (floor 4.5:1)

| Text token | Theme | page | surface | raise | sunk | overlay |
|---|---|---|---|---|---|---|
| `--ink` | light | 16.18 | 17.77 | 16.86 | 14.66 | 17.77 |
| `--ink` | dark | 17.52 | 16.31 | 14.88 | 18 | 14.08 |
| `--ink-2` | light | 9.17 | 10.06 | 9.55 | 8.3 | 10.06 |
| `--ink-2` | dark | 12.44 | 11.57 | 10.56 | 12.77 | 9.99 |
| `--muted` | light | 5.49 | 6.02 | 5.72 | 4.97 | 6.02 |
| `--muted` | dark | 8.21 | 7.64 | 6.97 | 8.43 | 6.6 |
| `--faint` | light | 5.49 | 6.02 | 5.72 | 4.97 | 6.02 |
| `--faint` | dark | 7.91 | 7.36 | 6.72 | 8.13 | 6.36 |
| `--brand` | light | 5.6 | 6.14 | 5.83 | 5.07 | 6.14 |
| `--brand` | dark | 10.51 | 9.78 | 8.92 | 10.79 | 8.44 |
| `--brand-ink` | light | 7.58 | 8.32 | 7.9 | 6.87 | 8.32 |
| `--brand-ink` | dark | 13.98 | 13.01 | 11.87 | 14.35 | 11.23 |
| `--ready` | light | 5.16 | 5.67 | 5.38 | 4.68 | 5.67 |
| `--ready` | dark | 12.83 | 11.94 | 10.9 | 13.18 | 10.31 |
| `--blocked` | light | 5.19 | 5.7 | 5.41 | 4.7 | 5.7 |
| `--blocked` | dark | 11.84 | 11.02 | 10.05 | 12.16 | 9.51 |
| `--danger` | light | 5.5 | 6.04 | 5.73 | 4.98 | 6.04 |
| `--danger` | dark | 7.41 | 6.89 | 6.29 | 7.61 | 5.95 |

### Paired fills (floor 4.5:1)

| Pair | Light | Dark |
|---|---|---|
| `--ready` on `--ready-soft` | 4.97 | 8.67 |
| `--blocked` on `--blocked-soft` | 4.99 | 7.97 |
| `--danger` on `--danger-soft` | 5.26 | 5.77 |
| `--brand-ink` on `--brand-soft` | 7.23 | 9.22 |
| `--muted` on `--sunk` | 4.97 | 8.43 |
| `--on-brand` on `--brand` | 6.14 | 10.51 |
| `--on-ready` on `--ready` | 5.67 | 12.83 |
| `--toast-ink` on `--toast-bg` | 15.53 | 12.18 |
| `--toast-muted` on `--toast-bg` | 10.01 | 7.83 |
| `--toast-link` on `--toast-bg` | 9.92 | 9.71 |

### UI component boundaries (floor 3:1)

| Boundary | Light | Dark |
|---|---|---|
| faint-deco / surface | 3.37 | 4.09 |
| faint-deco / raise | 3.2 | 3.73 |
| faint-deco / overlay | 3.37 | 3.53 |
| ready / sunk (segment) | 4.68 | 13.18 |
| brand / sunk (head) | 5.07 | 10.79 |
| brand / page (focus) | 5.6 | 10.51 |

### Glass chrome, worst case (floor 4.5:1)

Glass is `--surface` at α .90, composited in sRGB over pure white (dark) and pure black (light).

| Text on glass | Light (over #000) | Dark (over #fff) |
|---|---|---|
| `--ink` | 14.17 | 12.44 |
| `--ink-2` | 8.03 | 8.83 |
| `--muted` | 4.8 | 5.83 |
| `--brand` | 4.9 | 7.46 |
| `--ready` | 4.52 | 9.11 |
| `--blocked` | 4.55 | 8.4 |

### Identity hues vs functional colours (ΔE2000, floor 15)

| Hue | Light: ready · blocked · danger | Dark: ready · blocked · danger |
|---|---|---|
| `--t1` / `--g1` | 45.7 · 52.4 · 43.9 | 51.4 · 52.1 · 41.1 |
| `--t2` / `--g2` | 47.5 · 51 · 34 | 53.7 · 55.4 · 30.8 |
| `--t3` / `--g3` | 15.6 · 35 · 57.8 | 15.2 · 32.9 · 64 |
| `--t4` / `--g4` | 27.5 · 19.8 · 41.4 | 29.9 · 16.1 · 47 |
| `--t5` / `--g5` | 48 · 54.4 · 40.4 | 51.4 · 52.9 · 34 |
| `--t6` / `--g6` | 28.2 · 43.1 · 54.3 | 35.7 · 43.8 · 57.8 |
| `--t7` / `--g7` | 69.5 · 36.8 · 17 | 75.3 · 44.5 · 18.1 |
| `--t8` / `--g8` | 26.5 · 32.7 · 35.1 | 36.8 · 36 · 32.3 |

The tightest pairs are `--t3` against `--ready`: 15.6 light and 15.2 dark. Any later change to ready or blocked must re-run this check.

### Elevation order (relative luminance)

| Theme | page | surface | raise | sunk | overlay |
|---|---|---|---|---|---|
| light | 0.9065 | 1 | 0.9466 | 0.8165 | 1 |
| dark | 0.0033 | 0.0073 | 0.0128 | 0.0019 | 0.0163 |

---

## 7. B3 — Containers

| Container | Border | Radius | Padding | Elevation, light / dark |
|---|---|---|---|---|
| `group` | 1px inset `--rule` | 12 | 0; rows carry padding | `--sh-1` / inner highlight |
| `row` | `--line` bottom divider | — | 12 × 14, min-height 48 | none; hover `--raise` (100ms) |
| `telecard` | 1px inset `--rule`; 3px identity stripe | 16 | 16 phone / 20 desk | `--sh-1` (was `--sh-2`) |
| `hero` (Now slot) | 1px inset `--rule`; art band on `--art` | **20** (`--r-hero`) | 16 phone / 20 tablet | `--sh-1` |
| `cover` | none; `--sh-cover` | 4 (`--r-cover`) | — | 2:3. Hero 112 (150 from 768px) · shelf 112 · row 36 · stack 30 |
| `shelf` | none; horizontal scroll with `scroll-snap-type:x mandatory`, bleeding to the frame edge | — | 2 × 16 | Each card: cover, position chip on `--overlay`, 2-line title, mono meta, the readiness badge unchanged |
| `lens` (*This stretch*) | cells as telescope cells | 3 | — | 24 cells, one per issue, around the head. Run-relative, never catalogue-relative (FP-D3) |
| `sheet` | 1px inset `--rule-2`; grab 36×4 `--rule-2` | 16 (top) | 6 / 14 / 14 | `--overlay` + `--sh-3` over `--scrim` |
| `chip` | 1px inset `--rule-2`; on: `--ink` fill, `--page` text | full | 0 × 12, 32 tall (44 hit) | none |
| `badge` | per state (§2.9); `blocked`, `ready_hard` and `read` get a 1px ring | 6 | 4 × 8 | none |
| `meter` | none; track `--sunk` | full | 5px tall | fill `--ready` (D-26) |
| `emeter` | none; track `--sunk` | full | 52 × 5 | fill `--ready`. `.bar` stays the app header only (C01). |

---

## 8. B4 — Glass, used with discipline

| Surface | Glass? | Spec |
|---|---|---|
| Sticky app header `.bar`, desktop `.side` | yes | `background: var(--glass-bg)` (surface at α .90) · `backdrop-filter: blur(20px) saturate(1.4)` · `border-bottom: 1px solid var(--glass-edge)` · `box-shadow: var(--glass-hi)` |
| Thumb bar `.actionbar` | yes | same, with `border-top`, plus `padding-bottom: max(12px, env(safe-area-inset-bottom))` |
| Bottom sheets | **scrim only** | The sheet is solid `--overlay`. The scrim may take `backdrop-filter: blur(2px)` over `--scrim`. |
| Command palette | yes | `--glass-bg` over the scrim, `--r-xl`, `--sh-3` |
| Rows, telescope, plan rail, badges, meters, toast | **never** | — |

**Worst case.** Text on glass is measured against glass composited over pure white (dark theme, where cover art can scroll beneath) and pure black (light theme). At α .90: `--ink` 10.9:1 / 13.8:1, `--muted` 4.5:1 / 4.6:1, `--brand` 5.5:1 / 5.6:1 (§6). α .72–.85 failed `--muted`, which is why the glass is near-opaque. The frost is a texture, not a window.

**Fallback.** Under `@supports not (backdrop-filter)` or `prefers-reduced-transparency: reduce`, `--glass-bg` becomes `--surface` (solid). Both versions are drawn side by side in the Specimen B4 panel.

---

## 9. B5 — Component polish (structure and copy unchanged)

- **Readiness badges.** Mono 11/14 600, radius 6, glyph plus text plus `aria-label`. `blocked` gains a 1px `--blocked` ring and is a button.
- **Thumb bar.**
  - Glass.
  - Primary slot `flex:1`, 44px (48 on tablet), `--r-lg` 12 (FP-D10), `--brand` / `--on-brand`, text truncates with ellipsis.
  - **The mark answers back** (P2, FP-D7). The full sequence is in §14.3.
  - `+ batch` secondary: 44px, 1px `--rule-2`.
  - Search: 44×44 with a drawn magnifier, replacing the U+26B2 glyph.
  - Desktop dashboards keep header buttons (DN-2 a). The spine and krakoa keep the bottom bar.
- **Status tablist.** Links with `role="tab"`, 44px tall, counts in mono 11. The selected tab is `--ink` 600 with a 2px `--m-*` underline; the others are `--muted` 500. The underline slides between tabs (150ms).
- **Segmented control.** A raised pill (`--surface` + `--sh-1`) on a `--sunk` track, 32px (44 hit). Proposed deviation D4.
- **Chips.** Filter-on is neutral inverse (`--ink` / `--page`), filter-off is surface plus a ring, hover goes to `--raise` with a `--faint-deco` ring.
- **Switch.** 36×20, on = `--brand` track with an `--on-brand` knob, off = `--sunk` with a `--faint-deco` ring and a `--muted` knob; `role="switch"`, 44px row. **Stepper:** `role="group"`, 32px buttons on `--sunk`, `<output>` mono.
- **Toast.** `--toast-bg` / `--toast-ink`, with Undo in `--toast-link` 700. A second line in `--toast-muted` mono 12/16 carries the run count (*46 of 381 in Uncanny X-Men*). `role="status"`. A 2px `--brand` countdown bar runs along the bottom edge over 8s and pauses on hover or focus.
- **Skeletons.** The loaded geometry exactly (row 78px with a 36×54 cover, title 12px, meter 5px) in `--sunk`. The shimmer is off under reduced motion.
- **Sync pill.** A 6px dot (`--ready` online; `--blocked` offline or queued) plus `--ink-2` text. The offline strip is `--blocked-soft` with a `--blocked` ring.
- **Rate-limited status line.** Amber, because it is held: a countdown in mono and **Type it instead**.
- **API error status line.** Neutral surface with a grey × glyph. It is not red: nothing destructive happened.
- **Empty slate.** `--raise` panel, a 15/20 title, a 13/18 reason, and exactly one primary action.
- **Metadata pending.** A dashed `--muted` cover outline plus an italic *metadata pending* line.

---

## 10. Changelog — additions and changed values

### 2026-10-05 · feel pass (D-40)

- **Added:** `--display`, `--art` (with `--art-d` / `--art-l` inputs), `--sh-cover`, `--r-cover` 4, `--r-hero` 20, `--dur-hold` 600, `--dur-fill` 900, `--toast-muted`, `--fs-hero-name` 26/30, `--fs-hero-num` 44/48, `--cover-hero` 112 (150 from 768px), `--cover-shelf` 112, `--cover-row` 36.
- **Changed:** `--sans` Inter Tight → IBM Plex Sans; `--mono` JetBrains Mono → IBM Plex Mono; `--fs-title` 24/28 → 32/36 (desk 30/34 → 40/44, Newsreader 500); every neutral and semantic colour moves to palette 1c *After hours* (see §6 and `tokens.css`; D-40). Dark surfaces separate by about .04 L per step. `--glass-bg` and `--halo` follow the palette; the shadows are the feel pass's warm set.
- **Unchanged:** every name, `--t1…--t8`, `--g*`, `--m-*`, the spacing, telescope and plan-rail geometry, and the four colour meanings.

### 2026-09-30 · Step 3

**Additions** (`+ NEW`):

| Token | Light | Dark | Purpose | Used on |
|---|---|---|---|---|
| `--overlay` | `#fff` | `#1e232c` | Sheets, menus, dialogs, palette, tooltips | bookdetail, titledetail, issuedetail, batch, rebalance, moveplan, path, palette, telescope |
| `--toast-bg` | `#12151c` | `#1e232c` | Toast fill; dark stays tonal instead of a light slab | dashextras, queue, spine, range, batch |
| `--toast-ink` | `#f3f5f8` | `#e8ebf0` | Toast text | same |
| `--halo` | 3px brand 16% | 3px brand 22% + 14px bloom | Telescope head only | home, telescope, krakoa, watchlist, dashextras |
| `--focus-ring` | 2px surface + 2px brand | same | `:focus-visible` everywhere | all |
| `--glass-bg` | `rgba(255,255,255,.9)` | `rgba(18,21,27,.9)` | Header, sidebar, thumb bar, palette | all phone and desktop frames, palette |
| `--glass-edge` | `rgba(18,21,28,.08)` | `rgba(255,255,255,.07)` | Glass hairline | same |
| `--glass-hi` | inset 1px white 60% | inset 1px white 5% | Glass inner highlight | same |
| `--scrim` | `rgba(10,12,16,.4)` | `rgba(0,0,0,.6)` | Replaces the moveplan literal (L-01) | bookdetail, moveplan, issuedetail, batch |
| `--hatch` / `--hatch-settled` | blocked / muted stripes | same | Over capacity / accepted | bdash, plan, planmonth, moveplan, rebalance |
| `--r-cell … --r-full` | 3 / 6 / 8 / 12 / 16 / 999 | same | Radius scale | all |
| `--sp-0-5 … --sp-10` | 2–40 | same | Spacing scale | all |
| `--fs-*` | §5 | same | Type scale | all |
| `--tele-min/gap/rail/run/bracket/gutter` | 14 / 2 / 18 / 24 / 16 / 44 | same | Desktop 16 / 2 / 20 / 28 / 20 / 72 | home, telescope, krakoa, watchlist |
| `--row-h` | 48 | same | Compact on desktop: 32 | spine, krakoa, runs, blist, settings (density) |
| `--dur-1…4`, `--ease-out`, `--ease-in` | 100 / 150 / 200 / 300 | same | Motion | all |
| `--glass-blur`, `--glass-sat` | 20px, 1.4 | same | Glass | same as `--glass-bg` |

**Changed values** (`~`):

- **Light.** `--page` `#eceff4 → #f3f5f8`, `--raise` `→ #f8f9fb`, `--sunk` `→ #ebeef2`, `--ink` `→ #12151c`, `--ink-2` `→ #3a4250`, `--muted` `→ #5c6575`, `--faint` `→ #5f6878`, `--faint-deco` `#98a1b0 → #848d9b`, `--rule` `→ #dfe3e9`, `--rule-2` `→ #c7cdd7`, `--line` `→ #eceef2`, `-soft` fills lightly retuned.
- **Dark.** `--page` `#0d0f14 → #0a0c10`, `--surface` `→ #12151b`, `--raise` `→ #191d25`, `--sunk` `#232935 → #0d1015`, `--muted` `→ #8f98a7`, `--faint-deco` `→ #646d7a`, `--rule`, `--rule-2` and `--line` retuned.
- **Dark semantic.** `--brand` `→ #86a4ff`, `--ready` `→ #52c496`, `--blocked` `→ #e0a866`, `--danger` `→ #ef8173` with their `-soft` pairs, and `--toast-link` `#1a3aa3 → #a9bfff`.
- **Shadows.** `--sh-1…3` in both themes.

Identity hues `--t1…--t8`, `--g*` and `--m-*` are **unchanged**, and they still clear ΔE 15 against the retuned functional colours (§6).

---

## 11. Appendix — Tailwind `theme.extend` (reference only)

> **This is not the shipped format.** The codebase uses plain CSS custom properties (ARCHITECTURE §3). The mapping exists so anyone thinking in Tailwind reads the same scale. Every value points at the CSS variable, never at a copied hex.

```js
// tailwind.config.js — REFERENCE ONLY, not used by src/
theme: { extend: {
  colors: {
    page:'var(--page)', surface:'var(--surface)', raise:'var(--raise)', sunk:'var(--sunk)', overlay:'var(--overlay)',
    ink:{ DEFAULT:'var(--ink)', 2:'var(--ink-2)' }, muted:'var(--muted)', faint:'var(--faint)', 'faint-deco':'var(--faint-deco)',
    rule:{ DEFAULT:'var(--rule)', 2:'var(--rule-2)' }, line:'var(--line)',
    brand:{ DEFAULT:'var(--brand)', soft:'var(--brand-soft)', ink:'var(--brand-ink)', on:'var(--on-brand)' },
    ready:{ DEFAULT:'var(--ready)', soft:'var(--ready-soft)', on:'var(--on-ready)' },
    blocked:{ DEFAULT:'var(--blocked)', soft:'var(--blocked-soft)' },
    reading:{ DEFAULT:'var(--reading)', soft:'var(--reading-soft)' },
    danger:{ DEFAULT:'var(--danger)', soft:'var(--danger-soft)', on:'var(--on-danger)' },
    t:{1:'var(--t1)',2:'var(--t2)',3:'var(--t3)',4:'var(--t4)',5:'var(--t5)',6:'var(--t6)',7:'var(--t7)',8:'var(--t8)'},
    m:{ comics:'var(--m-comics)', books:'var(--m-books)', watch:'var(--m-watch)' },
  },
  borderRadius:{ cell:'3px', sm:'6px', md:'8px', lg:'12px', xl:'16px' },
  spacing:{ 0.5:'2px', 1:'4px', 1.5:'6px', 2:'8px', 3:'12px', 4:'16px', 5:'20px', 6:'24px', 8:'32px', 10:'40px' },
  fontSize:{ kicker:['11px','14px'], caption:['12px','16px'], 'body-sm':['13px','18px'], body:['14px','20px'],
    'row-title':['15px','20px'], section:['12px','16px'], title:['24px','28px'], 'title-desk':['30px','34px'],
    display:['40px','40px'], 'display-desk':['48px','48px'] },
  fontFamily:{ sans:'var(--sans)', mono:'var(--mono)' },
  boxShadow:{ 1:'var(--sh-1)', 2:'var(--sh-2)', 3:'var(--sh-3)', halo:'var(--halo)', focus:'var(--focus-ring)', 'glass-hi':'var(--glass-hi)' },
  transitionDuration:{ 1:'100ms', 2:'150ms', 3:'200ms', 4:'300ms' },
  transitionTimingFunction:{ out:'cubic-bezier(.2,.8,.2,1)', in:'cubic-bezier(.4,0,1,1)' },
  backdropBlur:{ glass:'20px' },
}}
```

---

## 12. Proposed deviations

| # | Deviation | Reason | Screens |
|---|---|---|---|
| **D1** | The telescope becomes **horizontal** (ARCHITECTURE §4 and DIAGRAMS §3b describe vertical rails; `allocate()` semantics unchanged, H becomes W). | Gesture conflict with vertical scroll, about 200px of height recovered, still fits at 360px (§1). | home, telescope, krakoa, watchlist (2-rail), dashextras, states |
| **D2** | Dark `--sunk` sits **below** `--surface`. The brief's list "`--page < --surface < --raise < --sunk`" reads as ascending, but `--sunk` means recessed. In dark, `.tag`, `.bdg.dn` and the stepper, which use `--sunk`, gain a 1px `--rule` ring so they read as inset chips, not holes. | Meter tracks and empty cells looked raised in dark (Review N D1). | all, dark |
| **D3** | `.toast` reads `--toast-bg` / `--toast-ink` instead of inverting `--ink` / `--page`. The class name is unchanged. | A light slab in dark mode is the brightest thing on screen; that is not low-glare. | dashextras, queue, spine, range, batch |
| **D4** | Selected **chip** = neutral inverse (`--ink` / `--page`). Selected **segment** = raised pill on `--sunk`. Neither uses a `--brand` fill any more. | `--brand` means position or primary action; a selected filter is neither. Three blue fills competed on `status`. | runs, blist, watchlist, status, settings, bdash, plan, capture, franchise |
| **D5** | `h3.s` is 12px caps +0.06em `--ink-2` (was 13px sentence case `--muted`). Only `text-transform` changes, not the copy. | Section heads were weaker than the rows they head. | all dashboards and lists |
| **D6** | `.more` "All N" is a quiet `--brand` text link (13/18 500) instead of a `--brand-soft` pill. | Four blue pills above the fold on `home`. | home, bdash, watchlist, status |
| **D7** | `.telecard .kick` and `.hero .kick` go from `--brand` to mono `--faint` caps. | Blue means position; a label is not a position. E21's medium accent stays on the `h1`. | home, spine, krakoa, watchlist, bdash |
| **D8** | `--faint-deco` is darkened to ≥ 3:1 so it can outline controls (cells, stubs, off switch tracks, stack buttons). ARCHITECTURE says "rules and outlines only"; this keeps that role and adds the 1.4.11 floor. | Cells and stubs are links, and their boundary must be 3:1. | all |
| **D9** | Stubs carry their `+N · Nk` count in the accessible name, ladder and popover, not inline. The spec says "labelled with a summed issue count". | "+30 · 843" cannot fit in 14px at 11px text. | telescope, home (overflow cases) |
| **D10** | New *floored* dot on cells shown larger than scale, with a legend. | A short run must look intact without pretending to be proportional. | telescope, home, krakoa |
| **D11** | Phone plan-rail footers drop the grey *Nk room* badge and show only the amber overage. Desktop keeps both (M-06). | "56k room" wraps to two lines in a 62px column. | bdash, plan, planmonth |
| **D12** | Glass α is .90, not the typical .6–.8. `--ready` text is barred from glass. | Worst-case contrast (§8). | all chrome |
| **Conflict** | ARCHITECTURE §4 says the run-list switch is "Show N hard-blocked; N is around 180 on the current graph, not 27", but the mockup copy is *Show 27 hard-blocked*. The specimen uses the mockup copy (the mockup wins on copy); the figure is illustrative (D-7). | Flagged, not resolved. | runs, specimen |
| **Conflict** | The brief says the thumb bar is "fixed at the bottom of dashboards". M DN-2 (a) chose header buttons on *desktop* dashboards. The frames follow DN-2: bottom bar on phone, none on the desktop telecard frames. | Flagged for the owner. | home, bdash, watchlist (desk) |

---

## 13. Checklist — §1 non-negotiables

| Rule | Satisfied by |
|---|---|
| `--ready` = read or done; every meter fills `--ready` | Read segments, cell fills, `.meter` and `.emeter` (§7, specimen B3); nothing else is green except `ready` badges |
| `--brand` = position and primary action | Head cell, halo, bracket, head pill, primary buttons, focus ring. Kickers (D7), chips and segments (D4) and "All N" pills (D6) are removed from blue. |
| `--blocked` amber = held; clears on decision | Blocked badge, plan hatch, fifth lane, `.decide`, offline strip, rate-limit line. Settled → grey `--hatch-settled` + `.decide.settled` (A4.2) |
| `--danger` only destructive or validation; never on a dashboard | Only the *Drop* buttons in the specimen (sheet and review context). The API error line is neutral (§9). No telescope or plan frame uses `--danger`. |
| `--t*` / `--g*` ≥ ΔE 15 from ready, blocked, danger | §6 ΔE table, both themes, all pass |
| Anything without meaning is grey | Cover placeholders `--sunk`, stubs, ticks, rules, empty cells, room badges |
| `--on-*`, never literal `#fff` | Every filled control in the frames uses `--on-brand`, `--on-ready` or `--on-danger`; the dark values are `#0a0c10` (§6 pairs) |
| `--faint` text-safe; `--faint-deco` rules only | `--faint` ≥ 4.5 on all five surfaces (§6). `--faint-deco` used for rules, ticks and outlines only, now ≥ 3:1 (D8) |
| 44px thumb bar and icon buttons; nothing under 24×24 | Thumb bar 44, search 44×44, sheet close 44, tabs 44, chips and segments 32 with 44 hit, Name it 24, plan blocks ≥ 24 hit (stack rule), telescope cells ≥ 14/16 wide × 18–28 tall inside a 44px slider row |
| Real buttons or links with names; glyph + text | Cells `<a>` with `aria-label`; rails `role="slider"`; badges glyph + text + `aria-label`; switch `role="switch"`; stepper `role="group"` |
| Hue identifies data, never navigation | Tab underline and `h1` unit badge use `--m-*` only (as decided). Sidebar icons are neutral; telescope and plan hues come from `--t*` / `--g*` data. |
| Read-elsewhere hint grey and dashed, never green | Dashed `--muted` segment and `.seen` hint (specimen B3) |
| Plain CSS custom properties | `tokens.css`; Tailwind appears in §11 as reference only |
| Thumb bar fixed at the bottom with the mark verb primary | Phone frames A1.1 and A1.4; the verb names the label |
| No progress against the catalogue | Track rail cells fill by their own block's share; the catalogue appears only as grey provenance text |
| A track is a row of its blocks with `read / total` as text | Track rail plus ladder `81 / 2,180 read` (A2.2) |
| Position drawn, not counted | Telescope rails, brackets and head; plan rail against the rule |
| Sample figures illustrative | Stated in the frame notes and the intro |
| No `src/` code; design artefacts only | Everything is in `design/` |
| No renamed or removed tokens or classes | §10: additions and value changes only |
| No decorative gradients, no red on dashboards | Gradients are used only as hatch or tick textures that carry meaning; zero `--danger` on dashboard frames |
| Ambient tone carries no state (feel pass) | `--art` is clamped content colour, never a meaning, and can be switched off; every badge and fill keeps its token |
| No streaks, confetti or catalogue progress (feel pass) | The lens, the *Since Tuesday* stack and the rollup are run-relative or this-year counts. Completion is a record, not a celebration |
| Reduced motion (feel pass) | Every feel-pass movement uses `--dur-*` and goes to 0. The colour hold (`--dur-hold`) stays so the confirm state is still seen |


---

## 14. Feel pass — screens and behaviour (2026-10-05)

Drawn in `Ledger Feel Review.dc.html`, at 390 × 844 in dark and light, plus 768 × 1024 for the tablet.

### 14.1 Dashboard slots (comics; books and watch follow the same pattern)

| Slot | Content | Weight |
|---|---|---|
| 1 Now (hero) | Art band on `--art`: cover (`--cover-hero`), *Up now* kicker, `hero-num`, `story`, run · creator. Then the *This stretch* lens with a count (`45 of 381 read`), the *Since Tuesday* stack of up to 4 covers with a count, and *Also reading* as one row with a 32px secondary verb. | Only large element; `--r-hero` |
| 2 Next | Up next shelf, numbered in queue order, readiness badges unchanged, **Start** on the first card, **Reorder** on the slot head | Shelf |
| 3 Position | Telescope card, unchanged (horizontal, 14px min cell), plus the ladder | One card |
| 4 Situation | *Ready when you are*: at most three rows, plus an *All N* text link | Group |
| 5 Rollup | *2026 so far*: three this-year counts on `--raise`. Never the catalogue | One line of numbers |
| Thumb bar | Primary mark verb naming the label, `+ batch`, search | Fixed, 44px |

**Books:** Now is the book in hand (cover, title, author, `p. 212 of 468`, a 6px `--ready` meter, sittings). Position is the single-quarter strip (FP-D8). **Watch:** Now leads with a 16:9 still and a one-cell-per-episode strip. Position is the 2-rail telescope (show → season), and *Paused* rows are grey.

### 14.2 Empty and caught-up states

- **Between books** (books): a 72px cover of the last finished book with a `--ready` check, a `✓ finished · Sun` badge, *Between books.*, a line saying what you finished and how long it took, the top of the quarter's plan, and *Pick something else*.
- **All caught up** (comics): the same shape. The badge reads `✓ caught up · date` and the headline *All caught up.* A *Coming out* list shows the next release of each monthly run, with the date in mono `--ink-2` and a grey `in N days` chip (a date has no colour meaning). Then the top of Up next with its readiness badge, and *Pick something else*. Position uses the telescope empty variant without its button (FP-D13). The thumb bar verb is *Start {top of Up next}*.

### 14.3 The mark answers back (P2)

| t | What happens |
|---|---|
| 0 | Press: scale .97, brightness .88, `--dur-1`. The write is optimistic. |
| 120ms | Confirm: the button turns `--ready` / `--on-ready` and reads *✓ #141 read*. The lens cell fills (scale .5 → 1.12 → 1, `--dur-4`). A `✓ read` stamp lands on the hero cover. The counts tick (each number rises 70% with a fade, `--dur-4`): run read, *Since Tuesday*, this year. The run-rail segment grows and the head pill slides (`--dur-4`). The toast enters (12px rise, `--dur-4`). |
| +`--dur-hold` | The green holds for 600ms. This hold is kept under reduced motion. |
| 1.3s | Next: the next issue slides in from 20px right. A read-elsewhere issue shows the dashed grey hint, never green. The button returns to `--brand` with the next label, and the marked cover joins the stack. |
| 8s | The toast's 2px `--brand` countdown ends (it pauses on hover or focus) and the toast leaves. **Undo** reverses every step. |

Announced through the toast (`role="status"`). Under `prefers-reduced-motion`, every movement is instant and the states are the same.

### 14.4 Completion

- **Run complete** (FP-D11): a centred art band with the key art at 120 × 180, a grey `✓ read · month` badge, *Finished.* in display 44/46, the run and issue count, and the date span with its duration. Then a card with the run rail fully green (it fills once over `--dur-fill`) and the block rail. Then *What this opened* (readiness badges, *All N newly ready*), and one closing `line`. The verbs are *Start {next in block}* and *Not now*.
- **Block complete** (FP-D14): the block's covers fanned out (60 × 90, overlapping by 16), a grey badge, `X-Men · block 1 of 7`, *Foundations, done.*, and the run count, issue count and span. The track rail is the record: cell 1 fills (`--dur-fill`), then the head ring moves to block 2 (`--dur-4`). Then *The block* (its runs, each with a `--ready` check), *What this opened*, and a closing line. The verbs are *Start block 2* and *Not now*.

### 14.5 Tablet, 768–1023px (D-33)

- **Rail.** A 72px rail on `--surface` with a right `--rule`. Each item is a 56px target, with a 20px icon in a 48 × 28 pill over an 11px label. The current item has a `--raise` pill and a 3px `--m-comics` bar, the same hue rule as the tab underline. Search and Settings sit at the foot. There are no tooltips.
- **Column.** One content column with 32px padding, and h1 40/44.
- **Hero.** Horizontal: a 150 × 225 cover, with the number (56/60), story, run and the lens to its right. *Since Tuesday* and *Also reading* share one row, split in two.
- **Shelf.** 5 covers visible, with a 16px gap.
- **Telescope.** Phone sizing (`--tele-*` changes only at 900px), with W = column − 2 × 20 − 44 (548 at 768). The ladder becomes three columns.
- **Side rail.** The desktop side rail stacks below as two columns, 1.5 : 1 (*Ready when you are* | *2026 so far*).
- **Thumb bar.** It spans the content column at 48px.

Interaction follows the pointer, not the width (D-33).

---

## 15. Copy (P7, approved 2026-10-05)

| Before | After |
|---|---|
| 2 runs in flight · 12 up next · 41 ready to start | 14 issues since Tuesday. Next up: Days of Future Past. |
| PICK UP WHERE YOU LEFT OFF | Up now |
| Unlocked and waiting | Ready when you are |
| costs 4,173 | 4,173 to unlock |
| Marked read · Undo | #141 read · 46 of 381 in Uncanny X-Men · Undo |
| Nothing in progress (books) | Between books. Nothing's on the go, and that's fine. |
| Nothing in progress (comics) | All caught up. *(lede: X-Men #9 is out Wed 22 Oct.)* |
| 73 of 10,834 issues logged. Kept small and last… | (moved to Stats) |
| ✓ read · Oct 2026 (badge only) | Finished. Uncanny X-Men, all 381 issues. Mar 2025 – Oct 2026. |
| (none: block completion was not drawn) | Foundations, done. Five runs and 664 issues, ending with Excalibur. |

Voice: sentences in place of tallies, plain verbs (*to unlock*, *ready when you are*), no exclamation marks, no streak or scoring language. A closing line may name a record (*The longest run you've finished so far.*), but never a goal.

---

## 16. Feel-pass departures (accepted 2026-10-05)

These are numbered D1–D14 in `Ledger Feel Review.dc.html` §9 and prefixed FP- here, so they don't collide with SG-D1…SG-D12. FP-D1…FP-D12 were accepted by the owner. FP-D13 and FP-D14 came with the new states and are adopted unless the owner rejects them.

| # | Departure |
|---|---|
| **FP-D1** | The telescope moves to slot 3 (Position), out of the Now telecard. The component is unchanged. |
| **FP-D2** | Up next is a cover shelf. Drag and keyboard reorder move behind a **Reorder** button that opens the existing list. |
| **FP-D3** | A *This stretch* lens in Now: 24 issue cells around the head, run-relative. |
| **FP-D4** | Removed from the dashboard: *Rest of block 1* (now in the ladder), *The frontier* (now on the run list), the provenance line (now on Stats). *Also in flight* becomes one line in the hero. |
| **FP-D5** | Fonts: IBM Plex Sans, Plex Mono and Newsreader. The phone h1 becomes 32/36 Newsreader 500. |
| **FP-D6** | Ambient art tone (`--art`), clamped, carrying no state, and switchable off. |
| **FP-D7** | The mark button turns `--ready` for `--dur-hold` and reads *✓ #141 read*. |
| **FP-D8** | The books Position slot is a single-quarter strip against the 760k rule. The full plan rail stays on /books/plan. |
| **FP-D9** | Copy changes per §15. |
| **FP-D10** | Radii: hero 20 (new), thumb-bar buttons 12 (was 8). |
| **FP-D11** | A run-completion state on the run page after the last mark: grey badge, green fills, *What this opened*. |
| **FP-D12** | Watch *Paused*: grey rows for shows untouched for more than 4 weeks. No new colour. |
| **FP-D13** | *(new, 2026-10-05)* On dashboards, the empty telescope (A2.2) drops its own Start button, because the thumb bar carries the same verb. |
| **FP-D14** | *(new, 2026-10-05)* Finishing a block steps the completion screen up a level: the block's covers fanned out, the track rail as the record, the block's runs listed, and *Start block 2*. |
