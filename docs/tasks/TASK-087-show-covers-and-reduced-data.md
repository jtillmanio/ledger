---
id: TASK-087
title: 4.3 Covers in the UI (3 of 3) — Show covers, and no image requested when data is reduced
status: Ready
depends_on: [TASK-085, TASK-086, TASK-045]
size: M
model: sonnet
autonomy: attended
ui: true
plan_status: none
planned_at_commit:
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
