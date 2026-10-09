# ui-verifier: Ledger

- **Sign-in** is `ui.auth`. Every route but `/api/health` redirects to `/login?next=<path>` until the browser holds the `rt_session` cookie (`src/proxy.ts`); one sign-in lasts the session.
- **The dev server reads the development database** (`.env` `DATABASE_URL`). Only the writes the steps themselves make are allowed; never mark or unmark in bulk.
- **Design files.** `design/mockups.html` is too large to read whole. Print one screen with `powershell -NoProfile -File scripts/screen.ps1 <data-id>`; the ids are the S-IDs in `design/mockups-index.md`. For the dashboards, the mark sequence, empty and caught-up states, completion, the 768px tablet and desktop at 1024px and up, the feel pass beats the mockup: compare against the PNGs in `design/screenshots/{phone,tablet,desktop}/` (indexed by `design/screenshots/README.md`) and `design/Ledger Feel Review.dc.html`.
- **Viewports** are `ui.viewports`: 360, 390 and 412 (phone, the primary device), 768 (tablet: bottom thumb bar plus a navigation rail), 1024 and 1280 (desktop: the dashboards move their verbs into the page header; the run detail keeps the bottom bar).
- **Targets and colour.** The thumb bar and icon buttons are 44px; nothing interactive is under 24px. Report an unnamed control (no accessible name) as a deviation. A read-elsewhere hint must be grey, never green; nothing on a dashboard is red.
