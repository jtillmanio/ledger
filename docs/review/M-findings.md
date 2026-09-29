# M — Mockup consistency audit (HORIZON = Phases 0–3)

Review M, 2026-09-23. A mechanical check of `design/mockups.html` against itself
and against the claims made about it. It is not a taste review.

> **Disposition, 2026-09-24.** The owner decided M-D1…M-D3, recorded in
> `decisions.md` as D-24, D-25 and D-26. All 13 findings and all 7 LOWs are fixed in
> `design/mockups.html`, `src/app/globals.css`, TASKS (1.5, 1.8, 1.8b, 1.9, 1.10,
> 2.2b, 2.4, 2.8), CLAUDE.md and `.claude/rules/ui.md`. A new DB-free check,
> `npm run test:tokens` (`scripts/check-tokens.mjs`, in `test:all` and CI), holds
> M-01 and M-02: it passes now and fails on the old values with 14 errors. The
> watch, stats and shelves items under *Out of horizon* were fixed as well, except
> the four questions in the ledger rows M-O1…M-O4. AR-1 is still open for the owner.
> The findings below are the review as written; they were not edited to match.

## 1. Verdict

**PASS WITH CONDITIONS.** The mockup and `src/app/globals.css` share one token
set exactly: 34 light and 34 dark values, zero differences. No dashboard uses
`--danger`, and the grey read-elsewhere hint is consistent everywhere it appears.
Two claims that HORIZON acceptance checks depend on are still false, though.

- **The track and genre hues collide with the functional colours.** In dark mode
  `--t3` is `--ready` and `--t4` is `--blocked`, hex for hex, and `--t2` is 1.01:1
  against `--danger`. So "nothing on a dashboard is red" can fail while the
  "no `--danger`" checks in 2.2, 2.2b, 2.4 and 2.9 still pass (M-01).
- **Text on filled controls is a hard-coded `#fff`.** It measures 2.51:1 on the
  dark primary button, and 1.8b's contrast script tests token pairs only (M-02).

Eleven MEDIUM items are drift between screens and between the mockup and TASKS,
and each is cheap to fix when its task is reached. None is a BLOCKER.

## 2. Coverage

| Area | What I checked | Result |
|---|---|---|
| Inputs | `claude/dashboard-*.md` | **Absent.** `claude/` does not exist (ledger R0-13, accepted), and the zip in `docs/claude-outputs/` does not hold them either. I tested each claim as the brief quotes it, and where the same rule appears in CLAUDE.md, TASKS, `.claude/rules/ui.md` or the mockup notes, I cite that too. |
| Screen count | The brief says 23 | The file has **40** `data-id` sections, with 89 frames. I checked all 40. |
| Browser check | Headless Chrome, with a hash wrapper to switch screen, viewport and theme | 8 captures: home (phone light and dark, desktop dark), bdash (phone dark), watchlist (phone dark), spine (desktop light), queue, states. The rest was checked at source level. |
| 1 Tokens | Script diff of mockup `.app` against `globals.css :root` and dark; a count of literal colours in the app CSS and in inline styles | Identical values; M-01, M-02, L-01 |
| 2 Components | Thumb bar (every frame, extracted), badges, meters, plan rail, queue row, sheets, scrim, close button | M-03…M-10 |
| 3 Claims | 14 claims, below | 6 confirmed, 6 contradicted, 2 partly |
| 4 States | Every screen against R1 §4 | No new gap beyond M-11; the rest is AR-1 |
| 5 Orphans | 40 screens mapped to TASKS; HORIZON tasks mapped to frames | Every screen has a builder. M-13 and L-07 are tasks with no frame |

## Claim verification table

