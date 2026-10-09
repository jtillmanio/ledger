---
paths:
  - "src/app/**"
  - "src/components/**"
  - "design/**"
---

# Design and UI rules

Loads automatically when you're touching a screen, component, or the mockups
— not on every session. This file is the only home of these rules; `CLAUDE.md`
holds what's true everywhere else and the Hard rules a reviewer checks. Which
design source wins over which (mockup, styling blueprint, feel pass, task) is
`CLAUDE.md` § Which document wins (D-1).

## Design

`design/mockups.html` (v4) is the reviewed layout and copy for every screen.
Match it. It is annotated with the reasoning behind each decision; read the
notes column before changing a layout. Pull up one screen with
`powershell -NoProfile -File scripts/screen.ps1 <id>` (`scripts/screen.sh` is
the bash twin; ids in `design/mockups-index.md`) rather than reading the whole
file. Read `docs/DESIGN.md`, the index to the styling blueprint (D-31), before
building a component.

Phone at 360–412px is the primary device and every screen is designed there
first. A desktop layout that a phone layout degrades into is the wrong answer.

- **One dashboard per medium**, not one dashboard for everything. `/comics`,
  `/books`, `/watch`. `/` redirects to whichever you touched last. List screens
  sit one level down (`/comics/runs`, `/books/list`).
- **Every medium has a status screen with the same three tabs**:
  `/comics/status`, `/books/status` and `/watch/status`, with *In flight · Up
  next · Done*, in that order and under those names. Each tab reads from
  existing views; nothing about them is stored.
- **Every add surface opens on a segmented control with Search selected** and
  the freeform path beside it — *Type it* for issues, *Paste a list · By hand*
  for books. The user's own catalog is matched before the API, an
  existing row shows as theirs ("in 3 runs") rather than as a second copy, and
  freeform always works when the API has nothing. Watch opens on Search alone;
  when TMDB has nothing its fallback is *Save to inbox* (D-28).
- **A read-elsewhere hint is grey, never green.** A spine row whose issue is
  read in another run carries a grey `read in Hickman — FF` note. Green means
  read *here*; the hint must not look like a checkmark.
- **Every dashboard has the same five slots in the same order**: now → next,
  with a control on it → position → situation → a compact rollup → the thumb
  bar. What differs between media is what fills a slot, not the order.
- **The thumb bar is fixed at the bottom of every dashboard and the run
  detail**, same position, same primary verb slot. Marking what you just read
  is one tap and reachable with a thumb. Nothing displaces it. On desktop
  (1024px+) the three dashboards carry the same verbs in the page header,
  primary last; a tablet (768–1023px) keeps the bottom bar and gets a
  navigation rail instead of the top media bar (D-33); the run detail keeps
  the bottom bar at every width (D-25). Hover, drag and shift-click need
  `(pointer:fine)` and always have a touch route. The
  mark verb names the issue by its label, never by its reading-order position
  (`Mark X-Men (2019) #8 read`; `#141` alone only on a single-series run).
- **Position is drawn, not counted.** Three nested positions (issue in run, run
  in block, block in track) render as the telescope, not as three percentages.
  Books get the same instinct applied to time: the plan rail.
- **Five readiness states, one badge partial.** `blocked` is the only amber
  readiness badge (`⊘ N runs first`); `ready_hard` is outlined green (`○ ready ·
  N soft unread`), `ready_all` `● ready`, `reading` `◐ n / N` with no
  prerequisite badge beside it, `read` `✓`. Glyph plus text, never colour alone.
  ARCHITECTURE §4.
- **The telescope is horizontal at every width** (D-31) and **its cells have a
  floor** — 14px phone, 16px desktop, overflow folded into `+N runs` stubs — and
  read state is drawn as segments, not one fill. A run with no block drops the
  block rail and keeps everything else (2-rail). The geometry will be
  `src/components/telescope/layout.ts` (task 2.5), not a hand-drawn SVG.
- **Contrast and targets are tokens, not taste.** `--faint` is text-safe
  (4.5:1 or more on every surface; `#5e6275` light, `#9fa4b8` dark, palette 1c,
  D-40); `--faint-deco` is for rules; thumb bar and icon buttons are 44px,
  nothing interactive under 24px; every control is a real button or link with a
  name. `.bar` is the app header only; era and block meters are `.emeter`.
- **Hue identifies data, never navigation.** Sidebar icons are neutral; one
  franchise keeps one hue on every screen; watch genre chips are grey with text.
  DNF and *Skip* are grey — only *Remove* and *Drop* may be red.
- **The feel pass (D-40)** beats `design/mockups.html` on layout and copy for
  what it draws: the dashboards, the mark sequence, empty and caught-up states,
  completion, the 768px tablet and desktop at 1024px and up
  (`design/STYLE_GUIDE.md` §14–§16, `design/Ledger Feel Review.dc.html`; PNGs
  in `design/screenshots/`). Each dashboard's Now slot is the one hero; `--art`, a
  cover's clamped ambient tone, is content colour, never state, and can be
  switched off. Fonts are self-hosted: IBM Plex Sans for the UI, Plex Mono for
  counts, Newsreader only for titles, hero names, story titles and completion
  lines. No streaks, no confetti.
- **Every screen has its states drawn**: empty (one primary action), loading
  (skeletons at the loaded size), offline (sync pill), rate-limited, error,
  metadata pending. See docs/TASKS.md's *UX floor*.
- **Never draw progress against the catalog.** 76 of ~10,100 as a bar is a lie
  told with a rectangle. Comics measure against the run and the block; the
  catalog total appears once, small, as provenance, on Stats and not on a
  dashboard (D-40). A track is drawn as a row
  of its blocks, each filled by its own share read, with `read / total` as
  text — never one bar against the whole track (D-29).
- **Detail views are intercepted routes, not modal components:** a sheet from a
  list, a full page on direct load. The back button must dismiss.
- **No page render calls an external API.** The one live path is an **add
  flow**: TMDB, Metron and Open Library are searched when the user submits a
  search in Add, and results are cached. Hardcover is backfill-only. TMDB
  attribution belongs in the footer. (What an add flow writes is
  `.claude/rules/schema.md`.)

## Style

- Plain CSS with the custom properties in `src/app/globals.css`. No Tailwind, no
  CSS-in-JS. The token set there is the same one as `design/mockups.html`, and
  from task 1.8a its values are `design/tokens.css`'s. Tailwind names in the
  design files are vocabulary only (`docs/DESIGN.md` §4); never ship them.
- **Colour is functional, and there are exactly four meanings.** `--ready`
  green is read/done. `--brand` blue is where you are, and the primary action.
  `--blocked` amber is *held* — either a hard prerequisite is unread or a
  decision has not been made (over capacity, no quarter chosen). `--danger` red
  is destructive actions and validation failures only. **Nothing on a dashboard
  is ever red.** `--t1`–`--t8` carry track and genre identity and nothing else,
  and never sit within ΔE2000 15 of `--ready`, `--blocked` or `--danger` (D-24,
  `npm run test:tokens`). Every progress meter fills with `--ready` (D-26). Text
  on a filled control uses `--on-*`, never a literal `#fff`.
  Anything without a meaning stays grey.
- **Amber clears when the user decides, including when they decide to keep the
  overage.** Accepting an over-committed year is a first-class outcome that
  persists. An indicator you cannot dismiss by choosing is one people stop
  reading.
- `--mark` and `--held` survive as aliases for `--ready` and `--blocked` so the
  first three routes keep rendering. New code uses the real names.
- Server components by default. Client components only where there is state.
  A query a screen needs goes in `src/db/queries.ts` (`.claude/rules/schema.md`).
