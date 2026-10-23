# 04 — Design: Ledger

How the Ledger looks and behaves: which design file answers which question, the
tokens, the telescope and the plan rail, the UX floor every UI task meets, and
the interface rules behind every screen. §1–§9 are the styling-blueprint index
(they keep their numbers, which code and tasks cite); §10 is the UX floor;
§11–§14 are the interface: the patterns, the dashboards, the detail sheets and
the per-screen refinements.

The design files themselves win over this one on what they draw (§2), and the
code wins over all of them on what runs (D-1). Screens are named by their
`design/mockups.html` `data-id` ([design/mockups-index.md](../design/mockups-index.md)).

The blueprint is the index to how the Ledger looks: which design file answers which
question, how the tokens get into the app, how to read the Tailwind names in the
design files, and the telescope's 3-rail and 2-rail rules. The files it points
at came out of the Step 3 style-guide pass and Review N (2026-09-30). The owner
adopted them as the blueprint in **D-31** (`docs/review/decisions.md`). The
**feel pass** (2026-10-05) updated them and added cover-led dashboards, mark-read
feedback, completion screens and the tablet layout. The owner adopted it as
**D-40**, with palette **1c After hours**; §9 below is its index.

**The token values and the fonts are built** (D-40): `src/app/globals.css`
carries `tokens.css` (palette 1c) and self-hosts IBM Plex Sans, Plex Mono and
Newsreader. Everything else — control states (1.8a), the shell (1.8), the
telescope (2.5, 2.5b), the dashboards and the feel-pass screens (§9) — lands
with its task. Until each task lands, the code is what runs (D-1). The `design/` files are reference specs: they are never
imported by `src/` and are kept as they were delivered.

---

## 1. The files

| File | What it is | Open it for |
|---|---|---|
| `design/STYLE_GUIDE.md` | The written spec: decisions, telescope geometry sheet and state matrix, plan rail, tokens, type, contrast and ΔE tables (palette 1c), containers, glass, component polish, changelog, the Tailwind appendix, the proposed deviations SG-D1…SG-D12, and the feel pass: **§14 screens and behaviour (§14.6 desktop), §15 copy, §16 departures FP-D1…FP-D18** | The rule and the reason behind a value |
| `design/tokens.css` | Every token in light and dark (palette 1c, D-40), plus the breakpoint, glass, `--art`, reduced-transparency and reduced-motion blocks. Existing names kept; additions marked `+ NEW`, changed values `~` | The values. They are in `globals.css` (D-40) |
| `design/Ledger Feel Review.dc.html` | The feel pass's review page: diagnosis, palette decision aid, and phone mockups in dark and light of comics, the mark storyboard, books (reading and between books), watch, run detail, run complete, all caught up, block complete, and the 768px tablet; its §11 imports the desktop frames. Its §9 lists the departures D1–D14 (FP- in the style guide) | What a feel-pass screen or state looks like |
| `design/LedgerComics.dc.html` | The comics dashboard component the review page imports. Mark-read is live in it | The mark sequence, frame by frame (1.8b) |
| `design/LedgerDesktop.dc.html` | The desktop frames (review §11, 2026-10-06): /comics at rest at 1280 and 1024, all caught up, /books reading and between books, run complete and block complete, dark and light, with builder notes and the desktop contrast table. FP-D15…FP-D18 come from here | A screen at 1024px and up (1.8, 2.4, 2.2, 2.12) |
| `design/LedgerNav.dc.html` | The desktop sidebar (224px, 1280 and up) and icon rail (64px, 1024–1279) the desktop frames import | The desktop navigation (1.8) |
| `design/ledger-feel-tokens.css` | All three palettes (1a, 1b, 1c) in oklch, imported by the pages above | The oklch source of a hex |
| `design/screenshots/` | PNGs of every frame of the review page, exported by Claude Design in palette 1c, dark and light: `phone/`, `tablet/` and `desktop/`. Its README maps each to its task | **Looking at** a feel-pass screen: the review page's source is templates, the PNGs are pictures |
| `design/handoff/` | The feel pass as delivered: the prompt, the implementation checklist (each step names its task), the D-40 draft, the 1a and 1b colour blocks (`palette-swaps.css`), and the contrast report for all three palettes plus the desktop pairs | Where a feel-pass step went |
| `design/archive/` | The 2026-09-30 `STYLE_GUIDE.md` and `tokens.css`, as they were before the feel pass | History only |
| `design/Style Guide.dc.html` | The hub page, and the **B specimen**: type, numbers, elevation, containers, badges, chips, buttons, tabs, glass, feedback states and the cell vocabulary, in dark and light at 390 and 1000px | Seeing a component in all its states |
| `design/Telescope Spec.dc.html` | Workstream A1–A3: seven telescope variants and three interaction states, each in dark and light at 390 and 1000px | The telescope, variant by variant |
| `design/Plan Rail Spec.dc.html` | Workstream A4: quarter (held), quarter (settled) and desktop drag; the month frame is retired (D-38) | The plan rail |
| `design/Telescope.dc.html` | The telescope component the spec page imports. Its `alloc()`, `niceStep()` and `fit()` are the reference implementation of `layout.ts` | Porting the geometry (task 2.5) |
| `design/PlanRail.dc.html` | The plan-rail component; `stackCol()` is the reference for the stack and hatch rules | Porting the plan rail (2.2b) |
| `design/Specimen.dc.html` | The component the hub imports for the B specimen | — |
| `design/support.js` | The Claude Design runtime that renders the `.dc.html` pages (generated; do not edit) | Nothing: it only has to sit beside them |
| `docs/review/NEW_UI_AUDIT_REPORT.md` | Review N: the visual-polish and UX audit (UX-N01…N29, UX-X01…X07, decisions N-DN1…N-DN4) that the style guide answers | Why a task line exists |

**Opening the `.dc.html` pages.** Open them in a browser from the `design/`
folder, with `support.js` beside them. They load React and the web fonts
from public CDNs, so they need a network connection (the app itself makes no
external requests: its fonts are self-hosted). The hub links to the two spec
pages; the feel pass is `Ledger Feel Review.dc.html`.

The older design files keep their roles: `design/mockups.html` (v4) for every
screen's layout and copy, `design/mockups-index.md` for its screen ids and the
*Not shown* list, and `docs/review/UI_AUDIT_REPORT.md` as the Sept 18 audit that
v4 absorbed.

## 2. Which file wins

| Question | Wins | Loses to it |
|---|---|---|
| Layout and copy of a surface the feel pass drew (dashboards, the mark, completion, empty and caught-up states, the tablet, desktop at 1024px and up) | `STYLE_GUIDE.md` §14–§15 and `Ledger Feel Review.dc.html` (D-40) | `design/mockups.html` |
| Layout of any other screen, its copy, what sits in which slot | `design/mockups.html` | a task description (CLAUDE.md) |
| A token's value | `design/tokens.css`, which `globals.css` and the mockup's `.app` blocks match (`test:tokens`) | the mockup's one-off values |
| Type, spacing, radius, elevation, glass, motion | `design/STYLE_GUIDE.md` §4–§9 | the mockup's one-off values |
| Telescope and plan-rail geometry, variants and states | `STYLE_GUIDE.md` §2–§3 and the two spec pages | the mockup's vertical telescope (SG-D1) |
| Why the schema, views or routes are the way they are | `docs/03-data-model.md`, `docs/02-architecture.md` | this file |
| What a task must do to pass | `docs/05-roadmap.md` (its **Check:**) and the task file | this file |

Where the blueprint and the mockup disagree on the blueprint's own ground, the
task that builds the component redraws the mockup in the same PR (standing rule 6). Figures in every design file are sample data (D-7).

Where Review N and the style guide give different values (Review N's light
`--page` is `#f5f6f8` and its section heads are 15px; the style guide's are
`#f3f5f8` and 12px caps), **the style guide wins**: it is the later pass, and
its values are the ones measured in its §6 tables.

## 3. Tokens

### 3.1 The families

