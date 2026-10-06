# Design — the styling blueprint

This is the index to how the Ledger looks: which design file answers which
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
| Why the schema, views or routes are the way they are | `docs/ARCHITECTURE.md` | this file |
| What a task must do to pass | `docs/TASKS.md` | this file |

Where the blueprint and the mockup disagree on the blueprint's own ground, the
task that builds the component redraws the mockup in the same PR (TASKS
standing rule 6). Figures in every design file are sample data (D-7).

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
| Meaning | `--brand`, `--ready`, `--blocked`, `--danger`, `--reading`, each with `-soft`; `--brand-ink` | The four meanings (CLAUDE.md *Style*) |
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
floor. The exact list is in TASKS 1.8a.

## 4. Tailwind patterns — reference only

**The app does not use Tailwind and is not going to** (ARCHITECTURE §3; D-31
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

The rules and their reasons are in ARCHITECTURE §4 (*The telescope*, *Rail count
and fallbacks*); the variants are drawn in `Telescope Spec`. This section is the
working sheet for tasks 2.5 and 2.5b.

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
pressed, focus, scrub) are STYLE_GUIDE §2.8, and TASKS 2.5b lists every one.

## 6. The plan rail

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
| 12 Verify | The TASKS header's *feel-pass surface* rule, which every one of those tasks inherits |

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

