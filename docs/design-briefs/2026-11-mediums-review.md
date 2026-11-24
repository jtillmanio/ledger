# Design review, November 2026: the new mediums, and everything since the feel pass

The prompt for roadmap 6.23 (`docs/05-roadmap.md`), run by the owner on the
[Ledger canvas](https://claude.ai/artifact/KMTyE4DuUvZPYH4pbuHHCu) in claude.ai,
with the Ledger design system installed (`docs/04-design.md` § 1, *In
Claude*). Standalone Claude Design closes by 2026-12-14, so the review is not
run there (owner, 2026-11-24; TASK-126, plan revision 1). Claude Code checks
the inventory below against `main` on the day it is run and cuts the roadmap
excerpt (TASK-126's plan, steps 1–2). Then the owner pastes everything under
**The prompt** into the canvas, with the files under **Attach**. What comes back
is recorded by steps 4–6. Nothing here changes a design source on its own:
`design/*.dc.html`, `design/STYLE_GUIDE.md`, `design/tokens.css` and
`design/screenshots/**` change only through what the design tool, the canvas,
delivers (`.claude/kit.json` `protectedPaths`).

**Names.** The canvas allows no spaces in a page name. The review is the
canvas page `Mediums-Review`, and it comes into the repo as
`design/Ledger Mediums Review.dc.html`, its repo name, the way the canvas's
`Main` is `design/Ledger Feel Review.dc.html`. A component page it adds keeps
its canvas name, which already has no spaces (`LedgerDesktop`, `LedgerNav`).

## Attach

The canvas already holds the feel pass (`Main`, with `LedgerComics`),
`LedgerDesktop`, `LedgerNav`, `Style-Guide`, `Telescope-Spec` and
`Plan-Rail-Spec`, and the Ledger design system holds palette 1c, the fonts
and the type scale. So attach only what it doesn't have:

| File | Why the design tool needs it |
|---|---|
| `design/STYLE_GUIDE.md` | The feel pass's screens, copy and departures (§14–§16), which the design system's README only summarises, and the §10 changelog the new §17 is listed in. |
| `design/tokens.css` | Palette 1c as the repo has it, both themes, with the `+ NEW` and `~` marks a new token follows. |
| `design/mockups.html` | Every screen as it stands, including the frames Claude Code drew after the feel pass (part E). Large: point at screens by their `data-id`. |
| `design/mockups-index.md` | What each `data-id` holds, and what each frame was redrawn for. |
| `docs/04-design.md` § 10 | The UX floor every frame must meet. |
| `docs/design-briefs/2026-11-mediums-roadmap-excerpt.md` | The behaviour behind each screen: `docs/05-roadmap.md` Phases 8, 9 and 10 in full, then every entry parts A, E and F name. Cut by 6.23's plan, step 2, with `scripts/task.ps1`. |
| `design/screenshots/` (all three folders) | Only if the canvas's pages don't render: the feel pass as pictures. |

## The prompt

> I'm handing you a design review, the second one on this app. You did the
> first in October 2026: the feel pass, the `Main` page on this canvas, with
> its desktop pages (`LedgerDesktop`, `LedgerNav`), its style guide (§14–§16,
> attached as `STYLE_GUIDE.md`) and its tokens (palette 1c, *After hours*: the
> Ledger design system installed here, and the attached `tokens.css`). Please
> keep working in that language. This pass is not a new look.
>
> **The app.** The Ledger is my personal media tracker. It's single-user, and
> an Android phone at 360–412px is the main device: design every screen there
> first, then the 768–1023px tablet (a 72px navigation rail, the bottom thumb
> bar kept) and desktop at 1024px and up (a 64px icon rail to 1279px and a 224px
> sidebar from 1280px; dashboard verbs move into the page header, primary
> last). It has three media today: comics (runs of issues in a reading order
> with prerequisites), books (a plan by quarter) and a film and TV watchlist.
> Watch is designed but not built. Two more are planned and not designed at
> all: **music** and **games**.
>
> **What stays fixed.** Treat these as constraints. Where you think one is
> wrong, say so in the notes as a question for me and draw it the existing way:
> - Colour has exactly four meanings: `--ready` green is read or done,
>   `--brand` is where you are and the primary action, `--blocked` amber is
>   *held* (a prerequisite unread, or a decision I haven't made), and
>   `--danger` red is destructive actions and validation failures only.
>   **Nothing on a dashboard is red.** Every progress meter fills with
>   `--ready`. The identity hues `--t1`–`--t8` and the medium accents identify
>   data, never state or navigation. Anything without a meaning is grey. A
>   status is a glyph plus text, never colour alone.
> - **Every dashboard has the same five slots in the same order:** now → next
>   (with a control on it) → position → situation → a compact rollup (*2026 so
>   far*). Then comes the thumb bar, fixed at the bottom, whose first slot is
>   the mark verb. The Now slot is the one hero. What changes between media is
>   what fills each slot.
> - **Every medium has a status screen with the same three tabs**, *In flight ·
>   Up next · Done*, in that order. Stopped things collapse under *Stopped*.
> - **Position is drawn, not counted.** Never draw progress against a whole
>   catalogue. A count is mono text (`7 / 14`), and a meter measures against
>   something I chose (a run, a series, a franchise, an artist's discography).
> - **The UX floor** (`docs/04-design.md` § 10): every screen shows its empty
>   state (one primary action), loading (skeletons at the loaded size),
>   offline, rate-limited, error (a grey ×, never red) and metadata-pending
>   states. Text contrast is 4.5:1 or more (`--faint` is text-safe;
>   `--faint-deco` is for rules only), buttons on the thumb bar and icon
>   buttons are 44px, nothing interactive is under 24px, and every control is
>   a real button or link with a name. Hover, drag and shift-click are never
>   the only way in, because the phone has no hover.
> - Detail views are sheets over a list and full pages on a direct visit.
>   Fonts are IBM Plex Sans for the UI, Plex Mono for counts, and Newsreader
>   only for titles, hero names and completion lines. No streaks, no confetti.
> - No page calls an outside API when it renders. Live search happens only in
>   an add flow, after three characters and a pause. Attribution (TMDB,
>   JustWatch, MusicBrainz, IGDB) sits in the footer.
> - The figures in every frame are sample data. Make them plausible and
>   consistent between frames (one show is mid-season everywhere it appears).
>
> **What I want back.**
> 1. A new page on this canvas, `Mediums-Review`, in the format of `Main`,
>    in parts A–F below. Each part opens with what it is
>    solving, then its frames: phone (390, and 360 wherever width is tight),
>    tablet (834) and desktop (1280, and 1024 where the icon rail changes the
>    layout), in **dark and light**. Each frame is labelled with its screen and
>    state.
> 2. A **numbered list of departures** (MR-D1, MR-D2, …), one line each, for
>    anything that changes a rule above, the style guide or an existing
>    drawing, so I can accept or reject each one.
> 3. A **list of decisions for me** (MR-Q1, …), each with your recommendation
>    and the alternatives you considered. The navigation question in part A
>    must be on it.
> 4. The style guide's changed sections (a new §17 for this pass, plus edits
>    to existing sections, each listed in the §10 changelog) and any new
>    tokens marked `+ NEW` in `tokens.css`, with their contrast measured as §6
>    measures them.
> 5. A PNG of every frame (`phone/`, `tablet/`, `desktop/`; light and dark),
>    and a hand-off note for Claude Code mapping each frame to the screen it
>    redraws or adds.
>
> ---
>
> **A. Navigation for five media.** The phone's top media bar reads *Ledger ·
> Comics · Books · Watch* plus a settings gear, and it is at its width limit at
> 360px. Under it sits a sticky tab row with the current medium's screens,
> then *Inbox*; it scrolls sideways. Adding Music, then Games, breaks the bar.
> Propose how five media fit at 360px, and draw the options you considered (for
> example five tabs with shorter labels, a medium switcher, or the newer media
> under *More*), plus your recommendation. Then draw the same five in the
> tablet rail's media switch and in the desktop sidebar and icon rail. Say
> what `/` opens (today it is whichever medium I touched last) and where the
> media-wide pages go: Inbox, *In the middle of* (part E) and Activity (part
> F). Show the music accent and the games accent beside the existing medium
> accents. They must stay at least ΔE2000 15 from green, amber and red in
> both themes.
>
> **B. Watch: finish what the feel pass started.** Feel Review §5 drew the
> phone dashboard, a 16:9 still in Now, a shelf of posters, a two-rail
> telescope and *Paused*. It left three conflicts with rules that stand, and
> I need them resolved in the drawing:
> 1. Its Now draws one cell per episode and *Mark S4 E3 watched*, but the
>    watchlist tracks **seasons, never episodes**. Redraw Now with the season
>    as the unit and *Mark S4 watched* as the verb.
> 2. Its shelf has **Reorder**, but watch has no stored order, by design.
>    Remove it, or argue for a watch queue as an MR-Q.
> 3. Its Position rails read show → season. The spec reads **franchise →
>    series**: the coarse rail is headed *FRANCHISE · release order* in the
>    franchise's hue, the fine rail is the show's seasons, and the unit badge
>    reads *seasons*. A show in no franchise drops the coarse rail.
>
> Then draw what the feel pass did not:
> - `/watch` on the tablet and the desktop (never specified).
> - `/watch/status`: In flight (watching shows with their next season, then
>   films watching, then *Waiting for a new season*: caught-up shows in grey,
>   *Severance · S2 watched · returning*); Up next (to watch, oldest added
>   first, a film/TV toggle and grey genre chips); Done (with *Stopped*:
>   dropped titles with a grey `dropped` badge). Draw each tab's empty state.
> - `/watch/list` with its filters (film or TV, genre, network, studio,
>   person, length band) and **saved views** (a named filter, plus titles
>   added by hand with a grey *added* tag, plus a collapsed *Removed · 2* with
>   *Put back*). Each row carries year, network or studio and length in grey,
>   and a director or creator on the second line.
> - The film sheet, the show sheet with its seasons (each with its own status,
>   date and rating; the show's own rating and note) and the rewatch history,
>   and the season sheet.
> - Add: search across films and shows, with the *Watched through* stepper
>   (*none · S1 · S2 · S3*). The TMDB error frame still draws `⚠`; redraw it as
>   a grey × with *Save to inbox* (watch has no freeform path).
> - A franchise page with the *Release · Chronological* toggle above its tree
>   and an *unplaced in chronology* group.
> - Title shelves (films and shows together, in my order, with a note per
>   title), and *Add these to a shelf…* from a filtered list.
> - A person page (a director's or actor's titles in my watchlist, grouped by
>   role, `watched / listed` in mono, and *Their other work* as a search I
>   start).
> - Refresh: *Check for new seasons* (*Checked 3 days ago · Check now*, and a
>   toast naming the new season), and *Where to watch* (*Netflix · as of 3
>   Oct*, greyed when older than 30 days).
> - **Parked**, for a film or a show: not on any tab and not under *Paused*.
>   It comes back in a review (part F).
>
> **C. Music, designed from nothing.** It's shaped like watch: **artist →
> album → track**, as franchise → title → season. The catalogue comes from
> MusicBrainz, with covers from the Cover Art Archive. There's no playback.
> It starts empty. The one sync is Spotify telling me which artists I follow.
> - `/music` in the five slots. Now is the album I'm on. Up next is albums from
>   artists I follow. Position is the album in its artist's discography,
>   `listened / listed`. Situation is artists I want to listen to. Then *2026
>   so far*. The mark verb is *Mark Album listened*.
> - `/music/status`: In flight (albums started, then artists followed as
>   *listening*), Up next (to-listen albums from followed artists, oldest
>   first), Done (listened albums by year). *Stopped* holds skipped albums.
> - `/music/artist/[id]`: the discography by year, studio albums on and *EPs ·
>   Singles · Live · Compilations* as toggles, each album's status and rating,
>   *Not for me* to hide one, and a sort by which albums I favour (from the
>   song ranking: *median rank 12 · 3 in your top 10 · 4 of 11 ranked*).
> - The album sheet: tracks in order with lengths, listened, skipped or to
>   listen, a date and a rating, and the relisten history.
> - **The song ranker.** Pairwise *This or that* (*Which do you like more?*,
>   two cards, each a button, the mono *Pick 3 of at most 8*, grey *Skip*),
>   built the same way as the books ranker in `thisorthat`, plus the ranked
>   list with a drag handle (fine pointer) and *Move to…* (touch and
>   keyboard). Resuming a half-finished ranking keeps the songs already
>   placed.
> - Add: search artists with the disambiguation shown (*Genesis (UK rock
>   band)*); adding one follows it and lists its albums to trim. On an error or
>   no result, *Save to inbox*.
> - Spotify: the review list of followed artists with no MusicBrainz match
>   (never guessed), albums added by the sync labelled *Added from your
>   Spotify follows*, and an upcoming album as *Coming Mar 14*.
> - The empty first screen: a full-width search, as watch's is. Parked albums
>   follow part F.
>
> **D. Games, designed from nothing.** This is a planning tool for what to
> play. The catalogue comes from IGDB. A game is one of two kinds, and it's
> my call which, not IGDB's genre. A game I **play through** goes *want →
> playing → finished or dropped*, like a book. A game I play **in rotation**
> (Civilization, Slay the Spire) goes *want → in rotation → set aside*, and it
> never reaches Done.
> - `/games` in the five slots. Now is what I'm playing, plus what's in
>   rotation as a quieter second group. Up next is the queue (stored, in my
>   order). Position is hours left in the game I'm on, from IGDB's
>   time-to-beat (*main · main + extras · completionist*). Situation is the
>   next three coming out. Then *2026 so far*.
> - `/games/status`: In flight (*Playing*, then *In rotation*), Up next (the
>   queue with *Move to…*, and its total as text, *9 games · about 140 h*,
>   through games only, a game with no estimate saying *no estimate*), and
>   Done (finished, by year). It can be grouped by platform, genre and play
>   style, each group with its count.
> - The game sheet: platform, play style, status, rating, notes, time to
>   beat, release dates per platform.
> - Add: results with year, genres and platforms (mine first and marked).
>   Adding asks which of my platforms I'll play on (one the game isn't on
>   says so) and *Play through · In rotation* (a suggestion is fine; the
>   choice is mine), then *Up next* or *Someday*. An unreleased game goes to
>   Coming out. On an error, *Save to inbox*.
> - Coming out: *Out now* (last 30 days), then by month at IGDB's precision
>   (*Mar 14 2027 · Q2 2027 · 2027 · TBA*) with the platform, *Refresh dates*,
>   and a moved date marked *was Feb 2027*.
> - *Your platforms* in Settings (own · will own), and game shelves (5.1's
>   shelves, for games).
> - The empty first screen: a search. Parked games follow part F.
>
> **E. Review what was drawn after the feel pass.** Since 6 October, features
> were drawn straight into `mockups.html` by the engineer who built them,
> following the feel pass by reading it, never with you. Most are built and in
> use. For each one, say whether it holds to the feel pass. Redraw it where it
> doesn't, and draw the tablet frame where only phone and desktop exist. The
> list, by `data-id` (each one's contents are in `mockups-index.md`):
> - `bdash`, the books dashboard: *Next in* and *Or keep going*, *where the
>   book sits* (up to three rows: universe, series, subseries or author, each
>   `read / total`), *the book's place* on On deck and Up next, the *Coming
>   out* line, the listening hero and the stale *Calibre last synced* line.
>   This is also roadmap 6.21's question: how universe, author, series and
>   subseries read in Now and on the tablet and desktop heroes, including a
>   long universe name, a book on three levels and a book on none. Please
>   give it its own frames. Also on `bdash`: the plan strip *Between books*
>   draws as the plan rail on its side, and *Review 3 parked →* under the
>   *Coming out* line when the parked review is due.
> - `blist`, the Library: sort, *Unlisted*, start and finish dates, the
>   *Listening* status and the headphones glyph, what I own (*Physical ·
>   Audiobook · Ebook*), the DNF closing card (*Why did you stop?*), *Park*
>   on the status control with the *Parked · N* chip and a parked row,
>   *Queue to listen* in a row's `⋯`, and the author, universe and series as
>   links to their pages. Also the genre chip row, which is built but never
>   drawn: top-level genres, grey with text, one row scrolling sideways.
> - `status`: *Finished* on each in-flight book row, *Reading* then
>   *Listening*, Up next grouped by genre, a stopped book's reason, the
>   *Listen next* queue after the plan (its handle and *Move to top · Move
>   up · Remove from Listen next*), and Done's *All · Listened* chips. Its
>   empty slates for comics and books are in `states`.
> - `progress`, *In the middle of · Completed*: books and comics on one page,
>   chips per medium, nested rows, *On hold* collapsed. Say how it grows when
>   shows, franchises, artists and games join it, and where it sits in part
>   A's navigation (beside Inbox; its rail entry is after Inbox today).
> - `author` (an author's page and a universe's, *By series* or *In order*,
>   with the follow control) and `bookdetail`, the book sheet: *Your record*'s
>   writes (*Listen next*, *Park*, the *Owned* toggles, *Notes* edited in
>   place), *Move* and *Shelves* opening their sheet in place of the book's
>   with a back control, and the names linking to their pages.
> - `parked`, the parked review, books only: *Keep parked · Plan… ·
>   Unlisted*, *Pick it back up* for a book parked mid-read, *Done
>   reviewing*; with the *Parked review* row heading Inbox (`capture`) and
>   the *Review parked items* cadence in `settings`. Part F asks how it
>   reads for every medium.
> - `follow` (the *Follow…* sheet: *Reading · Tracking · Not following* per
>   level) and `finishoffer` (the finish toast's *Now reading* chips and *Keep
>   going?*).
> - `thisorthat` and `top`: ranking a book on finishing it, and every year's
>   top ten.
> - `releases` (books coming out), `series` (the series list and a series'
>   own page, with gap rows like *#6 not in your library · Add*), `shelves`
>   (with *Remove from shelf* in a row's `⋯` and its undo toast), `plan` (the
>   plan rail, and the planning sheet: *Plan this quarter…*, *Accept as a
>   stretch year*), `rebalance` (the rebalance sheet and the settled stretch
>   year), `moveplan` (its header naming the book's place), `add` (Hardcover
>   search as you type, a result's place line, owned copies and *Add to
>   Physical copy*, *Queue to listen*, *Coming out*, *New shelf…*), `calibre`
>   (the sync log, with *Merge · Keep separate* on a waiting near spelling)
>   and `settings`.
> - `states`: the empty slates of the comics and books status tabs.
> - The tab row under the phone media bar (part A changes its context).
> - The stepper: its number can now be typed as well as stepped (a button
>   that opens a numeric input) and a held − or + repeats. Style guide §9
>   still says *rather than type*; please change it. Also say whether the
>   batch and finish sheets' steppers sit on `--sunk`, as §9 says, or on
>   `--raise`, as they're drawn.
>
> **F. Designed by nobody yet.** These are planned or half-built features,
> beyond the mediums, with no drawing at all:
> - **Parked**, for every medium: *not now, but not gone*. Books' is drawn
>   (part E, `parked`). Draw the review when more than one medium has
>   something parked (a group per medium, or one list), each medium's wording
>   of the verbs, and the *Park* verb and the dashboard's one-line mention on
>   watch, music and games.
> - Comics: *Coming out* for the runs I follow (`/comics/releases`, a Metron
>   check I start, accepted issues reviewed before they're added); editing a
>   run's prerequisites, with the cycle error naming the runs in the loop
>   (`newrun`); and the volume map editor (which *Captain America #1* means
>   in this run).
> - Activity, `/activity`: every finished read, newest first, by month under
>   year headings with the year's totals, with filters by medium and year and
>   undated reads under *No date*.
> - Offline writes: the sync pill's failed, retrying, and undone-while-queued
>   states (`states`).
> - The phone bar's gear: the mockup still draws a search icon where the gear
>   now sits. Show where search goes on the phone once global search
>   (`Ctrl K`) is built.
>
> Where the roadmap excerpt leaves a choice open (marked *stop and ask*,
> *open*, or *for the plan gate*), draw your recommendation and put the choice
> on the MR-Q list. Don't settle it silently.

## Inventory, as written

Checked against `main` at `5c47fd7` (2026-11-18), and again at `66d3001`
(2026-11-24, TASK-126 plan step 1; *Refreshed 2026-11-24* below says what
moved). Part E lists the frames
`design/mockups-index.md` records as drawn by a task after 2026-10-06. Part F
lists the roadmap entries whose text says *not drawn yet*, *the mockup gains*
or *the feel pass is silent* and whose drawing is not in `design/mockups.html`.
To refresh it, list those entries with their tick:

```powershell
Select-String -Path docs/05-roadmap.md -Encoding utf8 -Pattern "not drawn yet|the mockup gains|mockup's \S+ (frames? )?gains?|feel pass is silent|is not specified"
```

Then read each hit's entry (`scripts/task.ps1 <id>`) and compare it with
`design/mockups-index.md`. Roadmap entries behind each part:

| Part | Roadmap |
|---|---|
| A | 9.0, 10.0; D-113 (the gear), D-120 (the tab row) |
| B | 8.2, 8.3, 8.4, 8.5, 8.6, 8.7, 8.8, 8.9, 8.10; 5.15 for Parked |
| C | 9.0, 9.2, 9.3, 9.4, 9.5, 9.6, 9.7 |
| D | 10.0, 10.2, 10.3, 10.4, 10.5, 10.6; 10.1 for the two play styles |
| E | 1.4f, 1.9, 1.17, 1.17b, 1.21, 1.22, 1.23, 2.0b, 2.2, 2.2b–2.2j, 2.2l, 2.3, 2.7, 2.10b, 3.4b, 3.5b, 4.4, 4.5, 4.5b, 4.6, 5.1, 5.1b, 5.5, 5.7, 5.9, 5.11, 5.12, 5.14, 5.15, 5.17, 5.17b; 6.21 |
| F | 5.15 (beyond books), 5.8, 3.3, 3.9, 6.17, 6.4, 6.1 |

### Refreshed 2026-11-24

The grep at `66d3001` (TASK-126 plan step 1) hits 29 lines in 28 entries.
Each one is now in part E or F, or drawn or settled already:

| Entry | Tick | Where it is |
|---|---|---|
| 1.17b, 2.0b, 2.2c, 2.2d, 2.2e, 2.2f, 2.2g, 2.2h, 2.2i, 2.2j, 2.10b | ☑ | Part E (each one's *not drawn yet* predates its own drawing) |
| 2.2 | ☑ | Part E (`bdash`). Its *the feel pass is silent* question (the capacity card, *Place them*) was settled by D-147 and D-148: `/books/plan` only |
| 5.1b, 5.7, 5.9, 5.12, 5.15, 5.17, 5.17b | ☑ | Part E. 5.1b, 5.12, 5.15 and 5.17b moved here from F: drawn since `5c47fd7` |
| 6.4 | ☐ | Part F (offline writes, `states`) |
| 3.3, 3.9, 5.8 | ☐ | Part F (comics) |
| 8.8, 9.0, 10.0, 10.6 | ☐ | Parts B, C, D |
| 6.23 | ☐ | This review |

Since `5c47fd7`, these tasks drew frames into `design/mockups.html`
(`design/mockups-index.md`): 2.2l, 3.5b, 4.6, 5.1b, 5.11, 5.12, 5.14,
5.15, 5.17b. So 5.12 (`progress`), 5.14 (the listen queue), 5.1b and 5.17b
left part F for part E, Parked stays in F only beyond books, and 2.2l, 3.5b,
4.6 and 5.11 (`author`, new) joined part E. Four frames drawn after
2026-10-06 that the first inventory missed also joined part E: 1.4f (`add`'s
Hardcover search), 1.9 and 2.3 (the status empty slates in `states`), 2.2b
(the plan rail on `plan` and `bdash`) and 2.7 (`rebalance`).