| Family | Tokens | Rule |
|---|---|---|
| Surfaces | `--page`, `--surface`, `--raise`, `--sunk`, `--overlay` | `--sunk` is below `--surface` in both themes (SG-D2); `--overlay` is for sheets, menus, dialogs, tooltips |
| Ink | `--ink`, `--ink-2`, `--muted`, `--faint` | All four clear 4.5:1 on all five surfaces, both themes |
| Hairlines | `--rule`, `--rule-2`, `--line`, `--faint-deco` | `--faint-deco` outlines controls and clears 3:1 (SG-D8); it is never text |
| Meaning | `--brand`, `--ready`, `--blocked`, `--danger`, `--reading`, each with `-soft`; `--brand-ink` | The four meanings (`.claude/rules/ui.md` *Style*) |
| Text on a fill | `--on-brand`, `--on-ready`, `--on-danger`, `--on-muted` | Never a literal `#fff` |
| Toast | `--toast-bg`, `--toast-ink`, `--toast-muted`, `--toast-link` | Dark toast is tonal, not a light slab (SG-D3); `--toast-muted` is its second line (D-40) |
| Art tone | `--art`, from inline `--art-d` / `--art-l` on `[data-art]` | A cover's clamped ambient tone (FP-D6): content colour, never state; `--surface` when missing or `data-ambient="off"` |
| Covers | `--cover-hero` 112 (150 from 768px) · `--cover-shelf` 112 · `--cover-row` 36 · `--sh-cover` · `--r-cover` 4 | 2:3. A spine row stays `--cv-row-*` 28×42 (SG-D13) |
| Identity | `--t1…--t8`, `--g1…--g8`, `--m-comics/books/watch` | Unchanged; ΔE2000 ≥ 15 from ready, blocked, danger (D-24) |
| Elevation | `--sh-1`, `--sh-2`, `--sh-3`, `--halo`, `--focus-ring` | Three tiers; `--halo` is the telescope head and the lens head only |
| Glass | `--glass-bg`, `--glass-edge`, `--glass-hi`, `--glass-blur`, `--glass-sat`, `--scrim` | Chrome only; α .90 (SG-D12) |
| Texture | `--hatch`, `--hatch-settled` | Held, and accepted |
| Radius | `--r-cell` 3 · `--r-cover` 4 · `--r-sm` 6 · `--r-md` 8 · `--r-lg` 12 · `--r-xl` 16 · `--r-hero` 20 · `--r-full` | Badges `sm`, buttons `md`, groups and thumb-bar buttons `lg` (FP-D10), cards and sheets `xl`, the Now slot `hero` |
| Spacing | `--sp-0-5` 2 · `--sp-1` 4 · `--sp-1-5` 6 · `--sp-2` 8 · `--sp-3` 12 · `--sp-4` 16 · `--sp-5` 20 · `--sp-6` 24 · `--sp-8` 32 · `--sp-10` 40 | A 4px grid |
| Type | `--fs-kicker` 11/14 · `--fs-caption` 12/16 · `--fs-body-sm` 13/18 · `--fs-body` 14/20 · `--fs-row-title` 15/20 · `--fs-section` 12/16 · `--fs-title` 32/36 (desk 40/44, Newsreader) · `--fs-hero-name` 26/30 · `--fs-hero-num` 44/48 · `--fs-display` 40/40 (desk 48/48) | Size/line-height only; weight and tracking per STYLE_GUIDE §5. Nothing under 11px |
| Families | `--sans` IBM Plex Sans · `--mono` IBM Plex Mono · `--display` Newsreader | Self-hosted (D-40). Newsreader only for titles, hero names, story titles and completion lines; counts stay mono (D-32) |
| Telescope | `--tele-min`, `--tele-gap`, `--tele-rail`, `--tele-run`, `--tele-bracket`, `--tele-gutter` | Phone 14/2/18/24/16/44, desktop 16/2/20/28/20/72 |
| Density | `--row-h` | 48px; 32px under desktop `data-density="compact"` (6.11) |
| Motion | `--dur-1` 100 · `--dur-2` 150 · `--dur-3` 200 · `--dur-4` 300 · `--dur-fill` 900 · `--dur-hold` 600 · `--ease-out` · `--ease-in` | Zero under `prefers-reduced-motion`, except `--dur-hold`: it holds a colour, not a movement |

### 3.2 Moving `tokens.css` into `globals.css` (done with D-40)

`npm run test:tokens` (`scripts/check-tokens.mjs`) reads `globals.css` through
three selectors and requires every token there to have the same value in
`design/mockups.html`'s `.app` blocks. `tokens.css` uses the mockup's selectors,
so the move translates them:

| `tokens.css` | `src/app/globals.css` |
|---|---|
| `.app,:root{ … }` | `:root{ … }` |
| `.app[data-theme="dark"]{ … }` | `:root[data-theme="dark"]{ … }` **and** `@media (prefers-color-scheme: dark){ :root:not([data-theme="light"]){ … } }`, identical |
| `@media (min-width:900px){ .app,:root{ --tele-*… } }` | the same block on `:root` |
| `.app[data-density="compact"]` | as written, desktop only |
| glass fallback, `prefers-reduced-transparency`, `prefers-reduced-motion` | as written, on `:root` |

In the same PR the mockup's `.app` and `.app[data-theme="dark"]` blocks take the
same values, or `test:tokens` fails on parity. The `--mark`, `--held`, `--paper`,
`--paper-sunk`, `--col` and `--step` aliases stay. No token or class is renamed
or removed (SG §13).

With D-40, `check-tokens.mjs` also checks the toast pairs on `--toast-bg`,
every figure in `design/handoff/contrast-metrics.json` for palette 1c, text on
the `--art` clamp extremes, and that `globals.css` carries every token in
`tokens.css` unchanged. 1.8a adds the checks that make the rest
stay true as explicit floors: the elevation order, every text token on every surface, the paired
fills, `--faint-deco` at 3:1, text on glass at its worst case, and an 11px
floor. The exact list is in roadmap 1.8a.

## 4. Tailwind patterns — reference only

**The app does not use Tailwind and is not going to** (architecture § Stack; D-31
takes Review N's option N-DN1 (a)). The style guide's §11 and the whole of
`NEW_UI_AUDIT_REPORT.md` write recommendations in Tailwind names because many
people think in that scale. Read them as names for our custom properties. Never
add a Tailwind dependency, a `tailwind.config.js` or a utility class to `src/`.

### 4.1 Names

| Tailwind name | Custom property | Value |
|---|---|---|
| `rounded-md` · `rounded-lg` · `rounded-xl` · `rounded-2xl` · `rounded-full` | `--r-sm` · `--r-md` · `--r-lg` · `--r-xl` · `--r-full` | 6 · 8 · 12 · 16 · 999px |
| `p-1` · `p-2` · `p-3` · `p-4` · `p-5` · `p-6` · `p-8` | `--sp-1` · `--sp-2` · `--sp-3` · `--sp-4` · `--sp-5` · `--sp-6` · `--sp-8` | 4 · 8 · 12 · 16 · 20 · 24 · 32px |
| `text-2xs` · `text-xs` · `text-sm` · `text-base` · `text-md` | `--fs-kicker` · `--fs-caption` · `--fs-body-sm` · `--fs-body` · `--fs-row-title` | 11/14 · 12/16 · 13/18 · 14/20 · 15/20 |
| `text-2xl` · `text-3xl` · `text-display` | `--fs-title` · `--fs-title-desk` · `--fs-display` | 32/36 · 40/44 · 40/40 |
| `shadow-sm` · `shadow-lg` · `shadow-2xl` | `--sh-1` · `--sh-2` · `--sh-3` | the three tiers |
| `duration-100` · `-150` · `-200` · `-300` | `--dur-1` · `--dur-2` · `--dur-3` · `--dur-4` | ms |
| `ease-out` · `ease-in` | `--ease-out` · `--ease-in` | `cubic-bezier(.2,.8,.2,1)` · `cubic-bezier(.4,0,1,1)` |
| `backdrop-blur-[20px]` | `--glass-blur` | 20px |

### 4.2 Recipes in the audit, and what we write instead

| The audit writes | Write |
|---|---|
| `bg-surface ring-1 ring-slate-900/[0.07]` (a grounded card) | `background: var(--surface); box-shadow: inset 0 0 0 1px var(--rule), var(--sh-1)` |
| `ring-1 ring-white/[0.06]` (dark card) | the same rule; dark `--rule` and `--sh-1` already carry it |
| `shadow-lg shadow-slate-900/10` (menu, popover) | `box-shadow: var(--sh-2)` on `--overlay` |
| `shadow-2xl` + `bg-slate-950/40 backdrop-blur-[2px]` (sheet) | `--overlay` + `--sh-3`, over `background: var(--scrim)` |
| `bg-ink text-page` (selected chip) | `background: var(--ink); color: var(--page)` (SG-D4) |
| `text-2xs font-semibold uppercase tracking-wide text-muted` (kicker) | `font: 500 var(--fs-kicker) var(--mono); letter-spacing: .08em; text-transform: uppercase; color: var(--faint)` (SG-D7) |
| `text-sm font-medium text-brand hover:underline` (All N) | a plain link in `--brand`, 13/18 500 (SG-D6) |
| `ring-2 ring-brand` (editing field) | `box-shadow: 0 0 0 2px var(--brand)` |
| `focus-visible:ring-2 ring-offset-2` | `box-shadow: var(--focus-ring)` |
| `opacity-50 cursor-not-allowed` on `disabled` | `[aria-disabled="true"]` plus a visible reason line (UX-N18) |
| `translate-y-px` on press | `transform: translateY(1px)` for `--dur-1` |
| `size-4` / `size-5` icon | 16 / 20px |

### 4.3 The `theme.extend` block, as a lookup table

Copied from STYLE_GUIDE §11 so the mapping sits beside the rule. **Reference
only: not a file in the repo, not used by `src/`.** Every value points at a CSS
variable, never at a copied hex.

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
    'row-title':['15px','20px'], section:['12px','16px'], title:['32px','36px'], 'title-desk':['40px','44px'],
    display:['40px','40px'], 'display-desk':['48px','48px'] },
  fontFamily:{ sans:'var(--sans)', mono:'var(--mono)' },
  boxShadow:{ 1:'var(--sh-1)', 2:'var(--sh-2)', 3:'var(--sh-3)', halo:'var(--halo)', focus:'var(--focus-ring)', 'glass-hi':'var(--glass-hi)' },
  transitionDuration:{ 1:'100ms', 2:'150ms', 3:'200ms', 4:'300ms' },
  transitionTimingFunction:{ out:'cubic-bezier(.2,.8,.2,1)', in:'cubic-bezier(.4,0,1,1)' },
  backdropBlur:{ glass:'20px' },
}}
```

## 5. The telescope

The rules and their reasons, then the working sheet for tasks 2.5 and 2.5b. The
variants are drawn in `Telescope Spec`.

**The telescope** is the comics "now" slot: three horizontal rails stacked top
to bottom — the track's blocks, the block's runs, the run's issues — with
brackets carrying the eye from coarse to fine, so all three nested positions
read at once as geometry rather than as three percentages. It needs no new
tables and no new views: `block_position` already returns "run 2 of 5 in block
1 of 7", `block_progress` gives per-block issue and read counts, and
`run_progress` gives the run's own. Two ordered queries over views that exist.

**The rails are horizontal at every width, phone portrait included** (D-31,
SG-D1; the first drafts drew them vertical). Four reasons, in order of weight:

1. **Gesture.** Each rail is a `role="slider"`. On a phone a vertical drag is
   page scroll, so a vertical rail either steals scrolling or never scrubs; a
   horizontal drag competes with nothing.
2. **Height.** The vertical drawing took about 354px of an 806px phone
   viewport. Three horizontal rails with their ticks take 124px on the phone
   and 140px on desktop, which puts *Also in flight* and *Up next* above the fold.
3. **Width is enough at 360px.** The run rail is 250px wide in a 360px frame
   (282 at 390, 832 at 1000): room for the X-Men track's seven blocks (110px
   minimum) and a five-run block (82px). Overflow starts at 16 cells on a 360px
   phone.
4. **Thumb reach.** The rails sit in the upper middle of the card and scrub
   with a sideways thumb swipe; the mark verb stays in the bottom thumb bar.

**Telescope geometry is a pure function.** The layout lives in
`src/components/telescope/layout.ts` and is the same on every rail, so the
mockups are held to the same numbers the code will be. The rule did not change
when the rails turned; its axis did — `H` became `W`:

```ts
allocate(counts: number[], W: number, gap = 2, min = 14): Item[]
  avail = W - gap * (n - 1)
  if n * min > avail: return overflow(counts, head, W, gap, min)
  rest = avail - n * min
  return counts.map(c => ({ x, w: min + (c / total) * rest,
                            floored: (c / total) * avail < min }))
