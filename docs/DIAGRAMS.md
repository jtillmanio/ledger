# Diagrams

Mermaid source, renders on GitHub and in most editors. Keep these current — they
are the fastest way to give a new session accurate context.

---

## 1. Comics data model

```mermaid
erDiagram
    USERS ||--o{ ISSUE_PROGRESS : marks
    USERS ||--o{ EDITION_PROGRESS : owns
    USERS ||--o{ RUN_QUEUE : "queues, in order"
    RUNS  ||--o{ RUN_QUEUE : "queued as up next"

    TRACKS ||--o{ RUN_TRACKS : groups
    RUNS   ||--o{ RUN_TRACKS : "belongs to"
    RUNS   ||--o{ RUN_ISSUES : places
    ISSUES ||--o{ RUN_ISSUES : "placed in"
    ERAS   ||--o{ RUN_ISSUES : sections
    ISSUES ||--o{ ISSUE_CREDITS : "credited on"
    CREATORS ||--o{ ISSUE_CREDITS : "worked on"
    RUNS   ||--o{ PREREQS : requires
    RUNS   ||--o{ PREREQS : "is required by"
    TRACKS ||--o{ BLOCKS : "divided into"
    BLOCKS ||--o{ RUNS : orders

    RUN_ISSUES ||--o{ ISSUE_PROGRESS : "read state, per run"
    EDITIONS ||--o{ EDITION_PROGRESS : "owned state"

    EVENTS ||--o{ EVENT_RUNS : touches
    RUNS   ||--o{ EVENT_RUNS : "touched by"
    RUNS   ||--o| EVENTS : "is home of"

    USERS {
        text id PK
        text name
    }
    TRACKS {
        text id PK
        text name
        text publisher
    }
    BLOCKS {
        text id PK "avengers-b2"
        text track_id FK
        int  number "order within the track"
        text name "nullable until named"
    }
    RUNS {
        text id PK "your slug: hickman-ff"
        text title
        text why "2-4 sentences"
        text why_source "hand|claude"
        int  tier "1-5 priority"
        text block_id FK "nullable"
        int  sequence "position in block"
        bool spine
        bool placeholder "forward-declared"
        ts   deleted_at
    }
    ERAS {
        int  id PK
        text run_id FK
        int  ordinal "order within the run"
        text name "Days of Future Past"
    }
    ISSUES {
        text id PK "fantastic-four-1961-570"
        text label UK "Fantastic Four (1961) #570"
        int  metron_id "enrichment, not unique"
        date cover_date "run_span derives years"
        text cover_date_source "metron|hand"
        text story_title
        text story_title_source "metron|hand"
        text cover_url
    }
    RUN_ISSUES {
        int  id PK "the placement, task 0.8"
        text run_id FK
        int  sequence "reading order, UNIQUE with run_id"
        text issue_id FK "one issue, many runs"
        text type "core|recommended|optional"
        text notes
        int  era_id FK "nullable, task 0.3"
    }
    CREATORS {
        text id PK "jonathan-hickman"
        text name
        int  metron_id UK
    }
    ISSUE_CREDITS {
        text issue_id FK
        text creator_id FK
        text role "writer|artist|inker|colorist|letterer|cover"
        text source "metron|hand"
    }
    PREREQS {
        text run_id FK
        text prereq_run_id FK
        text type "hard|soft"
    }
    ISSUE_PROGRESS {
        text user_id FK
        int  placement_id FK "run_issues.id, never issues.id"
        ts   completed_at
    }
    RUN_QUEUE {
        text user_id FK
        text run_id FK
        int  ordinal "1..n, contiguous, authored"
        ts   added_at
    }
    EDITIONS {
        text id PK
        text title
        text book_type "Omnibus|TPB"
        text issues_text
    }
    EDITION_PROGRESS {
        text user_id FK
        text edition_id FK
        bool collected
        bool read
    }
    EVENTS {
        text id PK
        text name
        int  year
        text verdict
        text home_run_id FK
    }
```

