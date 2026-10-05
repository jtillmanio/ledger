# Ledger — Style Guide & Data Presentation (Step 3)

**Status:** design proposal, 2026-09-30. Nothing here touches `src/`.

**Files in `design/`:**

| File | What it is |
|---|---|
| `tokens.css` | Light and dark tokens, drop-in for `src/app/globals.css`. Same names; additions are marked `+ NEW` and changed values `~`. |
| `Style Guide.dc.html` | Hub page, plus the **B specimen** in dark and light at 390 and 1000px. |
| `Telescope Spec.dc.html` | Workstream A1–A3: 7 variants × 390/1000 × dark/light, plus hover, focus and scrub. |
| `Plan Rail Spec.dc.html` | Workstream A4: quarter, settled and drag (the month frame is retired, D-38). |
| `Telescope.dc.html`, `PlanRail.dc.html`, `Specimen.dc.html` | The components the pages import. Geometry is computed by the real `allocate()` rule. |

**Precedence.** `design/mockups.html` wins on layout and copy, and `globals.css` wins on token values. Every place this guide departs from either is listed in §12 *Proposed deviations*.

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
| Scale | 1000k = H (quarter) | same |
| Capacity rule | 1.5px dashed `--ink-2`, label `760k` on `--surface` | same |
| Column gap | 6 | 10 |
| Fifth lane | 52px, 1px dashed `--blocked` left border, `.un` blocks (`--blocked-soft`, 1px dashed `--blocked`) | 150px, labelled *2027 · no quarter* |
| Block | `button.qb`, radius 3, `--reading-soft`, 1px `--rule` ring, 3px `--hue` left edge, gap 2 | same, with inline title (≥ 18px tall) and words (≥ 32px) |
| Estimated | 1.5px dotted `--muted` top edge; label `~65k` (`~` at 400 `--muted`) | same |
| Over capacity | The portion of a block above the rule gets `--hatch` over `--blocked-soft`, and the block's ring turns `--blocked`. Labels sit on a `--surface` chip over the hatch. | same |
| Settled (stretch year) | Hatch turns `--hatch-settled` (grey). The decision card becomes `.decide.settled`: *2027 accepted as a stretch year on 14 Sep.* plus **Undo**. | same |
| Stack | Two or more adjacent sub-24px blocks merge into one button: `--raise`, dashed `--faint-deco` (the telescope stub's vocabulary), `+N` over `Nk`, height = the sum or 24, whichever is larger. A single sub-24px block keeps its drawn height with a 24px `::after` hit area. | same |
| Footer | `Q1`, `892k` and an overage badge only (`+132k`, amber). Room is implied by the rule. | `Q1`, `892k / 760k`, and either `over 132k` (amber) or `56k room` (grey, M-06) |
| Drag (desktop) | — | The ghost is rotated −1.5° on `--sh-2` with a 2px dashed `--brand` outline. The source keeps a dashed placeholder. `output.dropdelta` (`aria-live`) reads *Q3 +99k → 514k / 760k*. The Move sheet stays the keyboard and phone route. |

**Shared with the telescope:** radius 3, gap 2, dashed = folded, dotted = estimated, hatch = held, `--focus-ring`, 11px floor, mono tabular numbers.

---

## 4. B1 — Tokens

The full set is in `tokens.css`. The rules behind it follow.

### 4.1 Surfaces

| Order | Light (relative luminance) | Dark |
|---|---|---|
| Lowest | `--sunk` .83 | `--page` .0036 |
| | `--page` .91 | `--sunk` .0051 |
| | `--raise` .95 | `--surface` .0074 |
| Highest | `--surface` = `--overlay` 1.0 (separated by shadow) | `--raise` .0122 → `--overlay` .0166 |

Rules:

- **Bordered.** A surface sitting on `--page` gets a 1px inset `--rule` ring.
- **Tonal.** A surface inside a surface (a row header, a hover row, a well) changes tone and has no ring.
- **Neither.** A row inside a group has only a `--line` divider.

### 4.2 Shadows and glow

- **Light.** `--sh-1` is a hairline lift. `--sh-2` is for popovers and toasts. `--sh-3` is for sheets and dialogs.
- **Dark.** Depth comes from tone plus a 1px inner top highlight (`inset 0 1px 0 rgba(255,255,255,.03–.06)`). A drop shadow appears only from `--sh-2` up.
- **Glow.** `--halo` (a 3px ring plus a 14px bloom in dark) is used **only on the telescope head cell**. It is never decorative.

### 4.3 Scales

| Scale | Values |
|---|---|
| Radius | `--r-cell` 3 · `--r-sm` 6 (badges, tags) · `--r-md` 8 (buttons, inputs) · `--r-lg` 12 (groups, toasts) · `--r-xl` 16 (cards, sheets) · `--r-full` |
| Spacing | 4px base: 2 · 4 · 6 · 8 · 12 · 16 · 20 · 24 · 32 · 40 (`--sp-*`) |
| Motion | `--dur-1` 100 (hover, press) · `--dur-2` 150 (check, chevron, tab indicator) · `--dur-3` 200 (menus, era expand, bracket) · `--dur-4` 300 (sheet enter, segment grow) · `--ease-out` `cubic-bezier(.2,.8,.2,1)` for enter · `--ease-in` `cubic-bezier(.4,0,1,1)` for exit at ~70% of the duration. `prefers-reduced-motion` sets every duration to 0. |

---

## 5. B2 — Typography

Families are kept: **Inter Tight** (UI) and **JetBrains Mono** (labels, counts, ranges, keys; `font-variant-numeric: tabular-nums`). They are already shipped, and the mono face's wide x-height suits dense issue labels.

| Style | Size / LH | Weight | Tracking | Use |
|---|---|---|---|---|
| `kicker` / mono-label | 11/14 mono | 500 | +0.08em, caps | Card kickers, rail keys, ladder keys, frame tags |
| `caption` | 12/16 | 500 | 0 | Provenance, legends, timestamps |
| `body-sm` | 13/18 | 400 | 0 | `.rs` secondary lines, lede, notes |
| `body` | 14/20 | 400 | −0.003em | UI body, buttons (600), menu items |
| `row-title` | 15/20 (.9375rem) | 600 | −0.006em | `.rt`, run and book titles |
| `h3.s` section | 12/16 | 600 | +0.06em, caps, `--ink-2`; count in mono 11 `--muted` | Section heads. They are distinguished from rows by treatment, not size. |
| `h1.t` / `h2.t` screen title | 24/28 phone · 30/34 desk | 700 | −0.028em | One per page |
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

## 6. Contrast and ΔE2000 (computed from the proposed values)

**Glass note.** `--ready` *text* on light glass over black reaches 4.29:1, so ready-coloured text is not allowed on glass chrome. The sync pill uses a green dot (non-text) plus `--ink-2` text. Every other pair passes.

### Text tokens on every surface (floor 4.5:1)

| Text token | Theme | page | surface | raise | sunk | overlay |
|---|---|---|---|---|---|---|
| `--ink` | light | 16.72 | 18.26 | 17.34 | 15.69 | 18.26 |
| `--ink` | dark | 16.38 | 15.30 | 14.13 | 15.95 | 13.19 |
| `--ink-2` | light | 9.27 | 10.12 | 9.61 | 8.70 | 10.12 |
| `--ink-2` | dark | 10.69 | 9.99 | 9.23 | 10.41 | 8.61 |
| `--muted` | light | 5.38 | 5.88 | 5.58 | 5.05 | 5.88 |
| `--muted` | dark | 6.73 | 6.28 | 5.80 | 6.55 | 5.42 |
| `--faint` | light | 5.14 | 5.62 | 5.33 | 4.83 | 5.62 |
| `--faint` | dark | 6.32 | 5.90 | 5.45 | 6.15 | 5.09 |
| `--brand` | light | 6.78 | 7.41 | 7.03 | 6.36 | 7.41 |
| `--brand` | dark | 8.17 | 7.63 | 7.05 | 7.96 | 6.58 |
| `--brand-ink` | light | 8.83 | 9.64 | 9.15 | 8.28 | 9.64 |
| `--brand-ink` | dark | 10.80 | 10.08 | 9.31 | 10.51 | 8.70 |
| `--ready` | light | 4.91 | 5.36 | 5.09 | 4.60 | 5.36 |
| `--ready` | dark | 9.04 | 8.44 | 7.79 | 8.80 | 7.28 |
| `--blocked` | light | 5.63 | 6.15 | 5.83 | 5.28 | 6.15 |
| `--blocked` | dark | 9.28 | 8.67 | 8.01 | 9.04 | 7.48 |
| `--danger` | light | 6.06 | 6.62 | 6.29 | 5.69 | 6.62 |
| `--danger` | dark | 7.51 | 7.01 | 6.48 | 7.31 | 6.05 |

### Paired fills (floor 4.5:1)

| Pair | Light | Dark |
|---|---|---|
| `--ready` on `--ready-soft` | 4.70 | 7.60 |
| `--blocked` on `--blocked-soft` | 5.42 | 7.93 |
| `--danger` on `--danger-soft` | 5.65 | 6.63 |
| `--brand-ink` on `--brand-soft` | 8.25 | 8.90 |
| `--reading` on `--reading-soft` | 6.34 | 6.73 |
| `--muted` on `--sunk` | 5.05 | 6.55 |
| `--on-brand` on `--brand` | 7.41 | 8.17 |
| `--on-ready` on `--ready` | 5.36 | 9.04 |
| `--on-danger` on `--danger` | 6.62 | 7.51 |
| `--on-muted` on `--muted` | 5.88 | 6.73 |
| `--toast-ink` on `--toast-bg` | 16.72 | 13.19 |
| `--toast-link` on `--toast-bg` | 9.05 | 8.70 |

### UI component boundaries (floor 3:1)

| Boundary | Against | Light | Dark |
|---|---|---|---|
| `.chk` unchecked ring (`--muted`) | `--surface` | 5.88 | 6.28 |
| telescope cell edge, stub dash, rail outline (`--faint-deco`) | `--surface` | 3.35 | 3.49 |
| cell edge on hover (`--raise`) (`--faint-deco`) | `--raise` | 3.18 | 3.22 |
| stub edge inside a sheet (`--faint-deco`) | `--overlay` | 3.35 | 3.01 |
| focus ring on page (`--brand`) | `--page` | 6.78 | 8.17 |
| focus ring on surface (`--brand`) | `--surface` | 7.41 | 7.63 |
| read segment vs unread track (`--ready`) | `--sunk` | 4.60 | 8.80 |
| over-capacity hatch stroke (`--blocked`) | `--surface` | 6.15 | 8.67 |
| head cell stroke vs cell (`--brand`) | `--sunk` | 6.36 | 7.96 |

### Glass chrome, worst case (floor 4.5:1)

Glass is `--surface` at α 0.90 composited over the worst content that can scroll beneath it: pure white (dark theme; cover art) and pure black (light theme). Blur does not help the worst case, so it is not counted.

| Text on glass | Light (over #000) | Dark (over #fff) |
|---|---|---|
| `--ink` | 14.63 | 11.68 |
| `--ink-2` | 8.11 | 7.63 |
| `--muted` | 4.71 | 4.80 |
| `--brand` | 5.94 | 5.83 |
| `--ready` | 4.29 | 6.44 |
| `--blocked` | 4.92 | 6.62 |

### Identity hues vs functional colours (ΔE2000, floor 15)

| Hue | Light: ready · blocked · danger | Dark: ready · blocked · danger |
|---|---|---|
| `--t1` / `--g1` | 45.1 · 52.9 · 43.8 | 41.8 · 48.0 · 40.4 |
| `--t2` / `--g2` | 47.4 · 52.2 · 34.6 | 47.9 · 50.7 · 31.8 |
| `--t3` / `--g3` | 15.8 · 31.5 · 54.5 | 22.8 · 33.6 · 59.4 |
| `--t4` / `--g4` | 27.6 · 17.5 · 39.0 | 33.9 · 20.0 · 43.3 |
| `--t5` / `--g5` | 47.6 · 55.4 · 40.8 | 44.0 · 48.3 · 34.2 |
| `--t6` / `--g6` | 27.5 · 42.1 · 52.2 | 25.5 · 40.6 · 54.7 |
| `--t7` / `--g7` | 69.4 · 38.4 · 18.2 | 67.3 · 39.6 · 19.3 |
| `--t8` / `--g8` | 26.4 · 31.5 · 33.8 | 28.6 · 31.7 · 31.1 |

### Elevation order (relative luminance)

| Theme | page | sunk | surface | raise | overlay |
|---|---|---|---|---|---|
| light | 0.9114 | 0.8522 | 1.0000 | 0.9467 | 1.0000 |
| dark | 0.0036 | 0.0051 | 0.0074 | 0.0122 | 0.0166 |


---

## 7. B3 — Containers

| Container | Border | Radius | Padding | Elevation, light / dark |
|---|---|---|---|---|
| `group` | 1px inset `--rule` | 12 | 0; rows carry padding | `--sh-1` / inner highlight |
| `row` | `--line` bottom divider | — | 12 × 14, min-height 48 | none; hover `--raise` (100ms) |
| `telecard` | 1px inset `--rule`; 3px identity stripe | 16 | 16 phone / 20 desk | `--sh-1` (was `--sh-2`) |
| `hero` | as telecard | 16 | 16 / 20 | `--sh-1` |
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
  - Primary slot `flex:1`, 44px, `--brand` / `--on-brand`, text truncates with ellipsis.
  - `+ batch` secondary: 44px, 1px `--rule-2`.
  - Search: 44×44 with a drawn magnifier, replacing the U+26B2 glyph.
  - Desktop dashboards keep header buttons (DN-2 a). The spine and krakoa keep the bottom bar.
- **Status tablist.** Links with `role="tab"`, 44px tall, counts in mono 11. The selected tab is `--ink` 600 with a 2px `--m-*` underline; the others are `--muted` 500. The underline slides between tabs (150ms).
- **Segmented control.** A raised pill (`--surface` + `--sh-1`) on a `--sunk` track, 32px (44 hit). Proposed deviation D4.
- **Chips.** Filter-on is neutral inverse (`--ink` / `--page`), filter-off is surface plus a ring, hover goes to `--raise` with a `--faint-deco` ring.
- **Switch.** 36×20, on = `--brand` track with an `--on-brand` knob, off = `--sunk` with a `--faint-deco` ring and a `--muted` knob; `role="switch"`, 44px row. **Stepper:** `role="group"`, 32px buttons on `--sunk`, `<output>` mono.
- **Toast.** `--toast-bg` / `--toast-ink`, with Undo in `--toast-link` 700. `role="status"`. A 2px `--brand` countdown bar runs along the bottom edge over 8s and pauses on hover or focus.
- **Skeletons.** The loaded geometry exactly (row 78px with a 36×54 cover, title 12px, meter 5px) in `--sunk`. The shimmer is off under reduced motion.
- **Sync pill.** A 6px dot (`--ready` online; `--blocked` offline or queued) plus `--ink-2` text. The offline strip is `--blocked-soft` with a `--blocked` ring.
- **Rate-limited status line.** Amber, because it is held: a countdown in mono and **Type it instead**.
- **API error status line.** Neutral surface with a grey × glyph. It is not red: nothing destructive happened.
- **Empty slate.** `--raise` panel, a 15/20 title, a 13/18 reason, and exactly one primary action.
- **Metadata pending.** A dashed `--muted` cover outline plus an italic *metadata pending* line.

---

## 10. Changelog — additions and changed values

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