```

- `W` is the rail's width: the frame minus page gutters, card padding and a
  fixed rail-key gutter (`--tele-gutter`, 44px phone / 72px desktop) that holds
  the *TRACK · BLOCK · RUN* keys, so no label can collide with a bracket.
- `min` is **14px on the phone and 16px on desktop** (`--tele-min`). Widths are
  `min` plus a proportional share of what is left, so a 6-issue run beside a
  381-issue run is a legible cell, and no rail gives a run more than its share
  of `rest`. On a 282px rail that pair is 17.9px and 262.1px.
- **A floored cell says so.** When a cell's proportional share is under `min`
  it is drawn wider than its data; it keeps its full edge and fill (so it never
  reads as a stub) and carries a centred 4px dot, and the legend reads *• shown
  at minimum width* (SG-D10). That is the data-honesty rule applied to a floor.
- `overflow()` applies when `n · min > avail`. It keeps the **head cell and two
  neighbours either side** at `min` or wider — the window shifts at an edge so
  five are always kept — and folds the rest into at most two dashed stubs, one
  before and one after, each `min` wide. A stub's run or block count and summed
  issue count go in its accessible name, the ladder and its popover
  (*+25 runs · 687 issues — open list*), not inline: they cannot fit in 14px at
  11px text (SG-D9). Widths plus gaps always sum to W within 0.5px.
- **Ticks:** `tick = niceStep(total / floor(W / 6))` from
  {1, 2, 5, 10, 20, 50, 100}, a major tick every fifth. The legend prints the
  computed value, never a constant: 381 issues tick every 10 on a phone and
  every 5 on desktop.
- **Read segments.** The `run_read_segments` view returns run-length segments
  (`is_read`, `from_ordinal`, `to_ordinal`), computed from `issue_progress` and
  nothing stored, and a second set from `issue_read_runs` for placements read
  elsewhere. The first draws green, the second grey with a dashed outline. A
  single fill from the top would misreport a range mark, a skipped optional, or
  an issue read in another run.
- **Head label** is `ordinal / total · label` — `42 / 381 · #141` — on the rail
  and in the ladder, because the two rails otherwise speak different units.
- **Text and colour live outside the viewBox.** Labels are 11px minimum HTML or
  CSS-px classes; fills and strokes are classes (`.tele .cell`), not `var()`
  presentation attributes. The ladder is the text alternative (`role="list"`);
  the `<svg>` has a `<desc>`.
- **Cells are links.** Each is `<a href>` with a `<title>` and the shared
  `--focus-ring`; each rail is also a `role="slider"` (`aria-valuemin/max/now`)
  that scrubs by drag or arrow keys and navigates to `/comics/[runId]#p-[ordinal]`
  on release. While scrubbing, a dashed ghost head and a live `n / N · label`
  readout move; the real head moves only on a mark.
- **The head is the one glow.** The head cell carries a `--brand` ring plus
  `--halo`, and nothing else in the app glows: a halo means *you are here*.
- **Inline labels are fitted, never squeezed.** The longest candidate that fits
  wins (`1 · Foundations` → `1`); if none fits the cell has no text, and its name
  lives in the ladder, `<title>`, `aria-label` and popover. A partly read cell's
  label starts after its fill, so text never straddles green and grey.

**Rail count and fallbacks.** The telescope draws as many rails as the run has
levels, and a missing level is a shorter telescope, never a broken one. The
rule for every variant (drawn in `design/Telescope Spec.dc.html`):

| Variant | When | Rails | What changes | What does not |
|---|---|---|---|---|
| **3-rail** (A1.1) | The run has a block | TRACK → BLOCK → RUN, two brackets | — (the reference) | — |
| **2-rail** (A2.1, `data-rails="2"`) | `block_id IS NULL`; and always on `/watch` (franchise → series → seasons) | TRACK → RUN, one bracket | The BLOCK rail and its bracket are removed. The track rail's last cell is an italic *no block* group holding the block-less runs, and it is the head cell. The ladder drops its BLOCK row entirely (no empty row); TRACK's meta reads *no block · N runs* | Bracket depth, cell height, gap, radius, tick rule, type and the run rail are identical to 3-rail, so it reads as shorter, not broken |
| **Unnamed block** (A1.2) | `blocks.name IS NULL` | 3 | The block's cell label is `block 3`; the ladder reads *block 3 · unnamed* with a 24px **Name it** | Not an error and not amber: a block is a position and may be unnamed |
| **Overflow** (A1.3) | `n · min > avail` on any rail | 3 or 2 | Head ± 2 kept, the rest in at most two stubs; the ladder's BLOCK row reads *run 28 of 60* | Stub width is `min`; the head is never folded |
| **Dense** (A1.4) | A long run (Krakoa, 641) | 3 | Ticks are recomputed (every 20 on a phone, 5 on desktop); the head pill uses the full label (`118 / 641 · X-Men (2019) #8`) | Floored neighbours carry their dot |
| **Empty** (A2.2, `data-state="empty"`) | No run in flight | Track rail only | No head, brackets, run rail or legend. The ladder shows TRACK (`read / total` for the track's own blocks, D-29) and NEXT. One primary: *Start the top of Up next*, or *Pick from N ready runs* when the queue is empty too (M-11) | The track rail keeps its geometry |
| **Fully read** (A2.3) | Every placement read here | 3 or 2 | The run rail is solid `--ready` with no head marker; the badge is grey `✓ read · date`; the action is secondary (*Next in block · …*) | — |

Eras do not change the telescope: they section the spine, not the rails
(data model 2.10). The dense frame's ladder may gain an ERA row
(*DoFP · 4 / 22*) when the run has eras.

### 5.1 Which variant to draw

```
no run in flight                      → empty:  track rail only, one primary action
run.block_id IS NULL, or /watch       → 2-rail: TRACK → RUN
otherwise                             → 3-rail: TRACK → BLOCK → RUN
then, on each rail independently:
  n · min > W − gap·(n−1)             → overflow: head ± 2 kept, ≤ 2 stubs
  every placement read here           → fully read: solid run rail, no head
```

**3-rail and 2-rail are the same component.** The 2-rail view removes the
BLOCK rail and its bracket and changes nothing else: bracket depth, rail
heights, gap, radius, ticks and type are identical, so it reads as a shorter
telescope, not a broken one. The track rail gains an italic *no block* cell,
holding the block-less runs, as its head; the ladder loses its BLOCK row
without leaving a gap and TRACK's meta reads *no block · N runs*. Watch uses the
same 2-rail geometry for franchise → series, with seasons on the run rail.

### 5.2 Geometry

| | Under 900px (phone, most tablets) | 900px and up |
|---|---|---|
| Rail width `W` | 250 at 360 · 282 at 390 | 832 at 1000 |
| Rail-key gutter | 44 | 72 |
| Track and block rail height | 18 | 20 |
| Run rail height | 24 | 28 |
| Bracket depth | 16 | 20 |
| Cell minimum | 14 | 16 |
| Gap · radius | 2 · 3 | 2 · 3 |
| **Height, 3-rail** (rails + ticks + tick numbers) | **124** | **140** |
| **Height, 2-rail** | **90** | **100** |
| Height, empty (track rail only) | 18 | 20 |

STYLE_GUIDE §2.1 gives the 3-rail height as ≈150 / ≈176, but its own sum
(18+16+18+16+24+3+6+3+20) is 124, and `Telescope.dc.html` computes 124 and 140.
Use the computed figures.

### 5.3 Worked numbers (2px gap)

These are outputs of `allocate()` for given inputs, so a unit test may assert
them; they are not sample data.

| Input | Phone, `W` 282, min 14 | Desktop, `W` 832, min 16 |
|---|---|---|
| `[6, 381]` | 17.9 (floored) · 262.1 | 28.4 (floored) · 801.6 |
| `[66, 6, 381, 47, 90]` | 36.8 · 16.1 (floored) · 145.7 · 30.3 · 45.1 | 99.2 · 23.6 (floored) · 496.4 · 75.3 · 129.5 |
| `[664, 214, 301, 268, 352, 211, 170]` | 66.4 · 30.9 · 37.7 · 35.1 · 41.8 · 30.6 · 27.4 | 231.6 · 85.5 · 113.8 · 103 · 130.3 · 84.5 · 71.2 |
| 60 cells, head at 27 | stub (25) · cells 25–29 · stub (30) | the same, at 16px stubs |
| Ticks, 381 issues | every 10 | every 5 |
| Ticks, 641 issues | every 20 | every 5 |

### 5.4 Drawing it

Cells `--sunk` with a 1px inset `--faint-deco` edge; the head cell a 1.5px
`--brand` ring and `--halo`; brackets `--brand` at 8% with 1px edges at 50%;
read segments full-height `--ready`; read-elsewhere a dashed `--muted` inset
box; stubs dashed on `--surface`; a floored cell's 4px dot. States (hover,
pressed, focus, scrub) are STYLE_GUIDE §2.8, and roadmap 2.5b lists every one.