| Claim | Source doc | Result | Evidence |
|---|---|---|---|
| "The thumb bar is identical on every screen — same position, same primary verb slot" | claude/dashboard-* (absent); CLAUDE.md:234; mockups:998 | **Contradicted** (slot 1 confirmed on phone) | Slot 1 is the mark verb in every phone bar. Slots 2–3 vary: `+ batch · ⚲`, `✓ finished · ⚲`, `+ Add · ⚲`, `⏱ · +`. Desktop dashboards have no bottom bar, and the verbs move to the header in reverse order. The spine's desktop frame has the bar and krakoa's does not. → M-03 |
| "Amber = an unmade decision, not an error" | mockups:1907; CLAUDE.md:266-276 | **Confirmed** | Amber appears only as `bl`, `warncost`, `hatch`, `.decide`, the bare-year lane, `statusline.wait` and the offline strip, and each is a hold or an open decision. Every accepted state is `.decide.settled` (grey). |
| "Nothing on either screen is red", taken project-wide | mockups:1907, :5050; CLAUDE.md:270; TASKS:20 | **Contradicted** | `--danger` is used 0 times on home, bdash and watchlist, but `--t2` red is used 6 times on home and 6 on watchlist, and `.k2` red covers 4 times on home. In dark mode `--t2` against `--danger` is 1.01:1. → M-01 |
| Four colours only; the "colour audit only" items | CLAUDE.md:266; TASKS:17-21; `ui.md` | **Contradicted** | Green also means "room" (`bdg rd` "56k room", 18 times across bdash and plan), "stated", "backup ok" and "fits" (moveplan). Identity hues duplicate `--ready` and `--blocked`. → M-01, M-06 |
| Validation tiles follow the four colours | mockups:1537 | **Confirmed** | `vd ok/wn/er` and `dadd/dmv/ddel/dq` use only ready, blocked and danger, each with a glyph |
| "Comics never shows a catalogue percentage as a bar. 0.67% survives once, in grey" | mockups:996; TASKS 2.4:992-994 | **Partly** | No bar is drawn against the catalogue. The figure appears **twice** on the desktop dashboard (841, 985) → M-12. Track-scope bars at about 1% on tracks and stats are out of horizon. |
| "Every dashboard has the same five slots in the same order" | CLAUDE.md:231 | **Partly** | Phone frames match. The desktop comics frame moves *Also in flight* below *Rest of block* (966 vs 721). |
| "`blocked` is the only amber readiness badge" | CLAUDE.md:240 | **Confirmed** | The other amber badges are costs and edge kinds, not readiness states |
| Five readiness states, glyph plus text | CLAUDE.md:240; TASKS 2.4 table | **Contradicted** | The telecard shows "reading" with no glyph and no n/N. The spine hero shows "42 of 381". Search shows "⊘ blocked" without a count. → M-04 |
| "A read-elsewhere hint is grey, never green" | CLAUDE.md:229 | **Confirmed** | `.seen` is grey and dashed, the telescope `.else` is grey dashed, and the minimap tick is grey |
| "Only *Remove* and *Drop* may be red; DNF and *Skip* are grey" | CLAUDE.md:254 | **Confirmed** | Red appears on bulk *Drop* (1458), AI *Remove* and *Drop* (1670, 1673) and the queue's *Remove* (4499). DNF uses `.dnf`, which is grey. |
| "Every medium has a status screen with the same three tabs" | CLAUDE.md:221 | **Confirmed** (comics and books drawn) | The tablist markup is identical across status, queue and states |
| "Every add surface opens on a segmented control with Search selected" | CLAUDE.md:225 | **Contradicted** (out of horizon) | `watchadd` (3567) has no control and no freeform path |
| "Telescope cells have a floor", colours as classes | CLAUDE.md:245 | **Confirmed** | The telescope variants use `.cell`, `.fill`, `.else` and `.stub` classes only |

## 3. Findings

### M-01 Identity hues duplicate the functional colours, so the "no `--danger`" checks cannot catch a red or amber dashboard