## 2. Books data model

```mermaid
erDiagram
    USERS ||--o{ BOOK_STATUS : reads
    USERS ||--o{ READING_PLAN : plans
    USERS ||--o| READING_SETTINGS : configures
    USERS ||--o{ SHELVES : curates

    AUTHORS     ||--o{ BOOKS : wrote
    AUTHORS     ||--o{ BOOK_SERIES : wrote
    BOOK_SERIES ||--o{ BOOKS : contains
    BOOKS       ||--o{ BOOK_STATUS : "read state"
    BOOKS       ||--o{ READING_PLAN : "planned into"
    BOOKS       ||--o| RELEASES : "comes out"
    BOOKS       ||--o{ SHELF_BOOKS : "listed on"
    SHELVES     ||--o{ SHELF_BOOKS : holds
    BOOKS       ||--o{ EXTERNAL_LISTS : "named by"
    BOOKS       ||--o{ WISHLIST : "resolved from"

    READING_SETTINGS {
        text user_id PK
        int  minutes_per_day
        int  words_per_minute
    }
    AUTHORS {
        text id PK
        text name
    }
    BOOK_SERIES {
        text id PK
        text name
        text author_id FK
        int  total_books
    }
    BOOKS {
        text id PK
        text title
        text author_id FK
        text series_id FK
        real series_position
        text genre
        int  word_count
        text word_count_source "stated|estimated"
        int  page_count
        text cover_url
        ts   deleted_at
    }
    BOOK_STATUS {
        text user_id FK
        text book_id FK
        text status "to_read|reading|read|dnf"
        date finished_on
        int  finished_year
        int  year_rank "top-10 position"
        real rating
        text notes
    }
    READING_PLAN {
        text user_id FK
        text book_id FK
        text period "2027-Q1 | 2027 | on_deck"
        int  ordinal "quarters only, D-37"
    }
    SHELVES {
        text id PK "cosmere, stephen-king"
        text name
        text kind "books|titles"
    }
    SHELF_BOOKS {
        text shelf_id FK
        text book_id FK
        text run_id FK
        int  ordinal
    }
    EXTERNAL_LISTS {
        int  id PK
        text source "BookTube channel"
        int  year
        int  rank
        text raw_title
        text book_id FK
    }
```

## 3. Derived layer — what the views compute

Nothing below is stored. Each box is a view in `etl/views.sql`, replacing a
formula column or tab from the workbook.

```mermaid
flowchart TD
    I[issues] --> RP[run_progress<br/>total · read · pct · state]
    IP[issue_progress] --> RP
    U[users] --> RP

    RP --> RR[run_readiness<br/>hard_left · soft_left · readiness]
    RR --> RS[run_state<br/>blocked · ready_hard · ready_all · reading · read]
    RP --> RS
    RP --> RG[run_read_segments<br/>run-length read stretches]
    PR[prereqs] --> RR
    PR --> RA["run_ancestors: RECURSIVE<br/>full prereq chain, any depth"]

    RR --> TP[track_progress<br/>per-track rollup]
    RP --> TP
    RT[run_tracks] --> TP

    RR --> RTR["readyToRead: query<br/>unread AND ready-all"]
    RP --> RTR

    BS[book_status] --> BY[books_by_year<br/>Read 20XX tabs]
    B[books] --> BY
    B --> SP[series_progress<br/>Series tab]
    BS --> SP

    PL[reading_plan] --> CAP["capacity: planned<br/>words vs pace budget"]
    B --> CAP
    RS[reading_settings] --> CAP

    RP --> BP[block_progress<br/>issues · read · pct per block]
    RP --> BPOS["block_position<br/>run N of M · block N of M"]
    RA --> UC[run_unlock_cost<br/>full closure, in issues]
    PR --> LEV[run_leverage<br/>runs this one opens]
    RR --> FR[frontier<br/>ready · soft · cold · owned]

    BP --> TEL([Telescope])
    BPOS --> TEL
    RP --> TEL
    TEL --> CD([Comics dashboard])
    RTR --> CD
    UC --> CD
    LEV --> CD
    FR --> CD

    PL --> PP["plan_period<br/>year · quarter · level<br/>derived from period"]
    PP --> CAP
    PP --> PR2([Plan rail])
    CAP --> BD([Books dashboard])
    PR2 --> BD
    TP --> CD
    RA --> RD([Run detail])
    IP --> IRR["issue_read_runs<br/>runs where each issue is read"]
    IRR -- "grey 'read in …' hint" --> RD

    RQ[run_queue<br/>authored order] --> RQS["run_queue_state<br/>order · state · readiness"]
    RP --> RQS
    RR --> RQS
    RQS --> CD
    RQS --> ST
    RP --> ST([Status screens<br/>in flight · up next · done])
    RR --> ST
    PP --> ST
    BS --> ST
```

Read state is on the placement (ARCHITECTURE 2.14). `run_progress` and
`run_readiness` count a run's own placements. Block and track rollups count an
issue once, and count it read when any placement of it in scope is read.
`issue_read_runs` only drives a hint and never feeds a count.

## 3b. The telescope — three positions, no new tables

The comics dashboard shows where you are at three levels at once. Every number
it needs already exists; none of it is stored.

```mermaid
flowchart LR
    subgraph track["Track rail — X-Men"]
      B1["block 1<br/>664 iss · 42 read"] --> B2["block 2<br/>214"] --> Bn["… 7 blocks<br/>2,180 iss"]
    end
    subgraph block["Block rail — block 1"]
      R1["run 1<br/>Lee/Kirby · 66"] --> R2["run 2 ← you<br/>Claremont · 381 · 42 read"] --> Rn["… 5 runs"]
    end
    subgraph run["Run rail — Claremont"]
      I1["issue 1"] --> I42["issue 42 ← head"] --> I381["issue 381"]
    end
    B1 -.->|bracket| block
    R2 -.->|bracket| run
```

| Rail | Source | Query |
|---|---|---|
| Track: ordered blocks with issue and read counts | `block_progress` | `WHERE track_id = ? ORDER BY number` |
| Block: ordered runs with issue and read counts | `run_progress` ⋈ `block_position` | `WHERE block_id = ? ORDER BY run_ordinal` |
| Run: issue count, read count, head | `run_progress` + resume pointer (task 1.6) | one row |
| The ladder underneath | `block_position` | `run_ordinal / block_runs`, `block_ordinal / track_blocks` |

The rails run left to right and stack top to bottom, at every width (D-31); the
flowchart above shows their nesting, not their orientation. In the allocation
below, `H` is the rail's length, which is its width `W` (ARCHITECTURE §4).

The brackets are geometry, not data: each one connects the highlighted cell of
a coarser rail to the full extent of the next finer one. Runs with a null
`block_id` — nine of them — fall back to a two-rail view (`data-rails="2"`). The
only real work is a minimum legible cell height, so a 6-issue run beside a
381-issue one does not vanish. The allocation is one function, applied to every
rail (ARCHITECTURE §4 has the code):

```mermaid
flowchart TD
    C["counts[] per cell, rail height H, gap 2px"] --> A["avail = H − gap·(n−1)"]
    A --> F{"n · min > avail?<br/>min = 14px phone / 16px desktop"}
    F -- no --> D["height = min + count/total · (avail − n·min)"]
    F -- yes --> O["keep head ± 2 neighbours at ≥ min<br/>fold the rest into ≤ 2 stubs<br/>'+N runs' / '+N blocks', 14px each"]
    D --> S["draw read state as run-length segments<br/>green = read here<br/>grey dashed = read in another run"]
    O --> S
    S --> T["ticks every niceStep(total / floor(H/6))<br/>head label '42 / 381 · #141'"]
```

The rail is interactive: each cell is a focusable link, and each rail is a
slider that scrubs to `/comics/[runId]#p-[ordinal]`.

## 4. Run readiness state

Five states, all visible. Each has one badge, with a glyph as well as colour:

| State | Badge | Colour |
|---|---|---|
| `blocked` | `⊘ N runs first` | amber |
| `ready_hard` | `○ ready · N soft unread` | green outline |
| `ready_all` | `● ready` | green fill |
| `reading` | `◐ n / N` (no prerequisite badge alongside) | blue |
| `read` | `✓ read · date` | grey |

```mermaid
stateDiagram-v2
    [*] --> blocked
    blocked --> ready_hard : all HARD prereqs at 100%
    ready_hard --> ready_all : all SOFT prereqs at 100%
    ready_all --> reading : first issue marked
    ready_hard --> reading : first issue marked
    reading --> read : last issue marked
    read --> reading : an issue unmarked

    note right of blocked
        readiness comes from direct prereqs only.
        run_ancestors() gives the full chain
        for the "read these first" list.
    end note
```

## 5. Runtime architecture

```mermaid
flowchart LR
    subgraph client [Browser / phone home screen]
        UI["Next.js App Router<br/>server components"]
        SPINE["IssueList<br/>client, optimistic"]
    end

    subgraph vercel [Vercel Hobby · free]
        MW["proxy.ts<br/>cookie presence gate"]
        RSC["Server components<br/>db/queries.ts"]
        API["Route handlers<br/>/api/progress · /api/export"]
        CRON["Vercel cron<br/>release digest · phase 6"]
    end

    subgraph neon [Neon Postgres · free tier]
        TBL[(20 tables now<br/>36 when complete)]
        VW[[views + run_ancestors]]
    end

    subgraph ext [External · backfill, plus live search from add flows]
        METRON[Metron API<br/>20/min · 5k/day]
        OL[Open Library]
        HC[Hardcover GraphQL<br/>backfill only]
    end

    subgraph gh [GitHub]
        REPO[repo]
        CI["Actions: typecheck<br/>lint · build"]
        BAK["Actions: nightly<br/>pg_dump to backups/"]
        REL["Actions: Release, by hand<br/>CI check · snapshot · migrate · promote"]
    end

    UI --> MW --> RSC --> VW --> TBL
    SPINE -- POST --> API --> TBL
    REPO --> CI
    REPO -. git push builds, staged .-> vercel
    REL --> TBL
    REL -. promote .-> vercel
    BAK --> TBL
    METRON -. enrichment script .-> TBL
    OL -.-> TBL
    HC -.-> TBL
    CRON --> TBL
    API -- "add flow search, on submit" --> METRON
    API -- "add flow search, on submit" --> OL
```

## 6. Bulk-entry validation pipeline

```mermaid
flowchart TD
    P["Paste block<br/>one issue per line"] --> N[normalize<br/>trim · collapse spaces · NFKC]
    N --> G{"matches grammar?<br/>Title [(Year)] #N"}
    G -- no --> Q1[flag: unparseable<br/>offer manual accept]
    G -- yes --> V{"series known?"}
    V -- no --> Q2[flag: new series<br/>confirm or correct]
    V -- yes --> Y{"volume year<br/>consistent with<br/>existing rows?"}
    Y -- no --> Q3["flag: ambiguous<br/>'Captain America #1'<br/>matches 8 volumes"]
    Y -- yes --> R{"expand ranges<br/>#1-12 to 12 rows"}
    R --> D{"duplicate in run?"}
    D -- yes --> Q4[flag: already present]
    D -- no --> OK[stage for insert]
    Q1 --> REV[Review table:<br/>accept · fix · drop]
    Q2 --> REV
    Q3 --> REV
    Q4 --> REV
    OK --> REV
    REV --> INS[(insert with sequence<br/>appended in order)]
```

## 7. AI proposal flow (Phase 7)

The model never writes. It proposes; Metron verifies; you approve.

```mermaid
flowchart TD
    T["Trigger: review this run /<br/>review this track /<br/>draft a run for Priest's Black Panther"]
    T --> CTX["Ground the prompt:<br/>run record · current issues ·<br/>track siblings · existing prereq edges ·<br/>your tier ratings"]
    CTX --> API["Anthropic API<br/>server-side only"]
    API --> STORE[(proposals table:<br/>prompt · raw · parsed · status)]
    STORE --> PARSE{"bulk-entry grammar<br/>Title (Year) #N"}
    PARSE -- fails --> MAL[malformed]
    PARSE -- passes --> MET{"Metron:<br/>does this issue exist?"}
    MET -- no --> UNV["unverified<br/>shown, never dropped"]
    MET -- yes --> VER[verified]
    MAL --> DIFF
    UNV --> DIFF
    VER --> DIFF["Diff view, one row each:<br/>Kind glyph · Change · Why · Check · Decision<br/>insert · remove · reorder · reclassify core/optional"]
    DIFF --> ACC{accept per row}
    ACC -- accept --> W[(write)]
    ACC -- reject --> STORE
```

## 8. Watchlist data model

Three levels — franchise, title, season. Structurally this mirrors the comics
model in §1 (track → run → issue), minus the dependency graph. Episodes are
deliberately absent.

```mermaid
erDiagram
    USERS ||--o{ TITLE_STATUS : tracks
    USERS ||--o{ SEASON_STATUS : tracks
    USERS ||--o{ WATCH_EVENTS : logs

    FRANCHISES ||--o{ FRANCHISES : "nests one level"
    FRANCHISES ||--o{ FRANCHISE_TITLES : groups
    TITLES     ||--o{ FRANCHISE_TITLES : "belongs to"
    TITLES     ||--o{ SEASONS : "has (tv only)"
    TITLES     ||--o{ TITLE_STATUS : "film status"
    SEASONS    ||--o{ SEASON_STATUS : "season status"
    TITLES     ||--o{ WATCH_EVENTS : "film watches"
    SEASONS    ||--o{ WATCH_EVENTS : "season watches"
    TITLES     ||--o{ SHELF_TITLES : "listed on"
    SHELVES    ||--o{ SHELF_TITLES : holds
    SHELVES    ||--o{ SHELF_BOOKS : holds

    FRANCHISES {
        text id PK
        text name
        text parent_id FK "Star Wars -> Mandalorian era"
        int  tmdb_collection_id "auto for films"
    }
    FRANCHISE_TITLES {
        text franchise_id FK
        text title_id FK
        int  release_ordinal
        int  chronology_ordinal
    }
    TITLES {
        text id PK "movie-27205 / tv-1396"
        int  tmdb_id
        text kind "movie | tv"
        text name
        text overview
        int  release_year
        int  runtime "films"
        int  season_count "shows"
        text_array genres
        text_array creators
        text_array cast_top
        text poster_url
        int  tmdb_collection_id
        ts   fetched_at
    }
    SEASONS {
        text id PK "tv-1396-s2"
        text title_id FK
        int  season_number
        text name
        int  episode_count
        int  air_year
        text overview
    }
    TITLE_STATUS {
        text user_id FK
        text title_id FK
        text status
        date watched_on
        real rating
    }
    SEASON_STATUS {
        text user_id FK
        text season_id FK
        text status
        date watched_on
        real rating
    }
    WATCH_EVENTS {
        int  id PK
        text title_id FK "one or the other"
        text season_id FK
        date watched_on
        int  rewatch_of FK
    }
```

## 8b. Show state is derived, never stored

Exactly as run progress is derived from issues.

```mermaid
flowchart LR
    SE[seasons] --> SP[show_progress<br/>total · watched · next_season · state]
    SS[season_status] --> SP
    U[users] --> SP
    SP --> FP[franchise_progress<br/>spans films and shows]
    TS[title_status] --> FP
    FT[franchise_titles] --> FP
    SP --> SHOW([Show detail:<br/>2 of 3 seasons<br/>next up S3])
    FP --> FR([Franchise page:<br/>combined progress])
```

State machine per show:

```mermaid
stateDiagram-v2
    [*] --> to_watch
    to_watch --> watching : any season marked watched
    watching --> watched : all seasons marked
    watched --> watching : a season unmarked
    to_watch --> dropped
    watching --> dropped
    dropped --> to_watch : un-drop
    note right of watching
        watching / watched are a view over season_status;
        nothing is written to title_status for them.
    end note
    note right of dropped
        the one stored show-level status:
        title_status (kind 'tv', status 'dropped'),
        read first by show_progress.
        Shown under Done → Stopped.
    end note
```

## 9. Where metadata comes from

The catalogue is authored by you for comics; fetched for everything else. The
split matters: no API knows that `Fantastic Four #570-588` plus `FF #1-23` is
one Hickman run.

```mermaid
flowchart LR
    subgraph authored [Authored by you]
        R[runs · prereqs · eras]
        RO[reading orders]
        VM[volume_map.csv]
        LR[label_review.csv<br/>your accept / reject]
    end
    subgraph backfill [Backfill · never on a page render]
        MET[Metron<br/>20/min · 5k/day<br/>also live in Add issues]
        OL[Open Library<br/>no key<br/>also live in Add books]
        HC[Hardcover<br/>5k/day]
    end
    subgraph live [Live during search]
        TMDB[TMDB<br/>~40-50/sec<br/>attribution required]
    end

    R --> ISS[(issues · run_issues)]
    RO --> ISS
    VM --> ISS
    MET -. proposed labels .-> LR
    LR -- accepted renames --> ISS
    MET -. dates · covers · story titles · credits .-> SC[sidecar CSVs<br/>metron or hand]
    SC -- npm run extract --> ISS
    SC -- credits --> CR[(issue_credits · creators)]
    OL  -. pages · covers · summary · subjects .-> BK[(books)]
    HC  -. series position .-> BK
    TMDB -- overview · genres · cast · poster --> TI[(titles)]
    TMDB -- seasons array, one call --> SE[(seasons)]
    TMDB -- belongs_to_collection --> FR[(franchises)]
    HAND[you, by hand] -- cross-media franchises<br/>TMDB has no TV equivalent --> FR
    TI --> CACHE{{cached on first add<br/>detail never re-calls}}
    SE --> CACHE

    ISS --> DET1([Issue detail])
    BK  --> DET2([Book detail])
    CACHE --> DET3([Title / season detail])
```

## 10. Add flow — search or type it, always a real row

ARCHITECTURE 2.15. The same shape for an issue into a run and a book into a
shelf or a to-read level: a quarter or year, On deck, or Someday (D-37; Someday
writes `book_status` only, no plan row).

```mermaid
flowchart TD
    S{"Search · Type it"}
    S -- search --> LIB{"in your catalog?"}
    LIB -- yes --> OWN["show as yours<br/>'in 3 runs' · 'on Cosmere'"]
    LIB -- no, submit --> API["Metron / Open Library<br/>live, server-side, cached"]
    API -- results --> PICK[tap Add = explicit accept]
    API -- nothing / down --> TYPE
    S -- type it --> TYPE["freeform<br/>issues: bulk-entry parser (§6)<br/>books: title + author"]
    PICK --> REV[review / confirm]
    TYPE --> REV
    OWN --> REV
    REV --> CAT[("catalog row<br/>issues · books<br/>created or reused")]
    CAT --> DEST[("the row that points at it<br/>run_issues · shelf_books ·<br/>book_status · reading_plan")]
    CAT -. later .-> BF["backfill fills gaps<br/>never overwrites what you typed"]
```