## 6. The plan rail

**The plan rail** is the books "next" slot: a quarter is a column, a book is a
block sized by its word count, and a dashed rule across all four columns is
capacity. Anything above the rule is hatched. A fifth lane behind a dashed
border holds entries with a year and no quarter. Moving a book is a tap on its
block, which opens the same picker sheet the plan page uses.

Block heights stay proportional to words, but every block is a `<button>` with an
accessible name (*Piranesi, 65k words, estimated, Q1 2027*) and a hit area of at
least 24×24px (`::after` inset), because a 7px block is otherwise untappable and
`title` does not exist on Android. Adjacent sub-24px blocks merge into a
`+N · Nk` stack button that opens a list sheet. `data-wc="estimated"` blocks get
a dotted top edge and a `~` prefix. There is no month variant (D-38). Capacity and the hatch use `--blocked`; the
retired red classes (`.capnum.over`, `.pace .big.behind`) are gone. Only the part
of a block above the rule is hatched. Accepting a *stretch year* turns that hatch
grey (`--hatch-settled`) while still drawing the overage: the data stays
honest, only the held state clears. The phone's quarter footer shows only the
amber overage, because a grey *Nk room* badge wraps in a 62px column; desktop
shows both (SG-D11).

**The plan rail shares the telescope's vocabulary** (STYLE_GUIDE §3): radius 3,
gap 2, *dashed* means folded (a stub, a stack, a fifth-lane entry), *dotted*
means estimated, *hatch* means held, and the same focus ring. Comics measure
sequence along a horizontal rail; books measure time as a column per period
against a capacity rule.

| | Phone | Desktop |
|---|---|---|
| Column height | 230 | 300 |
| Scale | 1000k fills a quarter column | same |
| Column gap | 6 | 10 |
| Fifth lane | 52px, dashed `--blocked` left border | 150px, *2027 · no quarter* |
| Footer | `Q1 · 892k` and an amber overage only (SG-D11) | `892k / 760k` and `over 132k` or `56k room` (grey) |
| Drag | the Move sheet | ghost at −1.5° on `--sh-2`, dashed `--brand` outline, `output.dropdelta` |

Only the part of a block above the rule is hatched; accepting a stretch year
turns the hatch grey and keeps drawing the overage. Adjacent sub-24px blocks
merge into a `+N · Nk` stack; a lone one keeps its height and gets a 24px
`::after` hit area. Tasks 2.2b, 2.7 and 2.10.

## 7. Where each part is built

| Blueprint | Task |
|---|---|
| Tokens, type scale, elevation, radius, spacing, motion, control states, `test:tokens` checks | **1.8a** (before 1.8) |
| Glass chrome, sticky stack, icon set, chips and segments, section heads, widths | 1.8 |
| Thumb bar, toast, mark sequence | 1.8b |
| Status tab strip, empty slates | 1.9, 8.8 |
| Switch, stepper | 2.0 |
| Readiness badges, telecard container | 2.4 |
| Telescope geometry | 2.5 |
| Telescope drawing, states, mockup redraw | 2.5b |
| Plan rail | 2.2b, 2.7 (settled), 2.10 (drag) |
| Sticky track headers | 2.9 |
| Inline edit states | 3.1 |
| Prerequisite cycle error | 3.3 |
| Sheet motion, stacking, cover morph | 3.5 |
| Era headers, sticky chips | 3.6 |
| Archive and restore | 3.7 |
| Neutral cover placeholders | 4.3 |
| Finish moment | 5.4, 5.5 |
| Offline undo, failure toast | 6.4 |
| Keyboard layer, desktop row action | 6.5 |
| Compact density | 6.11 |
| Phone, tablet and desktop layouts; sidebar state by width | 1.8 |
| Sidebar toggle | 6.14 |
| Books coming out | 5.7 |
| Comic issues coming out | 5.8 |
| Feel pass: the mark answers back, toast copy | 1.8b, 1.2 |
| Feel pass: Up next cover shelf and *Reorder* | 1.10 |
| Feel pass: comics Now hero, lens, *Since Tuesday*, *All caught up* | 2.4 |
| Feel pass: books Now, *Between books*, single-quarter strip | 2.2, 2.2b |
| Feel pass: `run_opens` (*What this opened*, *opens N*) | 2.6 |
| Feel pass: run and block completion | 2.12 |
| Feel pass: cover sizes, run-detail art band, `--art` | 4.3 (books: 4.2) |
| Feel pass: tablet rail, local icons | 1.8 |

The item-by-item map from Review N to tasks is in `docs/review/LEDGER.md`, *N*.

## 8. Decided after the review (2026-09-30)

- **Counts stay mono (D-32).** Every count, range and label is IBM Plex Mono (D-40; it was JetBrains Mono)
  with tabular numerals, inline row counts included.
- **Tablets get a touch layout (D-33).** Breakpoints 768, 1024 and 1280px: a
  phone layout under 768; a 72px navigation rail (icon over label) with the
  bottom thumb bar from 768 to 1023; the desktop header verbs from 1024, with the
  sidebar collapsed to 64px until 1280. Width picks the layout, the pointer
  picks the interaction: hover, drag and shift-click need `(pointer:fine)`. The
  `--tele-*` size step stays at 900px (it sizes the telescope; it is not a
  layout breakpoint). Tablet frames are 834px wide.
- **One sheet at a time (D-34).** A sheet opened from a sheet replaces it, with
  a back chevron; Back unwinds one level.
- **Upcoming releases are in scope (D-35).** Books you want when they come out
  (5.7) and new issues in series you follow, offered for adding to a run (5.8).
  Each is a list screen one level below its dashboard, linked from the
  dashboard's rollup slot, so the five slots keep their order.

Small errors in the delivered files, left as delivered: `tokens.css` points at
STYLE_GUIDE "§7 changelog" and "§3" for type (they are §10 and §5), and
STYLE_GUIDE §2.1's height sum (see §5.2 above).

## 9. The feel pass (D-40, 2026-10-05)

The owner approved the feel pass on 5 October and picked palette **1c After
hours**. On 6 October it gained the desktop layout (1024px and up) and
screenshots of every frame. What it is, in one line each:

- **Spec:** `design/STYLE_GUIDE.md` §14 (screens and behaviour; §14.6 desktop),
  §15 (copy), §16 (departures FP-D1…FP-D18), with §4.2, §5, §7 and §9 updated in place.
- **Drawings:** `design/Ledger Feel Review.dc.html` (sections 2–7, 10 and 11),
  with `design/LedgerComics.dc.html` live and the desktop in
  `design/LedgerDesktop.dc.html` and `design/LedgerNav.dc.html`. Covers in them
  are striped placeholders. **`design/screenshots/` has the same frames as
  images** (palette 1c, both themes; `phone/`, `tablet/`, `desktop/`): read
  those to see a screen, because the page's source is templates.
  `design/screenshots/README.md` maps each to its task.
- **Precedence:** where it draws a surface, it beats `design/mockups.html` on
  layout and copy (D-40 amends D-31). Where it is silent, the mockup and the
  task stand.
- **Delivery record:** `design/handoff/` (the prompt, the checklist, the 1a
  and 1b colour blocks, and the contrast report for all three palettes and the
  desktop pairs).

**Built through the backlog, not as one pass** (the owner's call when it was
recorded). The tokens, the token checks and the fonts landed at once, because
`globals.css` and the layout already existed. Everything else went into the
task that builds the surface:

| Checklist step | Where it is |
|---|---|
| 0 Record | Done: D-40, this section, the files in `design/` |
| 1 Tokens | Done: `globals.css`, the mockup's `.app` blocks, `test:tokens`. The desktop layout tokens landed with the 6 Oct package |
| 2 Fonts | Done: `src/app/fonts/`, `@font-face` in `globals.css`, `test/self-hosted-fonts.test.ts` |
| 3 Icons | 1.8 (there are no icons in `src/` yet, so there was nothing to replace) |
| 4 `--art` | 4.3 for issue covers and 4.2 for book covers. A schema change, so the owner is asked again there |
| 5 /comics | 2.4, with 1.6 and 1.10 |
| 6 /books and /watch | 2.2 (and 2.2b), 8.7 |
| 7 The mark | 1.8b, with 1.2's toast copy |
| 8 Completion | 2.12, with `run_opens` in 2.6 and read runs on the tracks page in 5.2 |
| 9 Copy | The task that owns each string: 1.2, 1.6, 1.9, 1.10, 2.2, 2.4, 2.6, 2.9, 2.12, 6.2 |
| 10 Tablet | 1.8 (rail, column, 48px thumb bar), 2.4 (hero and side rail) |
| 11 Desktop | 1.8 (nav, column, header verbs, toast), 2.4 (/comics), 2.2 (/books), 2.12 (run and block complete). /watch is not drawn at desktop (8.7) |
| 12 Verify | The *feel-pass surface* rule in §10, which every one of those tasks inherits |

**Open questions the feel pass raised**, each written into its task as *stop
and ask*:

- **Watch (8.7).** The drawing tracks episodes (*S4 E3*), offers *Reorder* on a
  list with no stored order, and draws show → season rails. The app tracks
  seasons only and 8.7 specifies franchise → series.
- **Books (2.2).** Where Rebalance, Accept (2.7) and *Place them* (2.8) surface
  once the capacity and unplaced cards leave the dashboard.
- **Covers (4.3).** Which cover is a run's key art, and where a run's tone is
  stored.
- **Completion (2.12).** Whether a later visit to a block-closing run shows the
  block state or the run state.
- **Caught up (2.4).** *Coming out* needs 5.8's follows, so it waits for 5.8.
- **Watch on desktop (8.7).** The 6 Oct frames stop at /comics and /books:
  /watch at 1024px and up gets the shared shell and nothing more until it is
  drawn.

Two things the handoff got wrong, fixed when it was recorded: its style guide
and tokens predated spine v2, so spine v2's sections and its three tokens were
restored (a spine row stays 28×42); and P1's *spine rows get 36 × 54 covers*
was not adopted, because no FP departure changes SG-D13.

## 10. The UX floor

Every UI task meets this, and `/new-task` gives each `ui: true` task an
acceptance criterion pointing here (the **UX floor** role in `CLAUDE.md`).
It came from the Sept 2026 audit (`docs/review/UI_AUDIT_REPORT.md`) and the
design notes in §11.

**Four colour meanings, and only four.** `--ready` green is read. `--brand` blue
is where you are, and the primary action. `--blocked` amber is *held* — a hard
prerequisite unread, or a decision not yet made. `--danger` red is destructive
actions and validation failures only. Nothing on a dashboard is red. Track and
genre hues (`--t1`–`--t8`) carry identity and nothing else.

**The UX floor, for every UI task** (from the Sept 2026 audit,
`UI_AUDIT_REPORT.md`; design §11 design notes). A screen is not done until:
it has its empty, loading and error states drawn (design §14 → Everywhere);
text is at least 4.5:1 and control outlines 3:1 in both themes; thumb-bar and
icon buttons are 44px and nothing interactive is under 24px; every control is a
real `<button>` or `<a href>` with an accessible name; every readiness badge
carries a glyph and text; the phone bar is the one `Comics · Books · Watch`
partial. Where a task says "screenshot", that means 360px, 834px (a tablet,
D-33) and 1280px, light and dark. Hover reveals, hover popovers, drag and
shift-click sit behind `(hover:hover) and (pointer:fine)`; every one of them has
a tap, long-press or sheet route for touch, which is what a tablet gets.

The states look the same everywhere (STYLE_GUIDE §9): an empty slate is a
`--raise` panel with one primary action; a skeleton is the loaded geometry in
`--sunk`, shimmer off under reduced motion; *rate-limited* is amber (held) with a
mono countdown and a freeform escape (*Type it instead*); an API error is a
neutral line with a grey `×`, never red, because nothing destructive happened;
*metadata pending* is a dashed `--muted` cover outline and an italic line. An
unavailable action is `aria-disabled="true"` with a visible reason under it
(*Resolve 2 lines to add*), never a bare `disabled` that hides why (UX-N18).
Motion confirms, never celebrates: durations come from `--dur-1`…`--dur-4`
(and `--dur-fill` for a completion rail), and `prefers-reduced-motion` makes
every one of them 0. `--dur-hold` is the one exception: it holds a colour, not a
movement, so the mark's green confirm is still seen (D-40, STYLE_GUIDE §14.3).

**A feel-pass surface is checked more widely** (D-40, the checklist's step 12).
A dashboard, the mark sequence, an empty or caught-up state, or a completion
screen is screenshotted in every state it has at 360, 390, 412, 768, 1024 and
1280px, light and dark, plus once with `prefers-reduced-motion` and once with
`prefers-reduced-transparency`; at 1440px its content box stays 1056px wide and
centred; at 1280px every hover reveal is hidden at rest with a fine pointer and
shown at rest with touch emulated; an axe pass over it reports no new violations;
nothing on it resolves to `--danger`, and nothing on it measures against the
catalogue. Counts stay mono (Plex Mono, D-32); Newsreader appears only in screen
titles, hero names, story titles and completion lines.

**Focus returns where it came from** (R1-11). A sheet or dialog returns focus to
the control that opened it when it closes, by any route — confirm, Cancel, Esc
or the back button. An intercepted route returns focus to the row link that led
to it. This is one behaviour in the shared sheet component, not eight
per-screen fixes: 1.1, 1.3c, 1.3b, 1.4c, 1.8b, 2.1b, 2.3, 2.6 and 2.7 all open
one. A sheet also traps Tab while open and is labelled by its own heading.
Opening one puts focus on that heading (`tabindex="-1"`) and marks the page
behind it `inert`, except the undo toast, which stays live above it (D-63); Esc and Back both dismiss (UX-N11). Sheets are solid
`--overlay` over `--scrim`, never glass (SG §8).

**Figures in the mockups are sample data** (D-7). `design/mockups.html` wins on
layout, wording and behaviour — never on a number. Every count, cost, capacity
and percentage in it is illustrative; the app computes them, and no acceptance
check asserts a figure copied out of a mockup or out of prose. Where a check
needs to be exact, it asserts a relationship ("the switch hides exactly the rows
whose `run_state = 'blocked'`") or builds its own fixture.

## 11. Interface

**One dashboard per medium, not one dashboard for everything.** The first cut
had a single `/` that stacked a books pace card above a comics hero — two
questions in one screen, neither answered well. The three media are at
genuinely different stages (0.67% of the comic catalog read against five years
of book history) and they deserve different answers.

### 11.1 Five slots on every dashboard

**Every dashboard has the same five slots in the same order:** what you are in
the middle of; what is next, with a control on it; where that sits; the
situation; a compact rollup. Then the thumb bar. What differs between media is
what fills a slot, never the order — which is what makes the film and TV
dashboard a fill-in-the-blanks exercise rather than a design project.

| Slot | Comics | Books | Film & TV |
|---|---|---|---|
| Now | Run, issue position | Book, page position | Series, season position |
| Next, with a period control | Your Up next queue (data model 2.16), with + Up next on ready runs | Quarter chip | Five up next, filtered by film/TV and genre — see below |
| Position | Issue → run → block → track | Quarters across the year | Season → series → franchise |
| Situation | Ready when you are: at most three runs (the frontier moved to the run list, D-40) | On deck (where capacity decisions surface is open, roadmap 2.2) | Paused shows, in grey (D-40); what is reachable |
| Rollup | The year so far (provenance moved to Stats, D-40) | The year so far | The year so far |

Then the thumb bar: fixed to the bottom, same primary verb slot, 44px minimum.
Marking what you just read is one tap on all three media. The left slot is
always that medium's mark verb — `Mark #141 read`, `Log progress`,
`Mark S2 watched` — followed by a secondary and a `+`. Every `+ batch` opens the
**batch sheet**: *Mark next N* (a stepper), *Mark through…*, *Log a session*.
Undo toasts are `role="status"` and last 8 seconds, paused on hover or focus.

**Three media, told apart at a glance.** Each dashboard's `h1` carries a small
unit badge — *sequence · issues*, *time · words*, *seasons* — because amber
means *held* on all three but is held against a different thing. The active
media tab and the `h1` kicker take a per-medium accent (`--m-comics`,
`--m-books`, `--m-watch`); genre hues are a separate token family from track
hues. The comics telescope's coarse rail is headed **TRACK · prerequisite
order** and the watch one **FRANCHISE · release order**.

### 11.2 Status screens

**Every medium has the same three-tab status screen.** The dashboard answers
"what now". The status screen answers "show me all of it": everything in
flight, everything planned or next up, everything finished. The tabs are the
same in the same order on all three media, and so are their names, *In flight ·
Up next · Done*, each with a count. The tab is in the URL (`?tab=next`), so the
back button and a refresh keep it.

| Tab | Comics | Books | Film & TV |
|---|---|---|---|
| In flight | Runs with at least one placement read and not all read, most recently touched first, each with its resume pointer | `book_status = reading` | Shows whose `show_progress.state` is `watching`, films with `title_status = watching` |
| Up next | **Your queue** (data model 2.16), in your order, unstarted runs only, with drag handles. Below it, *Ready, not queued*: `ready_all` then `ready_hard` runs in track → block order, each with **+ Up next** | The plan by level (data model 2.9): each quarter in your order, with drag handles; then that year's bare-year entries; then On deck. Someday is a link to the master list, not a list here | `to_watch` films and shows, oldest added first, with the dashboard's film/TV and genre filters |
| Done | Finished runs, most recent last read first | `read`, grouped by year finished | `watched` films and shows, with show state derived |

Stopped work — DNF books, dropped titles — sits in a collapsed *Stopped* group
at the foot of Done. It is finished, just not the way you meant it to be.
Two *Up next* tabs are backed by an authored order: comics by the queue (data model 2.16),
books by each quarter's order (data model 2.9). Watch has to-watch; comics follow
the queue with what's reachable but not yet queued. Every tab reads from views
(`run_queue_state`, `run_progress`, `run_readiness`, `plan_period`,
`show_progress`). The queue's order and each quarter's order are the only stored
things on this screen.

The dashboards link in: *Also reading → All*, *Up next → Reorder*, *Ready
when you are → All N* (computed, D-7), and the books and watch equivalents go to the matching
tab. **The comics dashboard shows the queue as a cover shelf** (D-40, FP-D2) —
unstarted runs in your order, with a *Start* button on the first and *Reorder*
opening the reorderable list — in slot 2. That makes it the comics answer to the
books shelf and the watch up-next posters. Every *Ready when you are* row gets
**+ Up next** as its control.

### 11.3 Adding

**Adding is one pattern everywhere** (data model 2.15): a segmented control at the top of
every add surface, opening on Search, with the freeform path beside it —
*Type it* for issues, *Paste a list · By hand* for books. Watch opens on
Search alone, with *Save to inbox* as its fallback (D-28). Your own catalog is
matched before any API is called.

### 11.4 Readiness states

**Prerequisite state blocks.** The `run_state` view (`etl/views.sql`) combines
`run_readiness` and `run_progress` into five states
(DIAGRAMS §4; progress wins, so a started run is `reading` even if a hard
prerequisite is unread), and every surface that shows a run renders all five through one
`<RunStateBadge>` so a phone and a desktop frame cannot disagree:

| State | Meaning | Badge | Colour |
|---|---|---|---|
| `blocked` | a hard prerequisite is below 100% | `⊘ N runs first` | `--blocked` amber, the only amber readiness badge |
| `ready_hard` | hard met, a soft prerequisite unread | `○ ready · N soft unread` | `--ready` outline on `--surface` |
| `ready_all` | nothing in front of it | `● ready` | `--ready` fill |
| `reading` | one placement read, not all | `◐ n / N` — prerequisite badges are suppressed | `--reading` |
| `read` | all placements read | `✓ read · date` | grey |

Each carries a glyph plus text and an `aria-label` with the full sentence. The
run list's switch is scoped to `blocked` only (*Show N hard-blocked*; N is around
180 on the current graph, not 27 — R1-02, and it defaults to shown until 2.11), and the
*Why blocked?* sheet is opened from the amber badge.

The frontier's *one soft prereq short* tile takes the `ready_hard` outline. Each
badge carries an `aria-label` with the full sentence.

### 11.5 Film and TV has no period control

**Film and TV has no period control, and that is deliberate.** Books put a
quarter chip on the next-up row because there is a plan to put a book into.
There is no watch plan, no runtime budget and no watch period model, so the slot
is filled by filters instead — film or TV, then genre. Choosing what to watch is
a mood question, not a scheduling one. A films-per-year target was considered
and cut: it would need three new pieces of machinery to answer a question nobody
asked. `/watch` also nests only two levels, so the telescope drops a rail —
season in series, series in franchise — and keeps the bracket.

### 11.6 Review tables

**Review tables are the same shape everywhere.** Bulk add, Add-issues search and
the AI review (Phase 7) all end in a list where each line is proposed, checked
and decided before anything is written. The columns, on a phone stacked and on a
desktop as real columns:

| Column | Bulk add | AI diff view (7.3, 7.4) |
|---|---|---|
| **Kind** | Validation glyph — `✓` ok, `!` needs a choice, `×` error — never colour alone | Change kind glyph — `+` insert, `⇅` move or link, `−` remove or make optional, `?` unverified |
| **Line / Change** | The parsed label, e.g. `Thor (1966) #337–340` | What changes: the label or run, in mono for slugs |
| **Why** | One line: *4 issues, 3 to add: #337 is already in this run* | One reason per row: *Beta Ray Bill is the entry point for the whole block* |
| **Check** | Metron existence: confirmed, *new series*, or *unverified* | `verified`, `unverified` (shown, never dropped) or `malformed`, from the bulk-entry grammar and Metron |
| **Decision** | `role="radiogroup"` of buttons: *Use that · Keep as typed · Drop* | `role="radiogroup"`: *Insert · Skip*, *Apply · Skip*, *Make optional · Remove · Keep*, *Accept anyway · Drop* |

The default decision is the safe one: an unverified row defaults to *Drop*, a
duplicate to *Skip*, and nothing defaults to a write the user has not seen.
*Remove* and *Drop* are destructive and so are the only decisions that may use
`--danger`; *DNF* and *Skip* are grey. A row whose check failed is
`aria-invalid="true"` and points at its message with `aria-describedby`. The
sticky bar counts the real write — *Apply 3 accepted*, *Add 9 issues* — never the
line count, and the insertion preview shows where those placements land.

### 11.7 Colour, depth and type

**Design notes.** Colour is functional and carries four meanings: `--ready`
green is read, `--brand` blue is where you are and the primary action,
`--blocked` amber is *held* — a hard prerequisite unread, or a decision not yet
made — and `--danger` red is destructive actions and validation failures only.
Nothing on a dashboard is red: over-planning by 27% is a five-year habit, not
an error, and a red state you see every day is a red state you stop seeing.
Amber clears when the user decides, and accepting an over-committed year is a
first-class outcome that persists. `--t1`–`--t8` carry track and genre identity
and nothing else. Issue labels and counts are set in a mono face because they
are tabular data.

**The styling blueprint** (D-31) is the Step 3 style guide: `design/STYLE_GUIDE.md`
for the rules and the measured contrast, `design/tokens.css` for the values, and
the `design/*.dc.html` spec pages for the telescope, the plan rail and every
component state, drawn in both themes at 390 and 1000px. `docs/04-design.md`
indexes them. They are authoritative on tokens, type, elevation, motion and
component states; `design/mockups.html` stays authoritative on layout and copy.
The guide changed values and added tokens, and renamed nothing: the four
colour meanings, the identity hues and every class name survive. It makes
**dark the hero theme** — a near-black page with tonal elevation — and
changes the rest mostly by subtraction: blue only for position and the primary
action (a selected chip is neutral inverse, not a blue fill), one type scale of
nine styles with an 11px floor everywhere, five radii, a 4px spacing grid, and
three elevation tiers.

These rules keep the palette honest across three media and two themes:

- **Contrast is a token property.** *(D-40: the values are palette 1c's now,
  `--faint` `#5e6275` light and `#9fa4b8` dark, `--faint-deco` `#878b9c` and
  `#72768a`; the history below is why the rules exist.)* `--faint` (text) was `#606979` (dark
  `#8a93a2`), 4.5:1 or more on `--page`, `--surface`, `--raise` and `--sunk`
  (the audit's `#6f7888` measured 4.45:1 on white and 3.9:1 on the page, so it
  was darkened when the mockups were built); `--faint-deco` (`#98a1b0`) is for rules and
  outlines only; `--blocked` is `#8a560c` so a 11px amber badge clears 4.5:1;
  unchecked control rings use `--muted` (3:1+). A script checks every
  text-token/background pair. *(From task 1.8a the values are `tokens.css`'s:
  `--faint` `#5f6878`, and `--faint-deco` darkens to `#848d9b` so it clears 3:1
  and can outline controls — telescope cells, stubs, an off switch (SG-D8). The
  script then also checks every text token on all five surfaces, the elevation
  order, and text on glass at its worst case.)*
- **Depth is tone first, shadow second.** `--sunk` is *below* `--surface` in both
  themes, so meter tracks and empty cells read as recessed (in dark it used to
  sit above, SG-D2). A surface on the page gets a 1px `--rule` ring; a surface
  inside a surface changes tone and has no ring; a row in a group has only a
  `--line` divider. Shadows mark the three tiers — grounded (`--sh-1` at most),
  lifted (`--sh-2`: menus, popovers, toasts, a drag ghost) and modal (`--sh-3`:
  sheets, dialogs, the palette) — and in dark they become a 1px inner top
  highlight, with a drop shadow only from `--sh-2` up.
- **Glass is for chrome over scrolling content, and nothing else.** The header,
  the desktop sidebar, the thumb bar and the command palette are `--glass-bg`
  (the surface at α .90) with a 20px blur. α .90 is near-opaque on purpose:
  measured over pure white and pure black, lower values failed `--muted` text
  (SG-D12). `--ready` text is not allowed on glass. Sheets are solid
  `--overlay` over a `--scrim`; rows, the telescope, the plan rail, badges,
  meters and toasts are never glass. Without `backdrop-filter`, or under
  `prefers-reduced-transparency`, glass falls back to solid `--surface`.
- **Hue identifies data, never navigation.** `--t1`–`--t8` colour tracks and
  franchises; sidebar items get neutral line icons. A franchise keeps one hue
  across its dashboard, franchise page and detail, and watch genre chips are
  neutral grey with a text label. Genre hues are their own token family
  (`--g1`–`--g8`, scoped by `[data-medium]`) so *violet* does not mean X-Men,
  Fantasy and a nav item at once.
- **A medium has an accent, used twice.** `--m-comics`, `--m-books` and
  `--m-watch` colour only the active media tab underline and the `h1` kicker,
  next to a `.unit` badge (*sequence · issues*, *time · words*, *seasons*).
- **Touch targets.** 44px on the thumb bar, icon buttons and sheet close; 32px
  minimum on small buttons with a hit area expanded to 44px; 24px absolute
  floor elsewhere.
- **Interactive means focusable.** A navigable row is
  `<article class="row"><a class="row-link" href>` with a stretched-link overlay
  and any secondary button outside the anchor; segmented controls, chips and
  switches are real buttons (`aria-pressed`, `role="radio"`, `role="switch"`);
  status tabs are `role="tablist"` links to `?tab=`. `.bar` is reserved for the
  app header — meters are `.emeter`.
- **Every screen has states.** Empty, loading (skeletons at the loaded
  dimensions), offline (the sync pill), rate-limited, error and
  *metadata pending* are designed, not left to whatever renders. So are the
  control states: hover (pointer only), pressed, focus-visible, and unavailable
  as `aria-disabled` with a visible reason, never a bare `disabled`.
- **Motion confirms, it never celebrates.** Four durations (100, 150, 200,
  300ms), ease-out to enter and ease-in to leave; `prefers-reduced-motion` sets
  all four to zero. No confetti, bounce or streaks (product § Metrics).

### 11.8 Phone first, tablet second

**Phone first, tablet second.** 360–412px is the primary target. Every screen
is laid out there and expanded; nothing is designed at desktop width and
allowed to degrade. The tablet is a real device too — books and comics are read
on it (D-33) — so it is a touch layout, not a small desktop:

| Width | Navigation | Dashboard verbs |
|---|---|---|
| under 768px | the top media bar | bottom thumb bar |
| 768–1023px | a 72px navigation rail, icon over label | bottom thumb bar |
| 1024–1279px | the sidebar, collapsed to a 64px icon rail | page header, primary last |
| 1280px and up | the 224px sidebar | page header, primary last |

The run detail keeps its bottom thumb bar at every width (D-25). **Width chooses
the layout; the pointer chooses the interaction.** Hover reveals, hover
popovers, drag-to-move and shift-click ranges need `(hover:hover) and
(pointer:fine)`, and each has a tap, long-press or sheet route, which is what a
tablet — or a touch laptop — gets. The telescope's size step at 900px
(`--tele-*`) sizes a component; it is not a layout breakpoint.

### 11.9 Spine v2

**Spine v2 (Oct 2026) stores nothing new yet.** The rows gain an ordinal
gutter, *Hide read*, real covers and a desktop release-date column, and the
hero gains a next-issue strip (STYLE_GUIDE §5.1 and §9). The gutter shows
`run_read_segments`' ordinal, computed, never stored. Covers read
`issues.cover_url` and the date column reads `issues.cover_date`, both already
loaded from the sidecars (data model 2.13). Three proposals would change the model, and
each waits for the owner:

- `issues.store_date`, for the issue sheet's publication date (roadmap 3.5);
- a per-user, per-run preference for *Hide read* and *Show release dates*,
  which is never a column on `runs` (data model 2.1; roadmap 3.6b, 3.6c);
- where *Show covers* is kept (roadmap 4.3).

## 12. The dashboards

`design/mockups.html` is authoritative for layout; this is the scope behind it.
**Since the feel pass (D-40, 2026-10-05)** the dashboards follow
`design/STYLE_GUIDE.md` §14–§15 and `design/Ledger Feel Review.dc.html` instead,
where those draw them: the Now slot is the one hero, led by a cover; Up next is a
cover shelf with *Reorder*; the telescope is its own Position card; the
situation slot is at most three rows; and the rollup is three this-year counts,
never the catalogue. The slot order below is unchanged. roadmap 2.2, 2.4 and 8.7
carry the detail.

### Comics dashboard

| Region | Answers | Source |
|---|---|---|
| Now (*Up now*) | What am I reading, and how far into this stretch of it | the resume pointer, `run_progress`, `issues.story_title`, `run_credit_line`; the *This stretch* lens is 24 issues around the head, run-relative |
| … *Since Tuesday* | What have I read since I last looked | the marks since the last visit, as up to four covers and a count |
| … *Also reading* | What else is open, so I don't abandon it by accident | runs with state `reading`, as one row |
| Up next | What I've decided to read next, in my order | `run_queue_state` — unstarted runs as a cover shelf, *Reorder* opens the list (product § Requirement changes) |
| Where you are | Where am I in this run, its block, and the track — at once | the telescope: `run_progress`, `block_position`, `block_progress` (all exist) |
| Ready when you are | What could I start tonight with nothing to read first | `run_readiness`, plus `run_unlock_cost` and `run_opens` on the row; at most three |
| 2026 so far | What has this year been | three this-year counts |

*Rest of this block* is now the ladder's BLOCK row, and *The frontier* moved to
the run list (D-40, FP-D4). The frontier replaces a progress bar. Ready runs, runs one soft prereq short,
tracks never opened, and trades already on your shelf that cover a ready run are
the four numbers that change what you open.

### Books dashboard

Since D-40 the dashboard shows the book in hand (or *Between books*), the
current quarter's shelf, a single-quarter strip against the 760k rule, On deck
and *2026 so far*; the full rail below is `/books/plan`'s, and where Rebalance
and *Place them* now surface is open (roadmap 2.2). The regions as first scoped:

| Region | Answers | Source |
|---|---|---|
| Reading now | How much is left, in evenings rather than dates | `book_status`, word count, `reading_settings` |
| The plan rail | Where is the year going, what is over, and what has not been placed | `plan_period`, `capacity` |
| Unplaced entries | Which entries are pretending to belong to a year | `plan_period` where `period` is a bare year |
| Against capacity | Is my plan lying to me, and can I act on it from here | `capacity` |
| 2026 so far | What has this year been | `books_by_year` |

The plan rail is §6; tap targets and estimated counts are §14 → Plan.

### Over-commitment is a decision, not an error

Amber means **held**: either a hard prerequisite is unread, or a decision has
not been made. It is the same colour on both screens because it means the same
thing. It clears when you decide — including when you decide to keep the
overage. Red is reserved for destructive actions and validation failures;
nothing on a dashboard is red.

The catch-up affordance is one tap from the dashboard and offers four peers:

1. **Move the overage into the next year** — and show that the next year then
   holds 45 books. The overage moves; it does not leave.
2. **Move it to On deck** — out of the year, still next in line; suggests the
   longest titles first. Nothing is deleted.
3. **Even out the quarters** — same books, saner shape. Fixes the shape, not the
   total.
4. **Accept it as a stretch year** — persisted, dated, and the amber stops.
   Afterwards the banner reads *2027 accepted as a stretch year on 14 Sep ·
   Undo* in a calm state.

The four are equal-weight buttons on the **Rebalance sheet**, each showing a
before/after delta (*2028 then holds 45 books*). The Move sheet uses the same
amber for a preview that would overrun a period (*Q1 → 1,010k of 760k · over
250k*) — never red — and offers the same *Accept* outcome.

A sheet that only offered ways to shrink the plan would be telling you your
ambition is the bug.

### The three screens that followed

**Run list** groups **track → block**, always. Block bands are the same filled
bands the spine uses for eras, so "an ordered list, sectioned" is one device at
both levels. Every row carries `costs N · opens N` instead of a tier badge —
cost is the decision you are making now, tier is a judgement you made once, and
tier survives as a sort option. Cost badges are amber: an expensive run is held,
not failed. The nine block-less runs group under **No block** at the foot of
their track. Settles HANDOFF §8 open question 5.

**Plan page** is the plan rail at full size, with titles legible inside the
blocks. Only the quarter you are working on expands; the other three are summary
rows. The empty-state action consolidates to one line — "893k of room across
Q2–Q4" with a Suggest button — rather than three quarters each asking the same
question. v3's numbers were internally inconsistent (a 240k quarterly budget
beside a 3.04M annual capacity, rows that did not sum to their quarter totals);
they now reconcile at 760k a quarter.