- Severity: HIGH. Evidence: Proven. Confidence: high.
- Where: mockups.html:26-27, :44-45; globals.css:26-27, :50-51, :67-68; home 723-775; watchlist 3186, 3252-3260; TASKS:952, :1029, :1230.
- Evidence (script):
  `dark collisions: [('--t3', '--ready'), ('--t4', '--blocked')]`.
  Contrast: dark `--t2` against `--danger` 1.01:1; light `--t3` against `--ready` 1.02:1.
  Per-screen counts: home `t2=6 k2=4`, watchlist `t2=6`, and `--danger` is 0 on
  all three dashboards. The dark desktop capture shows Thor's edge in the same
  amber as the *⊘ 82 runs first* badge, and Hulk's edge in the same green as
  *● ready*.
- Failure scenario: The owner opens `/comics` in dark mode after 2.4 ships. The
  Immortal Hulk row carries a green edge identical to the ready badge, Thor an
  amber edge identical to *blocked*, and Priest's Black Panther a red edge. The
  2.4 check "no element renders `--danger`" passes.
- Why it matters here: colour is the app's state signal (four meanings), and the
  acceptance checks rely on "`--danger` is the only red". On screen, the state
  reads wrong.
- Recommended resolution: task 1.8 already edits these tokens (the `--g1`–`--g8`
  split), so re-pick `--t2`, `--t3` and `--t4` in both themes there. Also pull one
  line forward from 6.9's step 4 into 1.8b's contrast script: *no `--t*` or `--g*`
  value is within ΔE2000 15 of `--ready`, `--blocked` or `--danger`, in either
  theme*. The full palette revisit stays in 6.9. Or see DN-1.
- Proceed without fixing? Not past 1.8.

### M-02 Filled controls hard-code `#fff`, and dark mode fails contrast in a way 1.8b's check skips

- Severity: HIGH. Evidence: Proven. Confidence: high.
- Where: mockups.html:188 (`.btn`), :269-271 (`.chk` tick), :301 (`.toast u #9db4ff`), :207, :213, :232, :307; globals.css:167, :201; TASKS 1.8b:732-735.
- Evidence: `#fff` on dark `--brand` measures **2.51:1**. The tick on dark
  `--ready` measures **2.29:1**. The *Undo* link on the dark toast measures
  **1.72:1**, because `.toast` uses `--ink` as its background and `--ink`
  flips to `#eaedf2`. The dark phone capture shows *Mark #141 read* barely
  legible.
- Failure scenario: 1.8b's script checks "every text-token/background pair" in
  both themes and passes. Meanwhile the thumb bar's primary verb renders at
  2.51:1 on the owner's phone in dark mode.
- Why it matters here: this is the app's most-used control, and 1.8b's check
  certifies it.
- Recommended resolution: add `--on-brand` and `--on-ready` (light `#fff`, dark
  `#0d0f14`, which gives 7.64:1 and 8.37:1) and `--toast-link` (dark `#1a3aa3`,
  8.22:1). Make 1.8b's script read the computed colour and background of every
  rendered text node, not a token list.
- Proceed without fixing? Not past 1.8b.

### M-03 The thumb bar is not one component: desktop dashboards drop it, and the secondary slots vary

- Severity: MEDIUM. Evidence: Read (extracted by script). Confidence: high.
- Where: home 807 vs 842; bdash 1818 vs 1853; watchlist 3281 vs 3316; spine 1197 (the desktop frame has the bar); krakoa 4691 (the desktop frame has none); queue 4495 and batch 4708 (no search slot); dashextras 4807 (`+` is *Add issues*); note 998; TASKS 1.8b:720-730.
- Evidence: the desktop dashboard headers read `+ batch | Mark #141 read`, with
  the primary last. The note at 998 says "Primary verb, batch, search" on every
  dashboard, but books has `✓ finished` and watch has `+ Add`.
- Failure scenario: 1.8b's text puts `.actionbar` "fixed to the bottom" on every
  dashboard, but the mockup, which wins, draws header buttons on desktop. Two
  agents build two different desktop apps, and 1.8b's only check runs at 360px,
  so both pass.
- Recommended resolution: DN-2. Also correct the note at 998, and give the krakoa
  desktop frame the bar its spine sibling has.
- Proceed without fixing? Not past 1.8b.

### M-04 The reading and blocked badges are drawn four ways; the mockup contradicts 2.4's RunStateBadge table

