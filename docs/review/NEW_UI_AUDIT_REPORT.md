# NEW_UI_AUDIT_REPORT.md — Visual polish & frictionless UX pass (Review N)

**Date:** 2026-09-30 · **Scope:** `design/mockups.html` (40 screens, 89 frames, v4 + Sept 2026 + Review M) checked against `FEATURES.md`, `DIAGRAMS.md` and `ARCHITECTURE.md`.
**Builds on:** `UI_AUDIT_REPORT.md` (UX-C01…C39, UX-E01…E23), `M-findings.md` (M-01…M-13, L-01…L-07, DN-1…3, AR-1) and the disposition table in `mockups-index.md`.

This review does not repeat anything those documents closed. Each item below is one of two kinds:

| Tag | Meaning |
|---|---|
| **NEW** | Not raised in either earlier document, and not covered by a *Not shown* entry. |
| **EXT (ref)** | Extends a named earlier item. Either the earlier fix was scoped too narrowly, or the item was left open (AR-1, *Not shown* #n). |

Evidence comes from the mockup's `<style>` block (lines 10–604) and from the `home`, `spine`, `krakoa`, `dashextras` and `bookdetail` markup. Line numbers refer to `mockups.html` as supplied.

---

## 0. Constraint check: Tailwind tokens vs. the stack

`ARCHITECTURE §3` chooses **plain CSS with custom properties, "no utility-class churn"**. So this report uses Tailwind's scale **as a shared vocabulary for sizes, spacing, radii and opacity**, not as a switch to utility classes. Every recommendation is written as a Tailwind token (`px-4`, `rounded-xl`, `text-xs`, `ring-white/10`) and maps one-to-one onto a CSS custom property:

```
Tailwind token  →  custom property        →  value
rounded-xl      →  --r-card                →  12px
px-4            →  --sp-4                  →  16px
text-2xs        →  --fs-2xs                →  11px / 14px
```

If the owner later adopts Tailwind, these become `theme.extend` values unchanged. **Decision N-DN1** (§6) records this.

Every colour change proposed here has to pass `npm run test:tokens` again. That means the ΔE2000 ≥ 15 identity-hue rule (M-01) and the `--on-*` contrast pairs (M-02) still hold.

---

## 1. Executive summary

The earlier passes fixed **meaning**: five readiness states, amber means *held*, hue marks data only, and state coverage improved. What remains is **finish** and **feel**. The mockups still read as a well-argued spec rather than a product people want to open every night.

Six causes account for most of that gap:

1. **There is no motion system.** The app CSS has zero `transition` declarations. The only `:hover` rule is `.row:hover` (l.131). No button, chip, tab, sidebar link, segmented control or sheet has a hover, pressed, entering or leaving state. The single motion rule is a reduced-motion kill switch (l.603), which currently has nothing to switch off.
2. **Elevation is over-applied.** `.btn`, `.select`, `.seg`, `.search`, `.stat`, `.group` and `.pacecard` all carry `--sh-1`. `.hero` and `.telecard` carry `--sh-2`, the same depth family as overlays. In-page cards float instead of sitting on the page, so sheets and menus have no depth left to claim.
3. **Too many scale steps.** There are 13 font sizes, 12 border radii (5, 6, 7, 8, 9, 11, 12, 14, 16, 18, 22, 99px) and about 20 off-grid spacing values (7, 9, 11, 13, 15 and 17px). Seven text styles fall below the 11px floor that the telescope fix (C05) set, because C05 applied that floor to the telescope only.
4. **Dark mode is inverted in depth.** Light `--sunk` is darker than `--surface`, so it reads as recessed. Dark `--sunk` (`#232935`) is *lighter* than `--surface` (`#171b23`), so every meter track, telescope cell and skeleton looks raised in dark mode. Shadows are also invisible on `#0d0f14`, and nothing replaces them.
5. **Placeholder glyphs look broken.** The search button is `&#9906;` (U+26B2 NEUTER, a gender symbol), and it appears on every phone screen. Drag, menu, timer and chevron are mixed Unicode characters whose optical size depends on the font; on Android that means Roboto fallbacks.
6. **FEATURES Part 3, "Edit everything", has no interaction states drawn.** FEATURES calls it "the largest single chunk of remaining work". Inline edit, archive and restore, prerequisite-cycle errors, the finish-and-rate moment and the re-read start are specified in the docs but have no frame.

### Scorecard (delta vs. `UI_AUDIT_REPORT §1`)

| Dimension | Prior | Now | Why |
|---|---|---|---|
| Information architecture & slot parity | 8.5 | 9.0 | Nav unified; tracks, queue and status tabs drawn |
| Derived-state representation | 5.5 | 8.5 | Floor-then-distribute, five badges, read segments |
| Cross-screen consistency | 4.5 | 7.5 | M pass closed most drift |
| State coverage | 3.0 | 7.0 | Offline, skeleton, API and empty states now drawn; failed-write and edit states are still missing |
| Accessibility | 4.0 | 7.0 | Tokens and names fixed; sticky overlap and sub-11px text remain |
| **Visual polish** *(new)* | — | 5.5 | Scale drift, shadow noise, dark-depth inversion, glyph icons |
| **Motion & feedback** *(new)* | — | 1.5 | No transitions, no pressed or hover states, no sheet choreography |
| **Overall** | 5.9 | **6.6** | Correct and consistent, but not yet polished |

---

## 2. Aesthetic appeal & visual polish

### 2.1 Typography hierarchy

**Findings**

| # | Tag | Issue | Evidence |
|---|---|---|---|
| T1 | EXT (C05) | Sub-11px text outside the telescope | `.qfoot .bdg` 9px (l.442), `.planrail.labelled .qb em` 9px (l.404), `.cv.s` 9px (l.177), `.ladder .k` 10px (l.423), `.qb b` 10px, `.caprule em` 10px, `.qmore`/`.more2` 10px |
| T2 | NEW | 13 sizes in use: .5625, .625, .6875, .75, .8125, .875, .9375, 1, 1.0625, 1.5, 1.875, 2.5, 3, 3.5rem | `<style>` |
| T3 | NEW | Section headers are weaker than the rows they head. `h3.s` is 13px muted; `.rt` row titles are 15px semibold ink. The eye lands on rows first, so sections do not register when scanning. | l.117, l.135 |
| T4 | NEW | Kickers compete with state colour. `.telecard .kick` / `.hero .kick` ("PICK UP WHERE YOU LEFT OFF") are `--brand` blue, and blue already means *position* and *primary action*. E21 moved the `h1` kicker to `--m-*`, but these card kickers were missed. | l.379, l.416 |
| T5 | NEW | Weight inflation. 600 and 700 are used for row titles, `.lbl`, `.ghead`, `.hero .name`, `.era .nm`, badges, chips, `.more` and buttons, so bold stops ranking anything. | `<style>` |
| T6 | NEW | The `.ladder .k` letter-spacing of `.1em` at 10px mono is tracked like a caption but sized like a footnote. | l.423 |

**Recommendation: a nine-step type scale** (Tailwind names, Inter Tight; mono for labels and data per ARCHITECTURE §4)

| Token | px / line-height | Weight | Use | Replaces |
|---|---|---|---|---|
| `text-2xs` | 11 / 14 | 500–600 | Badges, tags, kickers, ladder keys, rail labels, legend | .5625, .625, .6875 |
| `text-xs` | 12 / 16 | 400–500 | Meta, `.rm`, `.inote`, `.seen`, prov | .75 |
| `text-sm` | 13 / 18 | 400 | `.rs` secondary lines, lede, form labels | .8125 |
| `text-base` | 14 / 20 | 500 | Body UI, buttons, `.lbl`, menu items | .875 |
| `text-md` | 15 / 20 | 600 | Row titles `.rt`, section headers (T3) | .9375 |
| `text-lg` | 17 / 22 | 650 | Hero and telecard names, sheet titles | 1.0625 |
| `text-2xl` | 24 / 28 | 700, `tracking-tight` | Phone `h1` | 1.5 |
| `text-3xl` | 30 / 34 | 700, `tracking-tight` | Desktop `h1` | 1.875 |
| `text-display` | 40 / 40 (mono) | 500, `tracking-tighter` | `.capnum`, `.pace .big`, `.timer-big` (desk 48) | 2.5, 3, 3.5 |

Rules:

- **Weights.** Reserve 700 for `h1` and the hero name. Row titles use 600. Everything else uses 500 or 400.
- **Section headers (T3).** Use `text-md font-semibold text-ink-2`. Put the count in `font-mono text-xs text-muted` next to the title, not as a filled pill.
- **Kickers (T4).** Use `text-2xs font-semibold uppercase tracking-wide text-muted`, or `text-[--m]` to follow E21. Never `--brand`.
- **Mono sizes.** Set mono one step below its sans neighbour. JetBrains Mono has a larger x-height than Inter Tight, so a mono count at 12px optically matches 13px sans.

### 2.2 Spacing & whitespace

| # | Tag | Issue |
|---|---|---|
| S1 | NEW | About 20 off-grid values (`.1875`, `.3125`, `.4375`, `.5625`, `.6875`, `.8125`, `.9375`, `1.0625rem` = 3, 5, 7, 9, 11, 13, 15, 17px). Adjacent components drift by 1–2px, which reads as imprecise even when nobody can say why. |
| S2 | NEW | Phone gutter is `.875rem` (14px). At a 360px viewport, the primary target (ARCHITECTURE §4), a 14px gutter with 14px inner card padding makes the telecard feel cramped against the bezel. |
| S3 | NEW | Vertical rhythm is irregular. Gaps are `.group + .group` 12px, `h3.s` top 24px / bottom 8px, `.hero` top 14px, `.telecard` top 14px and `.tonight` top 12px. Sections that should be peers sit at different distances. |
| S4 | NEW | Desktop `.wrap` is `max-width:1000px` with no centring. On 1440px and larger displays the content hugs the sidebar and leaves a dead band on the right. |

**Recommendation: a 4px grid, mapped to Tailwind**

| Current (px) | → Token | Current (px) | → Token |
|---|---|---|---|
| 3 | `1` (4) | 13 | `3` (12) |
| 5 | `1.5` (6) | 14 | `3.5` (14), cards only |
| 7 | `2` (8) | 15, 17 | `4` (16) |
| 9 | `2` (8) | 18 | `4.5` (18) → prefer `5` (20) |
| 11 | `3` (12) | 24 | `6` |

Layout recipe:

- **Phone.** Gutter `px-4`. Card padding `p-4` for hero and telecard, `px-4 py-3` for rows.
- **Section rhythm.** Section header `mt-6 mb-2`. Stacked cards in one section `space-y-3`. Between sections, always `mt-6`.
- **Desktop.** `.wrap` becomes `mx-auto max-w-[1080px] px-8`. At 1440px and above, the `.dk` rail widens from 320 to 360px instead of leaving empty space (see UX-N19).

### 2.3 Colour balance & light-theme neutrals

| # | Tag | Issue |
|---|---|---|
| C1 | NEW | The page is too grey-blue for the surface. `--page #eceff4` against white cards gives a strong "boxed" contrast, so every group reads as a separate tile. That strong framing also makes `--faint` fail on the page first (3.9:1 was the reason `#606979` was chosen). |
| C2 | EXT (M-01) | Cover placeholders `.k1`–`.k8` are hard-coded gradient literals (l.180–186), including `.k2` red. They are decorative colour in a system that bans decorative colour, and they stack with `.edge` and `.tag .sq` so the track hue appears three times per row. |
| C3 | NEW | A selected chip, a selected segment and a primary button all use the same `--brand` fill (`.chip[data-on]`, `.seg span[data-on]`, `.btn`). A filter state reads as a call to action. The status screen, with a tablist, a filter chip and a primary button, ends up with three solid blue shapes competing. |
| C4 | NEW | Every section's "All N" link (`h3.s .more`, `.brow .more`) is a filled `brand-soft` pill. On `home` that is four blue pills above the fold, next to the one primary action. |

**Recommendations**

- **Light neutrals.** Lighten the page and let hairlines do the separation:

| Token | Now | Proposed | Tailwind reference |
|---|---|---|---|
| `--page` | `#eceff4` | `#f5f6f8` | ≈ `slate-50`/`slate-100` midpoint |
| `--surface` | `#fff` | `#fff` | `white` |
| `--raise` | `#f7f8fa` | `#f9fafb` | `gray-50` |
| `--sunk` | `#e6eaf0` | `#eef0f3` | ≈ `slate-100` |
| `--rule` | `#dde2ea` | `#e3e6eb` (cards: `ring-slate-900/[0.07]`) | `slate-200` |
| `--line` | `#eaeef4` | `#eef0f3` | inner dividers |

- **Contrast check.** Re-measure `--faint #606979` on the new page. It improves, because the page is lighter.
- **Selected states (C3).** Selected filter chips and segments use `bg-ink text-page` (neutral inverse) or `bg-brand-soft text-brand-ink ring-1 ring-brand/30`. A solid `--brand` fill is reserved for the one primary action per view.
- **"More" links (C4).** Use a quiet text link: `text-sm font-medium text-brand hover:underline underline-offset-2`, with no fill.
- **Covers (C2).** Until real cover art lands (FEATURES #13), use a neutral placeholder: `bg-sunk`, mono initials in `text-muted`, `ring-1 ring-black/5`. Keep track identity on `.edge` or `.tag`, never both, and drop the cover gradients.

### 2.4 Component grounding, cards & elevation

| # | Tag | Issue |
|---|---|---|
| E1 | NEW | Cards are defined twice, once by a 1px border and again by a shadow. Inputs, selects, segmented controls and buttons also carry shadows (l.195, 206, 214, 237). The result is shadow noise at small scale. |
| E2 | NEW | `.hero` and `.telecard` use `--sh-2`, which is overlay-grade depth. Overlays (`.sheet` `--sh-3`, `.menu` `--sh-2`, `.toast` `--sh-2`) then sit at the same depth as in-page content. |
| E3 | NEW | `.ghead` paints a `--raise` band with a bottom rule inside every group, on top of the `h3.s` already above it. Headers are drawn twice and the stripes add clutter. |
| E4 | NEW | Radius drift: 12 values. Nested corners do not follow *inner = outer − padding*. For example, a `.hero` of 16px with 14px padding contains a `.cv.l` of 5px and a `.btn.sm` of 7px. |

**Recommendation: three elevation tiers** (light / dark)

| Tier | Use | Light recipe | Dark recipe |
|---|---|---|---|
| **0 · Grounded** | Groups, stats, pace, telecard, hero, inputs, buttons | `bg-surface ring-1 ring-slate-900/[0.07]`, no shadow (hero/telecard may use `shadow-[0_1px_2px_rgb(20_23_32/0.04)]`) | `bg-surface ring-1 ring-white/[0.06]`, no shadow |
| **1 · Lifted** | Menus, popovers, a lifted drag row, a desktop drag ghost | `ring-1 ring-slate-900/10 shadow-lg shadow-slate-900/10` | `bg-overlay ring-1 ring-white/10 shadow-lg shadow-black/50` |
| **2 · Modal** | Sheets, dialogs, command palette, toast | `shadow-2xl shadow-slate-900/20` + scrim `bg-slate-950/40 backdrop-blur-[2px]` | `bg-overlay ring-1 ring-white/10 shadow-2xl shadow-black/70` + scrim `bg-black/60` |

**Radius scale:**

| Token | Value | Use |
|---|---|---|
| `rounded-md` | 6px | Badges, tags, covers, `.seen`, plan-rail blocks |
| `rounded-lg` | 8px | Buttons, inputs, segmented controls, menu items, icon buttons |
| `rounded-xl` | 12px | Groups, stats, toast, menus |
| `rounded-2xl` | 16px | Hero, telecard, sheets, dialogs, palette |
| `rounded-full` | — | Chips, meters, sync pill, timer chip |

The 5, 7, 9, 11, 14, 18 and 22px radii are removed. 22px is the mockup frame chrome only.

**Group headers (E3).** Drop the `.ghead` band where an `h3.s` already names the group. Where a header must sit inside a card, as in status tabs and settings, use a transparent header with `border-b border-line`, not a filled band.

### 2.5 Dark-mode neutrals

| # | Tag | Issue | Evidence |
|---|---|---|---|
| D1 | NEW | **Depth inversion.** Dark `--sunk #232935` is lighter than `--surface #171b23`. Meter tracks, telescope `.cell` fills, `.skel`, the stepper and `.bdg.dn` all read as raised. | l.37 |
| D2 | NEW | `--raise #1e232d` and `--sunk #232935` are both lighter than surface and only about 1.1:1 apart. Hover rows (`.row:hover → --raise`) are barely distinguishable from `.bdg.dn` backgrounds. | l.37 |
| D3 | NEW | Shadows carry no information on `#0d0f14`, and the dark theme has no replacement, such as a top-edge highlight or a lighter overlay surface. Sheets over the page separate by scrim alone. | l.49–51 |
| D4 | EXT (*Not shown* #11) | Dark captures were reviewed for `home`, `bdash`, `watchlist` and `blist` only. The telescope variants, queue lift, `planmonth` hatch and `.decide` amber on `--blocked-soft #2c2114` are unreviewed. | index |
| D5 | NEW | `.cv::after` spine shading and the `rgba(0,0,0,.18)` cover border (l.175–176) vanish in dark mode, so cover edges merge into the surface. | l.175 |

**Recommendation: a five-step dark ladder** (cool-neutral, blue-tinted to match the brand; Tailwind reference `gray-950`/`slate-950`)

| Token | Now | Proposed | Role |
|---|---|---|---|
| `--page` | `#0d0f14` | `#0b0d12` | Canvas |
| `--sunk` | `#232935` | **`#0f1218`** | Recessed: meter tracks, cells, skeleton base (**below** surface) |
| `--surface` | `#171b23` | `#13161d` | Tier-0 cards |
| `--raise` | `#1e232d` | `#1a1e27` | Hover, `.ghead`, selected rows |
| `--overlay` *(new)* | — | `#1d222c` | Sheets, menus, dialog, palette |
| `--rule` | `#262d38` | `rgb(255 255 255 / .07)` ≈ `#23272f` on surface | Card rings, dividers |
| `--rule-2` | `#323a48` | `rgb(255 255 255 / .12)` | Stubs, ticks, interactive outlines |

- **Overlay highlight (D3).** Add an inner top highlight on dark overlays: `shadow-[inset_0_1px_0_rgb(255_255_255/0.06)]`. It is the dark-mode replacement for a drop shadow.
- **Cover edges (D5).** Dark covers get `ring-1 ring-white/10`.
- **Run the token checks.** `--faint #8a93a2` on the new `--surface #13161d` is higher contrast than today. Re-run `test:tokens` for the `--ready`, `--blocked` and `--brand` soft pairs against the new surfaces.

### 2.6 Iconography

| # | Tag | Issue |
|---|---|---|
| I1 | NEW | **The search icon is U+26B2 NEUTER** (`&#9906;`). It is on every phone header. |
| I2 | NEW | Other controls are Unicode glyphs whose rendering depends on the font: drag `⋮⋮` (U+22EE ×2), menu `⋯`, timer `⏱` (an emoji-presentation risk on Android), chevrons `›` and `▸`, and the `.seen` `↺`. Their optical sizes and baselines differ per font, and `⏱` can render as a colour emoji. |
| I3 | EXT (C13) | Sidebar `.ico` "neutral line icons" are characters at 13px, not a drawn icon set. |

**Recommendation.** Use one outline icon set: Lucide or Heroicons Outline, 1.5px stroke, sized `size-4` in rows and `size-5` in bars, `text-muted`, and `text-ink` on hover.

- **Keep as text.** The readiness glyphs `⊘ ○ ● ◐ ✓` stay text characters. They are semantic, sit inside text badges, and the DIAGRAMS §4 table depends on them. Pin them with `font-variant-emoji: text` and a fallback stack.
- **Icons in the mockup file.** The mockup is static HTML, so draw the icons as inline `<svg>` sprites once in a `<symbol>` block. This is the only drawn-SVG change this report asks for.

---

## 3. Frictionless UX & gaps

### 3.1 Coverage matrix: FEATURES / DIAGRAMS items with no frame

| Spec | Requirement | Mockup status | Tag |
|---|---|---|---|
| FEATURES Part 3 §1 | Inline edit: click, type, blur to save | **No frame.** No idle, hover, editing, saving, saved or error states | NEW |
| Part 3 §3 | Archive, don't delete (`deleted_at`), and restore | **No frame.** No archive action, archived view or restore | NEW |
| Part 3 order 4, #22, 2.11 | Edit prerequisites, with a cycle check | `newrun` has Remove only. No "this would create a cycle" error, no edit-existing-run flow | NEW |
| #8, #11 | Rating and note after finishing; DNF with a reason | Finish date is drawn (M-13). **No rating, note or DNF-reason moment** when a run's last issue or a book is finished | NEW |
| #22, 2.14 | Re-read history; `reread_of` | Book detail *Reading history* says "Rereads append". **No "Read again" entry point**, and no second-pass spine state | NEW |
| B1, B5 | Upcoming releases on the books dashboard; *Coming out* list with notify and calendar | **No screen** (`releases` is absent from the index) | NEW |
| Part 2c run list | Sort control (issue count, start year, tier, leverage); sticky group headers | **Not found** in `runs` markup (no "Sort") | NEW |
| #3 | Shift-click range on desktop | The range *sheet* is drawn. **No desktop shift-click selection preview** (anchor row, hover-extended range, count) | NEW |
| #17 | `j/k` move, `x` toggle, `/` search | Only the palette's `Ctrl K` is drawn. **No focused-row state and no `?` shortcut sheet** | NEW |
| Part 2c bulk add | Remember the last run added to | Not drawn | NEW |
| Part 2c shelves | Next *three* unread | Not verified in `shelves`; confirm during UX-N23 | NEW |
| HANDOFF, R1-07 | Failed-write toast | Open in the mockup (M AR-1) | EXT (AR-1) |
| Part 2c | Books and watch status empty slates | Comics only (*Not shown* #6) | EXT (*Not shown* #6) |
| #15, #16, #19 | Prerequisite graph, CSV import, events | Deferred by phase; placeholder route stubs only | Deferred |

### 3.2 Flow bottlenecks & layout-spacing defects

| # | Tag | Finding | Evidence | Impact |
|---|---|---|---|---|
| F1 | NEW | **Sticky collision.** `.bar` is sticky `top:0; z-index:20`. `.erachips` is also sticky `top:0; z-index:6`, so the era chips slide *under* the header when pinned. `.minimap top:4rem` is hard-coded. `.syncstrip` has no sticky rule. | l.99, l.568, l.570 | FEATURES Part 2c's jump chips disappear exactly when they are needed |
| F2 | NEW | **No safe-area handling.** `.actionbar` (sticky bottom), `.fab` and the toast ignore `env(safe-area-inset-bottom)`. In PWA standalone mode (#14) the Android gesture bar overlaps *Mark #141 read*. | l.198, l.203 | The primary verb sits under the system gesture zone |
| F3 | NEW | **Toast position is undefined** relative to the thumb bar. It is drawn in flow (`margin:.75rem 0`), so no rule stops it covering the primary button or stacking behind it. There is also no rule for two undo toasts in a row, such as a mark followed by a queue remove. | l.312 | Undo, promised in FEATURES #5, can be hidden behind the button that caused it |
| F4 | NEW | **360px is not drawn.** Every phone frame is 390px, but ARCHITECTURE says "360–412px is the primary target". The media bar (Ledger + 3 tabs + a 44px search) sums to about 348px of content at 360. With the `.unit` badge beside `h1` and `.since` chips, overflow is likely. | l.84 | The primary viewport is unverified |
| F5 | NEW | **No tablet layout.** FEATURES #14 says "You read on a tablet". Frames exist at 390 and 1120 only. The switch from phone to sidebar and from thumb bar to header (DN-2) has no breakpoint defined for 768–1023px. | — | The layout is undefined on the device used for reading |
| F6 | NEW | **Desktop mark verb is far from the eye.** Under DN-2 (a), dashboard verbs are header buttons at top right, while the scanning focus is the list. Mouse travel for the most frequent action is about 700px. | M-03 | Desktop check-off is slower than on the phone |
| F7 | NEW | **Sheet stacking is unspecified.** An issue sheet can open from the spine, and *Why blocked?* can open from a badge inside a sheet (`path` from `issuedetail` placements). There is no rule for a sheet opening over a sheet, or for how Back unwinds. | — | Intercepted routes can stack modals, and the Back behaviour is ambiguous |
| F8 | NEW | **Offline undo.** No state shows undoing a write that is still queued (`.qd` exists at l.534). Should Undo remove the item from the queue or add a compensating write? | `states` | The user sees Undo succeed while the queue still holds the mark |
| F9 | NEW | **Focus management for sheets and dialogs** (`.dsheet`, `.dkdlg`, `.palette`) is unspecified: no focus trap, no initial focus, no return focus to the invoking row, no `inert` background. | l.334, l.366 | Keyboard and screen-reader users land behind the overlay |
| F10 | NEW | **Button disabled and pending states are undefined.** For example: *Add 9 issues* while review rows are unresolved, *Apply 3 accepted* with zero accepted, or *Use these* with fewer than 5 sessions. | — | Agents will invent `disabled` states that hide why an action is unavailable |

### 3.3 Micro-interactions & motion system (all NEW)

**Motion tokens** (Tailwind names; custom properties `--dur-*` / `--ease-*`)

| Token | Value | Use |
|---|---|---|
| `duration-100` | 100ms | Hover and pressed colour, focus ring |
| `duration-150` | 150ms | Check fill, chevron rotate, tab underline, FLIP neighbours |
| `duration-200` | 200ms | Menus, popovers, era expand, sidebar collapse, scrim |
| `duration-300` | 300ms | Sheet enter, meter or segment growth, toast enter |
| `ease-out` → `cubic-bezier(.2,.8,.2,1)` | — | Everything that enters |
| `ease-in` → `cubic-bezier(.4,0,1,1)` | — | Everything that leaves (shortened to ~70% of the enter duration) |

Motion rules:

- **Reduced motion.** Under `prefers-reduced-motion`, all movement becomes an opacity-only cross-fade at 100ms or an instant change. Today's `*{transition:none!important}` (l.603) is kept, and it should also stop `animation` on everything except `.spin`.
- **No celebration effects.** No confetti, bounce or streak effects. That follows FEATURES Part 2d, *Streaks: deliberately not building*. Motion here confirms an action; it does not reward it.

**Interaction specs**

| Surface | Interaction |
|---|---|
| **Mark read** (`.chk`, thumb bar) | The circle scales 0.92→1 as `--ready` fills over 150ms. The ✓ draws in with a stroke-dashoffset animation. The spine's `.emeter` and the telecard run-rail segment grow over 300ms. The `42 / 381` label counts up with tabular-nums (no layout shift). The toast enters 8px up and fades in over 300ms. |
| **Buttons** | Hover: primary to `--brand-ink`, secondary to `bg-raise`. Pressed: `translate-y-px` plus 4% darken, 100ms. Focus: the existing 2px ring with offset 2. There is no hover lift: grounded components do not rise. |
| **Rows** | The hover background fades to `--raise` over 100ms, desktop only (`@media (hover:hover)`). Stretched-link rows show the chevron shifting `translate-x-0.5` on hover. Pressed on touch: `bg-sunk` for 100ms. |
| **Chips, segmented controls, tabs** | The selection indicator *slides* between options (one absolutely positioned pill, 150ms). The media tab underline, in `--m`, slides between Comics, Books and Watch. |
| **Era collapse** (`button.era`) | Grid-rows `0fr→1fr` over 200ms, chevron rotates 90° over 150ms, count text cross-fades. |
| **Sheets** (phone `.dsheet`) | Enter: `translate-y-full → 0` over 300ms ease-out; scrim `opacity 0→1` over 200ms. Drag to dismiss follows the finger 1:1, with a threshold of 30% of the height or a velocity above 0.5px/ms; otherwise it springs back. Exit takes 200ms ease-in. |
| **Dialogs** (desktop `.dkdlg`, palette) | `opacity 0→1` with `scale .98→1` over 150ms from the invoking element's side. Esc closes it; focus returns to the invoker (F9). |
| **List → sheet continuity** | As a progressive enhancement, the row's `.cv` cover morphs into the sheet hero cover through the View Transitions API (`view-transition-name: cover-{id}`), since detail views are intercepted routes. Without support, the fallback is the plain sheet enter. |
| **Toast** | A 2px progress bar along the bottom edge shows the 8s undo window (FEATURES Part 2h) and visibly *pauses* on hover or focus. At most one toast shows; a new toast replaces the old one and commits its action (F3). |
| **Queue reorder** | The lifted row gets Tier-1 elevation and `scale-[1.01]`. Neighbours slide into place using FLIP over 150ms. On drop, the row settles over 150ms. |
| **Sidebar** (desktop) | Collapses from 224px to 64px (icons only, with tooltips; hover exists on desktop, so this does not conflict with FEATURES 2f). Width transition 200ms; the main column reflows without jank because the grid uses `grid-template-columns: var(--side-w) 1fr`. The collapsed state persists in `localStorage`, not the DB. Auto-collapses at 1024–1279px. |
| **Telescope** | On scrub (E01), the head line follows the pointer and the ladder `RUN` row updates live. On release, the bracket trapezoids animate to the new cell over 200ms. |
| **Skeleton → content** | 150ms cross-fade, identical box geometry (C34). |
| **Sync pill** | The state dot cross-fades green↔amber. `queued → online` shows "Synced ✓" for 2s, then settles. |
| **Plan-rail block** (desktop hover) | `ring-2 ring-brand/40` plus a tooltip-style popover with name, words and estimated flag. Phone keeps the tap → Move sheet. |

---

## 4. Sequential task backlog

Conventions follow `UI_AUDIT_REPORT §4`:

- **IDs.** `UX-N##` for **New** items, `UX-X##` for **Extensions**, with the parent in brackets.
- **Target.** `design/mockups.html` unless stated.
- **Frames.** Rebuild both frames, phone and desk, in both themes.
- **Tasks file.** Append under `## Phase UX-N — polish & flow (Oct 2026)` in `docs/TASKS.md`, each with its `Check:` line.

**Priority** means P0 blocks building (the build would copy a wrong or missing pattern); P1 comes before HORIZON acceptance; P2 is polish within Phases 1–3; P3 is later or cheap.

### P0: foundation (do first; everything else inherits it)

- [ ] **UX-N01 · NEW. Motion tokens and interaction-state matrix.**
  - Add `--dur-100/150/200/300` and `--ease-out/--ease-in`.
  - Define hover, pressed, focus, disabled and pending for `.btn` (primary, sec, dg, sm), `.iconbtn`, `.chip`, `.seg span`, `.bar .tab`, `.side a`, `.row`, `.opts b`, `.switch` and `.stepper b`.
  - Draw one "state sheet" screen (`section[data-id="interaction"]`) showing each control in all five states, both themes.
  - Extend l.603 to cover `animation` too, except `.spin`.
  - Check: every interactive class has a `:hover` (under `@media (hover:hover)`), `:active` and `[aria-disabled="true"]` rule, and the new screen shows 11 controls × 5 states × 2 themes.
- [ ] **UX-N02 · NEW. Type scale consolidation.**
  - Replace the 13 sizes with the nine tokens in §2.1.
  - Set weights per the §2.1 rules.
  - Section headers `text-md`.
  - Check: `grep -oE 'font-size:[^;]+' | sort -u` returns at most 9 values, and none resolves below 11px.
- [ ] **UX-X01 · EXT (C05). 11px floor applied app-wide.**
  - Raise `.qfoot .bdg`, `.qb em`, `.qb b`, `.cv.s`, `.ladder .k`, `.caprule em`, `.qmore` and `.more2` to `text-2xs` (11px).
  - Where a plan-rail block is too short for 11px text, drop the label and rely on the accessible name (C18) plus the desktop hover popover (§3.3).
  - Check: no rendered text node below 11px in any of the 89 frames (extend the `test:tokens` computed-style crawl from M-02).
- [ ] **UX-N03 · NEW. Dark depth ladder.**
  - Re-pick the dark `--page/--sunk/--surface/--raise` values and add `--overlay` per §2.5, with `--sunk` *below* `--surface`.
  - Turn `--rule/--rule-2` into white-alpha values.
  - Add the inset top highlight to dark overlays.
  - Check: `L(--sunk) < L(--surface) < L(--raise) < L(--overlay)` in both themes, asserted in `test:tokens`, and the existing ΔE and contrast assertions still pass.
- [ ] **UX-N04 · NEW. Elevation tiers and radius scale.**
  - Apply the three tiers from §2.4: remove shadows from `.btn`, `.select`, `.seg`, `.search`, `.stat` and `.group`; move `.hero/.telecard` to Tier 0.
  - Collapse the radii to the five tokens.
  - Check: `--sh-2/--sh-3` appear only on `.menu`, `.sheet`, `.dsheet`, `.dkdlg`, `.palette`, `.toast`, `.queue li.lift` and `button.qb.ghost`, and `grep -oE 'border-radius:[^;]+' | sort -u` returns at most 6 values.
- [ ] **UX-N05 · NEW. Sticky stack and safe areas.**
  - Introduce `--bar-h` (phone 64px incl. 44px targets).
  - Set `.erachips{top:var(--bar-h)}`, `.minimap{top:calc(var(--bar-h) + 3rem)}` and a sticky `.syncstrip` under the bar.
  - Give `.actionbar` `padding-bottom:max(.75rem, env(safe-area-inset-bottom))`.
  - Pin the toast above the thumb bar at `bottom: calc(var(--actionbar-h) + .5rem + env(safe-area-inset-bottom))`.
  - Check: on `spine` phone, scrolled 400px, the era chips are fully visible below the bar, and the toast never overlaps the primary button in `dashextras`.
- [ ] **UX-N06 · NEW. Inline-edit pattern (FEATURES Part 3 §1).**
  - Draw an `.editable` field with six states: idle; hover (desktop pencil `size-4 text-muted`); editing (`ring-2 ring-brand`, Esc/Enter hints); saving (inline `.spin`); saved (✓ fades out after 1.5s); error (`--danger` ring and message, value reverted, **Retry**).
  - Apply it to the run `why`, the book Words field (with its `stated|estimated` flag) and an era name.
  - Check: one frame per state on `bookdetail` and `spine`. The error state uses `--danger` on a non-dashboard surface only.
- [ ] **UX-X02 · EXT (M AR-1, R1-07). Failed-write toast.**
  - Draw the failure state: `role="alert"`, *Couldn't save #141, kept offline · Retry*.
  - Draw the interplay with the sync pill.
  - Draw the Undo-of-a-queued-write state (F8): Undo removes the item from the queue with no network call.
  - Check: `states` has three new frames (failed, retrying, undone-while-queued).

### P1: before HORIZON acceptance

- [ ] **UX-N07 · NEW. 360px and tablet frames.**
  - Add a `data-w="phone-sm"` (360px) toggle and a `data-w="tablet"` (834px) frame for `home`, `spine`, `bdash` and `status`.
  - Define the 768–1023px layout: collapsed 64px sidebar, content in one column plus a rail below it, and the thumb bar kept at the bottom (it is a touch device).
  - Record the breakpoint in ARCHITECTURE §4 *Phone first*.
  - Check: no horizontal page overflow at 360px, and the media bar fits without truncating "Watch".
- [ ] **UX-N08 · NEW. Collapsible desktop sidebar.**
  - Two states: 224px and 64px (icons plus tooltips), with a toggle button `aria-expanded`, a 200ms width transition, `localStorage` persistence, and auto-collapse at 1024–1279px.
  - The sync pill and timer chip reduce to icon-only with `aria-label`.
  - Check: `home` desk is drawn in both states, and the main grid reflows with no content jump.
- [ ] **UX-N09 · NEW. Icon set.**
  - Replace `&#9906;` (U+26B2) with a search icon, and replace `⋮⋮ ⋯ ⏱ › ▸ ↺` and the sidebar `.ico` characters with one outline set (Lucide or Heroicons, 1.5px stroke) delivered as a `<symbol>` sprite.
  - Pin the readiness glyphs with `font-variant-emoji:text`.
  - Check: `grep -c '&#9906;'` returns 0, and no control glyph is a bare Unicode character.
- [ ] **UX-N10 · NEW. Motion specs for sheets, dialogs, toast and era.**
  - Draw the enter, mid-drag, dismiss-threshold and exit states for `.dsheet` (phone) and `.dkdlg` (desk).
  - Draw the toast countdown bar and its paused state.
  - Draw era expand and collapse mid-state.
  - Annotate the durations and easings from §3.3 in the `notes`.
  - Check: every overlay screen's notes list enter and exit duration, easing and dismiss gestures.
- [ ] **UX-N11 · NEW. Focus management spec (F9).**
  - For every overlay: initial focus goes to the sheet title (`tabindex="-1"`), Tab is trapped, `inert` goes on `.main`, Esc and Back dismiss, and focus returns to the invoking row.
  - Draw one annotated frame on `issuedetail`.
  - Check: TASKS 1.8 gains an axe and Playwright test, "focus returns to invoker".
- [ ] **UX-N12 · NEW. Sheet stacking rule (F7).**
  - At most one sheet at a time. Opening a sheet from within a sheet *replaces* it, with a back chevron in `.sheetbar` (a route push, so Back unwinds one level).
  - Draw `issuedetail → path`.
  - Check: no frame shows two `.dsheet` elements, and the `path` sheet opened from an issue sheet shows *‹ Uncanny X-Men #141*.
- [ ] **UX-N13 · NEW. Finish moment: rate, note, DNF reason (#8, #11).**
  - When the last placement of a run is marked, or a book is set to *Read*, a closing card appears in place of the toast: rating (5 × 44px targets), a one-line note, and *Skip*.
  - DNF opens the same card with a reason field; DNF stays grey.
  - Check: `spine` has a "run finished" frame, `blist` has a "finished" and a "DNF" frame, and neither uses `--ready` fill for the rating control.
- [ ] **UX-N14 · NEW. Prerequisite edit and cycle error (Part 3 order 4, #22).**
  - Draw editing an existing run's prerequisites: add with search, hard/soft segmented control, Remove, and the error state *Adding Claremont — X-Men would create a loop: X-Men → Excalibur → X-Men*, with the cycle drawn as a 3-row path (reuse the `.path` component).
  - Check: `newrun` gains an edit-mode frame and a cycle-error frame, and the error uses `--danger` only on the blocked control.
- [ ] **UX-N15 · NEW. Archive and restore (Part 3 §3).**
  - Draw *Archive* in each row and detail `⋯` menu (grey, not red, because nothing is deleted), the undo toast, and a *Show archived (3)* switch at the foot of `runs` and `blist`.
  - Archived rows are shown `opacity-60` with a *Restore* button.
  - Check: no archive control uses `--danger`, and a restore path exists on both lists.
- [ ] **UX-N16 · NEW. Run list sort and sticky headers (Part 2c).**
  - Add a *Sort* `.select` (issue count, start year, tier, leverage) to `runs.ctl`.
  - Make the track `.ghead` sticky at `top:var(--bar-h)`.
  - Show "108 left" instead of "11/25" on partly-read rows.
  - Check: `runs` phone, scrolled mid-track, shows the pinned track header, and the Sort control lists four options.
- [ ] **UX-N17 · NEW. Desktop range selection (#3).**
  - Draw the shift-click states: anchor row (`ring-1 ring-brand`), a hover-extended range tinted `bg-brand-soft`, a floating count pill *Mark 18 read · Shift-click to finish*, then the range sheet.
  - Check: `range` desk gains a pre-sheet frame.
- [ ] **UX-X03 · EXT (C12/C13, M-03, DN-2). Desktop mark reach (F6).**
  - Keep the header verbs per DN-2 (a), and add a row-level hover action on desktop spine and queue rows: a `btn sec sm` *Mark read* revealed on row hover or focus, plus `x` as its shortcut.
  - Check: on `spine` desk, the hovered row shows the inline action, and the header verb is unchanged.
- [ ] **UX-X04 · EXT (*Not shown* #11, D4). Dark review of Sept-2026 screens.**
  - Capture dark phone and desk for `telescope` (5 variants), `queue` (lift state), `planmonth`, `rebalance`, `path`, `session` and `palette` after UX-N03.
  - Check: all captures are listed in `mockups-index.md`, and item 11 is closed.
- [ ] **UX-N18 · NEW. Disabled and pending semantics (F10).**
  - Never use the bare `disabled` attribute on a primary action. Use `aria-disabled="true"` with `opacity-50 cursor-not-allowed`, plus a visible reason line underneath, for example *Resolve 2 lines to add* or *Needs 5 sessions (3 so far)*.
  - Check: `bulk`, `ai` and `settings` each show one unavailable-with-reason state.

### P2: polish within Phases 1–3

- [ ] **UX-N19 · NEW. Light neutral retune and quiet links.**
  - Apply the §2.3 light palette.
  - Make `.more` a text link (C4).
  - Selected chips and segments become neutral-inverse or `brand-soft` rather than solid `--brand` (C3).
  - Centre desktop `.wrap` and widen the rail at 1440px and above (S4).
  - Check: `home` phone has at most one solid `--brand` fill above the fold, and `test:tokens` passes.
- [ ] **UX-X05 · EXT (M-01, L-01). Neutral cover placeholders.**
  - Delete `.k1`–`.k8`. Placeholder covers become `bg-sunk`, mono initials and `ring-1 ring-black/5` (dark `ring-white/10`).
  - Each row carries track identity once (`.edge` *or* `.tag`).
  - Check: `grep -c 'class="cv[^"]*k[0-9]'` returns 0, and no row carries both `.edge` and a `.tag .sq`.
- [ ] **UX-N20 · NEW. 4px spacing grid.**
  - Map the ~20 off-grid values per §2.2. Phone gutter `px-4`.
  - Section rhythm: `mt-6` headers, `space-y-3` stacks.
  - Remove the `.ghead` band where an `h3.s` exists (E3).
  - Check: every padding, margin and gap value in the app CSS is a multiple of 2px, 95% of them a multiple of 4px.
- [ ] **UX-X06 · EXT (E21). Card kickers take the medium accent.**
  - `.telecard .kick` and `.hero .kick` become `text-2xs uppercase tracking-wide` in `--m` or `--muted`, not `--brand`.
  - Check: `--brand` text appears only on links, the current-position marker and primary buttons.
- [ ] **UX-N21 · NEW. Mark-read micro-interaction.**
  - Specify and draw the 3-step mark sequence: pressed, filled with ✓ drawn, then meter or segment grown with the count ticked.
  - Also the telecard head advancing one cell.
  - Check: `spine` notes carry the sequence with durations, and the mid-state frame exists.
- [ ] **UX-N22 · NEW. Selection-indicator slide and tab underline.**
  - One moving indicator per `.seg`, `.bar .tab` and `role="tablist"` (status), 150ms, with an opacity-only fallback under reduced motion.
  - Check: the notes on `status` and `home` describe the indicator, and the markup contains one indicator element per group.
- [ ] **UX-N23 · NEW. Keyboard layer (#17).**
  - Draw the desktop focused-row state (`ring-2 ring-brand/50 bg-raise`) and a `?` shortcut sheet (j/k, x, Shift-x for range, `/`, `Ctrl K`, `g c`/`g b`/`g w` for the media).
  - Show the `?` hint in the sidebar footer beside `Ctrl K`.
  - Verify *Next three unread* on `shelves` in the same pass.
  - Check: `palette` gains a sibling frame for `?`, and `spine` desk shows a focused row.
- [ ] **UX-N24 · NEW. Re-read entry (#22).**
  - Add *Read again* to the `⋯` menu of a read run or book, and in book and issue *History*.
  - Draw the spine second-pass state: a header chip *Pass 2 · started 30 Sep*, previous-pass reads shown as grey `.seen` hints (*read 2025*), and the checks empty.
  - Check: one frame each on `spine` and `bookdetail`, and pass-1 marks never render green in pass 2.
- [ ] **UX-N25 · NEW. List → sheet continuity.**
  - Annotate the View-Transition cover morph and the scroll-position restore on dismiss for `blist → bookdetail` and `spine → issuedetail`.
  - Check: the notes specify `view-transition-name` per cover and the fallback.

### P3: later or cheap

- [ ] **UX-N26 · NEW. Releases screen (B1, B5).**
  - Draw `/books/releases`: a list by month, each row with a *Notify me* switch; a calendar toggle; and an *Upcoming* slot on `bdash` only if it fits the five-slot contract (otherwise it links from the rollup).
  - Check: a new `data-id="releases"` row appears in `mockups-index.md`.
- [ ] **UX-N27 · NEW. Bulk add remembers the last run.**
  - Add a chip *Adding to: Claremont — Uncanny X-Men · Change* at the top of `bulk` and `addsearch`.
  - Check: drawn on both frames.
- [ ] **UX-X07 · EXT (*Not shown* #6). Books and watch status empty slates.**
  - Draw the six missing slates from the FEATURES Part 2c copy table.
  - Check: 9 of 9 slates are drawn.
- [ ] **UX-N28 · NEW. Terminology alignment.**
  - FEATURES Part 2c says *Recalculate from sessions*; `settings` draws *Use these*. Pick one in both.
  - Check: `grep` finds a single label.
- [ ] **UX-N29 · NEW. Deferred-feature stubs.**
  - Add sidebar or palette entries for the prerequisite graph (#15), CSV import (#16) and events (#19) as `aria-disabled` items marked *Phase 5–6*, so the IA reserves their slots without dead links.
  - Check: no `href="#"` on the stubs.

### Dependency order

```
N01 ─┬─ N10, N21, N22, N25        (motion builds on tokens)
     └─ N18
N02 ── X01 ── X06
N03 ── X04                        (dark review after ladder)
N04 ── N19 ── X05 ── N20
N05 ── N16, N23                   (sticky offsets)
N06 ── N14, N15                   (edit patterns reuse inline-edit states)
N07 ── N08                        (tablet defines collapse breakpoint)
X02, N11, N12, N13, N17, X03, N24, N26–N29: independent
```

---

## 5. Deliberately not recommended

These are consistent with the project's own "not building" lists.

- **Gradient or glass hero treatments.** Colour is functional (ARCHITECTURE §4). Premium here comes from restraint: hairline rings, a disciplined scale, one accent per medium.
- **Celebratory motion** (confetti, streak flames, count-up fireworks). FEATURES Part 2d rejects streaks; the finish moment (N13) is a calm card.
- **Hover-only affordances on the phone.** Every desktop hover reveal (X03, the plan-rail popover) has a tap or sheet equivalent. FEATURES 2f's "why not hover" still governs.
- **Switching the codebase to Tailwind utilities.** See §0 and N-DN1.
- **Replacing mono for counts.** It is a documented decision (ARCHITECTURE §4). See N-DN2 for a narrower option.

---

## 6. Decisions needed

**N-DN1: Tailwind as vocabulary, or as implementation?**

- (a) Keep plain CSS custom properties named after Tailwind tokens (`--sp-4`, `--r-xl`, `--fs-2xs`), with no build change.
- (b) Adopt Tailwind v4 `@theme` with these tokens, which revises ARCHITECTURE §3.
- **Recommend (a).** It gives the same visual result and keeps the stack decision. It blocks N02, N04 and N20 only in naming.

**N-DN2: mono for inline counts?**

- (a) As today: every count is mono.
- (b) Mono for issue labels, slugs, the telescope and display numerals. Inline row counts (`.rm`, `.ghead .n`) use Inter Tight with `tabular-nums`, which is still tabular and less "dev-tool" in dense lists.
- **Recommend (b)**, as a scoped exception recorded in ARCHITECTURE §4. It blocks N02.

**N-DN3: tablet posture (768–1023px).**

- (a) Phone layout stretched, keeping the thumb bar.
- (b) Collapsed sidebar with the thumb bar at the bottom.
- (c) Full desktop layout.
- **Recommend (b).** It keeps the touch verb at the bottom and the media nav visible. It blocks N07 and N08.

**N-DN4: sheet-over-sheet.** Recommend *replace, with a back chevron* (N12) over true stacking. It blocks N12.

---

## 7. Traceability

| This report | Parent |
|---|---|
| UX-X01 | UX-C05 (11px floor, telescope only) |
| UX-X02 | M AR-1, R1-07, UX-C33 |
| UX-X03 | UX-C23, M-03, DN-2 |
| UX-X04 | `mockups-index` *Not shown* #11 |
| UX-X05 | M-01 (`.k2` red), L-01 (literals) |
| UX-X06 | UX-E21 |
| UX-X07 | *Not shown* #6, UX-E20 |
| UX-N01 … N29 | New; the source spec is cited in each task |