**`/watch`** stopped being a list. It is a dashboard with the same five slots,
and the list moved to `/watch/list`:

- **Now** — the season in flight, with a two-rail telescope. Watch nests only two
  levels (season in series, series in franchise) so the component drops a rail
  and keeps the bracket. Episodes stay untracked, which is why the fine rail is
  seasons and stops there.
- **Next** — five rows, filtered by film/TV and then by genre. There is no period
  control because there is no watch plan to put anything into, and a
  films-per-year target would need a plan table, a runtime budget and a period
  model to answer a question nobody asked. What survives of that idea is one
  line — series finished this year — in the rollup.
- **Situation** — the comics frontier, not the books pace: seasons ready, shows
  never started, films waiting, plus the franchise in progress and the title
  that has waited longest.
- **Cut:** newly-available-on-your-services. It depends on a provider feed that
  goes stale, it changes weekly for reasons that have nothing to do with you, and
  it turns a personal list into a storefront.

### Metrics the dashboards promote to a row

- **True unlock cost** and **leverage** on every candidate run row — "costs 44 ·
  opens 2" instead of a tier badge.
- **Why blocked?** The amber `⊘ 82 runs first` badge is a button that opens a
  sheet at `/comics/[runId]/path`: the cheapest ordered chain to that run, with
  each run's own cost, the running total, hard/soft markers and *+ Up next all*.
- **Unlock preview.** *opens 13* expands in place to show which of those runs
  become `ready_all` and which stay `ready_hard`.
- **Cheapest block to close** — the only honest form of "completion" at 0.67%.
  52 issues finishes Thor block 1.
- **Owned and ready** — trades on your shelf covering runs with nothing in
  front of them. The shortest path from opening the app to reading.
- **Next event on your path**, with distance in issues.
- **Series debt** — series where the next book is unread and already owned. The
  best tiebreak when filling a quarter slot.
- **Evenings left in the current book** — pages left over your median session.
  Decides whether you start something else tonight. Deliberately short-horizon,
  which is why it is not the completion date that stays cut.

## 13. Detail sheets

**This reverses an earlier decision.** During the v2 mockup review the answer was
"no book detail page right now." Later is now, and it extends to all media.

### Why not hover

Hover doesn't exist on Android, and that's the device this app is mostly used
on. A hover preview would give the desktop a feature the phone can't have, and
leave the phone with nothing — backwards, given where the reading actually
happens. It also can't hold the content that justifies a detail view in the
first place: notes, reread history, shelf membership, edition mapping.

### What to build instead: an intercepted route

Tap a row and detail opens as a **sheet over the list** — a bottom sheet on
phone, a centred modal on desktop. The list stays behind it, scroll position
intact. Dismiss by dragging down, tapping outside, or pressing back.

The trick is that it's **a real route, not a modal component.** Next.js
intercepting routes render `/books/[id]` as a sheet when you arrive from the
list, and as a full page when you land on it directly:

```
src/app/
  books/
    page.tsx                  the master list
    [id]/page.tsx             full page — direct link, refresh, new tab
  @modal/
    (.)books/[id]/page.tsx    the sheet — same component, sheet chrome
```

This gets three things a modal component cannot:

1. **The back button dismisses it.** Which is what a phone user will press.
2. **It's linkable.** `/books/abc` works pasted into a note or opened cold.
3. **Refresh doesn't lose you.** You get the full page, not the list.

Same pattern for `/comics/[runId]/[issueId]` and `/watch/[id]`. Runs keep a
full page of their own — they're too dense for a sheet and you navigate to them
deliberately.

### What each detail view shows

| Media | Content |
|---|---|
| **Book** | Cover, summary, author, series and position (a link to the series page), genre, year, page count, word count with `stated`/`estimated` flag, status, start and finish date (1.17), rating, notes, shelves with each shelf's note, plan placement, reread history |
| **Issue** | Cover, series (a link to the series page, 5.13), cover date, story title, summary (4.1), credits by role, story arc, every run that places it with its position, **its read state in that run** (product § Requirement changes) and the placement's note (7.8), which editions collect it |
| **Run** | Full page. Era list, writers and artists derived from issue credits (`run_credit_line`), `why`, true unlock cost, prerequisite chain, collecting editions |
| **Film** | Poster, overview, genres, year, runtime, studio, director, top cast (each a link to the person page), where to watch with its date, status, watch date, rating, notes, franchise, shelves, rewatch history |
| **Show** | The above with network or streamer in place of studio and creator in place of director, plus **a season list with per-season status**, season and episode totals, derived show progress (with *waiting for a new season*), the next unwatched season, and a show-level rating |
| **Season** | Poster, overview, episode count, air year, status, watch date, rating, notes |
| **Franchise** | Every film and show in it, in release or chronological order, with combined progress |

