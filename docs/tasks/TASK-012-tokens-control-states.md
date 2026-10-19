---
id: TASK-012
title: 1.8a Design tokens and control states
status: Ready
depends_on: [TASK-011]
size: M
model: sonnet
autonomy: attended
ui: true
plan_status: approved
planned_at_commit: 4bba78a
---

# TASK-012 — 1.8a Design tokens and control states

## Goal

Every button, chip, tab and row responds the same way to hover, press, keyboard focus and being unavailable. No text in the app is smaller than 11px, and the token checks fail loudly when a value breaks contrast or elevation.

## Context

- Roadmap: `docs/TASKS.md` § 1.8a Design tokens and control states (sitting 6, before 0.11 and 1.8). The roadmap entry and its **Check:** are the contract.
- **The values have already landed** (D-40, PR `chore/feel-pass-d40`). This task does not move token values. It owes the control-state matrix, the 11px floor, the three elevation tiers in the component rules, the extended checks in `scripts/check-tokens.mjs`, the radius grep, and the mockup re-render captures.
- Design: `design/tokens.css` is the source and is protected (read only). STYLE_GUIDE §4–§6 and §10 give the reasons and measured contrast, and §4.1 and §7 the elevation tiers. `design/Specimen.dc.html` B5 draws the control-state matrix. `docs/DESIGN.md` indexes them. `src/app/globals.css` and `design/mockups.html`'s `.app` token blocks must stay identical (`npm run test:tokens`).
- The state-matrix classes: `.btn` and its variants, `.iconbtn`, `.chip`, `.seg`, `.bar .tab`, `.side a`, `.row`, `.switch`, `.stepper button`. Each gets a hover rule under `@media (hover:hover)`, a pressed rule (1px down, `--dur-1`), a `:focus-visible` rule on `--focus-ring`, and an `[aria-disabled="true"]` rule. The reduced-motion block stops `animation` on everything but `.spin`.
- Decisions: D-31 (the styling blueprint; SG-D2, SG-D8, SG-D12), D-40 (palette 1c), D-24b (identity hues vs state colours), UX-N01–N04, UX-X01, UX-X04.
- No renames or removals: additions and rule changes only. The `--mark` / `--held` aliases stay (SG §13).
- *From TASK-005 (1.3c, PR #74):* The range sheet's option chips (`.opts .opt`) and fields (`.sheet-fields .frow input`) outline with `--rule-2`, about 1.5:1 against their surface, under the 3:1 control floor. 1.3c's Add issues controls use `--faint-deco`, the 3:1 token (STYLE_GUIDE D8). Settle one control-outline token for every control.

## Acceptance criteria

- [ ] AC-1 (roadmap **Check:**, verbatim): `npm run test:tokens` passes, and is proven to fail three ways: dark `--sunk` set back to `#232935` (elevation), light `--faint-deco` set to `#98a1b0` (outline contrast; 1c's is `#878b9c`), and a `font-size:10px` rule added to `globals.css`. A test parses `globals.css` and asserts every class in the state-matrix list above has a `(hover:hover)` hover rule, an `:active` rule, a `:focus-visible` rule and an `[aria-disabled="true"]` rule. `grep -oE 'border-radius:[^;]+' src/app/globals.css | sort -u` returns only `var(--r-*)` values and `50%` (circles). Screenshot `/comics` at 360px in both themes before and after: the layout is unchanged, only the values move.
- [ ] AC-2: `scripts/check-tokens.mjs` checks, as explicit floors in both themes: the elevation order by relative luminance (dark `sunk < page < surface < raise < overlay`, STYLE_GUIDE §4.1; light `sunk < page < raise < surface`, `overlay = surface`); `--ink`, `--ink-2`, `--muted`, `--faint`, `--brand`, `--brand-ink`, `--ready`, `--blocked` and `--danger` at 4.5:1 or more on `--page`, `--surface`, `--raise`, `--sunk` and `--overlay`; the STYLE_GUIDE §6 paired fills at 4.5:1 or more; `--faint-deco` at 3:1 or more on `--surface`, `--raise` and `--overlay`; and glass, worst case (`--glass-bg` at its alpha over `#000` light and `#fff` dark) with `--ink`, `--ink-2`, `--muted` and `--brand` at 4.5:1 or more.
- [ ] AC-3: No rule in `globals.css` or the mockup's `<style>` block resolves to a font size under 11px, `font` shorthands included. No rule puts `--ready` text on glass. The reduced-motion block sets `animation: none` on everything except `.spin`.
- [ ] AC-4: `design/mockups.html` re-renders on the current values. The dark phone and desktop frames of `telescope`, `queue`, `planmonth`, `rebalance`, `path`, `session` and `palette` are captured and listed in `design/mockups-index.md`, and *Not shown* #11 (UX-X04) is closed there.
- [ ] AC-5: The control states meet the UX floor (`docs/TASKS.md` § *The UX floor, for every UI task*): with keyboard focus, every state-matrix control on `/comics` and a run page shows a visible `--focus-ring`; an `aria-disabled="true"` control looks unavailable without relying on colour alone; screenshots of `/comics` and a run page at every `ui.viewports` width, light and dark.

## Out of scope

- Changing any token value (D-40 landed them; `design/tokens.css` is protected).
- The app shell, nav, sidebar and skeletons (1.8), and the thumb bar (1.8b).
- Per-medium accents and genre hue splits (1.8).
- The 6.9 palette and CVD pass.

## Files likely touched

- `src/app/globals.css`: state-matrix rules, elevation tiers on components, the 11px floor, the reduced-motion `animation` stop.
- `scripts/check-tokens.mjs`: elevation order, text on every surface, paired fills, outlines, glass worst case, the sub-11px scan.
- `design/mockups.html`, `design/mockups-index.md`: the same rule changes in the `.app` blocks, plus the captures list (`ui.redrawFiles`).
- `test/control-states.test.ts` (new): parses `globals.css` for the matrix and the radius set.

## Verification

- Automated: `npm run test:tokens` green, then red on each of the three deliberate breaks, with the output quoted in the PR (AC-1, AC-2, AC-3). `test/control-states.test.ts` covers the matrix and the radius grep (AC-1).
- Manual: `npm run dev`, Tab through `/comics` and a run page → expected: a visible focus ring on every control. Compare 360px screenshots before and after in both themes → expected: the same layout.

## Follow-ups

_Work noticed during this task and deliberately left out. Each bullet ends `→ <path> § <section>` (where it was placed) or `→ not tracked: <reason>`. See `.claude/skills/track-follow-ups/classify.md`; the PR's Follow-ups section is copied from here._

- The roadmap and AC-2 gave the dark elevation order as `page < sunk < …`, but the shipped values (`--sunk` #05060e below `--page` #080a14) and STYLE_GUIDE §4.1 / SG-D2 put `sunk < page`. Owner, 2026-10-19: follow the style guide. AC-2 corrected in this file → docs/TASKS.md § 1.8a (approved at plan)
- Candidate decision: every control outline (chips, `.opts .opt`, inputs, `.btn.sec`, `.iconbtn`, `.seg`, `.stepper`) is `--faint-deco`, not `--rule-2` or `--rule`. This departs from STYLE_GUIDE §7's chip row and Specimen B5's resting *Batch* (`--rule-2`, about 1.5:1), for the style guide's own reason: SG-D8 darkened `--faint-deco` to 3:1 so it can outline controls (WCAG 1.4.11), and TASK-005 asked for one control-outline token. Both design files are protected → docs/review/decisions.md § D-71 (approved at plan)

## Plan

Steps:
1. `scripts/lib/css-rules.mjs` (new): a small brace-matching parser over a CSS string (comments stripped), returning `{ selectors[], decls{}, media: string[] }` per rule, the enclosing `@media`/`@supports` conditions included. `check-tokens.mjs` and the new test share it.
2. `scripts/check-tokens.mjs` takes `--globals <path>` and `--mockups <path>` (defaults unchanged), and adds a section 6 of explicit floors, each failure line naming its check: **elevation** by relative luminance (light `sunk < page < raise < surface`, `overlay = surface`; dark `sunk < page < surface < raise < overlay`, STYLE_GUIDE §4.1); **text** (`--ink`, `--ink-2`, `--muted`, `--faint`, `--brand`, `--brand-ink`, `--ready`, `--blocked`, `--danger` ≥ 4.5 on the five surfaces, both themes); **paired fills** (the STYLE_GUIDE §6 table, `--page` on `--ink` included) ≥ 4.5; **outline** (`--faint-deco` ≥ 3 on `--surface`, `--raise`, `--overlay`); **glass** worst case (existing composite; `--ink`, `--ink-2`, `--muted`, `--brand` ≥ 4.5); **no `--ready` on glass** (no rule with a `--glass-bg` background, and no rule under such a selector, sets `color:var(--ready)`); **sub-11px** over globals.css and the mockup's `<style>`: every `font-size` and `font` shorthand resolves (px, rem × 16, `var(--fs-*)`) to ≥ 11px; `em`/`%` sizes fail as unresolvable.
3. `globals.css`, the 11px floor: `.nextis .cv` and `.ladder .k` `.625rem` → `.6875rem`, `.qfoot .bdg` `.5625rem` → `.6875rem`. The mockup's `<style>`: its nine `.625rem` and three `.5625rem` → `.6875rem`, with `overflow:hidden;text-overflow:ellipsis` where a plan-rail label no longer fits (never shrunk, UX-X01), and `.notes code` `.8em` → `.75rem`.
4. Radius, mapped to STYLE_GUIDE §4.3 / §7: 2, 3px → `--r-cell`; 6, 7px → `--r-sm`; 8–11px → `--r-md`; 12, 14px → `--r-lg`; 16px → `--r-xl`; 99, 999px → `--r-full`; `50%` stays. The sheet's `var(--r-xl) var(--r-xl) 0 0` becomes `border-radius:var(--r-xl)` plus zeroed bottom longhands. The global `:focus-visible` drops its `border-radius:4px`.
5. Elevation tiers (§4.1, §7, SG-D2): `.telecard` `--sh-2` → `--sh-1`; in dark (both selectors) `.tag`, `.bdg.dn` and `.stepper` gain `inset 0 0 0 1px var(--rule)`. Menus and toasts stay `--sh-2`, the sheet `--sh-3`.
6. Control outlines → `--faint-deco` (TASK-005 note; SG-D8; candidate D-71: a departure from §7's `--rule-2` chip ring, for D8's 3:1 reason): `.opts .opt`, `.sheet-fields`/`.finish-fields .frow input`, `.chip`, `.btn.sec`, `.iconbtn`, `.stepper`, `input[type=search|password]`.
7. The state matrix, one block after the buttons, for `.btn` (+`.sec`, `.dg`), `.iconbtn`, `.chip`, `.seg button`, `.bar .tab`, `.side a`, `.row` (link rows only: `a.row`, `.row:has(.row-link)`), `.switch`, `.stepper button`: the values are Specimen B5's. Hover goes under `@media (hover:hover)`, at `--dur-1`: primary `--brand-ink`, secondary `--raise` with a `--faint-deco` ring. `:active` is `translateY(1px)`; fills add `inset 0 2px 4px rgba(0,0,0,.25)` and secondaries go `--sunk`. `:focus-visible` is `box-shadow:var(--focus-ring)`, the 2px ring outside a 2px gap. It adds `outline:2px solid transparent`, which isn't drawn: the reason is forced-colors mode, which drops box-shadows. `[aria-disabled="true"]` is `opacity:.45; cursor:not-allowed`, with no hover or press. Its non-colour cue is the visible reason under the control (B5: *Resolve 2 lines to add*), as each screen already writes. The existing `.55` disabled rules join it. `.rows .row:hover{background:none}` goes.
8. Reduced motion: one block, `*:not(.spin), *::before, *::after {animation:none!important}`, replacing the `.sk` and `.spin` stops (`.spin` keeps spinning, as the Check says).
9. The mockup's `.app` blocks get steps 7 and 8 (scoped `.app …`). Re-render, then capture the dark phone and desktop frames of `telescope`, `queue`, `planmonth`, `rebalance`, `path`, `session`, `palette` (the `th-dark` toggle; ui-verifier) to `design/captures/1.8a/<id>-<phone|desk>-dark.png`, list them in `design/mockups-index.md` § Oct 2026 feel pass, and strike *Not shown* #11. Tick 1.8a in `docs/TASKS.md`.

Files: `src/app/globals.css`, `scripts/check-tokens.mjs`, `scripts/lib/css-rules.mjs` (new, not in the list), `test/control-states.test.ts` (new), `test/check-tokens.test.ts` (new, not in the list), `design/mockups.html`, `design/mockups-index.md`, `design/captures/1.8a/*.png` (new), `docs/TASKS.md`.

Test strategy:
- AC-1 → `test/check-tokens.test.ts`: the script passes on the real files, then exits 1 on three copies in a temp dir: dark `--sunk` `#232935` (output names `elevation`), light `--faint-deco` `#98a1b0` (names `outline`), and `.x{font-size:10px}` appended (names `11px`). `test/control-states.test.ts` `each state-matrix control has hover, active, focus-visible and aria-disabled rules` (per class: a selector whose compound holds the class, `\b`-bounded so `.row` ≠ `.rows`, plus the state, hover inside a `(hover:hover)` media), and `border-radius values are var(--r-*) or 50%`. Manual: `/comics` at 360px, light and dark, before and after (ui-verifier), in the PR.
- AC-2 → the same `check-tokens.test.ts` run on the real files, plus one temp copy per new floor (text, paired fill, glass), each with one value pushed under the floor.
- AC-3 → `check-tokens.test.ts` `a --ready colour on a glass rule fails`; `control-states.test.ts` `the reduced-motion block stops animation on everything but .spin`.
- AC-4 → manual: the captures exist and are listed; #11 struck.
- AC-5 → manual (ui-verifier): Tab through `/comics` and a run page at every `ui.viewports` width, both themes; ring visible on each control; an `aria-disabled` control is dimmed with its reason shown beneath. The 0.11 harness doesn't exist yet.

Risks / open questions:
- Dark elevation order settled (owner, 2026-10-19): the style guide's `sunk < page < surface < raise < overlay`. The `#232935` break still fails, on `sunk < surface`.
- Settled (owner, 2026-10-19): `.seg` is a group, so its states sit on `.seg button`, and `.row` hover is limited to link rows.
- Raising the plan-rail mockup labels to 11px can crowd the `planmonth`/`rebalance` frames; the labels truncate there, never shrink.
- Settled (owner, 2026-10-19): the captures are committed as PNGs under `design/captures/1.8a/` (not protected).

Size check: M, 8 files plus the captures, CSS and a script, no schema; attended.

## Review log

_Filled by /implement-task. One line per round._

## Blocked

_Only if status is Blocked: what failed, what was tried, best hypothesis, decision needed._

## Metrics

- Verify rounds:
- Review rounds:
- First-pass AC FAILs:
- Plan revisions after approval:
