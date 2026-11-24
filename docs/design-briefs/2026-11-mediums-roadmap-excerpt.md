# Roadmap excerpt for the mediums review (6.23)

A copy of `docs/05-roadmap.md` at `66d3001` (2026-11-24), cut by TASK-126
plan step 2 for the design tool to read beside the prompt
(`2026-11-mediums-review.md`). **The roadmap wins (D-1)**: where this copy and
the roadmap disagree, the roadmap is right and this copy is stale. Phases 8, 9
and 10 are in full; then each entry the prompt's parts A, E and F name, in the
order of its inventory table, each printed with `scripts/task.sh <id>`.

## Phase 8 — Watchlist: film and television

**Goal:** Films, shows, seasons and franchises. Needs only Phase 0, so it can be pulled forward. **Milestones:** M23, M24.

Self-contained. Needs only phase 0, so it can be pulled forward any time —
useful as a change of pace between the heavier comics phases. Three levels:
films and shows, seasons beneath shows, franchises above both. **No episode
tracking.**

### ☐ 8.1 Schema and TMDB client · M
`titles`, `seasons`, `franchises`, `franchise_titles`, `title_status`,
`season_status`, `watch_events`, `shelf_titles`, `shelves.kind`. Plus the
`show_progress` and `franchise_progress` views.

Server-side TMDB client, `TMDB_API_KEY` in env, never shipped to the browser.
`/configuration` fetched once and cached for image base URLs. **TMDB
attribution in the footer** — a condition of the free tier.

Two additions from the audit: `franchises.hue` (nullable, else a deterministic
hash to `--t1..t8`) so a franchise keeps one colour across the dashboard,
franchise page and detail; and dropped-show storage — `title_status` accepts
`kind = 'tv'` only with `status = 'dropped'`, and `show_progress.state` becomes
`unknown | to_watch | watching | watched | dropped`, reading `title_status` first
(DIAGRAMS §8b, data model 2.5b). Update `etl/views.sql` in the same PR.

**From the 2026-10-20 intake** (owner: *streaming host, original network or
streaming original, director, studio, length, episodes and seasons, genre,
lead actors, filterable and obvious when browsing*; D-74). These amend
data model §4.2's draft before anything is built (data model 2.20):

- **Networks and studios.** `titles.networks text[]` (TMDB `networks`: the
  original network or streamer, *HBO*, or *Netflix* for a Netflix original)
  and `titles.studios text[]` (`production_companies`), handled like `genres`:
  short vocabularies filtered by containment, with a GIN index.
