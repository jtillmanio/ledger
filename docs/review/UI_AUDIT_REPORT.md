# UI/UX ARCHITECTURAL AUDIT & CLAUDE CODE HANDOFF

Scope audited: `design/mockups.html` (v4, 25 screens, phone + desktop frames, light theme) against `FEATURES.md`, `HANDOFF.md`, `ARCHITECTURE.md`, `DIAGRAMS.md`. All line references are to `design/mockups.html` as supplied. Contrast ratios were computed from the token hex values with the WCAG 2.x relative-luminance formula. Geometry figures come from the SVG coordinates in the file.

## 1. Executive Summary & Design System Score

- The v4 information architecture is strong. The five-slot dashboard contract (Now · Next · Position · Situation · Rollup) holds on all three media. The telescope, plan rail and frontier are the right devices, because they draw derived data as geometry instead of stating it as percentages. The semantic token rule (green = read here, blue = position, amber = held, red = destructive only) is the best decision in the file. The execution does not yet carry the derived-state layer faithfully. The telescope sizes cells strictly in proportion to issue count, with no minimum, so a 6-issue run renders at about 0.6px. The five readiness states in DIAGRAMS §4 collapse to three visible badges, and `ready_hard` is painted the same amber as `blocked`. Nine phone screens still carry v3 navigation or v3 numbers (240k quarters, "Home" tab, 50-series volume map). A CSS name collision (`.era .bar` vs the app `.bar`) hides every era and block progress meter on desktop. Accessibility is the weakest dimension: the `--faint` text token measures 2.61:1 on white, the unchecked read control's ring is 1.3:1, the thumb bar measures 41px against a stated 44px minimum, and every segmented control, chip, drag handle and "All N" link is a non-focusable `<span>` or an `href`-less `<a>`. Empty, loading, offline and backfill-pending states are almost entirely unmocked (0 occurrences of offline, skeleton, or pending-enrichment patterns).

| Dimension                                                     | Score /10 | Evidence                                                                                             |
| ------------------------------------------------------------- | --------- | ---------------------------------------------------------------------------------------------------- |
| Information architecture & slot parity                        | 8.5       | Same 5 slots, same order, on `/comics`, `/books`, `/watch`; status screen tabs identical             |
| Derived-state representation                                  | 5.5       | Telescope has no cell floor; readiness has 3 of 5 states visible; read fill assumes contiguous reads |
| Cross-screen consistency                                      | 4.5       | 4 different phone tab sets; v3 numbers on Move sheet and Settings; Andor state contradicts itself    |
| State coverage (empty / loading / offline / backfill / error) | 3.0       | Only the plan "893k of room" empty state and the search "214 issues" overflow state are drawn        |
| Accessibility (WCAG 2.2 AA)                                   | 4.0       | Fails 1.4.3, 1.4.11, 2.1.1, 2.5.8 (plan-rail blocks), 4.1.2 (unnamed read buttons)                   |
| **Overall design-system score**                               | **5.9**   | Strong concept, under-specified states, fixable in roughly 2 sittings of mockup work                 |

## 2. Structural Layout & UX State Deficiencies

### Telescope — Comics dashboard `section[data-id="home"]` (DIAGRAMS §3b)

- **Deficiency:** The rail cells are strictly proportional and have no minimum legible height, which §3b names as "the only real work". The block rail allots about 0.44px per issue (300px / 664 issues, less 2px gaps): Lee/Kirby at 66 issues gets 27.8px and Excalibur at 47 gets 19.2px. A 6-issue run would get about 0.6px, and a 381-issue sibling would take 57% of the rail. The track rail is 0.137px per issue (300px / 2,180), so any block under about 30 issues becomes a hairline. Four more problems:
  - **Read fill assumes contiguous reads.** It is one rect from the top down to the head (`rect … height="33.1" fill="var(--ready)"`). Per-run read state (ARCHITECTURE 2.14), range marks and skipped optionals all produce non-contiguous reads that this fill misreports.
  - **The head label mixes units.** The rail marks `#141`, an issue number. The ladder says "issue 42 of 381", a placement ordinal. Neither shows the other.
  - **SVG text is 7.5–9px** in a viewBox rendered at about 1:1 on a 390px frame.
  - **The rails are static.** No cell is focusable or navigable.
  - **Missing variants.** None of these are drawn: the 2-rail fallback for the 9 runs with a null `block_id`, the no-run-in-flight empty state, and the 641-issue Krakoa tick density (the "1 tick = 10" pattern is hardcoded).
- **User Impact:** The component exists to show position in a long ordered list at three scales. Without a cell floor, short runs and short blocks (the Thor and Avengers cases the notes promise) vanish. The user then reads "block 1 of 7" in the ladder but sees only 5 legible cells. The contiguous fill misrepresents exactly the case per-run read state was built for, where #142 is read elsewhere but unread here. The desktop frame also drops the phone's "1 soft prereq unread" badge (line 198 vs 53), so the same run carries different state on each device.
- **Technical Frontend Fix:**
  - **Floor-then-distribute layout.** Replace proportional sizing with the allocation below, the same function on every rail:
    ```ts
    // src/components/telescope/layout.ts
    export function allocate(
      counts: number[],
      H: number,
      gap = 2,
      min = 14,
    ): number[] {
      const n = counts.length,
        avail = H - gap * (n - 1);
      if (n * min > avail) return overflow(counts, avail, min); // see below
      const rest = avail - n * min,
        total = counts.reduce((a, b) => a + b, 0);
      return counts.map((c) => min + (total ? (c / total) * rest : rest / n));
    }
    ```
    `min` = 14px on phone and 16px on desktop. `overflow()` keeps the head cell plus ±2 neighbours at `min` or larger, and folds the remaining cells into up to two `+N runs` / `+N blocks` stub cells, each 14px, labelled with a summed issue count.
  - **Read segments.** Draw read state as run-length segments. Add `read_segments(placement_ordinal_from, to)[]` to the run-rail query. It is computed in SQL from `issue_progress`, not stored. Render one `<rect>` per segment. Also draw a second, grey, dashed-outline segment layer for placements the `issue_read_runs` view marks "read elsewhere". Keep it grey so it never reads as a green tick.
  - **Tick spacing.** Compute `tick = niceStep(total / floor(H / 6))`, choosing from 1, 2, 5, 10, 20, 50, 100. Write the legend from the computed value.
  - **Head label.** Render the head label as `42 / 381 · #141`, ordinal first and label second, in both the rail and the ladder `RUN` row.
  - **Text sizes.** Move all text out of the SVG and into the HTML ladder, or set it in CSS px via a class so it is not scaled by the viewBox. Minimum 11px; kick labels 11px mono.
  - **Interactivity.** Wrap each cell in `<a href="/comics/runs?block=…">` or `<a href="/comics/[runId]#p-[ordinal]">` inside the SVG, with `<title>` text such as "Block 2 · The Outback Years · 214 issues · 0 read". Add `tabindex="0"` and a `:focus-visible` stroke.
  - **Accessibility.** Give the `<svg>` a `<desc>` describing the three rails. Keep the ladder as the text equivalent, and mark it `role="list"`.
  - **Variants.** Add three:
    1. `data-rails="2"`: the null `block_id` fallback, which drops the BLOCK rail and brackets TRACK straight to RUN.
    2. `data-state="empty"`: no run in flight. Draw the track rail only, with a "Start the top of Up next" primary button.
    3. The 641-issue Krakoa case.
  - **Badge parity.** Render the same run-state badges on phone and desktop from one `<RunStateBadges>` component.
  - **Copy fix.** The `Rest of block 1` foot row (line 148) reads "Avengers block 2 has no name yet" under an X-Men block that is named "The Outback Years". Replace it with an unnamed X-Men example and a `Name it` action.

### Readiness state badges — all run rows (DIAGRAMS §4)

- **Deficiency:** The state machine has five states: `blocked`, `ready_hard`, `ready_all`, `reading`, `read`. The mockups render three: green `ready`, amber `.bdg.bl`, blue `reading`. `ready_hard` (all hard prereqs met, soft ones unread) is shown as amber "1 soft prereq unread" (Hickman FF, line 104), the same amber as hard-blocked "82 runs first" (Immortal Hulk, line 100). The design rule defines amber as "a hard prerequisite unread, or a decision not yet made". A soft prereq is neither. The frontier tile "62 one soft prereq short" is also amber (line 154). A run in `reading` carries a prereq badge beside `reading` (line 53), which mixes two state axes in one badge row. Search results show a bare `blocked` with no count (Cates — Thor). No `read` badge exists for runs.
- **User Impact:** The user cannot tell "cannot start without 4,173 issues" apart from "can start tonight; one optional companion unread", and that difference decides what gets opened. It also undermines the "Show blocked" toggle, which hides by readiness: if `ready_hard` rows are grouped visually with blocked ones, the user will assume they are hidden too.
- **Technical Frontend Fix:** Create `<RunStateBadge state="blocked|ready_hard|ready_all|reading|read" hardLeft soft Left>` with a glyph plus text on every state, so it never relies on colour alone:
  - `blocked` → `.bdg.bl` "⊘ 82 runs first". This is the only amber readiness badge.
  - `ready_hard` → new `.bdg.rdh` (1px `--ready` border, `--surface` fill, `--ready` text) "○ ready · 1 soft unread".
  - `ready_all` → `.bdg.rd` "● ready".
  - `reading` → `.bdg.rg` "◐ 42 / 381"; prereq badges suppressed.
  - `read` → `.bdg.dn` "✓ read · Sep 2026".

  Add `aria-label` with the full sentence. Recolour the frontier's "one soft prereq short" tile to `--ready` with an outline treatment. Scope the run list `Show blocked` switch to `blocked` only, and state that in its label ("Show 27 hard-blocked").

### Reading spine & per-run micro-states — `section[data-id="spine"]` (ARCHITECTURE 2.14, FEATURES Part 2i)