### What this changes

1. **`books` needs `summary` and `subjects`** — Open Library returns both and
   the app currently discards them. `subjects` is a better genre source than the
   single hand-entered value.
2. **The master list keeps inline status editing.** The sheet is for reading
   about an item; the list row is the fastest path to marking it read. Both
   exist and don't compete.
3. **One layout across all media** — hero, About, Details, Your record, History.
   Learn it once.

### Shelves become multi-media

Shelves were narrowed to books-only in the v3 review. They now cover films and
shows too, but **not** by reintroducing a polymorphic item table.
`shelves.kind` is `books` or `titles`, with `shelf_books` and `shelf_titles`
each carrying a real foreign key. A shelf holds one media type.

**Shelves and franchises are different things.** A franchise is a fact about the
work — Andor is Star Wars whether you like it or not. A shelf is your opinion —
"comfort rewatches", "things I own on disc". Franchises come from TMDB and
curation; shelves are purely yours.

### The issue sheet

The issue sheet is the disclosure surface for per-run read state (data model 2.14): the
grey *read in …* hint on a spine row leads to it. It uses the shared layout —
hero, About, Details, *Your record*, History — where *Your record* is a table of
placements (run · position · read state · date), each with its own `aria-pressed`
toggle and no *mark all*.

## 14. Per-screen refinements

Small things, ordered by how often you'd feel their absence.

### Everywhere
- **Empty states that offer an action**, never a bare "nothing here." Already
  done on Q3 of the plan page; needs to be the rule. Each has exactly one
  primary action:

  | Surface | Empty state |
  |---|---|
  | Comics telescope, no run in flight | Track rail only, with **Start the top of Up next** |
  | Comics Up next, queue empty | **Pick from N ready runs** (computed, D-7), top three rows each with **+ Up next** |
  | Books *Reading now*, nothing reading | **Start the first Q-current book** |
  | Status tabs | One primary action per medium and tab |
  | Books status, *In flight* empty | *Nothing in flight. Books you start land here.* **Open To read** (roadmap 1.9) |
  | Books status, *Up next* empty | *Nothing planned. The plan starts empty; nothing is added for you.* **Add a book** until 2.3, then **Plan a book** (roadmap 1.9, S-L5) |
  | Books status, *Done* empty | *Nothing finished yet. Finished books land here, by year.* **Go to In flight** (roadmap 1.9) |
  | Watch, first run | A full-width TMDB search with three example queries and attribution — never "no items" (product § Watch) |
- **Offline indicator.** You read on a tablet and phone; a silently failed
  write is the worst outcome. Queue and show it: a sync pill
  (`online · offline · queued`, `role="status"`, `aria-live="polite"`) in the
  desktop sidebar footer and the phone header, reading e.g. *Offline · 3 marks
  queued*.
- **Loading.** The first Neon request after idle takes about a second. Show
  skeletons with the same dimensions as the loaded telecard, run rows, plan rail
  and season rows, so nothing shifts when data lands; the shimmer is off under
  `prefers-reduced-motion`.
- **Live-API states.** A Metron, TMDB or Open Library search shows *loading*,
  *rate-limited* (with the `Retry-After` countdown) and *error* lines, each
  `role="status"` and each offering **Type it instead**, so a stalled add is
  never silent and a retry does not hit the 20-requests-a-minute limit.
- **Metadata pending.** A freeform issue or book starts thin. Wherever it renders
  (spine, master list, book detail) the cover has a dashed outline and the row
  says *metadata pending* until backfill fills it in.
- **"Since you were last here"** line on the dashboard — issues marked, books
  finished, anything that changed — plus the inbox count chip.
- **The accessibility floor.** Body and hint text is at least 4.5:1 and UI
  control outlines at least 3:1 in both themes (`--faint` is text-safe;
  `--faint-deco` is for rules only). Touch targets are 44px on the thumb bar and
  icon buttons, and at least 24px anywhere else (WCAG 2.5.8). Every control is a
  real `<button>` or `<a href>` with a name; nothing relies on colour alone, so
  every readiness badge carries a glyph and text. Each page has one `<h1>`.
- **Phone navigation is one bar.** `Ledger · Comics · Books · Watch` plus the
  search icon on every screen, current medium marked with `aria-current`. There
  is no Home tab because `/` is a redirect. On desktop the sidebar lists, per
  medium, *Dashboard · Status · list · Add*, plus Runs and Tracks for comics,
  Plan, Shelves and Top for books, and Franchises for watch, with a global
  `Inbox (N)`. Sidebar icons are neutral; hue is reserved for data.

### Run list
- **Sort control**, not just filters: by issue count, start year, tier, or
  unlock leverage (see product § Metrics).
- **Sticky group headers** while scrolling a long track.
- **Remaining, not just total**, on partially-read runs — "108 left" beats
  "11/25" when you're deciding what to pick up.
- **The blocked switch says what it hides.** *Show N hard-blocked* hides
  `blocked` runs only. A `ready_hard` run (all hard prerequisites read, a soft
  one unread) is reachable and never hidden by it.
- **Saved views.** A toolbar row of named views above the controls — *Ready ·
  owned · under 60 issues · X-Men or Thor* — each just a stored URL, plus *Save
  view* in the desktop filter rail. The master list gets the same.
- **Density.** Settings → Appearance: *Comfortable / Compact* (desktop only,
  32px rows against the phone's 48px).

### Run detail
- **Eras are drawn but not stored.** The mockup sections the spine into named
  eras with their own counts; nothing in the workbook or the ETL produces them.
  They become a table shaped like `blocks` (data model 2.10) and get typed by
  hand or proposed by task 7.3. Until a run has them, the spine is flat, which
  is the correct default rather than an empty state.
- **Era jump chips** at the top that scroll to a section, sticky under the hero,
  each with its read count (*Phoenix ✓ · DoFP 4/22 · Brood 0/19*). 381 issues is
  a lot of thumb travel. On the 641-issue Krakoa run add a **minimap** at the
  right edge (in the desktop rail): era boundaries, green read stretches and
  grey dashed *read elsewhere* ticks, so the next decision is visible without
  scrolling 300 rows.
- **Collapse finished eras** by default on runs over ~100 issues, with a count.
  The header is a button (`aria-expanded`, chevron) reading *38 / 38 · all read ·
  Show*; a collapsed era is a real state, not just a missing list.
- **The read control has a name.** Each row's circle is
  `<button aria-pressed aria-label="Mark Uncanny X-Men #141 read in this run">`.
- **The grey hint appears only where it helps.** *read in …* shows on rows
  unread here; on a row already read here it is hidden, so it does not spend
  attention where no decision remains. A trailing `+2` is a button that opens
  the issue sheet with the full list.
- **Adopt prior reads.** When unread placements have reads elsewhere the hero
  offers *Adopt 9 prior reads*: an explicit, previewed, undoable action on this
  run, keeping the original dates. It opens the range sheet in *Original dates*
  mode. Nothing ticks them for you.
- **Thumb bar order.** `Mark #141 read` (primary) · `Mark through…` · `+`
  (add issues) — the same primary slot as the dashboard.
- **Estimated time to finish** from your real reading rate — "about 6 weeks at
  your pace" is more decision-useful than "339 issues left."
- **Copy issue list** as plain text, for pasting into a shop pull-list or search.
  From the hero's `⋯` menu: *Copy unread (339) · Copy all · Copy as ranges*,
  confirmed by a toast.

### Bulk add
- **Remember the last run** you added to, so consecutive adds don't re-navigate.
- **Preview the resulting order** — show where the new issues land relative to
  existing ones before committing: three existing rows above and below the
  insertion point, the new rows highlighted, and an *Insert after* picker. The
  same preview sits on the search half of Add issues.
- **The count is the real insert.** The header and the button both count what
  will be written (*9 will be added* for a paste that expands to 10 with one
  already in the run), never the raw line count.

### Master list
- **"Pick one for me"** — a random or weighted suggestion from the current
  filter. With 1,130 unread books, choosing is the actual bottleneck.
  Shown as one highlighted row with *Another* and *Plan for…*; a `Pick one`
  button in the list controls.
- **"Fits my remaining budget"** filter — surface only books that fit the
  current quarter's leftover word capacity.
  A chip in the controls (*Fits Q2 · 56k*).
- **A row is a summary, not a page.** Its full record opens as the detail sheet
  (design §13). DNF, when chosen, is grey: stopping a book is not destructive.

### Plan
- **Auto-balance** — redistribute an over-capacity year across its quarters in
  one action, rather than moving books one at a time.
- **Running year total** at the top, not just per-quarter.
- **Estimated counts look estimated.** About 29% of 2027's words are
  estimated at pages × 275. Those blocks get a dotted top edge and a `~` prefix
  (`~65k`), with a legend tag, on the rail, plan rows, master list and book
  detail. A stated count is solid.
- **Every rail block is a tap target.** Blocks are proportional in height but
  each is a `<button>` with a name (*Piranesi, 65k words, estimated, Q1 2027*)
  and at least a 24px hit area; runs of sub-24px blocks merge into a `+3 · 180k`
  stack button that opens a list sheet.
- **No month view** (D-38). A quarter is the plan's finest grain: no month
  toggle, month columns or monthly capacity.
- **Desktop drag.** Dragging a block between quarters shows a ghost and a live
  readout (*Q3 +118k → 533k / 760k*) before release. The Move sheet stays the
  keyboard and phone route.

### Shelves
- **Next three unread**, not just the next one. Useful when the next one isn't
  what you're in the mood for.

### Settings
- **Recalculate from sessions** button once #20 exists, so the pace figures
  stop being a guess.
- **Real controls.** The minutes-a-day stepper is a group of two labelled
  buttons around an `<output>`; switches are `role="switch"`. The volume map
  reads *67 rules · 61 series*.