- **Credits are rows**, as comics' are (data model 2.12). `people(id,
  tmdb_id UNIQUE, name)` and `title_credits(title_id, person_id, role IN
  ('director', 'creator', 'cast'), ordinal)`, cast capped at the top ten
  billed. They replace the draft's `creators` and `cast_top` arrays, so a
  director page (8.10) and a cast filter are joins.
- **Lengths.** `titles.runtime` is a film's length, or a show's typical episode
  (`episode_run_time`, else the last episode's runtime). `seasons.episode_count`
  comes from the same `/tv/{id}` call. A show's season and episode totals are
  `show_progress` columns, never stored (hard rule 2), so the draft's
  `titles.season_count` is dropped.
- **Waiting for a new season.** `titles.tmdb_status` (*Returning Series ·
  Ended · Canceled · In Production*) is a fact from TMDB. `show_progress.state`
  gains `caught_up`: every known season watched, and the show returning.
- **A show's own rating and note.** For a show, `title_status.status` is NULL
  or `dropped`, and the row may carry `rating` and `notes`. For a film, status
  stays required. This replaces *accepts `kind = 'tv'` only with `status =
  'dropped'`*.

**Stop and ask** at plan time for these, as for every column in this task.
DIAGRAMS §8b's watch ERD still draws the arrays and `season_count`, so it is
redrawn in the same PR.

**Check:** test that a `/search/multi` response parses into `titles` rows for
both a film and a show; that `/tv/{id}` populates the full `seasons` array in
one call; and that no code path returns the API key to a client component. A
show with a `dropped` row reports `dropped` even with seasons watched, and a
`watching` `title_status` row for a show is rejected. A `/tv/{id}` fixture
fills `networks`, `studios` and `tmdb_status`, plus `title_credits` rows for
its creator and cast. `show_progress` counts the show's seasons and sums their
episodes. A returning show with every season watched is `caught_up`, and an
ended one is `watched`. A show's `title_status` row with a rating and a NULL
status is accepted.

### ☐ 8.2 Search and add · M
One search box across films and shows. Results show poster, year, and kind so
`Dune` (1984), `Dune` (2021) and `Dune: Prophecy` are distinguishable. Adding a
show creates its season rows from the same response. Status set at the moment of
adding. Already-tracked titles show status and an Open button, not Add.

First run: the empty watchlist is a full-width TMDB search with three example
queries and the TMDB attribution, never a "no items" message. Each show result
has a *Watched through* stepper (*none · S1 · S2 · S3*) so an already-seen show
is added with its seasons marked; loading, rate-limited and error states match
1.3b, except that the error and empty-result states offer **Save to inbox**, not
*Type it instead*: watch has no freeform path (D-28). The note is a 1.4b capture
row of kind Watch carrying the query. Neutral grey genre chips carry a text label.
The error line is a grey `×` (UX floor), as 1.3b built it; the TMDB error frame
in `design/mockups.html` still draws `⚠` and is redrawn with this task (from
TASK-006, 1.3b, PR #75).

A Watch note's **Resolve** already leads to `/watch/add?q=…&note=…` (1.4b).
This screen reads `?q=` as Search's starting text (searched only when
submitted) and `?note=`, and the add resolves that note in its own transaction
(D-64). `inbox` has no title column yet, so linking the note to the `titles`
row needs one (a schema question for this task's plan) (from TASK-009, 1.4b,
PR #80).

**Check:** test that adding a show with 2 seasons creates 1 `titles` row and 2
`seasons` rows from a single TMDB call, and that re-adding updates rather than
duplicating. With TMDB mocked to fail, *Save to inbox* writes one inbox row of
kind Watch whose text is the query, and no `titles` row.

### ☐ 8.3 Lists and season progress · M
To-watch, watching, watched, dropped. Show rows display derived progress from
`show_progress` — "2 of 3 seasons" and the next unwatched season — never a
stored status. Inline status, date, and rating at both title and season level.

Every *watched* mark, of a film or a season, also appends a `watch_events` row:
the log, as `read_events` is for books (product § Watch, *rewatch history*).
Marking something already watched as watched again appends a rewatch whose
`rewatch_of` points at the previous event, and leaves the status row as it is.
8.4's detail sheets show that history (coverage check, 2026-10-08).

**Browsing shows the facts, and filters by them** (2026-10-20 intake). Each
row carries, in grey, its year, its network or studio, and its length: a
film's runtime (*2h 49m*), or a show's seasons and episodes (*3 seasons · 28
episodes*, from `show_progress`). A director or creator name sits on the
second line. Filters: film or TV, genre, network, studio, person (a
director, creator or one of the top-billed cast, through `title_credits`),
and length band (*under 2h · 2–3h · over 3h* for films, *one season · 2–4 ·
5+* for shows). Where to watch joins them with 8.9. A show's rating is set at
show level (8.1), and each season keeps its own.

**Saved views, so a filter becomes a collection you name.** The watch list gets
2.9's saved views, the same component and storage, as a third list beside the
run list and the master list. *Save view* names the current filters: *Disney
Animated* is studio *Walt Disney Animation Studios* and film; *DCOM* is network
*Disney Channel* and film; *Nolan* is person *Christopher Nolan*, director.
Views sit in the toolbar row above the controls, and each can be renamed or
deleted. A view stores its filters, never the titles they match, so a title
added later that matches joins it on its own. The examples are the owner's; any
combination of 8.3's filters can be saved.

**When filters don't get it all** (owner, 2026-10-20). A view also holds titles
you add and remove by hand. Its members are the filter's matches, plus its
**additions**, minus its **removals**, so its contents are always *filter ∪
added − removed*:
- *Add to view…* on any title's row or sheet adds it to a view even if no
  filter would match it. That covers a Pixar short in *Disney Animated*, or a
  film Nolan only produced in *Nolan*.
- *Remove from this view* on a matching row hides it there only.
- A view with no filters is entirely hand-picked: *New view* starts empty and
  takes additions. Unlike a shelf, it has no order of its own and no notes; it
  sorts like the list.
- Rows that are there by hand carry a grey *added* tag. Removed titles are
  listed under a collapsed *Removed · 2*, each with *Put back*.

Storage is a plan-gate question (**stop and ask**), because 2.9's views are
stored URLs and a URL is the wrong place for a list of title ids. Proposed:
`watch_views(id, user_id, name, filters jsonb)` and
`watch_view_titles(view_id, title_id, kind IN ('added', 'removed'))`, both in
the export. Membership is computed in the query, never stored.

**Check:** test that marking every season watched flips the show's derived state
to `watched` with nothing written to `title_status`; that marking one of three
gives `watching` with `next_season = 2`; and that a film with no seasons still
reports correctly from `title_status`. Marking a watched film watched again
appends a second `watch_events` row with `rewatch_of` set to the first and
leaves one `title_status` row. The person filter for a director narrows the
list to titles crediting them as director, and the network filter *HBO* to
titles listing HBO. A show row shows its season and episode totals from
`show_progress`. A view saved as studio + film reopens with both filters set,
survives a reload, and includes a matching film added after it was saved;
deleting the view changes no title. A film added to that view by hand appears
in it with an *added* tag, though no filter matches it. A matching film
removed from the view is absent there, still appears on the unfiltered list,
and *Put back* restores it. A view with no filters shows exactly its
additions.

### ☐ 8.4 Detail sheets — film, show, season · M
`/watch/[id]` and `/watch/[id]/season/[n]` as intercepted routes: a sheet over
the list when arrived at from the list, a full page on direct load or refresh.
Show detail includes the season list with per-season status, and every sheet
shows its rewatch history from 8.3's `watch_events`. design §13; mockups "Show detail — seasons".

**Check:** test that the back button dismisses the sheet and restores list
scroll position; that a direct visit to `/watch/tv-1396` renders the full page;
and that the sheet renders from cached `titles` and `seasons` with no TMDB call.

### ☐ 8.5 Franchises · M
Create, nest one level, and add titles. Films auto-populate from TMDB
`belongs_to_collection` via `/collection/{id}`; **cross-media franchises are
hand-curated**, since TMDB has no TV equivalent and nothing links films to
shows. Franchise page lists members in release or chronological order with
combined progress.

The franchise page puts the order toggle (*Release · Chronological*) above the
tree it reorders; child rows are links (`<a class="row" href="/watch/[id]">`);
a title with a null `chronology_ordinal` shows in an *unplaced in chronology*
group when Chronological is chosen.

**Check:** test that adding a film in a TMDB collection offers to create or join
that franchise; that a hand-made franchise accepts both a film and a show; and
that `franchise_progress` counts a fully-watched show as watched via
`show_progress`.

### ☐ 8.7 Watch dashboard · M
`/watch` becomes a dashboard and the list moves to `/watch/list`. Same five
slots as comics and books. Depends on 8.3.

- **Now** — seasons with `season_status = 'watching'`, with a two-rail telescope:
  the series' seasons, and the series' position in its franchise. Two levels, so
  the component drops a rail and keeps the bracket — the same horizontal 2-rail
  geometry as comics' no-block fallback (2.5, design §5). No episode rail — episodes
  are deliberately not tracked.
- **Up next** — five rows from `show_progress` and unwatched films, with a
  film/TV toggle and genre chips. **No period control**: there is no watch plan
  to put anything into, and that absence is a design decision, not an omission
  (design §11).
- **What's reachable** — seasons ready, shows never started, films waiting,
  franchise in progress, title waiting longest.
- **2026 so far** — films, seasons, series finished, ranked.

**The feel pass** (D-40; STYLE_GUIDE §14.1; Feel Review §5) recasts the slots
as comics' are: Now is the only large thing (`--r-hero`), led by a 16:9 still;
Up next is a shelf of posters; Position is the 2-rail telescope card; **Paused**
(FP-D12) lists shows untouched for more than four weeks as grey rows with no
nudge (*Still here when you want them.*), grey because paused has no colour
meaning. A `caught_up` show (8.1) is never *Paused*, because it has nothing to
watch until 8.9 finds a new season. And **2026 so far** is three this-year counts (films, seasons, shows
finished). **Open, stop and ask before building**, because the drawing
conflicts with rules that stand (*from 6.23:* the mediums review's part B
asks the design tool to resolve all three, and 6.23's decisions rows record
the owner's answers): (1) its Now has a one-cell-per-episode strip,
*S4 E3* and *Mark S4 E3 watched*, but the watchlist tracks seasons and never
episodes (`.claude/rules/schema.md`, this phase's header); (2) its shelf has **Reorder**, but
watch has no stored order (no queue table, and no period control by design);
(3) its Position rails read show → season, where this task's are franchise →
series. Until the owner settles them, build the season-level reading: the
current season as the unit, the verb *Mark S4 watched*, and the rails below.

The telecard stripe is the franchise hue (8.1), the coarse rail is headed
**FRANCHISE · release order**, and the unit badge reads *seasons*. The up-next
button says **Start S1** (or `Start S{next_season}`), not a bare *Watch*; a
film's says **Start**. Like comics' *Start* (1.10, R1-08), both navigate — to the
show's next season or the film's detail — and never write; marking is the thumb
bar's job. A show
in Now and the same show's detail must agree on its state — the mockup's Andor
is mid-show (S1 watched, S2 up next) on both.

1.8d's `SeasonRowsSkeleton` was measured against a fixture of the mockup's markup; re-measure it against the season rows drawn here, within 2px at 360px (from TASK-027).

*From 1.8b (TASK-015, PR #114):* until this task, `/watch`
shows 1.8b's empty-state verbs, *Search · Save to inbox*, in the thumb bar and
the desktop header. Give `ThumbBar` (`src/components/ThumbBar.tsx`) its watch
configuration here: slot 1 *Mark S2 watched* (the season-level verb above),
slot 2 *+ Add*, slot 3 search.

**Check:** test that a show with season 1 watched and season 2 watching appears
once in Now and not in Up next; that a show with every season watched appears in
neither; that the genre filter narrows the queue without changing its order; and
that the franchise rail renders 7 of 14 for a seeded Star Wars franchise.
A show untouched for 29 days renders under *Paused* in grey, and one touched
yesterday does not. The feel-pass screenshots.

### ☐ 8.8 Watch status: In flight · Up next · Done · S
`/watch/status`, the 1.9 component with film and TV rows. Depends on 1.9 and
8.3. *From the second 2026-11-02 intake (D-109):* this task also adds watch's
rows to 5.12's `/progress` (shows and franchises in the middle of and
completed), named at its plan gate.

- **In flight**: shows whose `show_progress.state` is `watching`, with next
  season, and films with `title_status = watching`. Below them, *Waiting for
  a new season*: `caught_up` shows (8.1), grey, each with its last season
  watched (*Severance · S2 watched · returning*). They are in flight but have
  nothing to start.
- **Up next**: `to_watch` films and shows, oldest added first, with the
  dashboard's film/TV toggle and genre chips.
- **Done**: `watched`, with show state derived, most recent first. `dropped`
  collapsed under *Stopped*.

*Stopped* holds `dropped` shows and films as `<details class="stopped">`, each
with a grey `dropped` badge. Each tab's empty slate is drawn, with the design §14 copy and one primary action; the mockup gains watch's three (UX-X07,
see 1.9).

**Parked** (5.15, D-105): a film or show can be parked. It is on none of the
three tabs, never under the dashboard's derived *Paused*, and it comes back in
5.15's review (*Keep parked · To watch · Off the watchlist*). Whether it is a
`title_status` value or a row of its own is a question for 8.1's plan gate.

**Check:** a show with 1 of 3 seasons watched is in In flight only; a show with
all seasons watched is in Done with nothing written to `title_status`; a
dropped film appears only under Stopped; the genre filter narrows Up next
without reordering it. A returning show with every season watched is under
*Waiting for a new season*, not in Done.

### ☐ 8.6 Title shelves · S
`shelves.kind = 'titles'` with `shelf_titles`. Same UI as book shelves.
Distinct from franchises: a franchise is a fact about the work, a shelf is your
opinion.

**Custom shelves** (2026-10-20 intake: *Christopher Nolan, Spielberg, Disney
Animated, DCOM, a loosely connected group of films and shows*). A shelf holds
films and shows together, in your order, with 5.1's description and per-title
note (`shelf_titles.note`). The owner's examples are illustrations; any
grouping can be made in the app, in one of two ways:

- **A shelf** (this task): you choose its members and its order, and it changes
  only when you change it. It suits a loose group (a set of films you think
  belong together) and any list in an order of your own.
- **A saved view** (8.3): a named filter that keeps itself current, for a
  group that is a fact (a director's films, a studio's, a network's), with
  titles added or removed by hand where the filter misses or overreaches.

**From a filter to a shelf.** When a saved view's membership is right but you
want your own order or notes, *Add these to a shelf…* on the filtered list (and
on a person page, once 8.10 lands) adds every shown title to a new or existing title
shelf, in the list's order. It is one write with one undo. After that, the
shelf is yours and doesn't follow the filter.

**Check:** test that a book cannot be added to a title shelf, and vice versa.
A shelf holding a film and a show renders both, in shelf order, each with its
note. *Add these to a shelf…* on a list filtered to three titles adds three
`shelf_titles` rows in list order, Undo removes all three, and a title added
to the catalog afterwards does not join the shelf.

### ☐ 8.9 Refresh shows: new seasons and where to watch · M
Backlog intake, 2026-10-20; D-74. Depends on 8.1 and 8.3. Two TMDB facts change
after a title is added: a returning show gains seasons, and where a title
streams moves. Both refresh only when you ask, because no page render calls
TMDB (ui.md). The pattern is 5.8's *Checked 3 days ago · Check now*.

- **New seasons.** *Check for new seasons*, on the watch dashboard and on a
  show's sheet, re-reads `/tv/{id}` for each show that hasn't ended or been
  cancelled. It adds the new `seasons` rows and updates `tmdb_status`. A new
  season turns a `caught_up` show back to `watching` (derived), and the toast
  names it (*Severance S3 is listed*). Existing season rows and every status
  row stay as they are.
- **Where to watch.** `title_providers(title_id, region, provider, kind IN
  ('flatrate', 'free', 'ads', 'rent', 'buy'), fetched_at)`, from
  `/{movie|tv}/{id}/watch/providers`, region US.
  - It is refreshed per title from its sheet (*Check where to watch*), or in
    bulk from the list (*Refresh where to watch · 40 titles*), within TMDB's
    rate. The table goes in `export-tables.ts` (standing rule 7).
  - It shows as provider names with their date (*Netflix · as of 3 Oct*),
    greyed when older than 30 days. The list's *Where to watch* filter uses the
    latest snapshot.
  - JustWatch's attribution sits beside TMDB's in the footer: the data comes
    from JustWatch, and attribution is its condition.
- A daily cron for either refresh is a later option, with 7.6.

**Check:** with recorded fixtures:
- a show TMDB now lists with 3 seasons, where 2 were stored, gains one
  `seasons` row, keeps its season statuses, and goes from `caught_up` to
  `watching`;
- a provider refresh replaces that title's rows and stamps `fetched_at`;
- the *Netflix* filter shows only titles whose latest snapshot lists Netflix;
- no page render calls TMDB, and the JustWatch attribution renders.

### ☐ 8.10 People: director and cast pages · S
Backlog intake, 2026-10-20 (the owner's shelf ideas *Christopher Nolan* and
*Spielberg*). Depends on 8.1 and 8.3. A director's films are a fact about the
work, so they get a page that keeps itself up to date, not a shelf you
maintain by hand (data model 2.5d).

- `/watch/person/[id]` lists the titles in your watchlist that credit the
  person, grouped by role, in release order, each with its status, and
  `watched / listed` in mono.
- Every director, creator and cast name on a row or a sheet links here.
- *Their other work* is a TMDB search you start
  (`/person/{id}/combined_credits`), each result with *Add*. Opening the page
  never calls TMDB.
- Nothing creates a person page: every credited person has one. To keep a
  person on hand, save 8.3's person filter as a view (*Nolan*), or copy the
  page into a shelf (8.6).
- Studios and networks get 8.3's filters and saved views, not pages.

**Check:** a person credited as director on two listed films and as cast on
one show renders three rows under two roles. A name on a film's sheet links to
the page. Opening the page makes no TMDB call, and *Their other work* makes
one.

---

## Phase 9 — Music

**Goal:** A fourth medium, last (D-75). **Milestones:** M25.

Backlog intake, 2026-10-20; D-75. **After Phase 8, last.** A fourth medium,
shaped like the watchlist: **artist → album → track**, as franchise → title →
season. The catalog comes from MusicBrainz (free, CC0 core data, one request a
second, a real User-Agent): its release groups are albums and its recordings
are songs. Covers come from the Cover Art Archive. It starts empty, like
watch. No playback or scrobbling. The one streaming-service sync is 9.7's:
Spotify says which artists you follow (D-103, amending D-75).

The owner asked for three things: artists to listen to, those artists' albums
to listen to, and a ranking of each song for some artists, with which albums
are the favourites read off the ranking.

### ☐ 9.0 Music in the shell, designed · M
The feel pass and the mockups draw no music, and a fourth medium changes rules
that every dashboard shares, so the design comes first (standing rule 6). The
phone media bar is `Comics · Books · Watch` (a UX-floor rule). Settle with the
owner how four fit at 360px, as four tabs or with Music under *More*, along
with the tablet rail, the sidebar and `/`'s redirect.

The screens, phone, tablet and desktop, in the mockup:
- the `/music` dashboard in the five slots: Now (the album you are on), Up
  next (albums from artists you follow), position (the album in its artist's
  discography), situation (artists you want to listen to), and this year;
- `/music/artist/[id]`, the album sheet, and the song ranker (9.4);
- the empty first screen, a search, as watch's is.

*From 6.23 (2026-11-18):* the mediums review's parts A and C draw these in the
design tool first. This entry then draws the mockup's frames from that review,
and the media-bar decision is 6.23's decisions row.

**Check:** the mockup gains each screen at phone, tablet and desktop widths,
`design/mockups-index.md` lists them, and the media-bar decision is in the
decisions log.

### ☐ 9.1 Schema and MusicBrainz client · M
Depends on 9.0. **Stop and ask at plan time** (new tables).
- **Catalog:** `artists(id, mbid UNIQUE, name, sort_name, disambiguation)`,
  `albums(id, mbid UNIQUE, artist_id, title, primary_type, secondary_types
  text[], first_release_year, cover_url)` and `tracks(id, recording_mbid,
  album_id, position, title, length_ms)`. An album's tracks come from one
  canonical release of its release group, the earliest official one, chosen
  at add. So a song is a recording, and a recording on several albums is
  still one song for ranking (9.4).
- **Per user:** `artist_follows(user_id, artist_id, state IN ('want',
  'listening'))` (D-43's pattern); `album_status(user_id, album_id, status IN
  ('to_listen', 'listened', 'skipped'), rating, notes)`; and `listen_events`,
  the log, as `read_events` is.
- **Views:** `artist_progress` and `album_progress` (`etl/views.sql`).
- **Client:** server-side, paced at one request a second, with a real
  User-Agent and a cache table like `metron_cache` (D-53).
- Every table goes in `src/db/export-tables.ts`.

**Check:** a recorded release-group fixture parses into albums with their
types, and a release fixture into tracks in position order. The client never
sends two requests within a second, and the export test passes with the new
tables.

### ☐ 9.2 Search and add an artist, with the discography · M
Depends on 9.1.
- Search MusicBrainz artists, with the disambiguation shown (*Genesis (UK rock
  band)*).
- Adding an artist follows them at `want` and adds their release groups.
  Studio albums are on by default; *EPs · Singles · Live · Compilations* are
  toggles. The albums become a to-listen list you can trim, where *Not for me*
  hides one.
- Tracks load when an album is first opened or ranked, never for the whole
  discography at once, to stay inside the request budget.
- Loading, rate-limited and error states are 1.3b's. There is no freeform
  path, as with watch (D-28): when MusicBrainz fails or finds nothing, the
  screen offers *Save to inbox*. The inbox has no Music kind yet: that is a
  schema question for this task's plan.

**Check:** adding an artist with 12 release groups creates 12 albums and makes
no recording requests; adding them again updates without duplicating; a
mocked failure offers *Save to inbox*.

### ☐ 9.3 Albums: listened, rated, logged · S
Depends on 9.2. Each album is to listen, listened or skipped, with a date and
a rating. Every listen appends a `listen_events` row, and a relisten links to
the previous one, as 8.3's rewatch does. The artist page lists the
discography by year with each album's status, and `listened / listed` derived.
An album can be parked (5.15, D-105): off To listen until 5.15's review; its
value is asked with `album_status` at 9.1's plan gate.

**Check:** marking an album listened twice appends two events and leaves one
status row, and `artist_progress` counts the album once.

### ☐ 9.4 Rank an artist's songs · M
Depends on 9.2 (owner: *for specific artists, rank each song*).
- **A ranking is authored, so it is stored:** `song_rankings(user_id,
  artist_id, track_id, ordinal)`, contiguous from 1, like 1.10's queue. It goes
  in the export. Songs can stay unranked.
- **Two ways to build it.**
  - A pairwise *This or that* sorter: pick one of two songs. Binary insertion
    places each new song in about log₂ n picks, so 150 songs is roughly 1,100
    picks over many sittings. Each placed song is written at once, so
    stopping loses only the song in progress.
  - Direct reorder: drag by a handle with a fine pointer, or *Move to…* on
    touch and keyboard.
- A recording on several albums is one song, ranked once (dedupe by recording
  MBID).

**Check:** ranking five songs through the sorter, with scripted answers, gives
the expected order in at most 8 picks. Stopping and reopening resumes with the
placed songs kept. Ordinals stay contiguous after a song is unranked.

### ☐ 9.5 Which albums you favour · S
Depends on 9.4. Derived from the ranking in an `album_rank` view, never
stored. Per album: its ranked songs' median rank, how many of them are in your
top 10 and top 25, and how many of its songs are ranked. The artist page can
sort its albums by it.

**Check:** a fixture ranking in which album A holds ranks 1–3 and album B
ranks 4–8 orders A first. An album with unranked songs counts only its ranked
ones, and says *4 of 11 ranked*.

### ☐ 9.6 Music dashboard and status · M
Depends on 9.0, 9.3 and 1.9. `/music`, in 9.0's design, and `/music/status`
with *In flight · Up next · Done* (ui.md's rule for every medium).
*From the second 2026-11-02 intake (D-109):* it also adds music's rows to
5.12's `/progress` (followed artists in the middle of and completed), named at
its plan gate.
- **In flight:** albums you have started, and artists followed as
  `listening`.
- **Up next:** to-listen albums from followed artists, oldest added first.
- **Done:** listened albums, by year.

Nothing is stored beyond what 9.1 defines.

**Check:** an album with one listen is in Done, not Up next; an artist
followed as `listening` with two albums to listen shows in In flight and both
albums in Up next; tab counts equal row counts; the feel-pass screenshots.

### ☐ 9.7 Follow from Spotify: new albums into To listen · M
Owner intake, 2026-11-01 (owner: *followed artists have upcoming albums
automatically added to my "To listen" list; integrate with Spotify*). D-103,
amending D-75's *no streaming-service sync*. Depends on 9.2 and 9.3.

**Spotify says who you follow; MusicBrainz says what is coming.** Spotify's
API lists an album only from its release day, and its February 2026 changes
took `browse/new-releases` away from Development Mode apps. The artists you
follow (`GET /me/following?type=artist`) and an artist's albums
(`GET /artists/{id}/albums`) were not on the removed list. **Read Spotify's
current endpoint list and terms at plan time**: they changed twice in 2026.

- **Follows.** Each artist you follow on Spotify is matched to MusicBrainz
  by the artist's Spotify link in MusicBrainz's URL relations, and followed
  at `want` (9.1). An artist with no such link goes to a review list and is
  never guessed. Unfollowing on Spotify is reported, never applied: a follow
  in the Ledger is yours.
- **What's coming.** For each followed artist, a new release group of the
  types 9.2 keeps (studio albums by default) is added to To listen. One dated
  after today shows *Coming Mar 14* and turns into a plain to-listen album on
  the day. The Spotify album list adds the Spotify link to an album, and it
  adds any album MusicBrainz doesn't have yet, matched on title and date
  first.
- **Automatic means a schedule, and a schedule can't type the passcode.**
  Proposed: a nightly GitHub Actions job, the backup job's pattern, that runs
  the sync script against the database directly, so no new route joins
  `/api/health` outside the gate. It writes production, so **stop and ask at
  plan time**. Not chosen: a Vercel cron route (a second route outside the
  passcode gate); syncing when `/music` opens (no page render calls an API,
  product § Constraints).
- **What the sync added says so:** *Added from your Spotify follows*, with
  9.2's *Not for me*. A hidden album is never re-added.
- **Keys.** One Spotify app with a refresh token from a single sign-in, kept
  as secrets (`SPOTIFY_CLIENT_ID`, `SPOTIFY_CLIENT_SECRET`,
  `SPOTIFY_REFRESH_TOKEN`), never sent to the browser, and listed in
  `docs/SERVICES.md` in the same PR. Since February 2026, a Development Mode
  app works only while its owner has Spotify Premium: confirm that before
  the plan.

**Check (proposed):** against recorded fixtures: a followed Spotify artist
whose MusicBrainz record links to it becomes one `want` follow, and one with
no link lands in the review list with no follow. A release group dated after
today is added once as to-listen with its date, and a second run adds
nothing. An album hidden with *Not for me* is not re-added. The job exits
non-zero, writing nothing, when a secret is missing, and no Spotify token
reaches a client component.

---

## Phase 10 — Games

**Goal:** A fifth medium, a planning tool for what to play: search, a queue by
the platform you'll play on, and the games you're waiting for (D-102).
**Milestones:** M26.

Owner intake, 2026-11-01 (owner: *a video games category: search and add to
my queue, metadata by the system I own or will own the game on; categories by
genre (Action, RPG, Survival) but also playing it all the way through versus
playing sporadically, like The Last of Us vs Civilization or Slay the Spire;
mainly a planning tool; and tag games coming out that I'm excited for and see
those release dates*). It needs only Phase 0 and the shell, so like Phase 8 it
can be pulled forward; by default it follows Music. It starts empty, like
watch. Ranking games is *Later* § L-7.

The catalog comes from IGDB (Twitch's games database): free, with a Twitch
developer app's client-credentials token. It has genres, platforms, a release
date per platform and region, and time-to-beat estimates. **Read IGDB's
current terms, attribution rule and rate limit at plan time** (community
reports say four requests a second).

**Two kinds of game, and they end differently.** A game you play *through*
(The Last of Us) is wanted, then playing, then finished or dropped, like a
book. A game you play *in rotation* (Civilization, Slay the Spire) has no
end: it's in rotation or set aside, and it never reaches Done. This is the
owner's own category, separate from IGDB's genres, and it decides which
statuses a game can take.

### ☐ 10.0 Games in the shell, designed · M
Depends on 9.0. A fifth medium changes the phone media bar again (9.0 decides
four). Settle with the owner where Games goes at 360px, on the tablet rail
and in the sidebar, and draw at phone, tablet and desktop:
- the `/games` dashboard in the five slots: Now (what you're playing, and
  what's in rotation), Up next (the queue), position (hours left in the
  game you're on, from its time to beat), situation (coming out), and this
  year;
- `/games/status`, the game sheet, the coming-out list (10.4), *Your
  platforms* in Settings, and the empty first screen, a search, as watch's
  is.

*From 6.23 (2026-11-18):* the mediums review's parts A and D draw these in the
design tool first, and this entry draws the mockup's frames from that review.

**Check:** the mockup gains each screen at phone, tablet and desktop widths,
`design/mockups-index.md` lists them, and where Games sits in the navigation
is in the decisions log.

### ☐ 10.1 Schema and IGDB client · M
Depends on 10.0. **Stop and ask at plan time** (new tables); the plan writes
data model 2.22 for the games shape. Proposed:
- **Catalog:** `games(id, igdb_id UNIQUE, name, summary, cover_url,
  first_release_date, date_precision)`, `game_genres(game_id, genre)` (IGDB's
  genres, as 1.18c keeps a book's), `platforms(id, igdb_id UNIQUE, name)` and
  `game_releases(game_id, platform_id, release_date, date_precision, region)`.
  Time to beat, IGDB's *main*, *main + extras* and *completionist*, is a fact
  about the game, so it is columns on `games`.
- **Yours:** `owned_platforms(platform_id PRIMARY KEY, state IN ('own',
  'will_own'))`, set on *Your platforms*: what you own is your state, not a
  fact about the platform (hard rule 3). `game_status(game_id PRIMARY KEY,
  play_style IN ('through', 'rotation'), platform_id, status, rating,
  notes)`, where `through` takes
  `want · playing · finished · dropped` and `rotation` takes `want ·
  in_rotation · set_aside`, a CHECK for each. `play_events`, the log, as
  `read_events` is. No `user_id` (D-91).
- **Parked** (5.15, D-105): either play style can be parked, out of the
  queue and the dashboard until 5.15's review (*Keep parked · Up next ·
  Someday*). Rotation's `set_aside` is close to it; whether the two are one
  value is the owner's call at this plan gate.
- **Client:** server-side, paced to IGDB's limit, a cache table like
  `hardcover_cache`, rebuildable and not exported. Keys `IGDB_CLIENT_ID` and
  `IGDB_CLIENT_SECRET`, never sent to the browser, in `docs/SERVICES.md` in
  the same PR. Every new table except the cache goes in
  `src/db/export-tables.ts`.

**Check (proposed):** a recorded IGDB fixture parses into a `games` row with
its genres, its time to beat, and a `game_releases` row per platform with its
date precision. A `rotation` game set to `finished` is refused, and a
`through` game set to `in_rotation` is refused. The client never exceeds the
rate limit, no code path returns the token to a client component, and the
export test passes with the new tables.

### ☐ 10.2 Search and add, to the queue · M
Depends on 10.1. Search IGDB as 1.22 searches: after 3 characters and a 500 ms
pause, cached. Each result shows its year, its genres and its platforms, yours
first and marked.
- **The platform you'll play on.** Adding a game asks which of your platforms
  you'll play it on, offering those it's out (or coming) on that you own or
  will own. A game on none of yours says so, and can still be added with no
  platform.
- **How you play it.** *Play through* or *In rotation*, asked at add. A
  suggestion is fine (IGDB's 4X, card and roguelike genres lean towards
  rotation), but it is never decided without you.
- **Where it goes:** *Up next* (the queue, below) or *Someday*. An
  unreleased game goes to *Coming out* (10.4).
- **The queue is an order, so it is stored:** `game_queue(game_id PRIMARY KEY,
  position)`, contiguous from 1, like 1.10's (data model 2.16), in the
  export. **Stop and ask at plan time.**
- No freeform path, as with watch (D-28): when IGDB fails or finds nothing,
  *Save to inbox*. The inbox has no Games kind yet: a schema question for the
  plan, as in 9.2.

**Check (proposed):** adding a game with releases on three platforms, one of
them owned, offers only that one and writes one `games` row, one
`game_status` row with the platform and play style, and a queue position at
the end. Adding it again updates without duplicating. A mocked failure offers
*Save to inbox*.

### ☐ 10.3 Playing, the queue, and played · M
Depends on 10.2 and 1.9. `/games/status`, with *In flight · Up next · Done*
(ui.md's rule for every medium). *From the second 2026-11-02 intake (D-109):*
it also adds games' rows to 5.12's `/progress` (games played through, in the
middle of and completed), named at its plan gate:
- **In flight:** *Playing*, then *In rotation*, as their own groups.
- **Up next:** the queue in your order, with *Move to…*; starting a queued
  game takes it off the queue and closes the gap, and Undo puts it back.
- **Done:** finished games, by year. A rotation game is never here.
- **Planning, derived:** the queue's total time to beat, through games only,
  as text (*9 games · about 140 h*); a rotation game adds nothing, because it
  has no end. A game with no IGDB estimate says *no estimate* and is left out
  of the sum, never counted as zero.

**Check (proposed):** finishing a through game appends one `play_events` row
and moves it to Done; a rotation game set aside stays out of Done; starting
queued #2 of 3 leaves positions 1–2, and its undo restores the order; the
queue's hours equal the sum of its through games' estimates and skip one
with none; each tab's count equals its rows.

### ☐ 10.4 Coming out: games you're waiting for · M
Depends on 10.2. Owner: *tag games as coming out that I'm excited for and see
those release dates*.
- **Adding it is the tag.** A wanted game whose release on your platform is
  after today is *coming out*. That is derived from the date in a view,
  never stored as a flag (hard rule 2).
- **The list,** 5.7's pattern: *Out now* (released in the last 30 days), then
  by month, at the precision IGDB gives (*Mar 14 2027*, *Q2 2027*, *2027*,
  *TBA*), with the platform it's out on.
- **Dates move, so the refresh says so.** *Refresh dates* asks IGDB for every
  coming game, at most once a day, and a date that moved says *was Feb
  2027*. On release day the game leaves *Coming out* for Someday, or for the
  end of the queue if you said so when you added it.
- The dashboard's situation slot (10.0) shows the next three to come out.

**Check (proposed):** a game dated next month on your platform is listed
under its month, and the same game dated last week is under *Out now*. A
refresh that moves its date from February to May lists it under May with
*was Feb 2027*. A game coming only on a platform you don't own says so. No
page render calls IGDB.

### ☐ 10.5 Games dashboard · M
Depends on 10.0, 10.3 and 10.4. `/games` in 10.0's design, from the views
10.1–10.4 define; nothing new is stored. The UX floor and the feel pass's
rules apply as for every dashboard: no red, every meter fills with
`--ready`.

**Check (proposed):** with a fixture of one game playing, two in rotation,
four queued and two coming out, each slot shows them as 10.0 draws; an empty
ledger shows the search; the feel-pass screenshots at each width.

### ☐ 10.6 Game shelves: by platform, by genre, and your own · S
Owner intake, 2026-11-02 (owner: *tracks like shelves: could be based on
system type, genre type, custom, etc.*). D-106. Depends on 10.3 and 5.1. They
are called shelves, not tracks, because *track* is already the comics
grouping (`tracks`). The queue the owner asked for in the same intake is
10.2's `game_queue`.

- **By platform and by genre are views, not shelves** (hard rule 2).
  `/games/status` groups or filters by the platform you'll play on
  (`game_status.platform_id`), by IGDB genre (`game_genres`) and by play
  style, each group with its count. They keep themselves current and store
  nothing.
- **Your own shelves are 5.1's.** `shelves.kind` gains `games`, with
  `shelf_games(shelf_id, game_id, ordinal, note)` carrying a real foreign key
  (data model 2.5e: typed, never polymorphic), in `src/db/export-tables.ts`.
  **Stop and ask at plan time** (a new table and a widened CHECK). The same
  UI as book shelves: create, add from a game's sheet or the add sheet (*New
  shelf…*, B19), reorder, a description and a per-game note.
- **From a view to a shelf.** *Add these to a shelf…* on a filtered list, as
  8.6 does it, adds every shown game in the list's order, one write with one
  Undo. After that the shelf is yours and doesn't follow the filter.
- The mockup gains the games shelves and the grouped status list beside
  10.0's screens, at phone, tablet and desktop widths.

**Check (proposed):** a game cannot be added to a books or titles shelf, nor
a book to a games shelf. Grouping three games on two platforms renders two
groups counting 2 and 1 and writes nothing. *Add these to a shelf…* on a list
filtered to two games adds two `shelf_games` rows in list order, and Undo
removes both. The export test passes with `shelf_games`.

---


## Entries parts A, E and F name

### ☑ 1.4f Add books searches Hardcover · M
Owner, 2026-10-28; D-94. **After 1.4e, before 1.22.** 1.4c's *Search* lists
Open Library's top ten works as they come, edition labels, series suffixes
and omnibuses with them.

- **`src/lib/hardcover.ts`** replaces `src/lib/openlibrary.ts` in
  `POST /api/books/search`: Hardcover's `search` for books, ten results, one
  request a search, sent on submit (or as 1.22 has it), server-side with
  `HARDCOVER_API_TOKEN`, never in a response or a `NEXT_PUBLIC_` variable.
  Without the token, Search answers from your library only and says
  *Hardcover isn't set up here*, as Add issues does for Metron.
- **Cached** in a new `hardcover_cache` table (approved by the owner
  2026-10-28, D-94): `key`, `body`, `fetched_at`, as `open_library_cache`
  is, fresh for 7 days (D-62), a 429's `Retry-After` kept as its `hold` row.
  Rebuildable, so not in `src/db/export-tables.ts`. The migration only adds.
- **What lists.** A `compilation` is not listed. A result shows its title,
  with Hardcover's `subtitle` kept apart (the plan proposes how it reads), its
  author, its series and position, its year, and *est N words* from its pages
  as now. A query that is an ISBN (10 or 13 digits, hyphens allowed) lists
  that edition's book alone.
- **Adding a result** writes `hardcover_id`, `cover_url`, `page_count` and
  `published_year`. A result your library already holds (by `hardcover_id`,
  or by title and author, D-61) lists as your book, not a second copy.
- **The copy follows the source** (D-94): *From Hardcover*, *Hardcover · est
  174k words*, *Matched against your library first, then Hardcover*.
- **The docs it changes:** `.claude/rules/ui.md` (*Hardcover is
  backfill-only* goes), data model 2.15's add flows, architecture § Metadata
  sources. Open Library's code stays until 6.19.

**Check:** in the browser (0.11), with recorded Hardcover answers: searching
`piranesi` lists Hardcover's results under *From Hardcover*, and a compilation
in the recorded answer is not listed; adding one creates one `books` row with
`hardcover_id` and its cover, and adding it again reuses it and says so; the
same search again makes no request; a recorded 429 shows the rate-limited
state while your library's results still list; an ISBN-13 lists one result.
A vitest shows that with no token the route answers from the library with no
request, and that no response carries the token.

### ☑ 1.9 Status screens: In flight · Up next · Done · M
Requirement change, Sept 2026. design §11. `/comics/status` and
`/books/status`, a single component with three tabs in this order and with these
names. The tab is in the URL (`?tab=inflight|next|done`). Film and TV follow in
8.8. Mockup: `design/mockups.html` → "Status — in flight, up next, done".
Depends on 0.8a, 1.8 and 1.10 — build the queue first.

| Tab | Comics | Books |
|---|---|---|
| In flight | Runs partly read, most recently touched first, each with its resume pointer (1.6) and a one-tap *Read #N* | `book_status = reading`, with words left |
| Up next | The queue (1.10) in your order, unstarted runs only, draggable. Then *Ready, not queued*: `ready_all` then `ready_hard` runs in track → block order, each with **+ Up next**, cost and leverage once 2.6 lands | The plan by level (D-37): each quarter in date order, its rows in `ordinal` order and reorderable with 1.10's queue row — the named `button.drag` handle and the `⋯` menu (*Move to top · Move up · Move down*) — within that quarter only (moving elsewhere is 2.3's sheet); after a year's quarters, its bare-year lane (unordered, by title; grey until 2.8); then **On deck** (unordered, by title). Someday is not listed: a closing row, *Someday · N books*, opens the master list's *To read* filter at that level |
| Done | Finished runs, latest `run_state.finished_at` first, **undated last** (`NULLS LAST` — every pre-cutover read is precision `none`, S-14) | `read`, grouped by year finished, *No year* last; DNF collapsed under *Stopped* |

Every progress meter fills with `--ready` (D-26), on this screen and every other;
there is one `.meter` style.

**The master list learns the levels.** For the *Someday* row to land somewhere,
this task gives `/books/list`'s *To read* filter a level control — *All ·
Quarter · Year · On deck · Someday* — read from 1.7's `to_read_level`, with
`?level=` in the URL.

Each tab label carries its count. Apart from the queue's order and each
quarter's order, nothing is stored; every row comes from `run_queue_state`,
`run_progress`, `run_readiness`, `plan_period`, `to_read_level` and
`book_status`. The dashboard's *Also reading* row (in the hero, D-40), the
*Up next* shelf's head and *Ready when you are → All N* link to the matching
tab, N computed.

*From TASK-017 (1.9, PR #117):* `book_status` holds no reading
position, so *with words left* has nothing to subtract from: until one is
stored, books In flight shows the book's word count. Where a position would
live is an open question in the Owner checklist (Decisions waiting on you).
The *Also reading* row is 2.4's; until then 1.9 links the dashboard's
*Mid-run* head to `?tab=inflight`.

**The bare-year lane is neutral until 2.8** (R1-10). Amber means a decision you
have not made, and it must clear when you make one — but nothing in Phase 1 can
give a plan row a quarter (2.3 is the picker, 2.8 is the bulk flow). So in this
task the lane renders grey with its count and no button. It turns amber and
gains *Place them* when 2.8 lands; put the flip in 2.8's check.

Tabs are `role="tablist"` links (`<a role="tab" href="?tab=next"
aria-selected>`) with arrow-key navigation. The resume button is labelled with
its target (*Read New Mutants (2019) #9*), truncated with a `title`. DNF and
dropped items sit in a collapsed `<details class="stopped"><summary>Stopped ·
3</summary>` at the foot of Done. Every tab has an empty state with exactly one
primary action (design §14). Books *Up next* is empty until a book is put
On deck (1.7) or planned (2.3): the plan starts empty (D-13), and 1.4c alone adds
only to Someday. So its action in this task is **Add a book** (the 1.4c sheet),
never a link to a picker that does not exist yet; 2.3 changes it to *Plan a
book* (S-L5).

**The tab strip** (STYLE_GUIDE §9, UX-N22): 44px tabs, counts in mono 11, the
selected tab `--ink` 600 with a 2px `--m-*` underline, the rest `--muted` 500.
The underline is one element per tablist that slides between tabs (`--dur-2`);
under reduced motion it moves without easing. **Every tab's empty slate is
drawn** (UX-X07): nine in all, three per medium, each with the design §14
copy and one primary action. The mockup has comics' three; this task adds
books' three and 8.8 adds watch's, closing *Not shown* #6.

**Check:** seeded test: a run with 3 of 10 placements read is in In flight and
not in Up next, even if it is queued; queued unstarted runs appear first, in
queue order; a ready run that isn't queued appears under *Ready, not queued*
and not above it; a queued blocked run appears in the queue with its amber
badge; an unqueued blocked run appears in neither section; a run with all placements read
is in Done; a run whose issues are all read *in other runs* is not in Done
(0.8); a run finished with undated reads sorts below one finished last week. A book planned `2027` appears after 2027's quarters and before
On deck, with no drag handle. Three books planned `2027-Q1` render in ordinal
order, and the keyboard sequence (Space, Down, Space) on the first leaves that
quarter at a contiguous 1–3 with it second; a lift never carries a row into
another quarter. A `to_read` book with no plan row is not on the tab, is counted
in *Someday · N books*, and appears when that row opens the master list at
`?status=to_read&level=someday`.
A DNF book appears only under Stopped. Tab counts equal row counts.
Each tablist contains exactly one underline element. Screenshot at 360px,
including every empty tab.

### ☑ 1.17 Started and finished: a start date for books, a derived span for runs · M
Backlog intake, 2026-10-20 (owner: *books: date started and ended; comics: a
run's date started and ended*). **Before cutover, in sitting 9**, for 1.5's
reason: a start date that isn't captured from the first day can't be
recovered later. Finish dates exist already (1.5). What's missing is when a
read began.

- **Books: a stored start, with its precision.** Proposed:
  `book_status.started_on` with `started_on_precision`, and the same pair on
  `read_events`, under data model 2.17's rule (NULL exactly when `none`).
  The start of a read in progress lives on `book_status`. Finishing copies it
  onto the new `read_events` row, so a reread keeps its own start (data model 2.18). **Stop and ask at plan time** (new columns, CLAUDE.md). No column is
  dropped or retyped, so there is no down file.
- **Writes go through `saveBookStatus`.** Entering *Reading* stamps today's
  Eastern day (1.16) as `exact`, unless a start already exists. The status
  control's date line gains *Started …* beside *Finished …*, both editable with
  1.5's picker (*Today · Pick a day · Year only · No date*). A start after the
  finish is refused, with the reason under the control.
- **Runs: derived, never stored.** `run_state` gains `started_at`, beside
  `finished_at`: the earliest dated read of the run's own placements. Undated
  reads (`none`) don't count, so a run with only undated reads has no start.
- **Where it shows:** the book row's meta, the run hero's span line (*Started
  Mar 2026*, or *Mar–Sep 2026* once finished) and 1.9's Done rows. Days taken
  (*16 days*) is computed in the query, never stored. 3.5's book sheet shows
  both dates (noted there).
- Extract loads no start dates (D-41). Calibre's come only through 1.18
  (which loads Calibre's reads as Calibre has them, D-87).

**Check:**
- Setting a book to Reading writes `started_on` as today in Eastern, `exact`.
- Finishing it appends a `read_events` row carrying the same start.
- Rereading it sets a fresh `started_on` and leaves the first read's row as it
  was.
- A start after the finish is refused and writes nothing; a `none` start has a
  NULL date.
- `etl/test_views.sql`: `run_state.started_at` is the earliest dated read of the
  run's own placements, ignores a read of the same issue in another run and a
  `none` read, and is NULL for a run with no dated read.
- `npm run test:db:reset` migrates from zero.

### ☑ 1.17b Dates when you start and finish, and on every read · M
Owner, 2026-11-08 (D-131; extends 1.17). **Before 1.26.** 1.17 stamps a start
silently when a book enters *Reading*, and its date line edits only the latest
read. The owner wants to be asked at the moment, and to fix any read later.

- **Reading asks the start.** Setting *Reading* or *Listening* writes the
  status and today's Eastern start at once, as now, and opens the *Started*
  picker on *Today*: *Today* or Esc keeps it, another day re-dates it. One
  Undo restores what was there before.
- **Read asks both.** Setting *Read* opens *Started* (the stored start, else
  *No date*) and *Finished* (*Today*) together; confirming writes both, and a
  start after the finish is refused with 1.17's reason.
- **Every read.** The date line gains *All reads (n)* when a book has more than
  one read: each read with its format glyph (1.23), its *Started* and
  *Finished*, each editable with 1.5's picker. Re-dating an earlier read
  changes its `read_events` row only; re-dating the latest keeps `book_status`
  in step, through `saveBookStatus` or a sibling helper in `src/db/writes.ts`
  (the plan's). 4.4 sends the latest finish to Calibre.
- **Where.** The Library row (as now), the books dashboard's *Now* and the
  status screens (In flight, Up next, Done). Not search results.
- **Stop and ask at plan time** if the plan changes how a stored date is
  written or interpreted (CLAUDE.md). No new column is proposed.
- **Not drawn yet.** The status control's frames in `design/mockups.html` gain
  the two pickers and the read list before they are built.

**Check:** (proposed; the owner agrees it by merging or edits it first) in the
browser (0.11): setting a book to *Reading* opens *Started* on *Today*; picking
an earlier day writes that `started_on`, `exact`, and Undo restores the status
and start before. Setting it to *Read* opens both; confirming writes one
`read_events` row carrying both dates; a start after the finish is refused and
writes nothing. A book with two reads lists both under *All reads (2)*;
re-dating the first changes only its `read_events` row, and re-dating the
second changes it and `book_status`. The same control works from *Now* on
`/books` and from `/books/status`; a search result has none. axe passes at
every width.

### ☑ 1.21 Unlisted: the books you have but haven't put on your list · S
Backlog intake, 2026-10-26 (owner: *give all [Calibre] books a default status
below Someday … available during search, but not in my face on any list*).
D-83; named *Unlisted*, stored `unlisted`, by D-86 (it was *Owned*). **Built
in sitting 8, before 1.18**, which creates Calibre's other books at this
level. The ladder becomes Quarter · Year · On deck · Someday · **Unlisted**.
Someday keeps its line, *on your to-read list, not planned*. Unlisted is *in
your library, not on your list*.

- A fifth `book_status.status` value, `unlisted`, beside `to_read`,
  `reading`, `read` and `dnf`, with no CHECK on the column (owner, at
  TASK-029's plan gate: no migration). No column is added, dropped or retyped.
- **Out of the way.** `to_read_level` reads only `to_read`, so an Unlisted book
  has no level and is on no plan rail, capacity sum, dashboard slot or status
  screen, and in no year total. The master list's *Everything* leaves it out,
  and a fifth chip, *Unlisted · N*, shows only them. The progress views
  (`series_progress`, `author_progress`, 5.12's) count it as unread, as they
  count a book with no status today.
- **Found by search.** The master list's search, the add sheets' library
  search and 6.1 find it, tagged *Unlisted* (1.22).
- **One verb to promote it.** An Unlisted row and its sheet offer *Add to
  Someday* (writes `to_read`, with Undo) beside 1.4c's other destinations.
  Adding an Unlisted book through 1.4c to Someday or On deck moves it there
  instead of reporting it as already there; a shelf leaves it Unlisted.

**Check:** with a fixture of one `unlisted`, one `to_read` and one `read` book,
*Everything* lists two and the *Unlisted* chip lists one with the count 1; a
master-list search for the Unlisted book's title finds it; `to_read_level`, the
status screens and the plan rail never return it; *Add to Someday* writes one
`to_read` row and Undo puts back `unlisted`; a series holding one read and one
Unlisted book reads `1 / 2`.

### ☑ 1.22 Search as you type, and where each result comes from · M
Backlog intake, 2026-10-26 (owner: *search on finish typing, not just Enter …
any time there is a search (add books, filtering, etc), after a few characters
and a delay in typing … make it clear in search results where the result came
from (Open Library or Calibre/my list)*). D-84. Depends on 1.21 for the
*Unlisted* tag.

- **When it searches.** Every search box in the app (today the master list,
  Add books and Add issues) searches once the text is at least 3 characters
  and typing has paused for 500 ms. Enter still searches at once. A newer
  query aborts the older one's request, and a late answer to an old query is
  dropped. Under 3 characters, the results clear instead of searching.
- **The external APIs.** This amends `.claude/rules/ui.md`'s *searched when the
  user submits a search in Add* to *when the user submits or pauses typing*
  (D-84); this task edits the rule. Answers stay cached (D-53, D-62), so
  retyping a query asks no API, and the rate-limited states of 1.3b and 1.4c
  are unchanged. Add issues is the expensive case, because one search is up
  to ten Metron calls (D-60). The plan proposes whether its Metron half waits
  until the label parses as complete (`thor 337-340`, not `thor 33`), and the
  PR says which.
- **The master list** searches by replacing `?q=` without a history entry per
  keystroke, so one Back leaves the list rather than taking letters off.
- The hint *Searches when you press Enter* becomes *Searches as you type*.
- **Where each result comes from.** Every result row carries a source tag,
  in text and not colour alone: a library book shows where it sits (*Someday*,
  *On deck*, *Q1 2027*, *Reading*, *Read*, *Unlisted*), an Open Library result
  *Open Library*, a Metron result *Metron*. The group heads *In your library*
  and *From Open Library* stay. A *Calibre* tag on a book that is also on your
  list needs the Ledger to remember which books Calibre matched (for example
  `books.calibre_id`), a new column: **stop and ask** at plan time. Until then
  a Calibre-only book shows as *Unlisted*.
  *Amended 2026-10-27 (D-90):* 1.18b adds `books.calibre_id`, so the *Calibre*
  tag reads it and this task adds no column.
- *Amended 2026-10-28 (D-94):* it follows 1.4f, so the outside results are
  Hardcover's: the source tag reads *Hardcover* and the group head *From
  Hardcover*, and the Check's *recorded Open Library answers* are Hardcover's.

**Check:** in the browser (0.11), with recorded Open Library answers: typing
`pir` and pausing lists results without Enter; typing `pi` and pausing makes no
request; typing `piranesi` quickly makes one request, not six; a library result
shows its level tag and an Open Library result its source tag, each part of the
row's accessible name; the master list narrows as you type, and one Back leaves
it. A vitest with fake timers shows the older request aborted when a newer
query starts.

### ☑ 1.23 Audiobooks: listening, and a listen that counts as a read · M
Backlog intake, 2026-10-26 (owner: *audiobook listening: a separate status
under books, a separate column on a book if I've listened to it, shown only if
I'm listening or have listened … it counts as completed, but I want separate
stats and an icon to make it clear it was listened to or is being listened to;
the book summary shows reads and listens as different things*). D-85. **Before
cutover, in sitting 9**, for 1.5's and 1.17's reason: a finish logged without
saying it was a listen can't be told apart later.

- Proposed: a `listening` value of `book_status.status` (in progress, by ear),
  and `read_events.format` (`text` | `audio`, NOT NULL, default `text`, with a
  CHECK), so every read already logged is `text`. **Stop and ask at plan time**
  (a new column, and a new status meaning, CLAUDE.md). No column is dropped or
  retyped, so there is no down file.
- **A listen is a read.** Finishing from *Listening* sets `read` and appends a
  `read_events` row with `format = audio` through `saveBookStatus`, so series,
  author and universe progress, the Read filter and year totals count it as
  they count any read. A second listen is a reread (data model 2.18).
- **Said with a glyph.** A drawn headphones glyph with an `aria-label`
  (*Listened*, *Listening*) sits beside the status wherever a book's status
  shows: the master list, the status screens, search results (1.22) and the
  sheet. A book only ever read on the page shows none.
- **Listening is its own group.** The status control offers *Listening* beside
  *Reading*, and the books In flight screen (1.9) lists *Listening* as its own
  group after *Reading*.
- **The book's summary counts them apart:** *Read 2× · Listened 1×* on its
  master-list row and its sheet (3.5, noted there). The *Listened* part appears
  only when the book has a listen or is being listened to.
- **Separate stats, derived.** `books_by_year` gains a listened count beside
  its total (from `read_events.format`, never stored); the total still
  includes listens. 2.2's *2026 so far* and 6.2's charts show the split (noted
  there).
- **For the plan gate:** whether a listen counts against the year's reading
  capacity (2.1's word budget) or runs alongside it; whether a book can be
  Reading and Listening at once when you switch format mid-book (proposed: no,
  one in-progress state); whether a listen records its length.

**Check:**
- Setting a book to *Listening* and then finishing it writes `read` and one
  `read_events` row with `format = audio`; every read logged before the
  migration is `text`.
- `series_progress` counts the listened book as read.
- `books_by_year` returns a total that includes the listen, and a listened
  count of 1.
- In the browser (0.11), the row shows the headphones glyph with the accessible
  name *Listened*; a book only read on the page shows none; a book with two
  reads and one listen says *Read 2× · Listened 1×*.
- In flight lists a Listening book under *Listening*, not *Reading*.
- `npm run test:db:reset` migrates from zero.

### ☑ 2.0b Type a setting, and hold to step · S
Owner intake, 2026-11-05 (owner: *settings: modify the number directly with
numpad; maybe hold down button goes faster*). D-123. Depends on 2.0.

- **Type it.** The number in a stepper is a button named for its row (*Edit
  minutes a day*). A tap swaps it for an `<input inputmode="numeric">` with the
  value selected, so a phone opens its numpad. Enter or leaving the field
  commits; Esc puts the old value back; an empty field or anything that isn't
  a number changes nothing. A value past a bound commits the bound and shows
  the reason the stepper already gives (*The highest is N*).
- **Hold to go faster.** Pressing and holding − or + repeats after 400ms, and
  speeds up the longer it is held. It stops at a bound, on release, and when
  the pointer leaves or is cancelled. A tap is still one step, and a keyboard
  press still steps once.
- **One save.** Both go through `PaceSettings`'s existing wait, one save 500ms
  after the last change, so a long hold is one `PATCH` with the final value.
- **Not drawn yet.** The mockup's `settings` frame gains the input, and
  `design/STYLE_GUIDE.md` § 9 (*a number you step*) comes from the design tool
  after this: it is a protected file, and D-123 governs until then.

**Check:** component tests: typing 45 and Enter in *Minutes a day* changes it
to 45; a value over the maximum commits the maximum and shows the reason; Esc
and an empty field leave the value as it was; with fake timers, a hold repeats,
repeats faster after its first second, and stops at the bound and on release; a
tap steps once. `PaceSettings`: a hold sends one `PATCH`, carrying the final
value. In the browser (0.11), the input has `inputmode="numeric"`, focus
returns to the number after a commit, and axe passes. Screenshots at 360px and
1280px.

### ☑ 2.2 Books dashboard · M
Five slots in this order, per the feel pass (D-40; STYLE_GUIDE §14.1–§14.2,
Feel Review §4), which replaces "Books — v4" in `design/mockups.html` on layout
and copy: **Now** (the book in hand, or *Between books*); **Up next in Qn**, a
cover shelf of the current quarter's books in `ordinal` order with **Reorder**
(1.9's quarter list); **This quarter**, the single-quarter strip (FP-D8);
**On deck**; and **2026 so far**. Depends on 1.7, 1.8, 2.1 and, for the
sittings line, 2.1b.

*From 1.8e (TASK-028, PR #111):* the 834px `bdash`
frame in `design/mockups.html` is drawn from this feel pass at tablet width
(STYLE_GUIDE §14.5): the horizontal hero around a 150 × 225 cover, *Up next in
Q4*, *This quarter*, and *On deck* | *2026 so far* stacked below as two columns,
1.5 : 1. Build the 768–1023px layout from it.

*From 1.23 (2026-10-26 intake):* **Now** shows a book being listened to as it
shows one being read, with the headphones glyph, and *2026 so far* gives
listens beside reads (*31 finished · 6 listened*), from `books_by_year`'s
listened count.

*From the second 2026-11-02 intake (D-108, D-110):* **Now** gains 2.2d's
*Next in* line, and **Between books** its *Or keep going* rows, both from
`follow_next`; build them with 2.2d, not here. The master list stops being
`/books`: it is the Library (2.2e), which lands first or with this entry, so
the list keeps a nav item.

- **Now** is the only large thing (`--r-hero`, the art band on `--art` once
  4.2 stores it): the cover (`--cover-hero`), the title in Newsreader
  (`--fs-hero-name`), the author, `p. 212 of 468` in mono, a 6px `--ready`
  meter, and *Started 21 Sep · about 30 pages a sitting · 7 sittings* once 2.1b
  has sessions. Time left is still evenings at your own session length, never a
  date: *at your set pace* before sessions exist and *at your measured pace*
  after. It is never blank and never hidden.
- **Between books** (§14.2; §15) replaces the old empty state. A 72px cover of
  the last finished book with a `--ready` check, a `✓ finished · Sun` badge,
  *Between books.*, a line saying what you finished and how long it took
  (*You finished Piranesi on Sunday, 245 pages in nine days. Nothing's on the
  go, and that's fine.*, from 1.5's dated reads; an undated finish says what,
  not when), the top of the current quarter's plan (the lowest-ordinal
  `to_read` book, D-37), and *Pick something else*. The thumb bar's verb starts
  the top of the plan, named.
- **This quarter** (FP-D8) is one strip for the current quarter against the
  760k rule: *Q4 2026 · 3 of 7 read · 615k planned · 760k a quarter*. The full
  plan rail stays on `/books/plan` (2.10); 2.2b's rail component draws this
  strip as a one-quarter rail.
- **2026 so far** is three this-year counts on `--raise` (books, pages, new
  authors), one line, linking to Stats (6.2). Never the backlog.

**Desktop** (§14.6; Feel Review §11d; `design/screenshots/desktop/07…10`): Now,
*Up next in Qn* and *This quarter* in main; *On deck* (Situation) and *2026 so
far* in 1.8's side rail. The hero has 2.4's geometry with a 168×252 cover, the
title at 32/36 (`--fs-hero-name-desk`), the page count at 32/36 mono, and the
meter under the lens's 480px cap. The shelf gets ‹ › only when it overflows
(1.10). *This quarter*'s strip fills its card's inner width, each block k / 760
of it, with the 760k rule at the right edge. *On deck* rows hide **Plan** at
rest and reveal it on row hover or `:focus-within` with a fine pointer, as
2.4's *+ Up next* (FP-D15). *Between books* drops *Finished it* from the header
and names the top of the plan in full on the primary; below about 1100px it
truncates and keeps the full title in its accessible name. No capacity card and
no *Place them* at any width until the question below is answered.

*From 1.8b (TASK-015, PR #114):* 1.8b builds and
unit-tests `ThumbBar`'s books configuration (`src/components/ThumbBar.tsx`):
the bar *Log progress · ✓ finished · search*, and the header *Search · Finished
it · Log pages*. Since `/books` was still a redirect, nothing renders it yet.
Render it here, wrapped in `VerbsProvider`, as the comics dashboard is.

**Open, stop and ask before building** (the feel pass is silent): the old
dashboard had a capacity card with **Rebalance** and **Accept** (2.7) and an
amber unplaced-entries card with **Place them** (2.8). The feel pass draws
neither. Where those decisions surface now — an amber card in slot 4 when one
is open, the strip's own badge, or `/books/plan` only — is the owner's call.

**The capacity number is amber past 100%, never red**, and the word "behind"
does not appear anywhere on this screen.

**Check:** the feel-pass screenshots (the header's widths, themes and
reduced-motion and reduced-transparency passes) of reading and *Between books* —
no horizontal scroll, the capacity rule legible, the primary action inside the
bottom 96px. The five slots render in the order above. Nothing on the screen
resolves to `--danger`. With nothing reading, Now renders *Between books* naming
the last finished book, and its offer is the current quarter's lowest-ordinal
book that is still `to_read` (D-37), named on the button; with nothing ever
finished it omits the finished line. The strip's planned total equals 2.1's
figure for that quarter. *2026 so far* has three counts, all this year.
At 1280px *On deck* and *2026 so far* are in the side rail, and **Plan** follows
2.4's hover rule for *+ Up next*.

### ☑ 2.2b The plan rail · M
Depends on 2.2 (the slot) and 1.7. Split out of 2.2 (R3-12). Since D-40 the
dashboard shows one quarter of it (FP-D8, 2.2's *This quarter* strip); the
four-column rail is `/books/plan`'s (2.10). The component and its rules below
are the same for both.

A quarter is a column, a book is a block sized by its word
  count, and a dashed rule across all four columns is the quarterly capacity
  (760k at the current settings). Blocks stack from the foot of the column in
  the quarter's `ordinal` order (D-37), so the cumulative total crosses the rule
  at the end of your order: blocks whose cumulative total crosses the rule are
  hatched, and they are always the books you ranked last. Every block is a `<button>` with an accessible name (*Piranesi, 65k
  words, estimated, Q1 2027*) and at least a 24×24px hit area, merging sub-24px
  neighbours into a `+N · Nk` stack button; estimated counts (`data-wc="estimated"`)
  have a dotted top edge and a `~` prefix, with a legend tag. There is no month
  layout (D-38). A fifth lane behind a dashed border holds `plan_period` rows
  whose period is a bare year; it has no order (D-37) and stacks largest at the
  foot. On deck and Someday are not on the rail, because they count against no
  capacity. Tapping a block opens the picker sheet from 2.3.

**One rail markup** (M-07), the same on the dashboard and the plan page (2.10): `button.qb` with the book's genre hue in `--hue` (one book, one
hue), `.over` for a block past the rule, `.un` for a fifth-lane entry (a button,
not decoration), `data-wc` for estimated counts. No inline fills. Quarter footers
carry an amber *over Nk* badge or a grey *Nk room* badge — never green (M-06).
**On the phone the footer shows only the amber overage** (`+132k`); the grey
room badge is desktop only, because *56k room* wraps in a 62px column (SG-D11).

**Geometry** (STYLE_GUIDE §3; `design/Plan Rail Spec.dc.html` A4.1, A4.2): the rail
is 230px tall on the phone and 300px on desktop, scaled so 1000k fills a quarter
column; columns sit 6px apart on the phone, 10px on
desktop. The fifth lane is 52px on the phone and 150px on desktop (*2027 · no
quarter*), with a 1px dashed `--blocked` left border and `.un` blocks in
`--blocked-soft` with a dashed `--blocked` ring. A block is radius 3 with a 3px
`--hue` left edge on `--reading-soft`, gap 2. Only **the part of a block above
the rule** takes `--hatch` over `--blocked-soft`, and that block's ring turns
`--blocked`; its label sits on a `--surface` chip over the hatch. The capacity
rule is 1.5px dashed `--ink-2`. Two or more adjacent sub-24px blocks merge into
one stack button (`--raise`, dashed `--faint-deco`, `+N` over `Nk`, height the
sum or 24px, whichever is larger); a lone sub-24px block keeps its drawn height
and gets a 24px `::after` hit area.

1.8d's `PlanRailSkeleton` was measured against a fixture of the mockup's markup; re-measure it against this component, within 2px at 360px (from TASK-027).

*As built (TASK-051; D-135 to D-138):* a block sits at its cumulative words and a
short block or stack keeps its drawn height, its 24px hit area a real box rather
than an `::after`; the scale is fixed at 1000k a column and overflow folds into
a `+N more` stack; the strip is the rail on its side with the feel pass's fills.
Until 2.3 a book block opens its Library row and a stack is `aria-disabled` with
its reason shown.

**Check:** a quarter whose books total 892k against a 760k capacity renders
exactly the blocks past 760k as hatched, and those are the quarter's highest
ordinals; moving the last hatched book to the top of the order renders it plain
and leaves the quarter's total unchanged. A book with `period = '2027'`
renders in the fifth lane and in no column. A block straddling the rule is
hatched above the rule and plain below it. Every interactive element inside
`.planrail` measures at least 24×24 CSS px, an estimated book renders the dotted
edge and `~` label, the rail renders without horizontal page overflow at 360px,
and no *Quarter | Month* control renders anywhere. At 360px no quarter footer renders a *room* badge; at 1280px an
under-capacity quarter does. Nothing resolves to `--danger`. Screenshot at 360px
and 412px.

### ☑ 2.2c Follow what you're reading: the control, and an offer when you finish · M
Owner intake, 2026-11-02 (owner: *a follow option where I can manually say
I'm reading this author or this universe, not I happened to read one book of
it … upon finishing a book, in addition to marking the date, also give option
to follow the author, the universe or the shelf if it has one*). D-108.
Depends on 1.15 (the follow tables) and 1.5 (the finish). Takes the follow
control out of 5.11, so that 2.2d and 2.10b have something to read before the
author and universe pages exist.

*Amended by the 2026-11-05 intake (2.2h, D-117):* a finish now follows the
series, subseries and universe itself, and the offer keeps the author and
shelves. What's built here stands until 2.2h lands.

- **Only *Reading* means reading** (D-108, sharpening D-43). A series, author,
  universe or shelf counts as one you're reading only when its follow is
  `reading`, set by you. Having read one book of it never does: no suggestion,
  *Next in* line or *In the middle of* row infers it from `series_progress`
  or any other progress view. Those views still say how far along you are.
  `tracking` stays what it was: you want to know about it, not that you're on
  it. Every follow 1.15 loaded is `tracking`, so nothing is *Reading* until you
  set it.
- **The control.** *Reading · Tracking · Not following*, a `role="radiogroup"`
  writing `series_follows`, `author_follows`, `universe_follows` or
  `shelf_follows`. *Not following* deletes the row. Each change is one write
  with an undo (1.2) that restores the previous state, row or no row. Until
  the series, author and universe pages exist (5.9, 5.11), it is reached from
  *Follow…* in a book's row menu in the Library (2.2e), and on the book's
  sheet once 3.5 draws it. *Follow…* opens a sheet listing that book's series,
  author, universe and each shelf it is on, each with its control and its
  `read / total` in mono.
- **Shelves can be followed.** A shelf is the owner's own reading order (5.1),
  so following one as *Reading* means working through it. Proposed:
  `shelf_follows(shelf_id, state)`, `state IN ('tracking', 'reading')`, no
  `user_id` (D-91), in `src/db/export-tables.ts`, and a `shelf_progress` view
  (books listed and read per shelf, live books only, with `follow_state`),
  which 5.12 then reads. **Stop and ask at plan time** (a new table).
- **The offer at the finish.** Setting a book to *Read* (1.5's *Finished*)
  saves at once, as today; then the toast that carries its undo gains a second
  line, *Keep going?*, with one chip per thing the book belongs to that isn't
  already *Reading*: its series and universe while either still has an unread
  live book, its author, and each shelf it is on with a book left (*Mistborn ·
  series*, *Brandon Sanderson*, *Cosmere*). A chip sets *Reading* with its own
  undo. Ignoring the offer writes nothing, and the offer never blocks the
  finish. It sits beside 3.4b's *Rank it in 2026* when both apply, and moves
  into 5.4's closing card once that exists. Finishing the last unread book of
  something you follow as *Reading* offers *Done with Mistborn* instead, which
  sets it back to *Tracking* (D-43: *Reading* stays set until you change it,
  so the app asks rather than changing it for you).
- **Not drawn yet.** The mockup gains the *Follow…* sheet and the finish
  offer at phone, tablet and desktop widths before they are built, and
  `design/mockups-index.md` lists them.

**Check:** `npm test`: setting *Reading* on a series writes one
`series_follows` row at `reading`, *Not following* deletes it, and Undo
restores the earlier state; the same for an author, a universe and a shelf.
Finishing book 2 of 4 of an unfollowed series in the Cosmere, on a shelf with
a book left, offers the series, the author, the Cosmere and the shelf;
finishing book 4 of 4 does not offer the series; a series already *Reading* is
not offered; finishing the last unread book of a *Reading* series offers *Done
with* it, and taking it writes `tracking`; dismissing the offer writes no
follow row. `shelf_progress` counts read and listed books per shelf and skips
a soft-deleted book. The export test passes with `shelf_follows`. In the
browser (0.11), the offer's chips are reachable by keyboard and axe passes.
Screenshots at 360px and 1280px.

### ☑ 2.2d Next in what you're reading, on the dashboard · M
Owner intake, 2026-11-02 (owner: *how is current universe/author reading
showing up on continue reading or "Add books to plan" recommendation?*; asked,
the owner chose the dashboard and the plan sheet). D-108. Depends on 2.2 (the
dashboard) and 2.2c (the follows it reads).

*From the 2026-11-05 intake (2.2h, D-117):* when 2.2h lands first,
`follow_next` also lists each subseries followed as `reading`, its next book
being the lowest unread `subseries_position`, and the *Next in* line prefers
the subseries, then the series, the universe and the author. 2.2g's rows sit
above that line.

- **One derived list, read everywhere.** Proposed view `follow_next(kind,
  entity_id, name, book_id, read, total)` in `etl/views.sql`: for each series,
  universe, author and shelf followed as `reading`, its next book. Next is the
  lowest unread `series_position` for a series, the lowest
  `universe_position` for a universe, the lowest `ordinal` for a shelf, and
  for an author the earliest `published_year`, then title. Unread means
  `to_read` or `unlisted`; a book read, DNF or parked (5.15) is skipped. A
  follow whose next book is the one you're reading now has no row, and nor
  does a follow with nothing left. Nothing is stored (hard rule 2).
- **Under Now.** When the book in hand belongs to something you follow as
  *Reading*, the hero gains one grey line under its meter, *Next in Mistborn:
  The Well of Ascension*, linking to that book. One line only: the series
  first, then the universe, then the author.
- **Between books.** Under the top of the plan, *Or keep going* lists up to
  three rows from `follow_next`, most recently read first, each with its
  reason (*Next in Red Rising · 3 of 6 read*) and **Start** (sets the book
  `reading`, with undo). *Pick something else* stays. The top of the plan is
  still the primary, and the thumb bar's verb still starts it.
- **The plan sheet reads the same view.** 2.10b's first three groups are
  `follow_next`'s rows, so the dashboard and the sheet can't disagree.
- No nudge copy, no streaks, nothing amber or red: a follow you haven't
  touched in months is listed as calmly as one you touched yesterday.
- **Not drawn yet.** The feel pass (D-40) draws Now and *Between books*
  without these lines; the mockup's `bdash` frames gain them at phone,
  tablet and desktop widths before they are built.

**Check:** `etl/test_views.sql`: with a series followed `reading`
whose books 1–2 are read and 3–4 `to_read`, `follow_next` lists book 3 only;
the same series at `tracking`, or unfollowed with 2 read, has no row; an
author followed `reading` lists their earliest unread book; a shelf followed
`reading` lists its lowest unread ordinal; a DNF next book is skipped; a
series whose next book is `reading` has no row. In the browser (0.11), with
nothing reading, *Between books* lists book 3 under *Or keep going*, **Start**
sets it `reading` and Undo restores `to_read`; reading book 2 of a `reading`
series, Now shows *Next in* naming book 3. Nothing on the dashboard resolves
to `--danger`. Screenshots at 360px and 1280px.

### ☑ 2.2e Library: its own page, sorted as well as filtered · S
Owner intake, 2026-11-02 (owner: *Library view is own page, not home of
books dashboard that also includes sorting options, not just filtering*).
D-110. No dependency. Build it before 2.2 or with it, because 2.2 is the
change that makes `/books` the dashboard.

- **Its name is Library.** The master list's heading, its nav item and every
  link to it say *Library*. 2.2 points the *Books* switch and `/books` at the
  dashboard; this entry adds a *Library* item to the books section of every
  bar that lists books' screens (`src/components/nav/items.ts`), enabled now.
  Proposed: it stays at `/books/list` (ui.md's list screen one level down);
  the route's name is asked at plan time.
- **Sort, not only filter.** A *Sort* control beside the filters: a select on
  the phone, in the filter rail from 1024px. The orders:
  - **Series**, the default and today's order (series, then position, then
    title);
  - **Title**, A to Z;
  - **Author**, by name, then title;
  - **Length**, longest first (an estimated count sorts by its estimate and
    keeps 2.2b's `~` mark);
  - **Published**, newest first;
  - **Finished**, most recent first (meant for *Read*; under another filter a
    book with no finish comes last);
  - **Plan order**, on *To read*: quarters in order and by ordinal, then bare
    years, On deck and Someday (D-37, through `to_read_level`);
  - **Recently added**, once `books.added_at` exists (2.10b proposes it;
    whichever task is built first asks).

  Each order reverses (*↑ ↓*). The sort is in the URL
  (`?sort=length&dir=asc`), combines with every filter and the search, keeps
  the match count, and survives a reload. NULLs sort last in either
  direction. It is SQL in `listBooks`, never a sort in the app.
- This absorbs 6.10's *sort by word count*; 6.10 keeps the rest.
- **Not drawn yet.** The mockup's `blist` gains the *Sort* control and the
  *Library* name at phone, tablet and desktop widths before it is built.

**Check:** `npm test`: `listBooks` with `sort=length` returns the
longest book first and a book with no word count last, and `dir=asc` reverses
the order with the empty one still last; `sort=title` with `status=read` keeps
only read books; `sort=plan` on *To read* lists 2027 Q1's books by ordinal
before 2027 Q2's, and Someday's after On deck's. In the browser (0.11),
choosing *Length* updates the URL and the order and survives a reload; the
nav shows *Library* at 768px and 1280px, current on `/books/list`; at 360px the *Books* switch is current there and the page's heading reads *Library*.
Screenshots at 360px and 1280px.

### ☑ 2.2f Finish a book from In flight · S
Owner intake, 2026-11-05 (owner: *a way to finish a book from the status
tab*). Depends on 1.9, 1.5 and 2.2c. `StatusBookRow` is plain text today, so a
book in hand can only be finished from the Library.

- Each *Reading* and *Listening* row on `/books/status` gains **Finished**,
  named for the book (*Finished The Alloy of Law*). It is the Library's finish,
  not a second one: `saveBookStatus`, the undo toast with *Keep going?*, and a
  listen logged as `audio` (D-112). One tap writes today, with no date step; a
  different date is set from the Library's *Finished* (owner, 2026-11-06).
- The book moves to Done and each tab's count follows. In flight has no other
  status control: DNF, Parked and the rest stay where they are.
- **Not drawn yet.** The mockup's `status` frame gains it, at phone, tablet and
  desktop widths, before it is built.

**Check:** in the browser (0.11), **Finished** on a *Reading* row writes `read`
and one `read_events` row with `format = text`, and on a *Listening* row one
with `format = audio`; the toast carries *Keep going?*; Undo restores the status
and leaves no read; the book moves from In flight to Done and both tabs' counts
equal their rows. The button is reachable by keyboard, axe passes and nothing
resolves to `--danger`. Screenshots at 360px and 1280px.

### ☑ 2.2g Where the book sits, in Now · M
Owner intake, 2026-11-05 (owner: *hierarchy for currently reading dashboard.
Universe/author, series, sub series. How to show? Super series and sub series in
flight should be shown in some way*; asked, the owner chose stacked meters, to
be redesigned later). D-119. Depends on 2.2 and 2.2h (`subseries_progress`).
6.21 redesigns it; this is the working version, not the final drawing.

- **One thin row per level the book belongs to**, under the meter and above
  2.2d's *Next in* line, outermost first: the universe (D-90: Calibre's
  superseries is the universe), or with no universe the author when followed as
  *Reading*; then the series; then the subseries. Each row is the name, an
  `.emeter` filled with `--ready`, and `read / total` in mono.
- **At most three rows, and no empty one.** A level the book lacks draws
  nothing, and a standalone by an unfollowed author draws none. *Between books*
  draws none.
- **Position is a fact, not a follow.** Each row reads `universe_progress`,
  `series_progress`, `author_progress` or `subseries_progress`, whether or not
  that level is followed. D-108 stops a progress view from saying what you're
  *reading*; it never stopped one saying how far along you are. Nothing is stored
  (hard rule 2).
- Now stays the one large thing: these rows use the rollup's type sizes, not the
  hero's. A *Listening* book draws them too.
- **Not drawn yet.** The mockup's `bdash` frames gain the rows at phone, tablet
  and desktop widths before they are built.

**Check:** in the browser (0.11), a book in hand in a universe, a series and a
subseries renders three rows in that order, each `read / total` equal to its
view's; a book in a series alone renders one row; a standalone by an unfollowed
author renders none; a standalone by an author followed `reading` renders the
author's row; *Between books* renders none. Every meter fills with `--ready`,
nothing resolves to `--danger`, and there is no horizontal scroll at 360px. The
five slots keep their order. Screenshots at 360px, 834px and 1280px.

### ☑ 2.2h Finishing a book follows it · M
Owner intake, 2026-11-05 (owner: *is anything automatically followed upon
reading? Maybe should be for series/sub/super and universe, manual for author.
Can manually opt out. Difference between actively following and still in the
middle of but on hold*; asked, the owner chose automatic at the finish, with
every level still settable by hand, and On hold derived from Tracking). D-117,
D-118; **amends D-108 and 2.2c**. Depends on 2.2c. Build it before 2.2d, whose
`follow_next` then has followed subseries to read.

- **Automatic at the finish.** A finish in the app (setting a book to *Read*,
  from *Reading* or *Listening*) also sets the book's series, subseries and
  universe to `reading`, each only while it has an unread live book left, in
  the same transaction. Authors and shelves are never automatic: they stay
  *Keep going?* chips. Only a finish does this: nothing follows from an extract,
  a loaded read or 4.4's Calibre sync, and past reads are not backfilled.
- **A Tracking follow is raised.** Proposed: finishing a book of something at
  `tracking` sets it to `reading`, because you've just read it. Otherwise the
  series loaded from the sheet, all `tracking` (1.15), would never follow
  themselves. **Stop and ask at plan time.**
- **By hand still works.** The *Follow…* sheet and its control stay, for any
  level, before or after a finish.
- **Opting out sticks.** 2.2c's *Not following* deletes the row, so the next
  finish would follow it again. Proposed: on `series_follows`,
  `subseries_follows` and `universe_follows`, *Not following* keeps the row with
  a new `state` value, `off`, which every reader treats as no follow
  (`follow_state` NULL). Author and shelf follows, never automatic, keep deleting
  theirs. **Stop and ask at plan time** (a CHECK change on two tables, and a
  change to 2.2c's write).
- **The toast says what happened.** *Now reading Mistborn · Cosmere*, one chip
  each: a chip turns that one to *Not following*, with its own undo. *Keep
  going?* keeps the author and shelf chips. The finish's Undo undoes the finish
  and restores each follow it changed. *Done with Mistborn* on a last unread
  book is unchanged (D-43).
- **Subseries are followable.** Proposed: `subseries_follows(subseries_id,
  state)`, as `shelf_follows`, no `user_id` (D-91), in
  `src/db/export-tables.ts`, and a `subseries_progress` view (books listed and
  read per subseries, live books only, with `follow_state`). The *Follow…* sheet
  lists the subseries with its control and `read / total`. **Stop and ask at
  plan time** (a new table).
- **On hold is a label, not a state** (D-118). The control's middle choice still
  stores `tracking`. It reads *On hold* while the thing is partly read (at least
  one read, at least one unread) and *Tracking* otherwise. To pause something,
  you set it there. It is derived at display, never stored (hard rule 2), and
  5.12 lists it as its own group.
- **Not drawn yet.** The mockup's `follow` and `finishoffer` frames change at
  phone, tablet and desktop widths before they are built.

**Check:** `npm test`: finishing book 2 of 4 of an unfollowed series, in a
subseries and a universe with books left, writes `reading` for all three and no
author or shelf follow; the finish's Undo restores the book and leaves no follow
row; finishing book 4 of 4 writes no series follow; a series at `tracking` is
raised to `reading`, and Undo restores `tracking`; a series set to *Not
following* stays out at the next finish; a chip turns one follow off and leaves
the others; a DNF writes no follow; a read loaded through the ETL writes no
follow. The subseries control writes a row at each state, and the export test
passes with `subseries_follows`. `subseries_progress` counts read and listed
books and skips a soft-deleted book. The control reads *On hold* at 1 of 4 read
and *Tracking* at 0 of 4 and 4 of 4, with the same stored value. In the browser
(0.11), the toast's chips are reachable by keyboard and axe passes. Screenshots
at 360px and 1280px. This replaces the part of 2.2c's Check where a finish only
offers the series and the universe.

### ☑ 2.2i Every screen from a phone: the tab row · M
Owner intake, 2026-11-05 (owner: *some of the manual checks have me go to a
specific link. Make sure all of those links are available to get to through the
UI and not just putting into the url bar*, and *link for books by status (or
redo the dashboard so that's already on there)*; asked, the owner chose a tab
row). D-120; **amends D-77**. Depends on 1.8. No later entry needs it first, but
it is the phone's way to every screen, so it goes early.

The phone's bar draws the media switch and the gear only (D-77, D-113), so at
360px nothing links to Books *Status* or *Add* at all, and Comics *Status* has a
link only while something is mid-run.

- **A tab row under the media bar**, below 768px only, part of the sticky bar:
  the current medium's enabled items from `NAV_ITEMS` (R1-06), then *Inbox*. A
  task that flips an item on (Plan, Shelves, Top) adds it here with nothing else
  to do. Hue never identifies it (ui.md), and the current item has
  `aria-current="page"`.
- It scrolls sideways inside itself, never the page, with the current item
  scrolled into view. Targets are 44px tall.
- On a screen with no medium (`/inbox`, `/settings`) it draws the last medium's
  items (`mediumFor`, R1-13's cookie).
- `--bar-h` grows on the phone, and every sticky offset and skeleton that reads
  it follows, so CLS stays under the budget (0.10). The thumb bar and the five
  slots don't move. The tablet rail and desktop sidebar already list these items
  and don't change.
- **Manual checks walk the UI.** Standing rule 8 (`docs/06-tasklist.md`): a
  task's manual check says what to tap from a dashboard, not a URL to type.
- **Not drawn yet.** The mockup's phone frames gain the row, and
  `design/mockups-index.md` notes it, before it is built.

**Check:** a browser test at 360px, built from `NAV_ITEMS`, so a newly enabled
item is covered without editing it: from each medium's dashboard, every enabled
item of that medium, *Inbox* and *Settings* is reached by tapping links, with no
direct navigation. The current item has `aria-current="page"`. With every books
item enabled, the page has no horizontal overflow at 360px. The row is not
rendered at 768px or wider. Each item measures at least 44px tall, and axe
passes. 0.10's CLS budget holds on `/books/list` and `/comics`. Screenshots at
360px and 412px, light and dark.

### ☑ 2.2j The universe and series on a book's row · S
Owner intake, 2026-11-09 (owner: *on deck shows the series or sub series or
super series (smartly picked, whichever makes sense)*; asked, the owner chose
the universe, then the series, and the same line on Up next, the status tabs,
the Library and the plan sheet). D-134. Depends on 2.2 (On deck and *Up next
in Qn*). Pulled ahead of 1.26 by the owner (D-139).

- **One line, one rule.** A book row's second line is the author, then its
  place: the universe (D-90: Calibre's superseries), then the series and
  `#position` (*Brandon Sanderson · Cosmere · Mistborn #4*). With no universe
  it is the series alone (*Robot #2*); with no series, the universe alone, with
  no number (*First Law World*); with neither, the author alone. A series with
  no position drops the `#`. When the series name already contains the
  universe's, case-insensitively, the universe is dropped (*Magic Tree House
  #3*, not *Magic Tree House · Magic Tree House #3*).
- **The subseries isn't on this line.** 2.2g draws it in Now; a row names the
  two levels everyone recognises.
- **One helper, read everywhere.** A pure function in `src/lib/format.ts`
  (proposed: `bookPlace`) builds the line, and replaces `bookSub`'s series
  part and the Library's inline join, so a book reads the same on every
  screen. Its queries add the universe's name: `onDeck`, `quarterShelf`,
  `listBooks`, `booksInFlight`, `booksUpNext`, `booksDone`. Nothing is stored
  (hard rule 2).
- **Where:** On deck and *Up next in Qn* on the dashboard (neither shows a
  series today); the status tabs and the Library (today *Series #n*, which now
  gains the universe). 2.10b's suggestion rows use it when built. The plan
  rail's blocks have no second line, so 2.2b is unchanged.
- The line wraps rather than truncates: *The Chronicles of Thomas Covenant the
  Unbeliever* has to stay readable at 360px.
- **Not drawn yet.** The mockup's `bdash` frames show the line on On deck and
  Up next at phone, tablet and desktop widths before it is built.

**Check:** `npm test`: `bookPlace` returns *Cosmere · Mistborn #4* for a book
with both, *Robot #2* for a series alone, *First Law World* for a universe
alone, an empty place for neither, *Mistborn* for a series with no position,
and *Magic Tree House #3* when the series name contains the universe's;
`onDeck` and `quarterShelf` return the universe's name. In the browser (0.11),
an On deck row and an *Up next* row for *The Alloy of Law* read *Brandon
Sanderson · Cosmere · Mistborn #4*, and the same book reads the same on its
status tab and in the Library. There is no horizontal scroll at 360px, axe
passes, and nothing resolves to `--danger`. Screenshots at 360px and 1280px.

### ☑ 2.2l The universe and series on Add books' search results and the plan sheet · M
*Noticed by TASK-062 (2.2j); owner's call at its plan gate, 2026-11-12: left out of 2.2j. The plan sheet was added at its close-out, the same day.*

Add books' search results (`src/components/BookSearch.tsx`) build their own
second line, *author · series #n · pages*, so a library hit there doesn't name
its universe, and it is the one builder of a book's line outside `bookSub`
(2.2j's source scan exempts it by name). A library hit should read *author ·
universe · series #n*, as every other books row does (D-134), followed by its
pages. A Hardcover hit has no universe to name. Depends on 2.2j; `librarySearch`
adds the universe's name as 2.2j's queries do. The plan sheet
(`src/components/PlanPicker.tsx`, 2.3) names the book it moves in its header,
*author · words*; the 2026-11-09 intake asked for the same line on the plan
sheet, and 2.2j left it, so it reads *author · universe · series #n* there
too, followed by its words.

**Check:** `npm test`: given a book by Brandon Sanderson in universe *Cosmere*,
series *Mistborn* at 4, with `page_count` 330, its library hit has the line
*Brandon Sanderson · Cosmere · Mistborn #4 · 330 pages*, built from
`bookSub` and followed by its pages; a hit with no universe reads as it does
today; a Hardcover hit is unchanged. 2.2j's source scan no longer exempts
`BookSearch.tsx`. The plan sheet's header for that book reads *Brandon
Sanderson · Cosmere · Mistborn #4* followed by its words. In the browser (0.11)
a long series name wraps at 360px in both, with no horizontal scroll, and axe
passes.

*(Check proposed by TASK-062; the owner agrees it by merging, or edits it.)*

### ☑ 2.3 Plan editor · M
Depends on 1.7 and 2.1.

One picker sheet, three entry points: **Move** on a plan-page row, **Plan
for…** in the master list, and **Year or quarter…** when adding a new book (same
sheet, minus the "currently planned" badge). Mockup: `design/mockups.html`,
"Move / add to plan".

*From 1.4c (TASK-008, PR #77):* the Add books sheet
draws *Year or quarter…* in its *Add to* row `aria-disabled`, with the reason
*Year or quarter… arrives with the plan editor.* (the copy since 1.7, which
enabled *On deck*; `src/components/AddBooks.tsx`), and leaves out the mockup's
secondary *Year or quarter…* button on a search result row. This task enables the chip and
adds that button; the add itself is `POST /api/books`, whose `destination`
gains the plan level.

*From 1.7 (TASK-011, PR #96):* a quarter's ordinals count
every `reading_plan` row, a soft-deleted book's included, while `plan_period`
hides that book, so a planned book removed from the library would leave a
visible gap (1, 3). Nothing soft-deletes a planned book yet; whatever first
does should take its plan rows out through `takeOutOfPlan` / `moveToSomeday`
(`src/db/writes.ts`), or this task's lists re-rank.

*From 1.7 (TASK-011, PR #96):* undoing an add from a
search result clears the toast but leaves that row reading *✓ Added to …*
(disabled), so it can't be re-added without searching again (1.4c's
behaviour, seen at every destination). This task reworks those result-row
buttons; reset the row when its add is undone.

*From 1.21 (TASK-029, PR #143):* undoing a status change on a book that had no
status row (`undoBookStatus`, `src/db/writes.ts`) deletes the row even when the
book has been planned since, leaving a plan row with no `book_status`. Today
only a status toast left open while the book is planned in another tab reaches
it; this task makes planning a book an everyday action. 1.21 made the undo
refuse when it would put an Unlisted book back under a plan row; make the
no-prior case refuse the same way (or keep the row as a bare `to_read`, as the
undo already does when the row has gained a rating or a note).

Sheet contents: the four to-read levels (D-37). One row of chips: the next five
years, then **On deck** and **Someday**. Choosing a year opens a second row:
**No quarter yet** (a bare-year entry) and **Q1–Q4**. There is no month step
(D-38). Each year and quarter chip shows that period's current word total so the
choice is made with the budget visible, not checked after the fact. A live
preview card shows the target's total after the move (Q3 with a 118k book: *533k
of 760k*) and turns **amber** if it would go over capacity (*Q1 → 1,010k of 760k
· over 250k*), offering *Accept as a stretch year* — never red. The mockup's
Q1–Q4 chips (892k, 704k, 415k, 268k) are sample data; the seed has no plan
(D-13), so tests build their own. **On deck** and **Someday** skip the quarter
row and show no budget, because neither counts against capacity. **Someday**
is how a book leaves the plan: it deletes the plan row and keeps the book
`to_read`, never deletes the book, and pushes an undo entry onto the 1.2 stack
like every other row-removing action. The primary button names the target
(*Move to Q3 2027*, *Move to Someday*).

**Order (D-37).** Every write goes through 1.7's helpers: a book placed in a
quarter, from Move or from *Year or quarter…*, joins the **end** of that
quarter's order, and a quarter it left closes up. Bare-year and On deck entries
take no position. The sheet does not ask for one; a quarter's order is changed
on the Up next tab (1.9). Undoing a move restores the exact prior order.

**Check:** test that moving a 150k-word book from 2027 Q1 to 2028 Q2 changes
both periods' totals correctly and that the preview reflects the destination
period before the move is confirmed. The moved book takes 2028 Q2's last
ordinal, 2027 Q1 stays contiguous, and undo puts it back at its old position.
Test that On deck and Someday need no year or quarter; that Someday clears the
book's `reading_plan` row without touching `book_status`; that *No quarter yet*
writes a bare year; and that the sheet writes one `period` value, never a year
independent of a quarter and never a month. **Flip (R3-08):** 1.4c's add sheet
now offers *Year or quarter…* through this picker, and adding a book to a year
or quarter writes its `book_status` and `reading_plan` rows in one transaction;
1.9's empty Books *Up next* action becomes *Plan a book*.

*From 2.2b (TASK-051, PR #214):* until this lands, a rail block (the dashboard's
*This quarter* strip, and the rail on 2.10's page) is a `button` in a GET form
to `/books/list?q=<title>`, its book's Library row, and a `+N` stack is an
`aria-disabled` button with its reason shown (`PlanRail.tsx`, D-137). This task
swaps both for the picker sheet and the list sheet, the strip included, and drops
the stack's reason line.

### ☑ 2.7 Rebalance, and accepting an overage · M
*Pulled ahead of 1.26 by the owner (D-139).*

The catch-up affordance, one tap from the books dashboard. A sheet with four
peers, not three ways to shrink the plan:

1. **Move the overage into the next year** — and show what the next year then
   holds. The overage moves; it does not leave.
2. **Move it to On deck** — out of the year and its capacity, still next in
   line (D-37). Longest titles suggested first; nothing deleted.
3. **Even out the quarters** — same books, redistributed. Fixes the shape, not
   the total.
4. **Accept it as a stretch year** — persisted as a row in a new table,
   `plan_acceptance(user_id → users, year int, accepted_at timestamptz NOT NULL,
   accepted_total bigint NOT NULL)`, primary key `(user_id, year)` (R3-14). A row
   rather than a column on `reading_settings` because acceptance is per year and
   keeps its own date and figure; a later change that pushes the year past
   `accepted_total` re-raises the flag by comparing to it. *Undo acceptance* deletes
   the row. This task's migration creates the table.

**Order (D-37).** The overage is the books past each quarter's rule, which are
the end of that quarter's order (2.2b), so options 1 and 2 offer the books you
ranked last. A book moved into a quarter joins the end of it. *Even out the
quarters* keeps the year's order: it reads Q1's books in ordinal order, then
Q2's, and so on, and refills the quarters in that sequence.

Accepting turns the amber to a settled grey card stating what was accepted and
when, with an Undo. **Persistence is the whole feature** — an indicator that
comes back next week is one the user learns to ignore.

The sheet's four options are equal-weight buttons, each showing a before/after
delta (*2028 then holds 45 books*). Once accepted, the banner reads *2027
accepted as a stretch year on 14 Sep · Undo* in a calm state, on the dashboard
and the plan page. Mockup: `rebalance` (the sheet and the settled state); the legacy red classes `.capnum.over` and `.pace
.big.behind` are deleted. **Settling keeps the data honest** (`Plan Rail Spec`
A4.2): the overage is still drawn, but its hatch turns from `--hatch` to the grey
`--hatch-settled` and the legend reads *over, accepted (settled)*; only the held
state clears.

**Check:** test that accepting 2027 at 118% stores the acceptance with a date and
that the dashboard renders `.decide.settled` rather than `.decide`, and the
over-rule part of each block uses `--hatch-settled`, not `--hatch`; that Undo
removes it; that a later change pushing 2027 past the accepted total re-raises
the flag; and that "even out the quarters" leaves the year's book count
unchanged and never puts a book ahead of one that was ahead of it before.

### ☑ 2.10b Plan a year or a quarter, with suggestions · M
*Pulled ahead of 1.26 by the owner (D-139).*

Owner intake, 2026-11-02 (owner: *the ability to create a yearly/quarterly
plan … while creating a plan, the app gives suggestions: next book in a
series or shelf I'm reading, maybe recently added, others you think of*).
D-104. Depends on 2.3 (the picker and its writes), 2.10 (the page and its
*Suggest*), 1.15 (follows), 1.21 (Unlisted), and 2.2c and 2.2d (the
*Reading* follows and `follow_next`).

*Amended by the second 2026-11-02 intake (D-108):* the first three groups
read only what you follow as *Reading*. A series or shelf you happen to have
read one book of is no longer inferred into them; it shows nowhere on the
sheet unless another group lists it.

*From TASK-050 (2.2d, PR #212):* `follow_next`
as built is one row per follow (`kind` subseries, series, universe, author or
shelf), with the follow's `read`, `total` and `last_read_on` (its latest dated
finish); a book with no status row counts unread. One book can be next in
several follows (its series and its universe); the dashboard's `keepGoing`
lists it once, with the narrowest reason, and leaves out the top of the
quarter's plan, but the view itself does neither, so the sheet's groups choose
for themselves. Subseries rows exist too: group 1 can read them beside series
and universe.

There is no plan object to create, and this task adds none: a year's plan is
the `reading_plan` rows whose period falls in it (D-37). What's missing is a
way to fill a year or a quarter in one sitting, instead of one book at a time
from the master list. **Books only**: planning comics runs by period is
*Later* § L-8.

- **Where it starts.** `/books/plan` gains *Plan 2027…* in its header (any of
  2.3's five years) and *Plan this quarter…* on each quarter's summary row;
  2.10's *Suggest* opens it at the quarter with the most room. It is a sheet
  on the phone and the side rail from 1024px, so each placement is seen
  landing on the rail.
- **The budget stays in view.** The target's total against capacity, as 2.3's
  preview reads it (*533k of 760k*), updates after every placement. Over
  capacity it turns amber and offers 2.3's *Accept as a stretch year*; never
  red, and the word "behind" appears nowhere.
- **Suggestions, grouped by why.** Each group is a short list (five, then
  *More*); each row is the book's title, author with its universe and series
  (2.2j's line, D-134) and word count (estimated
  counts marked as in 2.2b), a reason line, and *Put in Q2* naming the target
  (for a year target, the bare year and the four quarter chips). A group with
  nothing in it is left out. In this order:
  1. **Next in a series you're reading:** `follow_next`'s row (2.2d) for each
     series and universe followed `reading` (*Next in Red Rising · you've
     read 3 of 6*).
  2. **Next on a shelf you're reading:** `follow_next`'s row for each shelf
     followed `reading` (2.2c; 5.1 builds the shelves UI).
  3. **From authors you're reading:** unread books by an author followed
     `reading`, earliest published first, `follow_next`'s first.
  4. **On deck:** already next in line (D-37).
  5. **Coming out in this period:** books whose `releases` date (5.7) falls in
     the target.
  6. **Recently added:** books added in the last 90 days. `books` records no
     date added: **stop and ask at plan time** (proposed `books.added_at
     timestamptz`, NULL for every row loaded before it, so the group starts
     empty and fills as books are added in the app).
  7. **Fits the room left:** to-read books whose word count fits the target's
     remaining room, largest first, so a quarter fills without tipping over.
  8. **A change of genre:** to-read books in a top-level genre you haven't
     read this year (`book_genre_tree` at depth 1, `books.genre` for a book
     with none, D-98).

  A book shows in the first group that lists it, never twice. Unlisted books
  appear in groups 1–3 with 1.22's *Unlisted* tag, because owning the next
  book of a series is the point; placing one writes `to_read` and its plan
  row in one transaction (1.21's promote). A book already in the plan shows
  its period and *Move here* instead. Read, reading and DNF books never
  appear, nor parked ones once 5.15 lands.
- **Derived, never stored** (hard rule 2): the suggestions are a query
  (proposed view `plan_suggestions(book_id, reason, detail, rank)` in
  `etl/views.sql`), run when the sheet opens, not cached. *Not now* hides a
  suggestion for this sitting only; whether a dismissal should outlast it (a
  table) is a plan-gate question, proposed no.
- **Every write is 2.3's.** *Put in Q2* goes through `placeInPlan`, joining
  the end of the quarter's order (D-37); a bare year takes no position. Each
  placement pushes an undo onto the 1.2 stack, its row reads *✓ In Q2 ·
  Undo*, and the sheet stays open for the next.
- No AI: the suggestions are rules over your own data.
- **Not drawn yet.** The mockup gains the planning sheet on `plan`, at
  phone, tablet and desktop widths, before it is built, and
  `design/mockups-index.md` lists it.

**Check:** with a fixture of a `reading` series with books 1–2 read and 3–4
`to_read`, a shelf followed `reading` whose first book is read, an author
followed `reading` with one unread book, an On deck book, an Unlisted book 3
of another `reading` series whose books 1–2 are read, an unfollowed series
with books 1–2 read and 3 `to_read`, and a DNF book, the sheet for 2027 Q2
lists book 3 and not book 4 under *Next in a series*, the shelf's second book
under *Next on a shelf*, the author's book, the On deck book, and the Unlisted
book tagged *Unlisted*; it lists the unfollowed series' book 3 under none of
the first three groups, never lists the DNF book, and no book twice. *Put in Q2* on
book 3 writes one `reading_plan` row at Q2's last ordinal, the budget line
shows the new total, and Undo removes the row. Placing the Unlisted book
writes its `to_read` status and its plan row in one transaction. With 100k of
room left, *Fits the room left* lists no book over 100k. Nothing on the sheet
resolves to `--danger`. Screenshots at 360px and 1280px.

### ☑ 3.4b Rank a book when you finish it, and every year's top ten · M
Owner intake, 2026-11-01 (owner: *a way to rank books for each year as I
finish them and then see my top 10 at the end of the year (and for past
years)*). D-101. Depends on 3.4 and 1.5; after 1.23, a listened book is ranked
like any read, with its glyph. 3.4 is pulled ahead of cutover by 1.25, and
this entry by the owner (D-139).

- **Every book of a year is ranked, not just ten** (D-101, amending D-3's cap).
  A year's ranks are contiguous from 1, like 1.10's queue (data model 2.16).
  The top ten is the first ten, read off the order, never stored apart.
- **A rank belongs to a read, not to a book.** A book read in 2024 and reread
  in 2026 can rank in both years, which one `book_status.year_rank` can't
  hold. Proposed: the rank moves to the read (`read_events.year_rank`, the
  year being the read's finish year), and `book_status.year_rank` is dropped,
  with a down file. **Stop and ask at plan time** (a column added, a column
  dropped, CLAUDE.md). 3.4's reorder writes the same column, so if 3.4 lands
  first this task moves its writes too.
- **Ranked at the finish.** Setting a book to *Read* (1.5) offers *Rank it in
  2026* beside the undo toast, and in 5.4's closing card once that exists. It
  opens a *This or that* placement against the year's ranked books: pick one
  of two, binary insertion, so a year of 34 books places a new one in at most
  6 picks. *Skip* leaves the read unranked, and the Top books screen lists
  it under *Not ranked yet* with the same control. The sorter is the one 9.4
  draws; whichever task is built first builds it as a shared component.
- **Every year, not only this one.** The Top books screen (mockup `top`) gains
  a year switcher over every year with a finished read. This year says *so
  far*. Each year shows its top ten, a divider, then every other book read
  that year: the rest of the ranks, then *Not ranked yet*. Nothing is
  collapsed, so the page is the year's whole list (D-122).
  The workbook's past ranks, kept in `seed/workbook_reads.csv` (product B4),
  load into the reads they belong to.
- **Books move** (2026-11-05 intake; owner: *can move books around*). Any
  book moves anywhere in its year with 1.10's reorder controls, across the
  divider too: a move past it changes what's in the top ten, the year's ranks
  stay contiguous, and it has an undo. Moving an unranked read in ranks it.
- **It replaces the Library's year chips** (2026-11-05 intake, D-122). When this
  lands, the Library's year chips and *No year* go, along with `listBooks`'s
  `year` filter. A read with no finish date keeps a home (R2-08): the year
  switcher ends with *No year*, listed and unranked. The Library's *Finished*
  sort stays.

**Check:** `npm test`: placing a new read into a year of six ranked
reads with scripted answers takes at most 3 picks and leaves ranks 1–7
contiguous, and its undo restores the six as they were; *Skip* writes no rank;
a book read in two years holds a rank in each; moving a book from rank 12 to
rank 3 leaves ranks contiguous and puts it in the top ten, and its undo restores
the order. In the browser (0.11), a past year lists its first ten, a divider,
then every other book read that year, with none collapsed; an unranked read
shows under *Not ranked yet*; a read with no date shows under *No year*; and the
Library renders no year chip. The up → down → up migration test passes.

### ☑ 3.5b The book sheet's own writes · M
*Split from 3.5 at TASK-079's plan gate (owner, 2026-11-16; PR #275).* The book
sheet (`/book/{id}`, D-157) shows your notes, what you own, where the book sits
in your plan and its shelves as text. This item makes each one editable there,
each one write with an Undo, through the routes that already exist:

- **Notes**: an editor in *Your record*, through TASK-074's
  `POST /api/progress/book/note` (a book with no status row is refused, as the
  route does today).
- **What you own** (5.17, D-121, D-132): the row menu's two toggles, *I own it on
  paper* and *I own the audiobook*, through `POST /api/books/owned`, as the
  Library's `⋯` does (TASK-093). The ebook stays Calibre's, never toggled.
- **Planned for** *Move* (the plan picker, 2.3) and **Shelves** *Edit*, from the
  mockup `bookdetail`; a sheet opened from the sheet replaces it (D-34).
- **The dashboards' book rows** (Now, On deck, the plan shelf, Top books) open the
  sheet, as the Library's and the status tabs' rows do since 3.5.

**Check:** test that saving a note from the sheet writes `book_status.notes`
once and its Undo puts the old note back; that each owned toggle writes or
deletes exactly one `owned_copies` row and its Undo reverses it; that opening
*Move* from the sheet leaves exactly one sheet in the DOM; and that a book row on
each books dashboard opens `/book/{id}` as a sheet.

### ☑ 4.4 Sync with Calibre, both ways: one command, by hand or weekly · M
Backlog intake, 2026-10-26 (owner: *Calibre link/import, recurring*). D-83.
Depends on 1.18 and 1.21, and only on cutover otherwise, so it can be pulled
ahead of 4.1–4.3. Extract stops at cutover and nothing local may write the
live database (`LEDGER_LIVE`, D-18), so 1.18's re-runnable command ends there.
This puts the same sync in the app.

- **Choose the file.** A *Sync from Calibre* screen (where it lives, under
  2.0's Settings or the books menu, is the plan's) takes `metadata.db` from the
  Calibre library folder. A Vercel function accepts at most 4.5 MB in a
  request and a library's `metadata.db` can be larger, so the proposal is that
  the browser reads the file (sql.js, WebAssembly) and sends only the fields
  1.18 reads: title, author, word count, series and index, ISBN, tags,
  comments, the read flag and date. The plan checks the limit, and whether a
  server-side read (`node:sqlite`) through Blob storage is simpler.
- **Matching is 1.18's**, in a TypeScript twin of `etl/calibre.py`'s, tested
  against the same fixtures, as `src/lib/issue-slug.ts` twins extract's ids
  (D-59, D-61).
- **A review, then writes.** One screen lists what the sync would do, each
  row accept or reject, and nothing is written until *Apply*: new books (to
  be created at Unlisted), word counts to fill (only where none is stored, never
  over a hand value), series and ISBN disagreements with Open Library, and new
  reads (D-73). A decided row is remembered, so the next sync doesn't ask
  again. Where that memory lives is the plan's to propose; a new table means
  stop and ask, and joins `src/db/export-tables.ts` (hard rule 7).
  *Amended 2026-10-27 (D-87):* Calibre is the source of truth for a book's
  data and reads, so the review is a preview of replacements, not a gate on
  each: a Calibre word count or series replaces the stored one, a book added
  in the app from Open Library (1.4c) takes Calibre's data once it is in
  Calibre, reads load as Calibre has them, and each replacement and Open
  Library disagreement is listed before *Apply*. A near spelling still waits
  for a merge or separate decision.
  *Amended 2026-10-28 (D-94):* read *Open Library* in this item as
  Hardcover: the ISBN and series disagreements are Hardcover's, and a book
  added in the app comes from Hardcover (1.4f).
  *Amended 2026-10-27 (D-90):* the sync also carries what 1.18b and 1.18c
  read (the superseries as a universe and its position, the subseries, page
  counts, genres) and matches on `books.calibre_id` before title and author.
  A book with no `calibre_id` is listed under a *Not in Calibre* filter,
  derived from the missing id, so the owner can add it to Calibre.
- The file is read and discarded: nothing stores `metadata.db`, and nothing
  writes to Calibre. Fetching it from Google Drive instead of an upload is
  *Later* § L-4.

*Rewritten 2026-11-08 (D-133), and pulled ahead of 1.26.* The owner wants
the sync two-way and automatic but light, so it is no longer an upload in the
app with a review before *Apply*. Where the text above disagrees, this wins;
the old Check is replaced.

- **One command, both ways.** `npm run calibre:sync` on the owner's PC reads a
  temp copy of `metadata.db` (`etl/calibre.py`'s reading, reused), sends what
  changed since the last sync to the app through a route inside the passcode
  gate (signed in with the passcode like a browser; `/api/health` stays the
  one open route), then takes back what the Ledger holds for each Calibre book
  and writes what differs into Calibre with `calibredb`. While the Calibre
  window is open it writes through Calibre's content server on localhost (an
  Owner checklist item turns it on), otherwise to the library folder. Any new
  key or setting goes in `.env.example` and `docs/SERVICES.md` in the same PR.
- **When.** A desktop shortcut runs it on demand, and a script registers a
  weekly Windows Task Scheduler run, which the owner runs once. Nothing else
  runs in the background.
- **Calibre → Ledger** (Calibre wins, D-87): new books at Unlisted (D-83); the
  title, author, series and index, subseries, universe, genres, tags, word
  count, ISBN and Calibre id of the books it has, matched on `calibre_id`
  first, then title and author (1.18's rules, twinned in TypeScript where the
  app applies them). A new book's page count follows D-130 (1.14c), from
  Hardcover through the app's client. A near spelling waits on the *Calibre*
  page for a merge or separate decision; where that decision is kept is the
  plan's. A book gone from Calibre stays a book, and is listed.
- **Ledger → Calibre:** `#read` (the book has a read), `#date_read` (the latest
  read's finish; how an `approximate` or `none` finish is written is the
  plan's), the Ledger's status in a new `#ledger_status` column, and 5.17's
  owned formats in a new `#owned` column. Not the start date. The owner
  creates the two columns; a missing one is named and skipped.
- **Reads, from the books cutover on: the Ledger wins.** A Calibre change to
  `#read` or `#date_read` since the last sync is overwritten with the Ledger's
  and listed. A book new to the Ledger takes Calibre's read as its first read,
  as 1.18 loads one. Before 1.26 extract still loads Calibre's reads (D-87),
  and the plan says what the write-back may touch until then.
- **The log.** Each run is kept by the app and listed on a *Calibre* page
  under Settings: when it ran, what came in, what went out, what waits. The
  books dashboard shows a plain line (*Calibre last synced 9 days ago*) once
  the last run is more than 7 days old; nothing red (hard rule 6).
- A new table (the log, a remembered decision) means stop and ask at plan
  time, and joins `src/db/export-tables.ts` (hard rule 7).
- **Never the owner's real library in a test.** Tests use a fixture library
  copied to a temp folder, and the test database.
- The same PR rewrites `.claude/rules/schema.md`'s *Calibre is the source of
  truth for a book's data and its reads* (which says nothing writes to
  Calibre) and data model 2.19 to match, and adds the command to
  `docs/COMMANDS.md`.

**Check:** with a
fixture library in a temp folder and the test database: four books, one
matching a Ledger book with a changed title and word count, one the Ledger
lacks and marked read, one whose `#date_read` was changed in Calibre after the
Ledger logged a different read, and one the Ledger has read and owns on paper.
One run creates one Unlisted book with one `read_events` row; renames the
matched book and replaces its `stated` word count; overwrites the changed
`#date_read` with the Ledger's and lists it; writes `#read`, `#date_read`,
`#ledger_status` and `#owned` for the book read in the Ledger; and is one log
entry listing each change. A second run changes nothing on either side and
logs that nothing changed. A missing `#owned` column is named and skipped. In
the browser (0.11), the *Calibre* page lists the run, and the dashboard's line
shows when the last run is 8 days old and not when it is 6.

### ☑ 4.5 Calibre's genres on every screen · M
*Pulled ahead of 1.26 by the owner (D-139).*

From 1.18c (TASK-033), 2026-10-30; D-98. **After 1.18c.** 1.18c loads every
Calibre genre into `book_genres` (one row per book and full dotted path,
`Young Adult.Fantasy.Romantasy`; 126 in the owner's library) and leaves
`books.genre` the workbook's single value, which is what the screens still
read: the master list's genre chips, its genre filter and the genre on each
row (`src/db/queries.ts` `listBooks`, `src/app/books/list/page.tsx`), and the
`books_by_year` view (`etl/views.sql`, read by `yearSummary`). Items not built
yet that read a book's genre should take `book_genres` from the start: 2.2b's
genre hue on the plan rail, 3.1's genre field, 3.5's book sheet and 6.2's
genre mix.

- Each reader takes a book's genres through the `book_genre_tree` view, which
  1.18c added: Calibre's genres cascade, so a book tagged `Fantasy.Epic
  Fantasy` alone is in `Fantasy` too. `books.genre` counts only for a book
  with no Calibre genre (D-98). How a dotted path is shown (its last segment
  or the whole path), which level a chip, a year total or a hue groups by, and
  how 43 top-level genres map onto the eight identity hues are asked at the
  plan gate.
- Then drop `books.genre` (extract, the loaders, `etl/test_views.sql`'s
  catalog list) with `drizzle/down/<tag>.sql` and an up → down → up test. An
  index on `book_genres(genre)` comes with the first query that filters by it.

**Check:** with one book given `book_genres` rows `Fantasy.Epic Fantasy` and
`Young Adult.Fantasy.Romantasy` and another with none and `books.genre` `Sci-Fi`,
the master list's genre filter finds the first under `Fantasy`, `Fantasy.Epic
Fantasy` and `Young Adult` and the second under `Sci-Fi`, and `books_by_year`
counts each; after the drop
migration no query, view or loader names `books.genre`, and up → down → up keeps
every `book_genres` row.

### ☑ 4.5b On deck by genre · S
*Pulled ahead of 1.26 by the owner (D-139).*

Owner intake, 2026-11-05 (owner: *filter on deck by genre, ie rank next up by
genre*; asked, the owner chose filtering and grouping, not a stored ranking).
D-124. Depends on 4.5 and 1.9.

- **Chips and sections.** Status → *Up next*'s On deck group gains a chip per
  top-level genre that has an On deck book, and sections by top-level genre
  (`book_genre_tree` at depth 1, `books.genre` for a book with none, D-98). The
  chip is in the URL. A book in two top-level genres is in both sections and
  counts once on the tab.
- **Nothing is stored.** On deck stays unordered (D-37); inside a section,
  books run by series, then title.
- **The Library's genre chips keep the filter.** They drop `status` and `level`
  today, so *To read · On deck* then *Fantasy* loses On deck. A genre chip keeps
  both.

**Check:** with On deck books in `Fantasy.Epic Fantasy` and `Sci-Fi`, and one in
both, Status → *Up next* renders a *Fantasy* and a *Sci-Fi* section, the book in
both is in each, and the tab counts it once; the *Fantasy* chip leaves only
*Fantasy*, survives a reload and writes nothing. In the Library, *To read · On
deck* then a genre chip lists only that genre's On deck books. Screenshots at 360px and 1280px.

### ☑ 4.6 Decide a waiting Calibre near spelling on the Calibre page · S
*From task 4.4 part 3 (TASK-083, PR #270). The Check is a proposal: agreed when merged, or edit it first.*
The *Calibre* page lists what a sync holds (a near spelling, or two Calibre
books on one Ledger book) but nothing in the app decides one.
`decideCalibrePair` (`src/db/writes.ts`, 4.4) stores a *merge* or *separate* per
Calibre book in `calibre_decisions`, and the next sync applies it (D-89, D-133).

- **A button for each answer** on each waiting entry of the newest run: an API
  route inside the gate around `decideCalibrePair`, and a client component with
  a real button each, named for its book (*Merge "Piranesi!" into Piranesi*,
  *Keep "Piranesi!" separate*), 44px on the phone. Neither is red: a merge
  renames (D-87) and is undone by deciding again.
- **An entry stops waiting once decided.** Derived from `calibre_decisions`,
  never stored on the log. A decided entry reads *Merged* or *Kept separate*
  and keeps its buttons, so the answer can be changed before the next sync.
- No new table: `calibre_decisions` exists (4.4).
- *Noted with it (task 4.4 part 3, TASK-083, PR #270):* the sync's report doesn't
  record whether a book it created brought a new author with it, so the page
  can't flag a stray new spelling (a Calibre author spelled a new way creates a
  new author: the app keeps no author merges) without guessing. The route would
  record a `newAuthor` flag on each `created` entry and the page would mark it.
  Its own Check, when it is done: a created book whose author the Ledger lacked
  carries the flag and the page marks it; one with a known author doesn't.

**Check:** with the test database, a run whose report has one waiting near
spelling and the Ledger book it is near: *Merge* writes one `calibre_decisions`
row, `merge`, with that book's id; *Separate* writes `separate` with none; a
second press changes nothing; the next sync (`POST /api/calibre/sync`) renames
the book or creates a new one to match, and logs it. In the browser the entry
reads *Merged* or *Kept separate* after the press, each button is named for its
book and 44px at 360px, and axe reports no violation.

- ☑ 5.1 Shelves (books only): create, add items, reorder · M. **+ Add to
  shelf** opens the 1.4c sheet with the shelf preselected: search your library
  and Open Library (Hardcover after 1.4f, D-94), or add by hand. A book not yet in the catalog is created
  first, then shelved. Each shelf shows its **next three unread** in shelf
  order, not just the next one (design §14 → Shelves). Pulled ahead of 1.26
  by the owner (D-139), whole: the Dark Tower's reading order is a shelf
  before `Books.xlsx` freezes (`docs/cutover-parity.md`).
  - **Context on a shelf** (2026-10-20 intake: *a context field, why a book is
    on it, like the Dark Tower reading order*). Proposed: `shelves.description`
    and `shelf_books.note`, and `shelf_titles.note` in 8.6. **Stop and ask**
    before adding them. The shelf page shows its description under its name,
    and each book's note under its row (*After Wizard and Glass: sets up the
    Wolves*), edited in place with 3.1's pattern. A shelf's order makes it a
    reading order across series and authors, the Dark Tower with its tie-ins,
    and a part-read shelf counts as *in the middle of* (5.12).
  - **Check (the context part):** a note saves, survives a reload and renders
    under its row; a shelf with no description renders no empty line; a note
    on one shelf does not appear on another shelf holding the same book.
  - **A new shelf from the add sheet** (2026-10-26 intake: *create a new
    shelf; right now I can only add to an existing one*). 1.4c's *Shelf…*
    picker ends with *New shelf…*: a name field, then the book goes on the new
    shelf in the same write, and one Undo removes both. A name already in use
    is refused, with the reason under the field. This part is small enough to
    pull ahead of the rest of 5.1 if the owner asks.
  - **Check (the new-shelf part):** *New shelf…* with a new name writes one
    `shelves` row and one `shelf_books` row; Undo leaves neither; a name
    already in use writes nothing and says why.
- ☐ 5.10 **Editions: collected and read** · M. Coverage check, 2026-10-08;
  product § The owner's list's *Master* row. Depends on 5.6. The workbook's Master tab (178
  trades and omnibuses) was loaded as `editions`, with per-user
  `edition_progress(collected, read)`, and has had no page since; after cutover,
  buying a trade could not be recorded. `/comics/editions`: each edition's
  title, type, year and issue text, with **Collected** and **Read** toggles
  (`aria-pressed`) writing `edition_progress`, and a *Collected* filter. An
  edition whose `issues_text` 5.6 could not parse is listed with a grey
  *issues not parsed* flag. **Add edition** is by hand (no API covers
  editions), matching your own editions first, with the issue text going
  through 5.6's parser. An edition's *Read* never marks an issue read: issue
  reads are per placement (`.claude/rules/schema.md`), and nothing propagates. 3.5's issue sheet
  links its collecting editions here. This is what turns on 2.6's *editions
  owned* frontier tile and 2.4's owned-edition tag.
  - **Collected in, on the run page** (2026-10-20 intake: *collected in:
    omnibus or TPB?*). The run page gains a *Collected in* group: each edition
    whose `edition_issues` cover any of the run's placements, with its type
    (`editions.book_type`: *Omnibus*, *Trade Paperback*, *Epic Collection*),
    how much of this run it covers (*#1–24 of 60*, derived in a view), and
    *Collected*. A stretch no edition covers reads *#25–60 not in an edition
    you've listed*. Editions you have never listed are not discovered here
    (Later § L-3).
  - **Check:** toggling *Collected* writes one `edition_progress` row for the
    user and survives a reload; toggling *Read* writes no `issue_progress` row.
    The frontier's owned-editions tile counts an edition only when it is
    collected and its `edition_issues` cover a ready run, and is hidden while
    no `edition_issues` rows exist. An unparsed edition is listed with the flag.
    Adding an edition by hand creates one `editions` row and its
    `edition_issues` through 5.6's parser. A run whose #1–24 one collected
    omnibus covers shows it under *Collected in* as *#1–24 of 60*, and the
    uncovered stretch as *#25–60*.

- ☑ 5.1b **Take a book off a shelf** · M. *From TASK-119 (3.5b, part 2):*
  the book sheet's *Shelves Edit* needs to take a book off a shelf, and no
  write does that today: 5.1 built create, add, reorder, a note and a
  description (`src/db/writes.ts`), never removal (owner, 2026-11-18). Depends
  on 5.1.
  - **The write.** Taking a book off a shelf deletes its `shelf_books` row and
    closes the gap, so the shelf's ordinals stay contiguous from 1, as
    `moveOnShelf` keeps them. Its undo puts the row back at its old place with
    its note, and refuses, changing nothing, once the shelf's order has moved
    since (as `undoShelfMove` does). The book itself, its status, its plan and
    its place on any other shelf are untouched. `shelf_books` has no
    `deleted_at`: like `owned_copies` and a plan row, a shelf placement is the
    owner's opinion, not a catalog row, so removing it deletes the row (the
    plan gate confirms this against Hard rule 4; a new column is a stop-and-ask).
  - **Where.** `PATCH /api/shelves/{id}` (or a `DELETE` with the book, chosen
    at the plan gate), and the shelf page's `⋯` *Remove from shelf* beside
    *Move to top · Move up · Move down* (`ReorderList` already offers the
    caller's *Remove*), with an Undo toast. 3.5b's *Shelves Edit* (TASK-119)
    uses the same write.
  - **Not drawn yet.** The mockup's `shelves` frame gains the `⋯`'s *Remove
    from shelf* and its toast before it is built.
  - **Check:** (proposed; the owner agrees it by merging or edits it first)
    on the test database, taking the third of five books off a shelf deletes
    its one `shelf_books` row and leaves the shelf's ordinals 1–4 contiguous;
    its Undo puts the row back at 3 with its note and the others back where
    they were; the book, its status, its plan and its place on another shelf
    are unchanged throughout; an Undo after the shelf has been reordered since
    answers 409 and changes nothing. In the browser (0.11), the shelf page's
    `⋯` *Remove from shelf* takes it off with an Undo toast; axe passes;
    screenshots at 360px and 1280px.

- ☑ 5.5 DNF with a reason field · S. DNF opens the same closing card as 5.4
  with a reason field instead of a rating; DNF stays grey (UX-N13).
  *Pulled ahead of 1.26 by the owner (D-139), without 5.4:* 5.5 builds the
  closing card for a book, and 5.4 reuses it for a run's rating and note.
  The reason is the book's note, `book_status.notes`, written through 3.4's
  note write: no new column (owner, 2026-11-15).
  **Check:** setting a book to DNF opens the closing card with a reason field
  and *Skip*; a typed reason saves, survives a reload and shows under the
  book's *Stopped* row on Done; *Skip* leaves the DNF with no reason; Undo of
  the DNF restores the prior status and the prior reason; nothing on the card
  or the row resolves to `--ready` or `--danger`.

- ☑ 5.7 **Books coming out** · M. D-35; product B1, B5; Review N UX-N26.
  Depends on 1.4c and 1.8. `/books/releases`: the books you want when they
  come out, read from the `releases` table (`book_id`, `release_date`; the
  workbook's *Coming Out* tab, 44 rows on the 2026-09-23 extract) that only the
  v1 home page ever showed, and that page goes when 1.8c makes `/` a redirect.
  - **What counts as wanted, with no new column:** a `releases` row whose book
    has no `book_status` row for you. **Got it** writes `book_status = to_read`
    (the book moves to Someday and off this one) and raises the undo
    toast. If the owner wants a separate per-user *want* row instead, that is a
    schema change: ask before building (CLAUDE.md).
  - **The list:** *Out now* first (a release date on or before today, not yet
    got), then one group per month, then *No date yet*. Each row: cover, title,
    author, series position, the date in mono, and **Got it**. The month
    grouping is the calendar view product B5 asked for; a month grid is not
    built.
  - **Adding:** 1.4c's add sheet gains a *Coming out* destination with a
    release-date field (a date, or *no date yet*). The book row is created or
    reused as usual, then the `releases` row.
  - **Notify me is in the app, not a push:** the books dashboard's rollup slot
    gains a line, *2 out now · 3 coming this month →*, linking here, so the
    five slots keep their order. The digest email stays 7.6.
  - The sidebar and navigation rail gain *Coming out* under Books (flip its
    `NAV_ITEMS` flag, R1-06); add `/books/releases` to the architecture's route
    table. The mockup gains a `releases` screen, phone, tablet and desktop, with
    its empty state (*Nothing coming out · Add a book*).
  - **Check:** a released-yesterday book with no status renders under *Out now*;
    one due next month under that month; *Got it* writes one `to_read` row and
    removes the row from the list, and Undo restores it; a book already `read`
    never appears. The dashboard line's counts equal the list's. Screenshot at
    360px, 834px and 1280px.

- ☑ 5.9 **Series page from `series_progress`** · M. Coverage check,
  2026-10-08; product B6 (the workbook's Series tab). The view has existed
  since the first load and nothing shows it. `/books/series`: every series
  with its author, `books_read / total_books` in mono and an `.emeter` filled
  with `--ready`, in progress first, then not started, then complete. Each row
  names the **next unread** book, the lowest `series_position` not read
  (derived in the query, never stored), and links to `/books/list?series=<id>`
  (this task adds that filter if the list lacks it). A series whose read count
  exceeds a stated `total_books` (the R2 `pct > 1` case) draws a full meter and
  the true counts. The sidebar and navigation rail gain *Series* under Books
  (flip its `NAV_ITEMS` flag, as 5.7); the mockup gains the screen with its
  empty state (*No series yet · Add a book*).
  - **Every series is a link, to a page of its own** (2026-10-20 intake:
    *series are clickable*; this makes 5.9 an M). Each row links to
    `/books/series/[id]`, not to the list filter. The page lists the series'
    books in `series_position` order, each with its status and dates, and
    marks the next unread. A position between 1 and `total_books` with no book
    in the catalog is a grey gap row (*#4 not in your library · Add*), which
    opens 1.4c with the series named. Wherever the app prints a series name (a
    list row, 3.5's sheet, the books dashboard) it links here. 5.11 adds the
    follow control to this page.
  - **Check:** a series with 3 of 5 books read renders `3 / 5` and a meter
    filled with `--ready`; one with NULL `total_books` counts its listed books;
    a soft-deleted book is not counted; the next-unread line names the
    lowest-position unread book, and a complete series has none. The row's link
    shows only that series' books. A series holding positions 1, 2 and 4 of 4
    renders a gap row for #3, and a series name in a list row links to its
    page. Screenshot at 360px, 834px and 1280px.

- ☑ 5.11 **Author and universe pages, and the follow control** · M. Follow-up
  from PR #58 (1.15's *Not here*); D-42, D-43; product B6. Depends on 1.15
  and 5.9. 1.15 adds `author_progress`, `universe_progress` and the three
  follow tables, and 5.9 draws series. This task draws an author page and a
  universe page in 5.9's shape: `read / total` in mono, an `.emeter` filled
  with `--ready`, and the next unread book (derived in the query, never
  stored). It also adds the control that sets a follow's state on all three
  kinds of page: *Tracking · Reading · Not following*, a `role="radiogroup"`
  writing `series_follows`, `author_follows` or `universe_follows` for the
  user. *Reading* stays set until it is changed (D-43). Done is never stored.
  *Amended by the second 2026-11-02 intake (D-108):* 2.2c builds the control
  and its writes (shelves included); this task places it on the author and
  universe pages, and 5.9 on the series page, and builds no control of its
  own.
  *From TASK-023 (1.15, PR #134):* nothing
  sets a book's `universe_id` after the load, and Grishaverse loads with no
  member books (the books its Series-tab group lists are reads, which D-41
  never loads), so its page would show 0/0 until a book can be put in a
  universe; settle where that happens at this task's plan gate. The first
  vitest suite that writes `book_universes` adds it to `truncateAll` in
  `test/db.ts`, which today clears it only through `books`' CASCADE.
  - **Check:** an author page and a universe page list their books with the
    counts from their views. Setting *Reading* writes one follow row for the
    user, survives a reload, and shows in the view's `follow_state`. *Not
    following* deletes the row. No count or state column is added.

- ☑ 5.12 **In the middle of, and completed: one page for every medium** · M.
  Backlog intake, 2026-10-20 (owner: *series, authors and tracks I'm in the
  middle of*, where "tracks" means both universes and ordered shelves);
  rewritten by the second 2026-11-02 intake (owner: *a page to see all the
  things I'm in the middle of, and have completed*; asked, the owner chose
  every medium). D-109, D-108. Depends on 1.9, 1.15, 2.2c and 2.2d; watch,
  music and games join in their own phases (8.8, 9.6, 10.3).
  - **One page, `/progress`, two tabs: *In the middle of · Completed***, in
    the global part of the nav beside Inbox, with a chip per medium (*All ·
    Books · Comics*, and *Watch*, *Music* and *Games* once they exist). It
    replaces this entry's old plan of a group on 1.9's books *In flight*
    tab: In flight keeps the books and runs in hand, and this page holds the
    bigger things they belong to.
  - **What counts is derived, never stored** (hard rule 2), and for books it
    follows D-108: only a *Reading* follow puts something in the middle.
    - **Books, In the middle of:** each series, universe, author and shelf
      followed `reading` with an unread live book, from `series_progress`,
      `universe_progress`, `author_progress` and 2.2c's `shelf_progress`.
      Having read one book of something you don't follow never lists it.
    - **Books, On hold** (2026-11-05 intake, D-118): a collapsed group under
      them, with its count: everything followed `tracking` with at least one
      read and one unread, labelled as 2.2h's control labels it. It is
      *In the middle of* without being on the go, so nothing here reaches
      `follow_next`.
    - **Books, Completed:** each series, universe and shelf with two or more
      live books, every one read (a standalone isn't a series), and each
      followed author with every listed book read. A follow isn't needed:
      completing something is a fact.
    - **Comics, In the middle of:** runs partly read (1.9's In flight rows)
      and tracks partly read (`track_progress`). **Completed:** runs and
      tracks fully read.
    - **Watch, music, games** add their own rows at 8.8, 9.6 and 10.3:
      shows and franchises, followed artists, games played through. Each
      phase's plan gate names its rows; this page draws them.
  - **Each row**: the medium's glyph, the kind (*series*, *universe*,
    *author*, *shelf*, *run*, *track*), the name, `read / total` in mono, an
    `.emeter` filled with `--ready`, and on *In the middle of* the next thing
    named (2.2d's `follow_next` for books, 1.6's resume pointer for a run).
    *In the middle of* is most recently touched first; *Completed* is most
    recently finished first, with the finish's month (*finished Mar 2026*).
    A row opens its page where one exists (5.9, 5.11, 5.2, the run).
  - **Rows nest** (2026-11-05 intake, D-119): a series under a universe on
    the page sits indented beneath it, and a subseries beneath its series, as
    2.2g's rows do in Now. A row whose parent isn't listed stands on its own.
  - The books and comics dashboards' rollups link here. Empty states are
    calm: *Nothing in the middle. Follow a series as Reading to see it here*
    with *Open the Library* (2.2e).
  - **Not drawn yet.** The mockup gains `/progress` at phone, tablet and
    desktop widths before it is built, and `design/mockups-index.md` lists
    it.
  - **Check:** a series followed `reading` with 2 of 5 read is under *In the
    middle of* and the same series unfollowed is not; a series with 5 of 5
    read is under *Completed* whether followed or not, and a one-book
    series read is not; an author appears only when followed; a shelf
    followed `reading` with 1 of 3 read appears; a run with 3 of 10 read is
    under *In the middle of*, and with 10 of 10 under *Completed*; the
    *Books* chip hides the run; nothing is written; each row's counts equal
    its view's. A series followed `tracking` with 2 of 5 read is under *On
    hold* and not above it, and at 0 of 5 it is on neither; a series under a
    listed universe nests beneath it. Screenshots at 360px and 1280px.

- ☑ 5.14 **Audiobooks: a queue to listen next** · M. Owner intake, 2026-11-01
  (owner: *audio books has a tracking system: what I'm reading, a queue for
  up next, what I've read*). Depends on 1.23 and 1.9. 1.23 builds two of the
  three: *Listening* is its own group on In flight, and a finished listen is
  a read with `format = audio` and the headphones glyph. What's missing is
  the order you mean to listen in. Nothing here is needed at cutover, but the
  owner pulled it ahead of 1.26 (D-139).
  - **The queue is an order, so it is stored**: proposed
    `listen_queue(book_id PRIMARY KEY, position)`, contiguous from 1, like
    1.10's `run_queue` (data model 2.16), no `user_id` (D-91), in
    `src/db/export-tables.ts`. **Stop and ask at plan time** (a new table).
    Not chosen: a format on `reading_plan` rows, because the plan is periods
    and a word budget, and a listen queue is only an order.
  - *Queue to listen* on the book sheet, the master-list row and the add
    sheet (1.4c), and *Move to…* to reorder (1.10's controls). Setting a
    queued book to *Listening* takes it off the queue and closes the gap;
    Undo puts it back where it was.
  - **The three states on the status screens.** Up next gains *Listen next*,
    in queue order, after the reading plan's levels. In flight already has
    *Listening*. Done gains a *Listened* chip that keeps only books with an
    audio read.
  - **For the plan gate:** whether a book can be on the reading plan and the
    listen queue at once (proposed: yes, they answer different questions);
    whether the books dashboard's *Up next* slot shows the first queued
    listen.
  - **Check (proposed):** `npm test`: queueing three books gives positions
    1–3; setting #2 to *Listening* leaves the other two at 1–2, and its undo
    restores all three in order. In the browser (0.11), Up next lists *Listen
    next* in queue order; Done's *Listened* chip lists only books with an
    audio read; each tab's count equals its rows. The export test passes with
    `listen_queue`.

- ☑ 5.15 **Parked: put a book away on purpose, and review it on a schedule**
  · M. Owner intake, 2026-11-02 (owner: *an on-hold type status for all media
  types: I put an item in it and it doesn't show up in my currently consuming
  feed or in my plan; once a month or quarter I get a notification or email to
  review these items and keep them, move them to the plan or queue, or remove
  them to unlisted*). D-105. Depends on 1.9, 1.17, 1.21, 2.2 (the dashboard
  line) and 2.3 (the review's *Plan…* is the picker). Pulled ahead of 1.26 by
  the owner (D-139). This entry builds Parked
  for books, the review every medium shares, and its reminder. Comics runs are
  5.16; watch, music and games take it in their own phases (8.8, 9.3, 10.1).
  - **What it means:** *not now, but not gone.* It is not Someday (on your
    list, not planned), not Unlisted (in your library, not on your list), not
    DNF (stopped), and not watch's derived *Paused* (untouched for four weeks).
  - **Stored as a status.** Proposed: a `parked` value of
    `book_status.status`, beside 1.21's `unlisted` (no CHECK, no migration),
    added to `SETTABLE_STATUSES`. *Park* sits on the status control, the book
    sheet and the master-list row, for a book that is `to_read`, `reading` or
    `listening` (1.23). **Stop and ask at plan time** (a new status meaning
    and a column): the date it was parked, proposed `book_status.parked_on
    date`, written by `saveBookStatus` on entering `parked` and cleared on
    leaving it. Whether it was parked mid-read is derived: a `started_on`
    (1.17) with no finish since.
  - **Out of the way.** Parking takes the book out of its plan through 1.7's
    helpers (its quarter closes up) and off 5.14's listen queue, in one
    transaction with the status; Undo restores the status, the period and the
    exact position. `to_read_level` reads only `to_read`, so a parked book is
    on no plan rail, capacity sum, dashboard slot or status-screen tab, and in
    none of 2.10b's suggestions; the progress views count it unread, as they
    count Unlisted. Search finds it tagged *Parked* (1.22), and the master
    list gains a *Parked · N* chip.
  - **The review.** `/parked` lists every parked item, books first, then each
    medium's as it lands, oldest parked first, each with *Parked 4 months*.
    Each book row has three verbs, each one write with Undo: **Keep parked**;
    **Plan…** (2.3's picker: a quarter, a year, On deck or Someday), or for a
    book parked mid-read **Pick it back up** (back to `reading`); and
    **Unlisted**. *Done reviewing* records the review, whatever is left
    parked.
  - **When it is due.** A Settings row (2.0), *Review parked items: monthly ·
    quarterly · never*, default quarterly. The review is due when something is
    parked and the last review is older than the cadence. Proposed:
    `reading_settings.parked_review` (with a CHECK) and
    `reading_settings.parked_reviewed_on date`. **Stop and ask at plan time**
    (two columns).
  - **The reminder is in the app** (owner, 2026-11-02). When the review is
    due, the books dashboard's rollup slot (2.2) gains a grey line, *Review 9
    parked →*, with no nudge copy, and the Inbox lists one *Parked review* row
    at its top until it is done. No push notification. The email is 7.6's,
    which carries the same line when it lands.
  - **Not drawn yet.** The mockup gains `/parked`, the *Park* verb on the
    status control and the dashboard line, at phone, tablet and desktop
    widths, before they are built; `design/mockups-index.md` lists them.
  - **Check (proposed):** `npm test`: parking the 2nd of 3 books in 2027 Q1
    writes `parked`, removes its plan row and leaves Q1 at ordinals 1–2, and
    Undo restores `to_read` at position 2. A parked book is absent from
    `to_read_level`, `plan_period`, the three status-screen tabs and 2.10b's
    suggestions, and present under the master list's *Parked* chip and in
    search tagged *Parked*; a series with one read and one parked book reads
    `1 / 2`. With a monthly cadence, one parked book and a last review 40 days
    ago, the review is due; with nothing parked it is not; *Done reviewing*
    makes it not due. In the browser (0.11), the review's *Plan…* opens 2.3's
    picker, *Unlisted* writes `unlisted` and Undo puts back `parked`, and the
    dashboard line shows only when the review is due. Nothing on the
    dashboard or the review resolves to `--danger`.

- ☑ 5.17 **What you own: physical copies and audiobooks** · M. Owner intake,
  2026-11-05 (owner: *clarify physically owned vs ebook library so I can track
  books I physically own*; asked, the owner chose a per-book toggle, with the
  ownership type in the book's details and a way to view the physical library).
  D-121. Depends on 2.2e, 1.4 and 1.21; 3.5 for the sheet.
  - **Stored as a fact about your copy.** Proposed: `physical_copies(book_id
    PRIMARY KEY → books.id)`, a row meaning you own one, no `user_id` (D-91), in
    `src/db/export-tables.ts`. **Stop and ask at plan time** (a new table). The
    ebook side is derived from `books.calibre_id` (D-90), never stored (hard rule
    2). Formats are not recorded: paperback or hardcover doesn't change anything
    the app does.
  - **The toggle.** *I own a physical copy* in the book's row menu in the
    Library, and on 3.5's sheet. One write with an undo.
  - **In the details.** 3.5's sheet says what you own: *Physical*, *Ebook*,
    *Physical · Ebook*, or nothing. Until 3.5, the Library row's grey sub-line
    says *Physical* for a book with a copy.
  - **The physical library is a filter.** The Library gains an *Owned* filter,
    *Physical · Ebook*, in the URL, combining with every other filter and sort
    (D-110). `/books/list?owned=physical` is the screen, reached by a chip.
  - **Marking many.** *Paste a list* gains a *Physical copy* destination: a
    matched book gets its row, and a new one is created at Unlisted (1.21) with
    its row; one Undo removes what the paste added.
  - It doesn't touch the plan, capacity or status. Comics already have 5.10's
    *Collected*, which stays separate.
  - **Not drawn yet.** The mockup's `blist`, `add` and sheet frames gain these
    before they are built.
  - *Amended 2026-11-08 (D-132), and pulled ahead of 1.26:* audiobooks you
    own are recorded too, and the bullets above read for both formats.
    Proposed: `owned_copies(book_id → books.id, format)`, primary key both,
    `format IN ('physical', 'audio')`, no `user_id`, in
    `src/db/export-tables.ts`, replacing `physical_copies`. **Stop and ask at
    plan time** (a new table). A book can have neither, either or both,
    whatever its status: owning an audiobook is not listening to it (1.23).
    The row menu has two toggles, *I own it on paper* and *I own the
    audiobook*; the sub-line and the sheet say *Physical*, *Audiobook* and
    *Ebook* as they apply; the *Owned* filter is *Physical · Audiobook · Ebook
    · Not owned* (none of the three); *Paste a list* gains a destination for
    each format. 4.4 writes the formats to Calibre's `#owned` column.
  - **Check:** (proposed; the owner agrees it by merging or edits it first)
    each toggle writes one `owned_copies` row with its format, Undo removes
    it, and the export test passes with the table. *Physical* lists only books
    with a `physical` row, *Audiobook* only books with an `audio` row, *Ebook*
    only books with a `calibre_id`, and *Not owned* only books with none of
    the three; a book with several is in each; a soft-deleted book is in none;
    each combines with a status filter and a sort, and the choice survives a
    reload. Pasting three lines to *Physical copy*, two matched and one new,
    writes three rows and one `unlisted` book, and Undo removes all of it.
    Screenshots at 360px and 1280px.

- ☑ 5.17b **Own it from Search and By hand** · S. *From TASK-094 (5.17,
  PR #268):* the owner chose, at its plan gate, to give *Physical copy* and
  *Audiobook* to *Paste a list* only and to bring them to the other two add
  modes here. Depends on 5.17.
  - **The destinations.** *Add to* keeps the two chips in *Search* and *By
    hand* instead of going back to Someday (`switchTo` in
    `src/components/AddBooks.tsx`). A library result gets its `owned_copies`
    row, whatever its status. A Hardcover result or a typed book that the
    library lacks is created at Unlisted (D-152) with its row. Each result's
    button says *Add to Physical copy*. `addBook` stops throwing on the owned
    destination and goes through `writeDestination`'s owned branch.
    `POST /api/books` accepts it (`parseDestination`'s `{ owned }`), and the
    undo is `undoOwned`, as the paste's is.
  - **The paste check knows what you own.** `bookMatches` (the dry run) says
    which formats a matched book already has, so the review says *Already
    owned on paper* and *Add N books* counts only the rows it will write.
    Today a paste to *Physical copy* counts a book that already has the row,
    and the toast then counts fewer (spec review, PR #268).
  - **While there.** `undoInside` (Someday, On deck, a year or quarter, a
    shelf) refuses a book it created that 4.4's sync has linked since
    (`calibre_id` set), as `undoOwned` does. Removing the book would make the
    sync skip it for good (schema review, PR #268).
  - **Not drawn yet.** The mockup's `add` frame gains a result row's *Add to
    Physical copy* before it is built.
  - **Check:** (proposed; the owner agrees it by merging or edits it first)
    with *Physical copy* chosen, Search's *Add to Physical copy* on a library
    book with a status writes one `physical` row and changes no status. On a
    Hardcover result, and on a typed book the library lacks, it creates one
    `unlisted` book with its row. Undo removes exactly what each add wrote,
    and leaves a row the book had before. A paste whose matched book already
    has the row counts it as already owned. Undoing an add to Someday whose
    created book has since gained a `calibre_id` answers 409 and changes
    nothing. Screenshots at 360px and 1280px.

- ☐ 6.21 **Redesign where the book sits, with Claude Design** · M. Owner
  intake, 2026-11-05 (owner: *stacked meters in Now with a subsequent future
  task to redesign it with Claude Design*). D-119. Depends on 2.2g and 5.12.
  2.2g's rows are a working version. This takes them to the design tool with
  real data in place: how universe, author, series and subseries read in Now, on
  the tablet and desktop heroes, and in 5.12's nested rows, including a long
  universe, a book on three levels and a book on none. The result lands as
  `design/*.dc.html` from the design tool, which is what may change those files,
  and the mockup, then the build follows it.
  *From 6.23 (2026-11-18):* the mediums review's part E asks for these frames
  (`docs/design-briefs/2026-11-mediums-review.md`, `bdash`). If the owner picks one
  there, this entry starts from that drawing.
  **Check:** (proposed; the owner agrees it by merging or edits it first) the
  design tool's frames cover phone, tablet and desktop, light and dark, the owner
  picks one, and Now and `/progress` match it; 2.2g's own Check still passes with
  its row and order assertions rewritten to the chosen drawing.

- ☐ 5.8 **Comic issues coming out, for the runs you follow** · M. D-35 (this
  reverses the product doc's *Not building: upcoming-issue tracking*). Depends on 1.3b,
  1.3c and 5.7 (the screen pattern). `/comics/releases`: new issues in a series
  you follow, offered for adding to a run. **Nothing reaches `issues` or
  `run_issues` without your explicit accept** (CLAUDE.md: Metron-proposed
  labels pass the bulk-entry parser and an accept, like AI labels).
  - **Settle the schema with the owner first** (CLAUDE.md, stop and ask). It
    needs a per-user follow — which Metron series, and the run new issues go
    to (proposed: `series_follows(user_id, metron_series_id, series_label,
    run_id)`) — and somewhere to hold what Metron reported before you accept
    it, which is not `issues` (proposed: a cache table keyed by Metron issue id,
    with the label, store date and cover, plus a per-user dismissal). Every new
    table goes into `GET /api/export` (standing rule 7).
  - **Following:** the run hero's `⋯` menu offers *Follow new issues of X-Men
    (2019)* for the series of the run's last placement; `/comics/releases`
    lists what you follow, each with *Unfollow*.
  - **Checking is a search you start, never a page render** (`.claude/rules/ui.md`: the one
    live path is an add flow). The screen renders from the cache with *Checked
    3 days ago · Check now*; *Check now* asks Metron for each followed series'
    issues with a store date from 30 days ago onward, through 1.3b's
    server-side client, rate limit, cache and rate-limited state. A daily cron
    is a later option, alongside 7.6, not this task.
  - **The list:** *Out now*, *This month*, *Later*. Each row: cover, the label in
    the bulk-entry grammar, the store date, the run it would join, and **Add to
    Claremont — Uncanny X-Men**, which opens 1.3b's staged review with the
    issue appended after the run's last placement (change the run or the
    position there). *Not for me* dismisses it for you. An issue already placed
    in that run never appears.
  - The comics dashboard's rollup slot gains *2 new issues out →*; the sidebar
    and rail gain *Coming out* under Comics; add `/comics/releases` to
    the route table (architecture § Routes and data access); the mockup gains the screen and its empty state
    (*Follow a series from a run's ⋯ menu*).
  - **Check:** with a recorded Metron fixture, *Check now* for one followed
    series stores its three upcoming issues and writes nothing to `issues`;
    accepting one through the review creates exactly one `issues` row (with
    `metron_id`) and one placement at the end of the followed run, and it leaves
    the list; *Not for me* hides an issue for that user only; no page render
    calls Metron (the mocked client counts calls). A mocked 429 renders the
    rate-limited line and makes no second request before `Retry-After`.

### ☐ 3.3 Prereq editor · M
Add and remove edges, hard or soft, with **cycle detection**. After cutover this
is the only thing that keeps the graph acyclic (2.11a's loader check no longer
runs), so it rejects any edge, hard or soft, that would close a cycle of any
length: the same invariant as 2.11a, "no strongly connected component larger
than one". The message names the runs in the cycle it would create.

**What the editor looks like** (UX-N14): editing an existing run's prerequisites
is search to add, a hard/soft segmented control per edge, and *Remove*. A
rejected edge shows *Adding Claremont — X-Men would create a loop* with the loop
drawn as a short path (the `path` component: *X-Men → Excalibur → X-Men*).
`--danger` marks only the rejected control and its message; nothing was written.
The mockup's `newrun` gains an edit-mode frame and a cycle-error frame.

**Check:** test asserts adding A→B when B→A exists is rejected with a clear
message, and that adding A→D when D→C→B→A exists (a four-run cycle, soft edges
included) is rejected naming all four.

### ☐ 3.9 Volume map editor · S
Coverage check, 2026-10-08 (the owner chose an editor over cutting the
table). Depends on 1.12 (which fills `volume_rules`), 1.3 and 1.3c (the parser
and review table it feeds) and 2.0 (Settings). The volume map is the approved
answer to "which volume does a bare `Captain America #1` mean in this run",
and after cutover it can no longer be edited as a CSV.

- **`/settings/volumes`**, linked from Settings' volume-map line (2.0, whose
  counts are computed, D-7): the rules grouped by series, each showing its run
  (or *any run*), its issue range (or *any issue*) and its year. **Add**,
  **Edit** and **Remove**. Remove deletes the row and raises the undo toast:
  `volume_rules` is configuration with no reading history and no
  `deleted_at`; adding one is a schema change (ask first).
- **A rule that overlaps** another for the same series and scope is refused,
  `aria-disabled` with the reason shown (*Overlaps X-Men · any run · #1–200*).
  1.12 writes *Always use* rules by select-then-insert with no unique key
  (case-sensitive on `series`), so a stale tab could write a duplicate: the
  editor dedupes, or a unique expression index is added here.
- **The parser reads it.** 1.12 already applies the rules in the parser (the
  run's own rule before an any-run rule, only inside the rule's issue range,
  annual rules under `<Title> Annual`), so a covered label is not flagged. This
  entry is left with the review row pre-selecting that year and saying *from
  the volume map*, and the user changing it; nothing is written without 1.3c's
  accept. With no matching rule, the row is flagged for a pick as before.
- **Nothing is relabelled.** Rules apply to labels entered after the edit;
  existing `issues` rows change only through an accepted label review
  (`.claude/rules/schema.md`).
- The mockup gains the screen (standing rule 6).

**Check:** `Captain America #1` typed into a run with a run-scoped rule to 2018
pre-selects `Captain America (2018) #1` marked *from the volume map*; the same
label in another run, with only an any-run rule to 1998, pre-selects 1998; with
no rule it is flagged for a pick as before. A rule overlapping an existing one
for the same series and scope is refused with its reason shown. Editing a rule
changes no existing `issues` row. The Settings line's counts equal the table's.

- ☐ 6.17 **Activity: the reading log as a page** · M. Backlog intake,
  2026-10-20 (owner: *total books read each year, and a past list of read books
  and activity*). The yearly totals exist (`books_by_year`, `/books`' year
  chips) and 6.2 charts them. What has no page is the log itself. Depends on
  1.5 and 1.17.
  - `/activity`: every finished read, latest first, grouped by month under year
    headings, each year with its totals (*2026 · 31 books · 412 issues*).
  - Book rows come from `read_events`, with start, finish and days taken
    (1.17).
  - Comic reads come from `issue_progress`, grouped per run per day: *6 issues
    of Claremont — Uncanny X-Men, #141–146*.
  - Watch events join once Phase 8 exists, and music listens after Phase 9.
  - Filters by medium and year. Undated reads sit at the foot, under *No date*.
  - The sidebar gains *Activity*. Rows come from an `activity_log` view;
    nothing is stored.
  - **Check:** a book read in two different years appears in both (D-65); six
    marks in one run on one day render as one row with the range; undated reads
    come last; each year's book total equals `books_by_year`'s.

- ☐ 6.4 PWA: manifest, service worker, queued offline writes · M. Drives the
  sync pill from 1.8 (*Offline · 3 marks queued*); a queued write is never
  silent. **Undoing a queued write removes it from the queue** and makes no
  network call (UX-X02, F8). The failure toast is `role="alert"` (*Couldn't
  save #141, kept offline · Retry*); `queued → online` shows *Synced ✓* for 2s,
  the pill's dot cross-fading amber to green. The mockup's `states` gains three
  frames: failed, retrying, undone while queued.

- ☐ 6.1 Global search, `Ctrl+K`, across runs, issues, books, series, events · M.
  The overlay also takes verbs: a `>` prefix lists *Actions on this screen*
  (`> mark through #160`, `> move Piranesi Q3`, `> queue Priest BP top`) above
  *Results*, and results are grouped Comics · Books · Watch. The shortcut shows
  in the sidebar; on the phone the trigger is the 44px search icon.
  *From 1.8b (TASK-015, PR #114):* the thumb bar's and the
  dashboard header's *Search (Ctrl K)* slot is drawn, `aria-disabled`, until this
  lands. Turn on the `search` item in `NAV_ITEMS` and the slot becomes a link
  to it (`SearchVerb` in `ThumbBar.tsx`).
  *From 2.2i (TASK-052, PR #201):* `design/mockups.html` and
  `design/mockups-index.md` still draw and describe the phone bar's Search icon
  where D-113 put Settings' gear. Redraw the bar with the gear (and this
  trigger wherever Search lands on the phone) when this is built.
- ☐ 6.10 Master list: a *Fits Q2 · 56k* chip and a *Pick one* button (one
  highlighted row with *Another* and *Plan for…*), plus saved views (as 2.9) · S.
  Also product B3 and the route table's `/books/list` row (architecture § Routes and data access): **sort by word
  count** (moved to 2.2e with the Library's other sorts, D-110), and a **series-completion filter** (*complete · in progress · not
  started*, read from `series_progress`, never computed in the app).
  *From TASK-047 (2.2e, PR #194):* the sticky desktop filter
  rail (search, chips and *Sort* in a right column from 1024px, the mockup's
  `blist` desktop frame) is not built: 2.2e puts *Sort* inline beside the status
  filters at every width. The rail goes with this entry's saved views.