- Severity: MEDIUM. Evidence: Read. Confidence: high.
- Where: home 665, 848 ("reading"); spine 1102, 1191 ("42 of 381"); runs 1020 and dashextras 4806 ("◐ 42 / 381"); search 2728 ("⊘ blocked"); TASKS 2.4:1001-1007.
- New evidence on UI audit C08, which the ledger triage marks as landed.
- Failure scenario: CLAUDE.md says the mockup beats a task, so 2.4 renders the
  word "reading" on the telecard and `◐ 42 / 381` in the run list. The telecard
  parity check passes, because both frames are equally wrong.
- Recommended resolution: change those four instances in the mockup to the table
  forms.
- Proceed without fixing? Not past 0.8b (spine hero) and 2.4.

### M-05 The same run's progress meter is green on one screen and blue on another

- Severity: MEDIUM. Evidence: Read. Confidence: high.
- Where: `.meter.rd` (green) on home 726, 970, runs 1020, bdash 1760. `.meter` (blue) on spine 1103, status 1926, 1931, stats. Shelves switch colour "past two-thirds" (2620). `.meter.rg` at 3850 is an undefined class.
- Failure scenario: Astonishing X-Men at 11/25 draws a blue bar on
  `/comics/status` (1.9) and a green one on `/comics` (2.4), one tap apart.
- Recommended resolution: DN-3 (recommend `--ready`, since the filled part is
  what has been read). Then add "in-progress meters use one class" to the 1.9
  and 2.4 checks.
- Proceed without fixing? Not past 1.9.

### M-06 Green is used for states that are not "read"

- Severity: MEDIUM. Evidence: Proven (count). Confidence: high.
- Where: `bdg rd` "56k room" at 1771-1773, 1863-1865, 2033, 2049-2053; "stated" at 3716; "ok" at 4025; the moveplan preview at 2210-2213.
- Failure scenario: 2.2b copies the rail footers, so a quarter with room reads
  as a quarter that is done.
- Recommended resolution: use `bdg dn` (grey) for room, stated and ok, and a
  neutral preview card. Amber stays reserved for going over.
- Proceed without fixing? Not past 2.2b.

### M-07 The plan rail is drawn three incompatible ways

- Severity: MEDIUM. Evidence: Read, plus the bdash dark capture. Confidence: high.
- Where: bdash 1769-1774 (inline fills, no `--hue`, and the fifth-lane entries are `<i>`, not buttons); plan 2033 (`.labelled`, inline fills); planmonth 5056 (`button.qb` with `data-wc`, but Q1 at 892k is not hatched, and there are no footer badges and no fifth lane); TASKS 2.2b:947-952.
- Failure scenario: built from planmonth, the only frame with the estimated and
  stack treatments, Q1 renders unhatched and fails 2.2b's own check. Built from
  bdash, the fifth lane cannot be tapped or tabbed to.
- Recommended resolution: regenerate all three rails from one markup:
  `button.qb`, a hatch class, and a fifth lane of `button.qb.un`.
- Proceed without fixing? Not past 2.2b.

### M-08 The dashboard's Up next rows are not the queue component

- Severity: MEDIUM. Evidence: Read. Confidence: high.
- Where: home 732-751, 906-925 (the handle is `<span class="chev">⋮</span>`, unnamed, with no row menu) vs queue 4494 (`<button class="drag" aria-label="Reorder …">`); note 999; TASKS 1.10:785, :817-822.
- Failure scenario: 1.10 builds the dashboard section from "Comics — v4". Reorder
  on `/comics` then works by pointer only, while the same queue on the status
  screen works by keyboard. The keyboard check runs on only one of them.
- Recommended resolution: either draw the dashboard rows with the queue `<li>`,
  or state in 1.10 that the dashboard section is read-only, and drop "drag
  handle" from the note at 999.
- Proceed without fixing? Not past 1.10.

### M-09 A spine note contradicts its own markup and 0.8b's check

