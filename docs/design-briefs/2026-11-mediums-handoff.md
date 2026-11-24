# Mediums-Review · hand-off for Claude Code (2026-11-24)

Design review 2. The frames live on the Ledger canvas, page **Mediums-Review**; the PNGs are in `design/screenshots/mediums-review/{phone,tablet,desktop,spec}/{frame}-{dark,light}.png` (phones at 2×). The style guide's §17 and `tokens.css` (`--m-music`, `--m-games`) carry the rules.

## How to use this

- **The frame wins over `mockups.html`** on layout and copy for every screen below, until the task that builds the screen redraws its mockup frame from here in the same PR (D-40's standing rule 6, extended). Figures are sample data (D-7): assert relationships, never a number from a frame.
- **Departures (MR-D1…24) are adopted unless the owner rejects them; MR-Q1…24 are open.** Where a task depends on an open MR-Q, stop at its plan gate and ask. The questions that block building: MR-Q1/Q3/Q4 (navigation, every screen), MR-Q9 (music marks), MR-Q13/Q14 (games hours), MR-Q15 (set aside), MR-Q16/Q17 (parked).
- **Order that avoids rework:** tokens (`--m-music`, `--m-games`) → navigation shell (A: phone bar + Switch medium sheet, tab row tail, tablet rail well, sidebar list, icon-rail flyout) → the small E fixes (MR-D16, D17, D18, D19, D20) → watch (B) → parked for every medium (F1–F4) → Activity (F9–F10) → offline states (F11–F15) → music (C) and games (D) when their tables land.
- **Shared components to build once:** the medium switch (sheet on the phone, menu on the icon rail); the 1-rail telescope variant; the album lens (the comics lens with a skipped cell); the time-to-beat bar; the status control's grey stops (MR-D24); the stepper (typed + held, on `--sunk`); the grouped parked review; the offline strip's three new states.
- **Every UI task still meets the UX floor** (`docs/04-design.md` § 10): empty, loading, offline, rate-limited, error (grey ×) and metadata-pending states; 4.5:1 text, 3:1 boundaries; 44px thumb-bar and icon buttons; real buttons and links; hover never the only way in. Screenshots at 360, 834 and 1280, light and dark; a feel-pass surface (every dashboard here) at the wider set in § 10.

## Frame → screen

| Frame | Screen · state | PNG | Redraws or adds |
|---|---|---|---|
| A1 | Media bar · today (three media) | `phone/A1-{dark,light}.png` | reference: the built bar |
| A2 | Option · five text tabs, no wordmark | `phone/A2-{dark,light}.png` | rejected option |
| A3 | Option · icons, current one named | `phone/A3-{dark,light}.png` | rejected option |
| A4 | Option · three media + More | `phone/A4-{dark,light}.png` | rejected option |
| A5 | Recommended · medium switcher + search + gear | `phone/A5-{dark,light}.png` | redraws the phone media bar on every screen (D-120 bar) |
| A6 | Switch medium sheet · Books current | `phone/A6-{dark,light}.png` | adds: the medium switcher sheet (shared Sheet) |
| A7 | Tab row scrolled to its end · Progress current | `phone/A7-{dark,light}.png` | redraws the tab row (task 2.2i): adds Activity after Progress |
| A8 | Tablet rail · five media in the well · /books | `tablet/A8-{dark,light}.png` | redraws the 72px tablet rail (§14.5) |
| A9 | Sidebar 1280 · media list, current medium open | `desktop/A9-{dark,light}.png` | redraws LedgerNav wide (§14.6 sidebar) |
| A10 | Icon rail 1024 · medium flyout open | `desktop/A10-{dark,light}.png` | redraws LedgerNav collapsed (§14.6 icon rail) |
| A11 | Medium accents, all five | `spec/A11-{dark,light}.png` | adds: --m-music, --m-games |
| B1 | /watch · Now Slow Horses (no franchise) | `phone/B1-{dark,light}.png` | redraws Feel Review §5 /watch phone; mockups watchlist phone |
| B2 | /watch · Now Andor (Star Wars) | `phone/B2-{dark,light}.png` | redraws watchlist phone (franchise rail) |
| B2s | /watch · Andor, scrolled to Position and Paused | `phone/B2s-{dark,light}.png` | watchlist phone (lower half) |
| B3 | /watch · 360, three posters visible | `phone/B3-{dark,light}.png` | watchlist 360 frame (new) |
| B4 | /watch · tablet | `tablet/B4-{dark,light}.png` | adds /watch at 834 |
| B5 | /watch · Now Andor · sidebar | `desktop/B5-{dark,light}.png` | redraws watchlist desktop |
| B6 | /watch · Now Slow Horses · icon rail | `desktop/B6-{dark,light}.png` | adds /watch at 1024 |
| B7 | Status · In flight | `phone/B7-{dark,light}.png` | redraws status (watch In flight, notes only today) |
| B8 | Status · In flight after Check now: a new season | `phone/B8-{dark,light}.png` | adds the new-season toast |
| B9 | Status · Up next, oldest added first | `phone/B9-{dark,light}.png` | status (watch Up next) |
| B10 | Status · Done, Stopped open | `phone/B10-{dark,light}.png` | status (watch Done) |
| B11 | Status · In flight empty | `phone/B11-{dark,light}.png` | states (watch empty slates, 8.8) |
| B12 | Status · Up next empty | `phone/B12-{dark,light}.png` | states |
| B13 | Status · Done empty | `phone/B13-{dark,light}.png` | states |
| B14 | Status · Up next · tablet | `tablet/B14-{dark,light}.png` | adds status watch at 834 |
| B15 | Status · In flight · desktop | `desktop/B15-{dark,light}.png` | adds status watch desktop |
| B16 | /watch/list · Sunday films | `phone/B16-{dark,light}.png` | adds /watch/list (saved views, 6.10) |
| B17 | /watch/list · Removed · 2 open | `phone/B17-{dark,light}.png` | adds |
| B18 | Add these to a shelf… sheet | `phone/B18-{dark,light}.png` | adds |
| B19 | /watch/list · desktop, filters in the rail | `desktop/B19-{dark,light}.png` | adds |
| B20 | Film sheet | `phone/B20-{dark,light}.png` | adds the film sheet |
| B21 | Show sheet · seasons, rating, note, history | `phone/B21-{dark,light}.png` | redraws titledetail phone |
| B22 | Show sheet · Where to watch out of date | `phone/B22-{dark,light}.png` | titledetail (stale provider line) |
| B23 | Season sheet, opened from the show | `phone/B23-{dark,light}.png` | adds the season sheet |
| B24 | /watch/title/[id] · direct visit | `desktop/B24-{dark,light}.png` | redraws titledetail desktop |
| B25 | Add · search with Watched through | `phone/B25-{dark,light}.png` | redraws watchadd phone |
| B26 | Add · TMDB error, Save to inbox | `phone/B26-{dark,light}.png` | redraws watchadd error frame (⚠ → grey ×) |
| B27 | /watch · first run, nothing added | `phone/B27-{dark,light}.png` | redraws watchempty |
| B28 | Franchise · Chronological, unplaced group | `phone/B28-{dark,light}.png` | redraws franchise phone |
| B29 | Franchise · Release order · desktop | `desktop/B29-{dark,light}.png` | redraws franchise desktop |
| B30 | Shelves, and a shelf in your order with notes | `phone/B30-{dark,light}.png` | adds watch shelves (5.1 for watch) |
| B31 | Person · Denis Villeneuve | `phone/B31-{dark,light}.png` | adds the person page |
| C1 | /music · Sempiternal in hand | `phone/C1-{dark,light}.png` | adds /music |
| C1s | /music · scrolled to Position and Situation | `phone/C1s-{dark,light}.png` | adds |
| C2 | /music · 360 | `phone/C2-{dark,light}.png` | adds /music 360 |
| C3 | /music · first run, nothing followed | `phone/C3-{dark,light}.png` | adds the empty first screen |
| C4 | /music · tablet | `tablet/C4-{dark,light}.png` | adds |
| C5 | /music · desktop | `desktop/C5-{dark,light}.png` | adds |
| C6 | Status · In flight: albums, then artists listening | `phone/C6-{dark,light}.png` | adds |
| C7 | Status · Up next | `phone/C7-{dark,light}.png` | adds |
| C8 | Status · Done, Stopped (skipped) open | `phone/C8-{dark,light}.png` | adds |
| C9 | Artist · by year | `phone/C9-{dark,light}.png` | adds |
| C10 | Artist · sorted by Favourites | `phone/C10-{dark,light}.png` | adds |
| C11 | Album sheet · tracks | `phone/C11-{dark,light}.png` | adds |
| C12 | Artist · desktop | `desktop/C12-{dark,light}.png` | adds |
| C13 | This or that · Which do you like more? | `phone/C13-{dark,light}.png` | adds (as thisorthat) |
| C14 | Ranker · resuming a half-finished album | `phone/C14-{dark,light}.png` | adds |
| C15 | Songs · Move to… sheet (touch, keyboard) | `phone/C15-{dark,light}.png` | adds |
| C16 | Songs · desktop, drag handles | `desktop/C16-{dark,light}.png` | adds |
| C17 | Add · artists with disambiguation | `phone/C17-{dark,light}.png` | adds |
| C18 | Add · following Genesis, trim its albums | `phone/C18-{dark,light}.png` | adds |
| C19 | Add · MusicBrainz error, Save to inbox | `phone/C19-{dark,light}.png` | adds |
| C20 | Artists · Spotify follows to review | `phone/C20-{dark,light}.png` | adds |
| D1 | /games · Expedition 33 in hand | `phone/D1-{dark,light}.png` | adds /games |
| D1s | /games · scrolled to Position and Coming out | `phone/D1s-{dark,light}.png` | adds |
| D2 | /games · 360 | `phone/D2-{dark,light}.png` | adds |
| D3 | Log time sheet | `phone/D3-{dark,light}.png` | adds |
| D4 | /games · first run | `phone/D4-{dark,light}.png` | adds |
| D5 | /games · tablet | `tablet/D5-{dark,light}.png` | adds |
| D6 | /games · desktop | `desktop/D6-{dark,light}.png` | adds |
| D7 | /games · icon rail | `desktop/D7-{dark,light}.png` | adds |
| D8 | Status · In flight: Playing, In rotation, Set aside | `phone/D8-{dark,light}.png` | adds |
| D9 | Status · Up next, the queue and its total, row menu open | `phone/D9-{dark,light}.png` | adds |
| D10 | Status · Up next grouped by platform | `phone/D10-{dark,light}.png` | adds |
| D11 | Status · Done, Stopped open | `phone/D11-{dark,light}.png` | adds |
| D12 | Status · Up next · desktop with handles | `desktop/D12-{dark,light}.png` | adds |
| D13 | Game sheet | `phone/D13-{dark,light}.png` | adds |
| D14 | Add · results, your platforms first | `phone/D14-{dark,light}.png` | adds |
| D15 | Add · which platform, which play style, where | `phone/D15-{dark,light}.png` | adds |
| D16 | Add · IGDB error | `phone/D16-{dark,light}.png` | adds |
| D17 | /games/releases · Coming out | `phone/D17-{dark,light}.png` | adds |
| D18 | Settings · Your platforms; game shelves | `phone/D18-{dark,light}.png` | redraws settings (adds a Games group) |
| E1 | Now · a book on three levels (universe, series, subseries) | `phone/E1-{dark,light}.png` | bdash Now (task 2.2g, 6.21) |
| E2 | Now · a long universe name at 360 | `phone/E2-{dark,light}.png` | bdash Now 360 |
| E3 | Now · a book on no level | `phone/E3-{dark,light}.png` | bdash Now |
| E4 | Now · listening, author only | `phone/E4-{dark,light}.png` | bdash listening hero |
| E5 | Now · tablet hero, three levels | `tablet/E5-{dark,light}.png` | bdash 834 hero |
| E6 | Now · desktop hero, three levels | `desktop/E6-{dark,light}.png` | bdash desktop hero |
| E7 | Library · genre row, Owned and Sort as dropdown chips | `phone/E7-{dark,light}.png` | blist phone (genre row 4.5; MR-D20) |
| E8 | Status · Listen next row menu, Remove grey | `phone/E8-{dark,light}.png` | status books Listen next (MR-D16) |
| E9 | Progress · five media, nested | `phone/E9-{dark,light}.png` | progress phone (grows for 8.8, 9.6, 10.3) |
| E10 | Finish toast · capped (recommended) | `phone/E10-{dark,light}.png` | finishoffer 360 (MR-D17) |
| E10b | Finish toast · as built, for comparison | `phone/E10b-{dark,light}.png` | reference: finishoffer as built |
| E11 | Stepper · rest, typing, held | `spec/E11-{dark,light}.png` | settings, batch and finish sheets (§9) |
| E12 | Book sheet · tablet | `tablet/E12-{dark,light}.png` | bookdetail 834 |
| E13 | This or that · tablet | `tablet/E13-{dark,light}.png` | thisorthat 834 |
| E14 | Top books · tablet | `tablet/E14-{dark,light}.png` | top 834 |
| E15 | Rebalance sheet · tablet | `tablet/E15-{dark,light}.png` | rebalance 834 (and moveplan by the same rule) |
| E16 | Calibre sync log · tablet | `tablet/E16-{dark,light}.png` | calibre 834 |
| E17 | Settings · tablet | `tablet/E17-{dark,light}.png` | settings 834 |
| F1 | /parked · four media | `phone/F1-{dark,light}.png` | redraws parked (books only today) |
| F2 | /parked · desktop | `desktop/F2-{dark,light}.png` | redraws parked desktop |
| F3 | Inbox · the parked review row for every medium | `phone/F3-{dark,light}.png` | redraws capture (Inbox) |
| F4 | Park verb and dashboard line per medium | `spec/F4-{dark,light}.png` | spec |
| F5 | /comics/releases | `phone/F5-{dark,light}.png` | adds /comics/releases |
| F6 | Metron check · review before adding | `phone/F6-{dark,light}.png` | adds |
| F7 | Edit run · Read first, with the loop error | `phone/F7-{dark,light}.png` | redraws newrun (prerequisites) |
| F8 | Volume map editor | `phone/F8-{dark,light}.png` | adds (Settings → Volume map) |
| F9 | /activity | `phone/F9-{dark,light}.png` | adds /activity |
| F10 | /activity · desktop | `desktop/F10-{dark,light}.png` | adds |
| F11 | Offline · marks queued | `phone/F11-{dark,light}.png` | states (offline, existing) |
| F12 | Back online · retrying | `phone/F12-{dark,light}.png` | states (adds) |
| F13 | A queued mark failed | `phone/F13-{dark,light}.png` | states (adds) |
| F14 | Undone while queued | `phone/F14-{dark,light}.png` | states (adds) |
| F15 | Sidebar sync pill · four states | `spec/F15-{dark,light}.png` | states (desktop pill) |
| F16 | Global search from the bar | `phone/F16-{dark,light}.png` | redraws palette (phone) |

## Not drawn, and why

- **Tablet frames for every sheet and list of music and games.** They follow the rules drawn in E12–E17: a sheet is the phone's bottom sheet, 640px wide and centred; a list is the phone's list in the 32px column. Dashboards are drawn at every width.
- **`add` and `moveplan` at 834px.** One column with the phone's order, and E15's sheet rule.
- **Interactions a still can't show:** the switcher sheet's open and close, the tab row's scroll-into-view, drag in the song list and games queue, the stepper's repeat, the toast's countdown. Each is specified in the frame notes; the e2e tests hold them.
- **Real cover art.** Striped placeholders, as in the feel pass; the neutral placeholder ships until 4.3.
- **Watch, music and games skeletons.** The loaded geometry in `--sunk`, as `states` draws for comics and books; no new shape.
