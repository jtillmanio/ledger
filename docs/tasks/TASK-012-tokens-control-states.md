---
id: TASK-012
title: 1.8a Design tokens and control states
status: Ready
depends_on: [TASK-011]
size: M
model: sonnet
autonomy: attended
ui: true
plan_status: none
planned_at_commit:
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

## Acceptance criteria

- [ ] AC-1 (roadmap **Check:**, verbatim): `npm run test:tokens` passes, and is proven to fail three ways: dark `--sunk` set back to `#232935` (elevation), light `--faint-deco` set to `#98a1b0` (outline contrast; 1c's is `#878b9c`), and a `font-size:10px` rule added to `globals.css`. A test parses `globals.css` and asserts every class in the state-matrix list above has a `(hover:hover)` hover rule, an `:active` rule, a `:focus-visible` rule and an `[aria-disabled="true"]` rule. `grep -oE 'border-radius:[^;]+' src/app/globals.css | sort -u` returns only `var(--r-*)` values and `50%` (circles). Screenshot `/comics` at 360px in both themes before and after: the layout is unchanged, only the values move.
- [ ] AC-2: `scripts/check-tokens.mjs` checks, as explicit floors in both themes: the elevation order by relative luminance (dark `page < sunk < surface < raise < overlay`; light `sunk < page < raise < surface`, `overlay = surface`); `--ink`, `--ink-2`, `--muted`, `--faint`, `--brand`, `--brand-ink`, `--ready`, `--blocked` and `--danger` at 4.5:1 or more on `--page`, `--surface`, `--raise`, `--sunk` and `--overlay`; the STYLE_GUIDE §6 paired fills at 4.5:1 or more; `--faint-deco` at 3:1 or more on `--surface`, `--raise` and `--overlay`; and glass, worst case (`--glass-bg` at its alpha over `#000` light and `#fff` dark) with `--ink`, `--ink-2`, `--muted` and `--brand` at 4.5:1 or more.
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

## Plan

_Written by /plan-batch or /implement-task Phase 1. Approved by the user (plan_status: approved) before any code is written._

## Review log

_Filled by /implement-task. One line per round._

## Blocked

_Only if status is Blocked: what failed, what was tried, best hypothesis, decision needed._

## Metrics

- Verify rounds:
- Review rounds:
- First-pass AC FAILs:
- Plan revisions after approval:
