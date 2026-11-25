---
id: TASK-156
title: 4.3b Covers load small, behind their placeholder
status: Ready
depends_on: []
size: M
model: opus
autonomy: attended
ui: true
plan_status: none
planned_at_commit:
---

# TASK-156 — 4.3b Covers load small, behind their placeholder

## Goal

A cover box shows its placeholder until the image has arrived, and the image it fetches is a small one sized to the box.

## Context

- Roadmap: `docs/05-roadmap.md` § 4.3b Covers load small, behind their placeholder (M16 in `docs/06-tasklist.md`). Feature F-33. Its **Check:** is AC-1, verbatim; proposed in PR #342 and agreed when it merged (2026-11-25).
- Owner intake, 2026-11-24 (*covers take a second to come in*).
- **What exists.** `src/components/CoverImage.tsx` is the one component that draws a cover's `<img>` (task 4.3, F-33): the server sends the placeholder, and after hydration the image replaces it at once when *Show covers* is on and data isn't reduced (`src/lib/covers.ts`). The URL is Hardcover's (or Metron's) full-size image, hotlinked (D-94); `src/components/Cover.tsx` draws the 40×60, 28×42 and art boxes.
- **The decision for the plan:** how the small image is made. A resize the CDN offers (if Hardcover's or Metron's does), Next's image optimizer (`next/image` or its loader; its cost on Vercel's plan stated), or a stored thumbnail (a schema change: asks first). The cover URL in the database is unchanged either way.
- **Budget.** The Library and the dashboard are in `scripts/perf/budget.json`.
- Rules: `.claude/rules/ui.md` (motion tokens; reduced motion). UX floor: `docs/04-design.md` § 10. The UX floor. Decisions: D-94.

## Acceptance criteria

- [ ] AC-1 (roadmap **Check:**, verbatim):
in the
browser (0.11), with cover responses held back: a Library row's cover box shows
the placeholder, and its bounding box is the same before and after the image
is released; once released, the image shows. The image requested for a 40-px
box is at most 80 px wide. A cover that fails leaves the placeholder. The
Library stays within its budget in `scripts/perf/budget.json`.
- [ ] AC-2: Given *Show covers* off or `prefers-reduced-data`, no cover image is requested on any screen, as before (`test/e2e/covers-reduced-data.spec.ts` still passes).
- [ ] AC-3: Given a 28-px and an art box, each requests an image at most twice its CSS width.
- [ ] AC-4: Covers meet the UX floor (`docs/04-design.md` § 10. The UX floor): no layout shift from the swap (CLS unchanged in the measured run), any fade from the motion tokens and none under reduced motion, and screenshots at 360px and 1280px, light and dark.

## Out of scope

- Changing which covers the backfill stores (4.2) or adding covers where none are drawn.
- A stored thumbnail without the owner's yes (a schema change).

## Files likely touched

- `src/components/CoverImage.tsx` — the placeholder until `onLoad`; the small URL.
- `src/lib/covers.ts` — the URL for a box's width.
- `next.config.ts` — only if the optimizer is the choice (`images.remotePatterns`).
- `src/app/globals.css` — the swap, tokens only.
- `test/covers.test.tsx` — the placeholder until load, the URL's width.
- `test/e2e/covers.spec.ts` — AC-1 with held responses, AC-3, AC-4.

## Verification

- Automated: `test/covers.test.tsx`; `test/e2e/covers.spec.ts` (held responses via `page.route`); `test/e2e/covers-reduced-data.spec.ts` unchanged.
- Manual: `npm run dev`, throttle the network, open the Library → expected: grey placeholders hold the boxes, then the covers appear in place with no jump.

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