- **Deficiency:** Seven problems:
  1. **CSS collision.** `.era .bar` (the era meter) shares its class with the sticky app header `.bar`. It inherits `padding:.625rem .875rem` under `box-sizing:border-box`, so it renders about 21px tall instead of 5px, sticky, with a surface border. `.frame[data-w="desk"] .bar{display:none}` (specificity 0,3,0) beats `.era .bar` (0,2,0), so every era and block progress meter disappears on desktop, including the run list block bands.
  2. **Collapsed eras.** The finished era "Second Genesis & Phoenix 38/38" renders with no rows and no affordance. It has no chevron, no `aria-expanded`, and no "38 read · show" control. Open question 3 (collapse finished eras) is therefore drawn but not designed.
  3. **Hint on read rows.** The `↺ read in …` hint also appears on rows that are already read here (#140, "also read in Byrne — X-Men"). That spends visual weight where no decision remains.
  4. **Unexpandable "+1".** "read in X-Men Graphic Novels +1" has no way to show the other run.
  5. **Unnamed read control.** The `.chk` button has an empty accessible name and no `aria-pressed`. `.seen::before{content:"↺"}` is announced by screen readers.
  6. **Missing navigation.** There are no era jump chips and no position scrubber for 381 or 641 rows (FEATURES Part 2c).
  7. **Thumb bar.** The primary slot is `Add issues`, with `Mark through here` secondary. The dashboard's primary is `Mark #141 read`, which contradicts "same primary verb slot".
- **User Impact:** Desktop users lose all section progress, which is the main structural cue in a 381-row list. Screen-reader and keyboard users cannot tell what a circle button does or whether it is on. Thumb muscle memory breaks between the dashboard and the run page. Because the hint is not suppressed on read rows, it fires on the rows that don't need it, and users will learn to ignore it before it reaches the rows where it matters.
- **Technical Frontend Fix:**
  - **Meter class.** Rename the era meter to `.era .emeter` in the CSS and in every era/band instance, including the run list `.tgroup .era`. Add a stylelint `selector-class-pattern` rule or a unit check that `.bar` appears only as the app header.
  - **Era header markup.** Make `.era` a `<button class="era" aria-expanded="false" aria-controls="era-3-list">`. Add a chevron `<span class="echev" aria-hidden="true">▸</span>`. Render collapsed finished eras (runs of 100 issues or more) as `38 / 38 · all read · Show`.
  - **Read control.** Change `.chk` to `<button class="chk" aria-pressed="true|false" aria-label="Mark Uncanny X-Men #141 read in this run">`.
  - **Hint markup.** Change `.seen` to `<span class="seen"><span class="sr-only">Previously read in </span>Hickman — FF · Mar 2025</span>` with `aria-hidden` on the glyph. Render the hint only when the row is unread here (`[data-read] .seen{display:none}`), and move the full list into the issue sheet.
  - **"+N" expansion.** Make "+N" a `<button>` that opens `/comics/[runId]/[issueId]` as the intercepted-route sheet.
  - **Jump chips.** Add a sticky `<nav class="erachips" aria-label="Eras">` under the hero, with horizontal-scroll chips `Phoenix ✓ · DoFP 4/22 · Brood 0/19 …`.
  - **Thumb bar.** Reorder the spine action bar to `[Mark #141 read (primary)] [Mark through… (sec)] [+ (icon, Add issues)]`.

### Plan rail — Books dashboard `section[data-id="bdash"]` and plan page `section[data-id="plan"]`

- **Deficiency:** Seven problems:
  1. **Tap targets.** The notes say "tap a block to move that book", but blocks render 7–27px tall and about 60px wide on phone (`style="height:7px"` for The Tusks of Extinction). WCAG 2.2 SC 2.5.8 needs 24×24 CSS px.
  2. **Title attribute.** Block identity lives in the `title` attribute, which does not exist on Android, the stated primary device.
  3. **Estimated counts invisible.** 29% of 2027 is estimated at pages × 275 (per the capacity card copy), but no block shows it is estimated.
  4. **Month view undesigned.** The `Quarter | Month` toggle is shown but has no layout: 12 columns plus the fifth lane at 390px leaves about 22px per column.
  5. **Settled state missing.** The persisted "Accept as a stretch year" outcome (`.decide.settled` exists in CSS) is never shown.
  6. **Rebalance sheet missing.** The four-peer Rebalance sheet (push to next year, drop to wishlist, even out quarters, accept) is referenced on two screens and drawn on none (0 matches for "Even out").
  7. **Move sheet is stale v3.** `section[data-id="moveplan"]` shows "Q1 312k of 240k" and "118k of 240k", and its notes say the preview "turns red", which contradicts the 760k reconciliation and the amber rule. It also uses the v3 `Home / Comics / Books` tab bar.
- **User Impact:** The rail is the books "Next" slot and its main interaction is untappable on the device it was designed for. Users can't tell a firm 387k figure from a ±15% estimate, so the "118% of capacity" headline reads as more precise than it is. Once the stretch year is accepted, the amber should become a calm state, but no one knows what that state looks like.
- **Technical Frontend Fix:**
  - **Hit areas.** Keep visual heights proportional, but give each block `<button class="qb" aria-label="Piranesi, 65k words, estimated, Q1 2027">` with a `::after` hit area: `position:absolute; inset:-4px -2px; min-height:24px`. Where stacking would still produce targets under 24px, merge adjacent sub-24px blocks into a `+3 · 180k` stack button that opens a list sheet.
  - **Estimate treatment.** Set `data-wc="estimated"` on blocks and render `border-top:1.5px dotted var(--muted)` plus a `~` prefix on labelled blocks (`~65k`). Add an "~ estimated" legend tag.
  - **Month view.** Add a `.planrail[data-gran="month"]` variant: three month sub-columns grouped under each quarter header, horizontally scrollable with `scroll-snap-type:x mandatory` on phone. The per-month capacity rule is 253k.
  - **Missing states.** Mock the settled state (`.decide.settled`: "2027 accepted as a stretch year on 14 Sep · Undo") and the Rebalance sheet, with four equal-weight `.btn.sec` options, each with a before/after numeric delta.
  - **Move sheet rebuild.** Rebuild `moveplan` on 760k figures, change the preview's over-capacity state to amber `.bdg.bl` with a hatch swatch, and fix the tab bar.
  - **Legacy red classes.** Delete `.capnum.over` and `.pace .big.behind` (they encode the retired red rule).

### Global navigation chrome — every screen

- **Deficiency:** The phone top bar has four variants:
  - `Comics/Books/Watch` (v4 dashboards, runs, status)
  - `Home/Comics/Books` (spine, range, addsearch, bulk, newrun, blist, moveplan, capture, search, settings)
  - `Home/Comics/Books/Watch` (franchise, watchadd, titledetail)
  - `Home/Comics/Books` with Books current (moveplan)

  `/` is a redirect, so "Home" has no destination. On desktop the sidebar links `Today` (no route), `Tracks` (no screen exists), and `Watchlist` (the route is now a dashboard, `/watch`). It has no `Status` or `Up next` entries and no capture inbox. Sidebar dots use track hues decoratively (Runs = `--t1`, Plan = `--t4`), which breaks the "nothing is coloured decoratively" rule and makes `--t5` mean X-Men, Fantasy, _and_ "Master list".

- **User Impact:** The three-medium mental model is carried by the tab bar. Screens that show "Home" and drop "Watch" imply two different apps and remove the one-tap switch between media. Decorative hue use dilutes the track-colour language that the telescope and run list depend on.
- **Technical Frontend Fix:**
  - **Phone header.** Replace every phone `.bar` with one partial: `<nav class="bar" aria-label="Media"><a class="home" href="/">Ledger</a><a class="tab" href="/comics" aria-current="page">Comics</a><a class="tab" href="/books">Books</a><a class="tab" href="/watch">Watch</a><a class="iconbtn" href="/search" aria-label="Search (Ctrl K)">⚲</a></nav>`.
  - **Desktop sidebar.** Per medium: `Dashboard · Status · List · Add`, plus `Runs · Tracks` for comics, `Plan · Shelves · Top` for books, and `Franchises` for watch. Delete `Today`. Add a global `Inbox (6)` entry.
  - **Dots.** Replace hue dots with neutral 16px line icons. Reserve `--t1`–`--t8` for data.
  - **Tracks screen.** Add a `section[data-id="tracks"]` mockup (37 tracks, completion bars, "never opened" group), or remove the link.

### Thumb bar & touch targets — `.actionbar`, `.btn`, `.iconbtn`

- **Deficiency:** HANDOFF §7 requires a 44px minimum. The computed `.btn` height is 41px (14px × 1.5 line-height + 18px padding + 2px border). `.btn.sm` is about 33.5px, `.iconbtn` is 34px, and `.sheetbar .x` is 30px. `+ batch` appears on three thumb bars but no batch surface exists. The Undo `.toast` has no live region or timeout specification.
- **User Impact:** The app's most-used verb, "Mark #141 read", falls below its own tap spec on the primary device. An undefined "+ batch" button is a dead end on the highest-traffic bar. Undo on a 96-issue range mark is invisible to assistive technology.
- **Technical Frontend Fix:**
  - **Sizing.** Set `.actionbar .btn{min-height:44px}`, `.iconbtn{width:44px;height:44px}`, `.btn.sm{min-height:32px}` with a `::after` hit-area expansion to 44px, and `.sheetbar .x{width:44px;height:44px}`.
  - **Toast.** Give it `role="status" aria-live="polite"` and document an 8s timeout that pauses on focus or hover.
  - **Batch sheet.** Define `+ batch` as a bottom sheet with three actions: "Mark next N (stepper)", "Mark through…", "Log a session". Mock it as `section[data-id="batch"]`.

### Status screen — `section[data-id="status"]` (ARCHITECTURE §4, 2.16)

- **Deficiency:** The tabs are `<span>`s inside `.seg`, with no `role="tablist"`, no `aria-selected`, no keyboard arrows, and no `?tab=` link. The comics Up next queue with drag handles, _Move to top_, _Remove_, and the _Ready, not queued_ section is described in the notes but only the books Up next is drawn (desktop). The phone shows only In flight. The `⋮` drag handle is a `<span class="chev">` with no keyboard or screen-reader alternative. The collapsed _Stopped_ group is not drawn. The Krakoa row button reads just `Read`.
- **User Impact:** The only authored order on the comics side, the queue, has no reviewed layout. Reorder is pointer-only, which fails SC 2.1.1 and makes long-press on Android undiscoverable.
- **Technical Frontend Fix:**
  - **Tabs.** Convert to `<div role="tablist">` with `<a role="tab" href="?tab=flight" aria-selected="true">` elements.
  - **Queue mockup.** Mock comics Up next: `<ol class="queue">` rows, each with `<button class="drag" aria-label="Reorder Simonson — Thor, position 2 of 12" aria-describedby="dnd-help">`. Keyboard: Space lifts, arrows move, Space drops, Esc cancels, announced through an `aria-live` region. The row menu offers `Move to top · Move up · Move down · Remove`.
  - **Ready, not queued.** Add a `ghead` section below the queue with `+ Up next` on each row.
  - **Stopped group.** Mock it as `<details class="stopped"><summary>Stopped · 3</summary>`.
  - **Button label.** Always label the resume button with the target, e.g. `Read New Mutants (2019) #9`, truncated with a title.

### Watch dashboard, show detail, franchise — `watchlist`, `titledetail`, `franchise` (DIAGRAMS §8, §8b)

- **Deficiency:** Six problems:
  1. **Data contradiction.** The dashboard shows Andor `watching` Season 2 with "Mark season 2 watched". The show detail shows Andor `watched`, 2/2, S2 watched 2026-08-14.
  2. **Hue collision.** The Andor stripe is `--t7` on the dashboard and `--t4` on detail and franchise, and `--t7` is also the _Rom-com_ genre chip on the same screen.
  3. **First-run state missing.** FEATURES Part 2e says the watchlist starts empty and "the first screen is a search box, not a 'no items' message". That first-run state is not mocked.
  4. **No dropped state.** "Dropped" is a stated status for shows, but `show_progress.state` can only be `unknown | to_watch | watching | watched`, and show status is never written to `title_status`. There is nowhere to store or render a dropped show.
  5. **Stale spec.** ARCHITECTURE §4's slot table still says "Series, episode within season" and "Episode → season → series", which contradicts the no-episode rule.
  6. **Franchise page and add flow.** The franchise order toggle sits _below_ the list it reorders, and franchise child rows are not links. Also, `Watch` on up-next rows is an ambiguous verb (set watching? log watched?), and adding a show cannot record "already watched through S3".
- **User Impact:** A dashboard that disagrees with the detail sheet destroys trust in derived state, which is the whole premise of the show-progress view. Hue drift means the franchise colour does not identify the franchise. Without a dropped state for shows, abandoning a show leaves it in "watching" forever, and it will sit in the Now slot indefinitely.
- **Technical Frontend Fix:**
  - **Andor example.** Swap it for a genuinely mid-show title, or set Andor's detail to S2 unwatched.
  - **Hue binding.** Bind the telecard stripe to `franchises.hue` (new nullable column or deterministic hash to `--t1..t8`), and use neutral grey chips with text labels for watch genres.
  - **Empty state.** Mock `watchlist[data-state="empty"]`: a full-width search input, three example queries, and TMDB attribution.
  - **Dropped shows.** Add `show_dropped` handling. Either allow `title_status` rows for `kind='tv'` only when `status='dropped'` and have `show_progress` `COALESCE` it first, or add `dropped_at` to a `show_flags` table. Render `.bdg.dn` "dropped" under Done → Stopped.
  - **Spec fix.** Correct ARCHITECTURE §4's table to "Series, season position" and "Season → series → franchise".
  - **Franchise page.** Move the `.seg` order toggle above the tree. Make child rows `<a class="row" href="/watch/[id]">` with chevrons, and render a null `chronology_ordinal` as "unplaced in chronology" at the foot when Chronological is selected.
  - **Button labels.** Rename `Watch` to `Start S1`. Add a season stepper to the add row: "Watched through: none · S1 · S2 · S3".

### Add flows — `addsearch`, `bulk`, `watchadd`, `add` (DIAGRAMS §6, §10)

- **Deficiency:** Five problems:
  1. **Count mismatch.** The bulk review header says "42 will be added" and the notes explain "42, not 44". The visible paste expands to 10 rows (4 + 4 + 1 + 1).
  2. **No insertion preview.** FEATURES Part 2c "Preview the resulting order" (where placements land relative to existing ones) is not drawn. The notes say placements "go after an issue you choose", but no picker exists.
  3. **No failure or waiting states.** Metron's 20 req/min limit, a 429 with `Retry-After`, a timeout, and "Metron down → Type it" have no states. There is no loading state between Enter and results.
  4. **Thin records invisible.** Freeform-created records start thin and backfill later (ARCHITECTURE 2.15), but no row anywhere shows "metadata pending".
  5. **Review semantics.** Validation tiles (`.vd`) carry glyphs, which is good, but the review list has no semantics connecting a line's error to its fix controls.
- **User Impact:** A count that does not match the visible paste undermines the one screen that must feel more trustworthy than Sheets. Without an insertion preview, a bulk add into the middle of Krakoa is a blind write. When a live-API add stalls silently, the user retries and hits the rate limit.
- **Technical Frontend Fix:**
  - **Count.** Change the paste example to one that sums to the header (for example `Thor #337-382` = 46 lines, minus 4 already present = 42), or change the header to 10.
  - **Insertion preview.** Add `<section class="insertprev" aria-label="Where these land">`: 3 existing rows above and below the insertion point, the new rows highlighted `--brand-soft`, and an "Insert after: [issue picker]" select.
  - **Search states.** Add a `.search[data-state="loading|ratelimited|error"]` status line, e.g. "Metron is busy, retrying in 40s · Type it instead", with `role="status"`.
  - **Pending enrichment.** Add `data-enrich="pending"` on `.cv` (a dashed outline and "metadata pending" in `.rs`) wherever a freeform issue or book renders.
  - **Review markup.** Mark up review rows as `<li class="vrow" aria-invalid="true" aria-describedby="vm-3">`, with `.opts` as `role="radiogroup"` of `<button role="radio">`.

### Backfill, offline and first-run states — cross-cutting

- **Deficiency:** There are zero mockups for:
  - the offline indicator and queued writes (FEATURES Part 2c "Everywhere")
  - "Since you were last here"
  - skeleton or loading states for the Neon cold start (about 1s, ARCHITECTURE §5)
  - an Up next empty state ("offers a pick from the ready runs")
  - a Books dashboard with nothing in Reading now
  - a telescope with no run in flight
  - the inbox count on dashboards (promised in Quick capture notes)
  - session logging (feature #20), although Settings shows "Measured from sessions: 212 wpm · 38 min/day" and the books thumb bar's primary is "Log progress"
- **User Impact:** HANDOFF calls a silently failed write "the worst outcome". The first cold-start second shows a blank frame, which on a phone reads as broken. The capacity engine's calibration input has no UI, so the Settings "Use these" button has no data source.
- **Technical Frontend Fix:**
  - **Offline pill.** Add a global `<div class="syncpill" role="status" aria-live="polite" data-state="online|offline|queued">`, e.g. "Offline · 3 marks queued", pinned inside `.bar` and in the desktop `.side`.
  - **Skeletons.** Add `.skel` blocks: a shimmer disabled under `prefers-reduced-motion`, with the same dimensions as `.row`, `.telecard`, and `.planrail`.
  - **Empty variants.** Mock `data-state="empty"` variants for telecard, Up next, Reading now and status tabs, each with one primary action (FEATURES Part 2c rule).
  - **Session screen.** Add `section[data-id="session"]`: a start/stop timer, "read 35 minutes" after-the-fact entry, attach to book or run, and a pages or issues delta.
  - **Inbox and since-last-visit.** Add an inbox count chip to each dashboard `.lede` ("6 in inbox"), and a single `.lede` line for "Since Tuesday: 14 issues marked, 1 book finished".

### Detail sheets & master list — `bookdetail`, `blist`

- **Deficiency:** The master list notes say "everything a detail page would hold lives here, which is why the page can be skipped", which contradicts FEATURES Part 2f, the intercepted-route sheet that the next screen mocks. The issue detail sheet (`/comics/[runId]/[issueId]`), the one that lists "every run that places the issue and its read state in each", is not mocked. It is the full expansion of the grey hint. The DNF option turns red (`.opts b.no[data-on]`), although DNF is not destructive. There is no "fits my remaining budget" filter and no "Pick one for me" (both FEATURES Part 2c).
- **User Impact:** The per-run read model's primary disclosure surface is undesigned, so the "read in …" hint has nowhere to lead. Red DNF says the user did something wrong for stopping a book they didn't enjoy.
- **Technical Frontend Fix:**
  - **Notes.** Replace the master list note with the Part 2f position.
  - **Issue sheet.** Mock `section[data-id="issuedetail"]` using the shared hero / About / Details / Your record / History layout. "Your record" is a table of placements (run · position · read state · date), each with its own `aria-pressed` read button and no "mark all" control.
  - **DNF.** Restyle DNF selected as `.bdg.dn` grey.
  - **List controls.** Add `<button class="chip" aria-pressed>Fits Q2 (56k)</button>` and a `Pick one` `.btn.sec` to the master list `.ctl`.

### Settings & Quick capture — `settings`, `capture`

- **Deficiency:** The volume map shows "50 series", but HANDOFF §5.2 says 67 approved rules across 61 series. Stepper `−` / `+` are `<b>` elements, so they are not buttons. The switches have no `role="switch"`. Capture's kind segmented control offers `Books · Comics · Unsure` with no Watch, although watch is a full medium. Capture uses the v3 tab bar.
- **User Impact:** A stale number on the data-provenance screen undercuts every reconciled figure elsewhere. A film someone mentions has no place to be captured.
- **Technical Frontend Fix:**
  - **Volume map count.** Change it to "67 rules · 61 series".
  - **Stepper.** Make it `<div role="group" aria-label="Minutes a day"><button aria-label="Decrease">−</button><output>45</output><button aria-label="Increase">+</button></div>`.
  - **Switch.** Make it `<button role="switch" aria-checked="true">`.
  - **Capture kind.** Change to `Books · Comics · Watch · Unsure`; resolving a Watch note opens `/watch/add` pre-filled.

### Design tokens & global accessibility — `<style>`

- **Deficiency:** Measured contrast:
  - `--faint #98a1b0`: 2.61:1 on `--surface`, 2.26:1 on `--page`, 2.45:1 on `--raise`. It is used for text in `.prov`, `.ladder .k`, `.kbd`, the `.rs.faint` TMDB line, and SVG rail labels (fails 1.4.3).
  - `--blocked` on `--blocked-soft`: 4.45:1 at 11px badge size (fails 1.4.3).
  - The unchecked `.chk i` ring, `--rule` on white: 1.30:1 (fails 1.4.11, 3:1 for UI components).
  - Dark `--faint`: 3.54:1 (fails as text).

  Other issues:
  - `.grab` references the undefined `--rule-2`.
  - Clickable rows are `<a class="row">` with no `href`, so they are not focusable, and some contain `<button>` (`+ Up next` inside `<a>`, lines 122 and 127), which is invalid nesting of interactive content.
  - `h3.s .more` "All 41" is a `<span>`.
  - The app has no `<h1>`.
  - SVG presentation attributes use `var(--…)` (`fill="var(--rule)"`, `font-family="var(--mono)"`), which is not reliably honoured across engines.
  - Track and genre identity is carried only by hue on row `.edge` strips.

- **User Impact:** The provenance line and the ladder keys, the text the design relies on for honest context, are the least legible text on the screen. Unchecked read circles are hard to see in sunlight on a phone. Keyboard users cannot reach a single run row.
- **Technical Frontend Fix:**
  - **Tokens.** Set light `--faint:#6f7888` (4.6:1 on white) and use it for text. Add `--faint-deco:#98a1b0` for non-text rules only. Darken `--blocked` to `#8a560c` (≥5:1 on `--blocked-soft`). Set the dark `--faint` to `#8a93a2`.
  - **Checkbox ring.** Set `.chk i{border-color:var(--muted)}` (5.3:1).
  - **Undefined token.** Define `--rule-2` or replace it with `--rule`.
  - **Row markup.** Make every navigable row `<article class="row"><a class="row-link" href="…">` with a stretched-link `::after` overlay. Secondary buttons sit outside the anchor with `position:relative; z-index:1`.
  - **Links and headings.** Make `.more` an `<a href>`. Promote `h2.t` to `<h1>` inside `.app`.
  - **SVG.** Move SVG colours to classes (`.tele .cell{fill:var(--sunk)}`).
  - **Track labels.** Add a text track tag or `aria-label` wherever an `.edge` carries track identity.

### Dual-track cognitive load — cross-medium differentiation

- **Deficiency:** Slot parity is correct, but the three media are hard to tell apart:
  - **Shared hues.** `--t1`–`--t8` mean _track_ on comics, _genre_ on books (the capbar `--t5` = Fantasy) and _genre_ on watch (`--t7` = Rom-com). On the desktop sidebar, where all three media are visible at once, violet means X-Men, Fantasy and a nav item.
  - **Shared component.** The telecard component is identical on comics and watch, so "PICK UP WHERE YOU LEFT OFF" over a franchise rail and over a track rail read the same. The comics rail is prerequisite-ordered and the watch rail is release-ordered.
  - **Unit ambiguity.** Books measure time (words vs 760k/quarter), comics measure sequence (costs · opens), and watch measures neither. Only the `.lede` copy signals which unit a screen is in.
- **User Impact:** Switching media without re-reading labels invites misreading. For example, an amber hatch on books means "over time budget", and an amber badge on comics means "prerequisite unmet". Both are "held", which is intentional, but the unit each is held against is invisible.
- **Technical Frontend Fix:**
  - **Medium accent.** Add `--m-comics`, `--m-books`, `--m-watch`, used only on the `.bar` active tab underline and the `h1` kicker.
  - **Unit badge.** Add `.unit` beside each dashboard `h1`: "sequence · issues", "time · words", "seasons".
  - **Scoped palettes.** Scope palettes with `[data-medium="books"] { --g1: …; }`, so genre hues are a separate token family (`--g1..g8`) from track hues (`--t1..t8`), even if they start as the same values.
  - **Rail headers.** Label the watch telescope's coarse rail "FRANCHISE · release order" and the comics one "TRACK · prerequisite order".

## 3. High-Value Inferred Feature Opportunities

- **Missing Strategic UI Element:** Telescope-as-navigator (scrub to position)
- **Value to Power User:** After five minutes the user will try to drag the run rail to jump into a 641-issue spine, and tap a block cell to open that block. The telescope already holds the geometry; making it a controller turns the headline visual into the fastest route into the spine.
- **DOM Placement Strategy:** `section[data-id="home"] .telecard > svg.tele`. Wrap each rail in `<g role="slider" aria-valuemin="1" aria-valuemax="381" aria-valuenow="42" tabindex="0">` with pointer and arrow-key handling. On release, navigate to `/comics/[runId]#p-[ordinal]`.

- **Missing Strategic UI Element:** Spine minimap / fast-scroller with era, read, and "read-elsewhere" density
- **Value to Power User:** A heavy reader of Krakoa or Claremont wants a phone-contacts-style edge scroller. It shows era boundaries, green read runs, and grey dashed "read in another run" ticks, so they can find the next crossover decision without scrolling 300 rows.
- **DOM Placement Strategy:** A sibling of `.group` inside `section[data-id="spine"] .wrap`: `<nav class="minimap" aria-label="Reading order overview">` with `position:sticky; right:0; top:4rem; height:calc(100vh - 8rem)`. On desktop, place it inside `.dk-rail` under the hero.

- **Missing Strategic UI Element:** "Why blocked?" critical-path sheet (cheapest unlock path)
- **Value to Power User:** "82 runs first" names the cost but not the route. A collector will immediately want the ordered minimal chain to Immortal Hulk: cumulative cost, which links are soft and skippable, and which runs already sit in Up next. `run_ancestors()` already computes the closure.
- **DOM Placement Strategy:** Make the `.bdg.bl` badge on any run row a `<button>` that opens an intercepted sheet at `/comics/[runId]/path`. Render `<ol class="path">` rows (run · own cost · running total · hard/soft) with `+ Up next all`.

- **Missing Strategic UI Element:** Unlock preview on long-press ("finish this, these open")
- **Value to Power User:** Leverage ("opens 13") is a number. Power users want to know _which_ 13 runs, and which of them become `ready_all` versus stay `ready_hard`. This is the decision behind "Highest leverage" on the frontier.
- **DOM Placement Strategy:** A `.cost .tag` "opens N" becomes a `<button aria-expanded>` that expands an inline `<ul class="unlocks">` under the row, inside `Unlocked and waiting` and the run list `.tgroup` rows.

- **Missing Strategic UI Element:** "Tonight" fit card: a cross-medium, short-horizon planner
- **Value to Power User:** Median session minutes (feature #20) times rate gives an honest "tonight fits: 6 issues of Claremont · or the rest of The Butcher of the Forest (1 evening) · or Andor S2E1–2". It links the two budgets without breaking the no-completion-date rule, because it looks only one evening ahead.
- **DOM Placement Strategy:** An optional compact card directly under each dashboard's Now slot (`.telecard` / `.hero`), `<aside class="tonight" aria-label="Fits tonight">`, with three one-tap rows. Hide it until at least 5 sessions exist.

- **Missing Strategic UI Element:** Persistent session timer chip
- **Value to Power User:** Speed readers calibrate wpm by timing themselves. A timer that follows the user across screens, and pre-fills "log this session against Claremont #141–146" on stop, is the lowest-friction feed for the capacity engine.
- **DOM Placement Strategy:** A third slot in every `.actionbar` (`<button class="btn sec timer" aria-pressed>` showing `12:04`), mirrored in the desktop `.side` footer. On stop it opens the `session` sheet.

- **Missing Strategic UI Element:** Explicit "adopt prior reads in this run" action
- **Value to Power User:** Crossover-heavy runs (Fear Itself tie-ins) can have dozens of rows that carry the grey hint. Ticking each one is tedious, and auto-ticking is forbidden. An explicit, previewed, undoable bulk action ("Mark the 9 issues you read elsewhere as read here, keeping their original dates") respects "nothing ticks them all" because it acts on one run at the user's command.
- **DOM Placement Strategy:** Place it in the spine `.hero .btnrow` when `issue_read_runs` count > 0 for unread placements: `<button class="btn sec sm">Adopt 9 prior reads</button>`. It opens the range sheet (`section[data-id="range"] .sheet`) pre-filled with those placements and date mode "Original dates".

- **Missing Strategic UI Element:** Saved views / pinned filters on the run list and master list
- **Value to Power User:** "Ready · owned · under 60 issues · X-Men or Thor" is a query a collector re-runs weekly. Rebuilding four controls each time is the friction that sends users back to a spreadsheet filter view.
- **DOM Placement Strategy:** A `.chips[role="toolbar"]` row above `.ctl` in `section[data-id="runs"]` and `section[data-id="blist"]`, holding named saved views, plus a "Save view" item in the desktop `.dk-rail` Filter group. State is in URL params, so views are just stored URLs.

- **Missing Strategic UI Element:** Command palette actions (verbs, not just search)
- **Value to Power User:** Ctrl+K is specified as search. A power user will type `> mark through #160`, `> move Piranesi Q3`, `> queue Priest BP top`. Verb commands against the current context remove three taps from the most frequent edits.
- **DOM Placement Strategy:** Extend `section[data-id="search"]` with a `>`-prefixed mode. Render `<ul role="listbox">` groups "Actions on this screen" above "Results". Show the shortcut in `.side .kbd`.

- **Missing Strategic UI Element:** Density toggle (comfortable / compact)
- **Value to Power User:** Desktop bulk sessions over 381–641 rows want 32px rows. Phone check-off wants 48px. One control respects both without forking layouts.
- **DOM Placement Strategy:** `settings` → Appearance group. `<div class="frow">Density <div class="seg">Comfortable · Compact</div>` sets `.app[data-density="compact"]`, which overrides `.iss` and `.row` padding and `.chk{min-height:2rem}`, on desktop only.

- **Missing Strategic UI Element:** Plan rail what-if drag with ghost and capacity delta
- **Value to Power User:** Picker sheets are correct for phone. On desktop a planner will expect to drag a block between quarter columns, with a ghost and a live "Q3 +118k → 533k / 760k" readout before release.
- **DOM Placement Strategy:** `section[data-id="plan"] .frame[data-w="desk"] .planrail.labelled`. Add `draggable="true"` on `.qb`, `aria-dropeffect` on `.qcol`, a `<output class="dropdelta" aria-live="polite">` pinned above the rail, and a keyboard alternative through the existing Move sheet.

- **Missing Strategic UI Element:** Copy / export run issue list
- **Value to Power User:** FEATURES Part 2c lists it and it is unmocked. It pastes a run's unread issues into a shop pull-list, a library hold search, or Marvel Unlimited.
- **DOM Placement Strategy:** A `section[data-id="spine"]` hero overflow menu (`.iconbtn ⋯` → `<menu>`) with `Copy unread (339) · Copy all · Copy as ranges`, confirmed by a toast with `role="status"`.

## 4. Structured Claude Code Task Appendices

Conventions: IDs `UX-C##` (critical) and `UX-E##` (enhancement). Append each task to `tasks.md` under a new `## Phase UX — mockup audit (Sept 2026)` heading, keeping the project's pass/fail `Check:` line. Unless stated otherwise, the target file is `design/mockups.html`. Rebuild each affected screen in both `data-w="phone"` and `data-w="desk"` frames, and check light and dark themes.

### [ ] CRITICAL FIXES (Layout, Schema Realization, Missing Views)

- [ ] Task UX-C01: Modify `design/mockups.html` to rename the era/block progress meter class from `.bar` to `.emeter` in the `/* spine */` and `/* v4 — run list */` CSS blocks and in every `.era` instance (spine, run list `.tgroup`, both frames). Check: on the desktop frame, every `.era` shows a 5px-high meter, and `.bar` appears only as the app header.
- [ ] Task UX-C02: Modify `design/mockups.html` to re-render the comics telescope (`section[data-id="home"]`, both frames) with the floor-then-distribute layout: 14px phone / 16px desktop minimum cell height, overflow into `+N runs` / `+N blocks` stub cells, and the head cell ±2 neighbours always at or above the minimum. Check: add a second telescope example with a 6-issue run beside a 381-issue run, and every cell measures 14px or more in the SVG coordinates.
- [ ] Task UX-C03: Create `src/components/telescope/layout.ts` exporting `allocate(counts, H, gap, min)` and `overflow(...)` as specified in §2, plus `niceStep(total, H)` for tick spacing. Check: unit tests cover (a) [6, 381] at H=300 giving both cells 14px or more, (b) 40 cells at H=300 folding to at most 12 rendered cells including stubs, (c) the sum of heights plus gaps equalling H ±0.5px.
- [ ] Task UX-C04: Update the telescope run rail in `design/mockups.html` to draw read state as run-length segments rather than one top-anchored rect, plus a grey dashed-outline layer for placements read in other runs. Add a `read_segments` output to the run-rail query in `src/db/queries.ts` (derived from `issue_progress`, nothing stored). Check: the mock shows a gap in the green where #142 is unread here, and a grey dashed segment at #142.
- [ ] Task UX-C05: Modify `design/mockups.html` to move telescope text out of SVG scaling (HTML ladder or CSS-px classes, 11px minimum), label the head as `42 / 381 · #141` in both rail and ladder, compute the tick legend from `niceStep`, and replace `var()` in SVG presentation attributes with CSS classes. Check: no `<text>` element renders below 11px at a 390px frame width.
- [ ] Task UX-C06: Add telescope variants to `design/mockups.html`: `data-rails="2"` (null `block_id` fallback), `data-state="empty"` (no run in flight, with a "Start the top of Up next" primary), and the 641-issue Krakoa run. Check: three new frames exist under the Comics dashboard nav group.
- [ ] Task UX-C07: Make every telescope cell a focusable `<a>` with `<title>` text inside the SVG, add `<desc>`, and give the ladder `role="list"`. Check: tabbing through the phone frame reaches track, block and run cells in order, each with a visible focus stroke.
- [ ] Task UX-C08: Create `src/components/RunStateBadge.tsx` and restyle `design/mockups.html` badges to the five-state system: `blocked` = amber "⊘ N runs first", `ready_hard` = new outlined-green `.bdg.rdh` "○ ready · N soft unread", `ready_all` = "● ready", `reading` = "◐ n / N" with prereq badges suppressed, `read` = "✓ read · date". Apply it to the dashboard, run list, status, search and queue rows. Check: Hickman FF renders outlined green, Immortal Hulk renders amber, and no `reading` row carries a prereq badge.
- [ ] Task UX-C09: Recolour the frontier tile "one soft prereq short" in `design/mockups.html` from `--blocked` to the `ready_hard` outline treatment, and relabel the run list switch "Show N hard-blocked". Check: amber appears only for hard-blocked runs and undecided plan states.
- [ ] Task UX-C10: Restore phone/desktop badge parity on the telecard (the desktop frame is missing the phone's soft-prereq badge, line 198 vs 53) by rendering both from the RunStateBadge partial. Check: a diff of badge markup between the frames is empty.
- [ ] Task UX-C11: Fix the `Rest of block 1` foot row copy in `design/mockups.html`: replace the Avengers sentence with an unnamed X-Men block example and a `Name it` button. Check: no block-name copy references a different track than its group.
- [ ] Task UX-C12: Replace every phone `.bar` in `design/mockups.html` with the single `Comics · Books · Watch` media nav partial (with `aria-current="page"` and a search icon link), removing all `Home` tabs. Check: `grep -c '<a class="tab">Home' design/mockups.html` returns 0.
- [ ] Task UX-C13: Rebuild the desktop `.side` in `design/mockups.html` per medium (`Dashboard · Status · List · Add`, plus `Runs · Tracks`, `Plan · Shelves · Top`, `Franchises`), add a global `Inbox (N)`, delete `Today`, and replace hue dots with neutral icons. Check: no `.side .dot` uses a `--t*` token.
- [ ] Task UX-C14: Add `section[data-id="tracks"]` to `design/mockups.html` (37 tracks, completion bars counting distinct issues, a "never opened · 24" group, links to the run list pre-filtered by track). Check: the sidebar `Tracks` link resolves to a mocked screen.
- [ ] Task UX-C15: Rebuild `section[data-id="moveplan"]` in `design/mockups.html` on 760k quarterly figures, change the over-capacity preview from red to amber `.bdg.bl` with a hatch swatch, and fix its tab bar. Update its notes so they no longer say "turns red". Check: `grep -n '240k' design/mockups.html` returns nothing.
- [ ] Task UX-C16: Add the Rebalance sheet (`section[data-id="rebalance"]`) to `design/mockups.html` with four equal-weight peers (push to 2028 → "2028 then holds 45 books", drop longest to wishlist, even out quarters, accept as stretch year), each showing a before/after delta. Check: the Books dashboard and Plan `Rebalance 2027` buttons point to it.
- [ ] Task UX-C17: Mock the settled stretch-year state (`.decide.settled`, "2027 accepted as a stretch year on 14 Sep · Undo") on `bdash` and `plan`, and delete the legacy red classes `.capnum.over` and `.pace .big.behind`. Check: no dashboard element resolves to `--danger`.
- [ ] Task UX-C18: Make plan rail blocks `<button class="qb" aria-label="Title, Nk words, stated|estimated, Qn YYYY">` with a 24px or larger hit area via `::after`, merging sub-24px neighbours into `+N · Nk` stack buttons. Remove reliance on `title`. Check: every interactive element in `.planrail` measures at least 24×24 CSS px.
- [ ] Task UX-C19: Add the estimated-word-count treatment to `design/mockups.html` (`data-wc="estimated"`: dotted top edge, `~` prefix, legend tag) on plan rail blocks, plan rows, master list `.rm` values and the book detail Words field. Check: at least one estimated example appears on each of those four surfaces.
- [ ] Task UX-C20: Design `.planrail[data-gran="month"]` in `design/mockups.html`: 3 month sub-columns per quarter group, horizontal scroll-snap on phone, a 253k monthly capacity rule, fifth lane retained. Check: the Month segment on `bdash` and `plan` has a drawn frame at 390px with no horizontal overflow of the page itself.
- [ ] Task UX-C21: Rebuild the spine (`section[data-id="spine"]`) in `design/mockups.html`:
  - era headers become `<button aria-expanded aria-controls>` with a chevron
  - finished eras collapse to "38 / 38 · all read · Show"
  - `.chk` gets `aria-pressed` and an `aria-label`
  - `.seen` gets sr-only lead-in text and is hidden on rows read here
  - "+N" becomes a button to the issue sheet

  Check: #140's hint no longer renders, and #142's hint remains.

- [ ] Task UX-C22: Add `section[data-id="issuedetail"]` to `design/mockups.html` as the intercepted-route sheet: hero, story title, credits by role, story arc, a placements table (run · position · read state · date · per-row read toggle, no "mark all"), and collecting editions. Check: the spine `.seen` "+1" and any issue row link to it.
- [ ] Task UX-C23: Reorder every `.actionbar` in `design/mockups.html` so the left primary slot is always the medium's mark verb (`Mark #141 read`, `Log progress`, `Mark S2 watched`). Set `.actionbar .btn{min-height:44px}`, `.iconbtn` to 44×44 and `.sheetbar .x` to 44×44. Check: the computed thumb-bar button height is 44px or more in every frame.
- [ ] Task UX-C24: Add `section[data-id="batch"]` to `design/mockups.html` to define the `+ batch` sheet (Mark next N stepper, Mark through…, Log a session). Check: every `+ batch` button in the file has a destination.
- [ ] Task UX-C25: Convert status tabs in `design/mockups.html` to `role="tablist"` / `role="tab"` links with `?tab=` hrefs and `aria-selected`. Mock the comics Up next tab on phone (queue `<ol>`, keyboard-operable drag handle buttons with an aria-live announcer, row menu with Move to top / up / down / Remove, the _Ready, not queued_ section) and the collapsed _Stopped_ `<details>` group. Check: the queue can be reordered by the documented keyboard sequence.
- [ ] Task UX-C26: Resolve the Andor contradiction in `design/mockups.html` (a mid-show example on the dashboard, or unwatched S2 on detail), bind the watch telecard stripe to a per-franchise hue consistent across dashboard, franchise and detail, and render watch genre chips neutral with text labels. Check: one franchise equals one hue across all three watch screens.
- [ ] Task UX-C27: Add `watchlist[data-state="empty"]` to `design/mockups.html`: a first-run screen that is a full-width TMDB search with example queries and TMDB attribution. Check: the frame contains no "no items" copy.
- [ ] Task UX-C28: Add dropped-show support. Update `etl/views.sql` so `show_progress.state` can return `dropped` (from a `title_status` row with `status='dropped'` for `kind='tv'`, checked first), document it in `ARCHITECTURE.md` 2.5b and DIAGRAMS §8b, and render it under Done → Stopped in `design/mockups.html`. Check: the §8b state diagram's `dropped` state has a data path and a UI.
- [ ] Task UX-C29: Correct `ARCHITECTURE.md` §4's dashboard slot table: watch Now = "Series, season position", watch Position = "Season → series → franchise". Check: `grep -n 'episode within season' ARCHITECTURE.md` returns nothing.
- [ ] Task UX-C30: Fix the bulk-add review count in `design/mockups.html` so the header matches the visible paste (change the paste to sum to 42, or the header to 10) and update the notes. Check: the expanded line count minus already-present lines equals the header number.
- [ ] Task UX-C31: Add the insertion-point preview to `bulk` and `addsearch` in `design/mockups.html` (`<section class="insertprev">`: 3 existing rows above and below, new rows highlighted, an "Insert after" issue picker). Check: both add halves show where placements land before commit.
- [ ] Task UX-C32: Add live-API states to `addsearch`, `add` and `watchadd` in `design/mockups.html` (loading, rate-limited with Retry-After countdown, error with "Type it instead"), each as `role="status"`. Check: three state frames exist for Metron search.
- [ ] Task UX-C33: Add the global sync pill (`.syncpill`, online / offline / queued, `aria-live="polite"`) to the `.bar` partial and the desktop `.side`, plus one offline frame of the spine showing "Offline · 3 marks queued". Check: `grep -c syncpill design/mockups.html` is at least 2.
- [ ] Task UX-C34: Add `.skel` skeleton states (reduced-motion safe) for telecard, run rows, plan rail and season rows, and one cold-start frame of `/comics`. Check: the skeleton dimensions match the loaded components exactly (no layout shift).
- [ ] Task UX-C35: Add `data-enrich="pending"` treatment (dashed cover outline, "metadata pending" line) for freeform-created issues and books, shown in the spine, the master list and book detail. Check: one pending example per surface.
- [ ] Task UX-C36: Add `section[data-id="session"]` (start/stop timer, after-the-fact minutes entry, attach to book or run, words or issues delta) and link it from the books thumb bar `Log progress` and Settings "Measured from sessions". Check: the Settings "Use these" figures have a mocked input source.
- [ ] Task UX-C37: Apply the token fixes in `design/mockups.html` `<style>`:
  - light `--faint:#6f7888` for text, plus a new `--faint-deco:#98a1b0` for non-text
  - `--blocked:#8a560c`
  - dark `--faint:#8a93a2`
  - `.chk i{border-color:var(--muted)}`
  - define or replace `--rule-2`

  Check: a contrast script reports 4.5:1 or more for all text-token/background pairs and 3:1 or more for the unchecked control ring.

- [ ] Task UX-C38: Refactor clickable rows in `design/mockups.html` from `href`-less `<a class="row">` to `<article class="row"><a class="row-link" href>` with a stretched-link overlay, moving nested buttons (`+ Up next`) outside the anchor. Make `.more` an `<a href>`, promote `h2.t` to `<h1>`, and convert `.seg` / `.chip` / `.opts b` / `.stepper b` / `.switch` to real `<button>` elements with `aria-pressed`, `role="radio"`, or `role="switch"` as appropriate. Check: an axe-core run over each screen reports 0 critical `nested-interactive`, `button-name` and `link-name` violations.
- [ ] Task UX-C39: Update the Settings volume map count in `design/mockups.html` to "67 rules · 61 series", and correct the master list notes to match the FEATURES Part 2f detail-sheet decision. Check: every catalog figure on screen matches HANDOFF §2 / §5.2.

### [ ] UX & FEATURE ENHANCEMENTS (New features, QOL upgrades)

- [ ] Task UX-E01: Update the UI interactions in `design/mockups.html` to make the telescope a navigator: `role="slider"` rails with drag and arrow-key scrubbing, and release navigating to `/comics/[runId]#p-[ordinal]`. Annotate the interaction in the Comics dashboard notes.
- [ ] Task UX-E02: Add a spine minimap (`<nav class="minimap">`, sticky right edge on phone, in `.dk-rail` on desktop) showing era boundaries, read runs and read-elsewhere ticks. Mock it on the Krakoa 641-issue run.
- [ ] Task UX-E03: Add sticky era jump chips (`<nav class="erachips">`) under the spine hero, each chip showing era name and read count.
- [ ] Task UX-E04: Add the "Why blocked?" critical-path sheet (`/comics/[runId]/path`) opened from any `.bdg.bl`: ordered minimal chain, running cost total, hard/soft markers, `+ Up next all`.
- [ ] Task UX-E05: Add the unlock preview: the "opens N" tag becomes an `aria-expanded` button revealing which runs become ready_all vs ready_hard. Apply to dashboard and run list rows.
- [ ] Task UX-E06: Add the "Tonight" fit card beneath each dashboard's Now slot, hidden until at least 5 sessions exist, with three one-tap rows computed from median session minutes.
- [ ] Task UX-E07: Add the persistent session timer chip to every `.actionbar` and the desktop `.side` footer. On stop it opens the session sheet pre-filled with the current run or book.
- [ ] Task UX-E08: Add an "Adopt N prior reads" button to the spine hero when unread placements have reads elsewhere. It opens the range sheet with an "Original dates" mode and supports Undo.
- [ ] Task UX-E09: Add saved views to `runs` and `blist` (a `.chips[role="toolbar"]` row of named URL-param views, plus "Save view" in the desktop filter rail).
- [ ] Task UX-E10: Extend `section[data-id="search"]` with a `>` verb-command mode (mark through, move to quarter, queue at top), grouped "Actions on this screen" above results. Add a Watch results group to global search.
- [ ] Task UX-E11: Add the density toggle to Settings → Appearance (`.app[data-density="compact"]`, desktop only, 32px rows).
- [ ] Task UX-E12: Add desktop drag-to-move on `.planrail.labelled` (ghost block, live `<output class="dropdelta">` capacity delta, the Move sheet as the keyboard alternative).
- [ ] Task UX-E13: Add a spine overflow menu with `Copy unread · Copy all · Copy as ranges`, confirmed by a `role="status"` toast.
- [ ] Task UX-E14: Add `Fits Q2 (56k)` and `Pick one` controls to the master list `.ctl`, and mock the Pick one result as a single highlighted row with "Another" and "Plan for…".
- [ ] Task UX-E15: Add the "Since you were last here" `.lede` line and the inbox count chip to all three dashboards.
- [ ] Task UX-E16: Add `Watch` to the Quick capture kind control (`Books · Comics · Watch · Unsure`). Resolving a Watch note opens `/watch/add` pre-filled.
- [ ] Task UX-E17: Add a "Watched through" season stepper to show rows in `watchadd`, and rename the up-next `Watch` button to `Start S1` (or `Start S{next_season}`).
- [ ] Task UX-E18: Move the franchise order toggle above the tree, make child rows navigable links, and add an "unplaced in chronology" foot group for null `chronology_ordinal`.
- [ ] Task UX-E19: Add the empty-state slate to the container element `section[data-id="home"] .group` under "Up next" (queue empty → "Pick from 41 ready runs" with the top 3 ready rows and `+ Up next`), and to `section[data-id="bdash"] .hero` (nothing reading → "Start the first Q-current book" primary action).
- [ ] Task UX-E20: Add the empty-state slate to each status tab panel (`[role="tabpanel"]`) with exactly one primary action per medium and tab. Also add `role="status" aria-live="polite"` plus an 8s pause-on-focus timeout spec to `.toast`.
- [ ] Task UX-E21: Introduce medium accents (`--m-comics`, `--m-books`, `--m-watch`) on the active tab underline and `h1` kicker, add the `.unit` badge beside each dashboard `h1` ("sequence · issues", "time · words", "seasons"), and split genre hues into a `--g1..g8` token family scoped by `[data-medium]`.
- [ ] Task UX-E22: Relabel the telescope coarse-rail headers "TRACK · prerequisite order" (comics) and "FRANCHISE · release order" (watch).
- [ ] Task UX-E23: Add "Estimated time to finish" ("about 6 weeks at your pace", from session data) to the spine hero and the in-flight status rows, hidden until session data exists.
