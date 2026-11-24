---
id: TASK-126
title: 6.23 Design review with Claude Design — the new mediums, and what was drawn since the feel pass
status: In progress
depends_on: []
size: M
model: opus
autonomy: attended
ui: false
plan_status: approved
planned_at_commit: 5c47fd7
---

# TASK-126 — 6.23 Design review with Claude Design — the new mediums, and what was drawn since the feel pass

## Goal

The owner runs one design review on the Ledger canvas in claude.ai (standalone
Claude Design closes 2026-12-14; `docs/04-design.md` § 1, *In Claude*) that draws watch, music and
games in the feel pass's language, settles where five media sit in the
navigation, and reviews every screen drawn after the feel pass. Its result is
in the repo, where 8.7, 9.0, 10.0, 6.21 and the other entries it touches can
build from it.

## Context

- Roadmap: `docs/05-roadmap.md` § 6.23 (M21). Its **Check:** is the contract,
  proposed and agreed by the owner merging the PR that added it.
- **The prompt** is `docs/design-briefs/2026-11-mediums-review.md`: what to attach,
  the text to paste, and the inventory behind parts A–F, checked against
  `main` at `5c47fd7` and again at `66d3001` (plan step 1).
- **Where it runs (owner, 2026-11-24, plan revision 1).** On the
  [Ledger canvas](https://claude.ai/artifact/UYEoW99o3cm13kYGYWpHPH), with the
  Ledger design system installed, not in standalone Claude Design, which
  closes by 2026-12-14. The canvas already holds the feel pass (`Main`) and
  the desktop pages, and allows no spaces in a page name: the review is the
  canvas page `Mediums-Review`, and it comes into the repo as
  `design/Ledger Mediums Review.dc.html` (its repo name, as `Main` is
  `Ledger Feel Review.dc.html`). "The design tool" below means the canvas.
  Revision 2 (owner, 2026-11-24): the canvas and the design system #335
  linked had been published to the owner's second claude.ai account, which
  Claude Code's artifact tools can't open. Both were rebuilt in the main
  account from `design/` and `src/app/globals.css` at `66d3001` (the canvas's
  pages byte for byte, except the four renames and the three links between
  the spec pages), and every link in the repo now points at the new ones.
- **The precedent** is the feel pass (D-40): `design/handoff/README.md` records
  what that delivery was and how it was recorded. `design/mockups-index.md`
  § *Oct 2026, feel pass (D-40)* is the superseded-frames table this task
  copies the form of. `docs/04-design.md` (the table of design files) lists
  each design source.
- **Protected paths.** `design/*.dc.html`, `design/STYLE_GUIDE.md`,
  `design/tokens.css` and `design/screenshots/**` are in `protectedPaths`
  (`.claude/kit.json`): *changes come from the design tool*. This task never
  edits them. The owner puts the design tool's export there, and Claude Code
  checks it and stages it as delivered (plan step 3). The owner approved that
  route with this plan (2026-11-18).
- **Size.** Seven files are written here: the brief, the excerpt,
  `mockups-index.md`, `decisions.md`, `04-design.md`, `05-roadmap.md` and
  `06-tasklist.md`. The rest are the design tool's delivery, staged as
  exported.
- **Who reads what comes out:** 8.7 (its three *stop and ask* conflicts), 8.8,
  9.0, 10.0 (their Checks still need the mockup frames, drawn from this
  review), 6.21 (*where the book sits*, part E) and 6.9 (the theme pass will
  find the new accents measured).
- Decisions: D-1 (which document wins), D-31, D-33, D-40, D-113, D-120,
  D-123, D-28. The UX floor: `docs/04-design.md` § 10.

## Acceptance criteria

- [ ] AC-1 (roadmap **Check:**, verbatim): the
  review page and its PNGs are in `design/` as the design tool delivered them,
  covering the prompt's parts A–F at phone, tablet and desktop, light and dark;
  `design/mockups-index.md` gains a section listing each `mockups.html` frame
  the review supersedes and the roadmap entry that redraws it; the decisions
  log records where four and five media sit in the navigation and the answers
  to 8.7's three open questions; and each question the owner answered is a
  decisions row or a *From 6.23* note in the roadmap entry it changes.
- [ ] AC-2: Before the owner pastes the prompt, its inventory matches `main`
  that day. The plan step 1 grep lists every roadmap entry whose text says
  *not drawn yet*, *the mockup gains* or *the feel pass is silent*, and each
  one is in part E, in part F, or named in the PR as drawn since. The grep's
  output is in the PR.
- [ ] AC-3: Opened in a browser with `design/support.js` beside it, the
  delivered review page renders with no console errors and a heading for each
  of parts A–F. Every PNG the hand-off note names exists under
  `design/screenshots/` at that path.
- [ ] AC-4: Each departure the design tool lists (MR-D1…) is marked accepted
  or rejected in one decisions row, as D-40 lists D1–D14, and the new D-n rows
  continue the log's numbering with no gap and no reuse.
- [ ] AC-5: `git diff main -- docs/05-roadmap.md` changes no **Check:** line,
  apart from 6.23's tick at close-out. Every other change is a *From 6.23*
  note or a tick.
- [ ] AC-6: Nothing under `src/`, `test/`, `etl/` or `drizzle/` changes, and
  `npm run verify:docs` passes on the branch.

## Out of scope

- Drawing music's and games' frames into `design/mockups.html`. That is 9.0's
  and 10.0's own Check, done from this review.
- Building anything, including `src/app/globals.css` following a new token
  (the task that first uses the token adopts it, as 1.8a did for palette 1c).
- Redrawing any existing `mockups.html` frame. The index marks it superseded,
  and its roadmap entry redraws it (standing rule 6).
- Changing a design-tool file by hand. A fix goes back to the design tool.

## Files likely touched

- `docs/design-briefs/2026-11-mediums-review.md`: the inventory refreshed (step 1)
  and a *Delivered* section (step 3).
- `docs/design-briefs/2026-11-mediums-roadmap-excerpt.md` (new): the roadmap text
  the prompt attaches.
- `design/Ledger Mediums Review.dc.html` (the canvas page `Mediums-Review`),
  any component pages it imports, `design/screenshots/{phone,tablet,desktop}/`
  and `README.md`, `design/STYLE_GUIDE.md`, `design/tokens.css`: delivered by
  the design tool and staged as exported (protected; never edited here).
- `docs/tasks/TASK-137-where-the-book-sits-redesign.md`: a *From 6.23* note in
  Context, that its drawing happens on the canvas (plan revision 1).
- `design/mockups-index.md`: the *Nov 2026, mediums review* section.
- `docs/review/decisions.md`: the owner's answers and the departures row.
- `docs/04-design.md`: the review page in the table of design files.
- `docs/05-roadmap.md`: *From 6.23* notes (6.23 and 6.21 first, on where the
  review runs) and 6.23's tick.
- `docs/06-tasklist.md`: 6.23's Done cell at close-out.
- Revision 3: `design/MR-*.dc.html` (18) and `design/mr.css` in place of one
  review page; `design/screenshots/mediums-review/` (234 PNGs);
  `docs/design-briefs/2026-11-mediums-handoff.md`; `src/app/globals.css` and
  `design/mockups.html` (the two new tokens);
  `docs/tasks/TASK-137-where-the-book-sits-redesign.md` (its drawing settled).

## Verification

- Automated: `npm run verify:docs` (the task-file parse, and any test that
  names a changed file).
- Manual: open `design/Ledger Mediums Review.dc.html` in a browser. Parts A–F
  render, light and dark, at each width, and the console is clean.
- Manual (owner): walk the review page (in the repo, or `Mediums-Review` on the
  canvas), accept or reject each MR-D, answer each MR-Q.

## Follow-ups

- The built screens the review redrew (MR-D16 *Remove from Listen next* grey,
  MR-D17 the capped finish toast, MR-D18 steppers on `--sunk`, MR-D20 the
  Library's phone chips, the drawn gear) and the six missing 834px mockup
  frames (owner, 2026-11-24: "do we need a task…") → `docs/05-roadmap.md` § 6.24
- Navigation for four and five media (D-178: the medium switcher, search in
  the phone bar, the tab row's across-media tail, the tablet rail, sidebar and
  icon rail, *Start on*), needed before 9.0 adds a fourth medium →
  `docs/05-roadmap.md` § 6.25
- Each watch, music, games and backlog entry the review draws for (3.3, 3.9,
  5.8, 5.15, 6.1, 6.4, 6.9, 6.17, 6.21, 8.2–8.10, 9.0, 9.2–9.7, 10.0–10.6) →
  `docs/05-roadmap.md` § each entry, *From 6.23 (2026-11-24, D-177)* note
- 6.21's starting drawing is settled (frames E1–E6) →
  `docs/tasks/TASK-137-where-the-book-sits-redesign.md` § Context
- 6.24 and 6.25 need task-list rows and task files (`/milestones`, then
  `/new-task 6.24 6.25`) → not tracked: the owner's next step, named in the PR
  and the final report
- The old canvas and design system in the owner's second claude.ai account,
  and the *Migrated Design* canvas, are no longer used → not tracked: the
  owner deletes them in claude.ai; nothing in the repo links them
- The worktree's Playwright wants browser build 1255 and only 1254 is
  installed; the render check ran on 1254 → not tracked: `npx playwright
  install chromium` (CLAUDE.md, *Commands*) fixes it on the owner's machine

## Plan

Approved by the owner, 2026-11-18, with the task ("make this into an approved
task"). The branch is `task/6.23-mediums-design-review`, in its own worktree.
Attended throughout, because step 3 is the owner's.

**Revision 1 (owner, 2026-11-24).** The plan went stale on two counts. Main
moved 43 commits past `5c47fd7`, which step 1 already allows for. And
standalone Claude Design closes by 2026-12-14, with its pages moved to the
Ledger canvas (#335). The owner chose the canvas for step 3, and asked that
the files describing the review follow it. Within AC-5 and the task list's
Done-cell rule, that means: the brief (where it runs, the Attach table, the
prompt's wording), this file, a *From 6.23* note on roadmap 6.23 and 6.21,
and one in TASK-137's Context. Entry titles that say *with Claude Design*
stay as they are.

**Revision 2 (owner, 2026-11-24).** The canvas and design system that #335
linked live in the owner's second claude.ai account, out of Claude Code's
reach. The owner chose to rebuild both in the main account. The new
[Ledger canvas](https://claude.ai/artifact/UYEoW99o3cm13kYGYWpHPH) holds
`design/`'s ten `.dc.html` pages and `ledger-feel-tokens.css` at `66d3001`,
with the Ledger design system installed. The new
[Ledger design system](https://claude.ai/artifact/2rUye3qEeu2arnmh85vFFj) is
built from `src/app/globals.css`, `src/app/fonts/` and `design/STYLE_GUIDE.md`
at `66d3001`. Their links are swapped in `README.md`, `docs/04-design.md` § 1,
`docs/SERVICES.md`, the brief, the two roadmap notes, TASK-137 and this file:
files outside the plan's list, changed for this revision only. The old
artifacts are the owner's to delete. Step 4 can now read the canvas and
check the export against it.

**Revision 3 (owner, 2026-11-24, at step 4).** Three things the delivery
changed. (1) The review came back as eighteen canvas pages (`MR-Main`,
`MR-Handoff` and parts A–F split under the canvas's 8,000px height limit) plus
`mr.css`, so they keep their canvas names in `design/` and `MR-Main.dc.html`
is the page this plan called `Ledger Mediums Review.dc.html`. (2) The owner
gave Claude Code permission to copy the delivery into the protected paths
itself, byte for byte, instead of placing it by hand. (3) The delivered
`design/tokens.css` adds `--m-music` and `--m-games`, and
`scripts/check-tokens.mjs` (in `test:no-e2e`) fails unless `globals.css`
holds every `tokens.css` token. The owner chose to adopt the two tokens now
in `src/app/globals.css` and `design/mockups.html` (3 and 2 lines, nothing
uses them yet): an exception to AC-6's *nothing under `src/`* for those lines
only, recorded in D-177. With `src/` changed, the branch runs `verify.full`,
not `verify:docs`, and CI runs every browser area. The owner also took every
MR-Q recommendation and accepted every MR-D ("take every recommendation"), and
asked for the built screens the review redrew to get their own work: two new
roadmap entries, 6.24 and 6.25 (Follow-ups), beside the *From 6.23* notes
AC-5 names.

1. **Refresh the inventory (Claude Code).** On an up-to-date `main`, list the
   roadmap entries whose text says *not drawn yet*, *the mockup gains* or *the
   feel pass is silent*, with their tick, using the command in
   `docs/design-briefs/2026-11-mediums-review.md` § *Inventory, as written*.
   Compare the list with `design/mockups-index.md`. Move
   anything drawn since `5c47fd7` (likely 5.14, 5.15 and 5.9 part 3, which
   were in flight) from part F to part E, and add anything new. Then edit the
   prompt's parts E and F and the inventory table to match. Paste the output
   into the PR (AC-2).
2. **Cut the excerpt (Claude Code).** `powershell -NoProfile -File
   scripts/task.ps1 <id>` for each ID in the inventory table, Phases 8–10 in
   full. Write them in that order to
   `docs/design-briefs/2026-11-mediums-roadmap-excerpt.md` under a line saying it
   is a copy and the roadmap wins (D-1). Commit steps 1–2 and hand the owner
   the attach list and the prompt.
3. **Run the review (owner, on the Ledger canvas).** Paste the prompt with the
   attachments into the canvas, which holds the feel pass already. Iterate
   there for as long as the owner wants. Export the review page
   (`Mediums-Review`, and any component pages it imports), every PNG, the
   style guide and tokens if changed, and the hand-off note. The owner puts
   the exported files into `design/` under their repo names
   (`Mediums-Review` → `Ledger Mediums Review.dc.html`) and
   `design/screenshots/`, and the hand-off note into `docs/design-briefs/`
   as `2026-11-mediums-handoff.md`.
4. **Record the delivery (Claude Code).** Check the export: the page renders
   (AC-3), each PNG the note names exists, and `git diff` on `STYLE_GUIDE.md`
   and `tokens.css` is listed file by file in the PR, with no edit by Claude
   Code. Stage the delivered files by path. Add a *Delivered* section to the
   brief (the date, every file and what it is, as
   `design/handoff/README.md` does) and a row for the review page in
   `docs/04-design.md`'s table of design files.
5. **The owner's calls (owner, then Claude Code).** Claude Code lists every
   MR-Q with the design tool's recommendation, and the owner answers each one.
   Each answer is a decisions row: the navigation for four and five media,
   8.7's three conflicts, and each other answer that changes a rule. Answers
   that only settle one entry are a *From 6.23* note in that entry instead.
   One more row lists every MR-D as accepted or rejected (AC-4). An MR-Q the
   owner defers stays open as a note in its entry, worded as a question.
6. **Supersede, don't redraw (Claude Code).** Add a *Nov 2026, mediums review*
   section to `design/mockups-index.md`, in the form of the feel pass's table:
   each `mockups.html` frame the review redraws, its section in the review
   page, and the roadmap entry that will redraw it. Then add a *From 6.23*
   note to each such entry (8.2–8.10, 9.0, 10.0, 6.21 and the parts-E and F
   entries the review changed), naming the section. Never change a
   **Check:** line (AC-5).
7. **Close out.** Run `npm run verify:docs`. Spec review against this file.
   Tick 6.23 in the roadmap and its Done cell in `docs/06-tasklist.md`, then
   run `.claude/scripts/build-index.ps1`. Push and open the PR, ready for
   review. Its Follow-ups include the new tokens for `globals.css` (→ the
   first task that uses them) and any MR-Q left open (→ its entry).

## Review log

Plan R1 stale (main +43; Claude Design closing) → revision 1 (owner, the
Ledger canvas) | Steps 1–2 done at `66d3001` | Verify R1 PASS (verify:docs) | CI R1 PASS
Revision 2 (owner: canvas and design system rebuilt in the main account) | Verify R2 PASS (verify:docs)

## Blocked

_Only if status is Blocked: what failed, what was tried, best hypothesis, decision needed._

## Metrics

- Verify rounds:
- Review rounds:
- First-pass AC FAILs:
- Plan revisions after approval: 2 (the Ledger canvas; the canvas and design system rebuilt in the main account)