- Severity: MEDIUM. Evidence: Read. Confidence: high.
- Where: note 1209 ("A read row can carry *also read in …* too (#140)") vs #140 at 1114 (no hint), the CSS at 157 (`.iss[data-read] .seen{display:none}`), and TASKS 0.8b:305. New evidence on audit C21.
- Failure scenario: 0.8b's agent reads the notes, as CLAUDE.md instructs, builds
  the hint on read rows, and then fails the render test or edits it.
- Recommended resolution: delete that sentence.
- Proceed without fixing? Not past 0.8b.

### M-10 "#N" in the mark verb means the label on one run and the ordinal on another

- Severity: MEDIUM. Evidence: Read. Confidence: high.
- Where: spine 1130 ("Mark #141 read", where #141 is the label and 42 the ordinal); krakoa 4659-4660 ("Resume #119", "Mark #119 read", where 119 is the ordinal and the issue is X-Men (2019) #8); telescope 4289 ("118 / 641 · #118"); TASKS 2.5:1072, 1.9:763.
- Failure scenario: on `hickman-krakoa` the thumb bar reads "Mark #119 read". No
  issue in the run carries that number, so the owner cannot tell which issue the
  tap will mark.
- Recommended resolution: the verb is always `Mark <label> read`, matching 1.9's
  *Read New Mutants (2019) #9*. Fix the krakoa and telescope frames.
- Proceed without fixing? Not past 1.8b.

### M-11 The empty dashboard's one action targets an empty queue

- Severity: MEDIUM. Evidence: Read. Confidence: high.
- Where: states 4864-4883 ("0 up next" and *Nothing queued*, alongside "The top of Up next is Simonson — Thor" and *Start the top of Up next*); TASKS 2.4:1011-1013.
- Failure scenario: with nothing in flight and nothing queued (reachable after
  finishing the last queued run), the telecard's only primary button has no
  target, so an agent invents one.
- Recommended resolution: 2.4 says that when both are empty, the call to action
  is *Pick from N ready runs*. Fix the frame to match.
- Proceed without fixing? Not past 2.4.

### M-12 The catalogue total appears twice on the desktop comics dashboard

- Severity: MEDIUM. Evidence: Read. Confidence: high.
- Where: 841 (the lede "… · 73 of 10,834 logged") and 985 (`.prov`); TASKS 2.4:993; note 996.
- Failure scenario: 2.4, built at desktop width, promotes the provenance figure
  into the headline line. 2.4's check is phone-only.
- Recommended resolution: delete "· 73 of 10,834 logged" from 841.
- Proceed without fixing? Not past 2.4.

### M-13 1.5's finish-date control has no frame, and the one date control drawn has no "year only" option

- Severity: MEDIUM. Evidence: Read. Confidence: medium.
- Where: blist 2344 and bookdetail 3725 (status only); range 1222 (Today · Pick · Spread · No date); TASKS 1.5:580-585; decision D-21; CLAUDE.md "year-only is `approximate`".
- Failure scenario: an agent copies the range sheet for books. "Finished
  sometime in 2019" then has no honest option and is stored as an `exact` date,
  which enters pace maths.
- Recommended resolution: add a frame of *Read → Today · Pick a date · Year only
  · No date*, mapped to exact, exact, approximate and none.
- Proceed without fixing? Not past 1.5.

### LOW

- **L-01** One-off literals and undefined classes: the moveplan scrim `rgba(15,17,20,.42)` (2182, 2267) differs from `.scrim`; newrun's selected chips swap the track hue for `#fff` (1558-1559, 1620-1621); `.meter.rg` and the minimap `.else` class are undefined (3850, 4659).
- **L-02** Unnamed controls in HORIZON frames: range `.chk` has no label and no `aria-pressed` (1229-1235); the bookdetail close is `<span class="x">` (3696, 3781), while path and issuedetail use a named button; the moveplan and density segmented spans have no role (2200, 4017).
- **L-03** The status frames have no `data-medium` (1916, 1943), so the tab accent and unit fall back.
- **L-04** addsearch phone and desktop disagree: the insert point (1342 vs 1415), the desktop drops the insertion preview, and the button reads *Review* on phone and *Add* on desktop.
- **L-05** The moveplan desktop chips show Q3 and Q4 as "·0k" (2293-2294) against the sheet's own 533k preview. The note (2322) promises *Accept as a stretch year* in the preview, which 2.3 requires, but it is not drawn.
- **L-06** In the queue, the toast names Simonson as grabbed while the lifted row is Hickman's FF (4499), and the comics *Stopped* list contains a book (4504).
- **L-07** 2.8's one-book-at-a-time flow (quarter buttons, Skip, Stop, closing card) has no frame. Only *Place them* and *Place all* are drawn (1787, 2044).

## 4. DECISION NEEDED

**DN-1: re-pick the identity hues now, or accept the collision until 6.9?**
The docs promise both "hues carry identity" and "nothing red", and the current
values cannot deliver both.

- (a) Re-pick three hues in 1.8 and add the ΔE assertion. It costs one token
  edit, and the checks become true.
- (b) Keep the hues until 6.9 and reword the rule to "no `--danger` on a
  dashboard". Track edges keep reading as states for Phases 1–5.
- **Recommend (a).** Blocks 1.8 and 2.4.

**DN-2: where do the thumb-bar verbs live on desktop?**

- (a) As drawn: header buttons on dashboards, a bottom bar on the run detail at
  every width. Record this in 1.8b.
- (b) A bottom bar everywhere, as 1.8b's text says. Redraw the three desktop
  dashboards.
- **Recommend (a).** It is what was reviewed. Blocks 1.8b.

**DN-3: what colour is an in-progress fill?**

- (a) `--ready`: the filled part has been read.
- (b) `--reading` blue: in progress.
- **Recommend (a).** Blocks 1.9.

## 5. Proposed ACCEPTED RISK

**AR-1: most screens draw only the populated state.** No new frames beyond M-11
and M-13. The UX floor (TASKS:23-31), FEATURES 2c's copy table and each task's
empty-state line already define these states. The failed-write toast (R1-07) is
fixed in the contract (TASKS 1.8:682-686) but still undrawn in the mockup. That
is open in the mockup, closed in the contract, and not re-reported.

## 6. NOT A VALID ISSUE

- Numbers that disagree between screens (22 vs 38 books read in 2026, two queue orders, Defenders both ready and blocked, Immortal Hulk at 64 vs 105 issues, Star Wars 7/14 vs ten cells). The figures are sample data under D-7 and TASKS:40.
- Token drift between the mockup and globals.css: there is none (Proven). The missing `--m-*`, `--g*` and font tokens are 1.8's to add (TASKS:701-703).
- `--danger` on dashboards: used 0 times (Proven).
- The grey `✓ read` badge: this matches 2.4's table. "Green = read" governs marks and segments, not the run-level badge.

## 7. Sound — do not change

- The readiness badges on the run list and in the queue (1020-1022, 4494): glyph, text, and the `rdh` outline. This is the reference for M-04.
- `.decide` amber and `.decide.settled` grey, consistent across bdash, plan, rebalance and session.
- The read-elsewhere treatment: grey and dashed in the spine, the telescope and the minimap, and never green.
- The tablist markup, identical across status, queue and states.
- Token parity between the mockup and `globals.css`, including the dark `@media` block, which equals `[data-theme=dark]` (Proven).

## 8. Out of horizon

- Watch: the genre filter chips are coloured (3252-3257, new evidence on C26); *Start S1* appears on Season 2 and 3 rows and on a film (3260); watchadd has no segmented control (3567); TMDB attribution appears only on watchempty (5110); the telescope cell titles say "issues · % read" (3193).
- Tracks and stats draw track-scope bars at about 1%, all at the same width (4447, 2891). The stats note claims real data (3066), which contradicts D-7.
- The shelves note names `shelf_items` (2616), which CLAUDE.md forbids.
- The dashextras timer sits in slot 2, where the note says slot 3 (4807, 4848). That is 6.12.
- TASKS 5.3's era editor duplicates 3.6.
