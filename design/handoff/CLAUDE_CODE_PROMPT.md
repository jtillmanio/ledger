# Prompt for Claude Code

Paste everything below the line into Claude Code, at the repo root. The palette is set to `c` (1c After hours, the owner's pick on 5 Oct). Change it only if the owner asks.

---

PALETTE = c    <!-- a = 1a Signal · b = 1b Lamplight · c = 1c After hours (adopted) -->

You're implementing the Ledger "feel pass" (D-40, palette 1c, with the desktop layout added on 6 Oct), a design change the owner has already approved. The design package is in `design/handoff/`. Read it before writing any code:

1. `design/handoff/README.md`: what each file is.
2. `design/handoff/IMPLEMENTATION_CHECKLIST.md`: the steps and their "done when" tests. **This is your task list. Follow it in order.**
3. `design/handoff/STYLE_GUIDE.md` §14–§16 (screens including §14.6 Desktop, copy, departures FP-D1…FP-D18) and §6 (measured contrast).
4. `design/handoff/tokens.css` and `design/handoff/palette-swaps.css`.
5. `design/handoff/D-40.md`: the decision entry you'll add.
6. In the repo: decisions.md (especially D-24, D-25, D-26, D-29, D-31, D-32 and D-33), ARCHITECTURE §3 (plain CSS custom properties, no Tailwind build step), and the existing `src/app/globals.css`, `npm run test:tokens`, dashboard routes, mark action, cover ingest and readiness view. Find where these live before changing anything.

The mockups are in `design/handoff/mockups/Ledger Feel Review.dc.html`. Open it in a browser; it loads `support.js` beside it. Sections 2–10 are phone and tablet. Section 11 is desktop and also opens on its own as `LedgerDesktop.dc.html`; read the builder notes under each frame. PNGs of every frame are in `design/handoff/screenshots/` (phone, tablet, desktop) if you can't run the mockups. They are design artefacts, not code to copy. Rebuild them using the app's own components and conventions. Covers in the mockups are striped placeholders; use the real cover images.

## What to do

Work through the checklist in order, one step per commit, running the step's "done when" test before you move on:

0. **Record.** Copy the handoff files into `design/`. Add D-40 to decisions.md with the palette from the first line (`a` → "1a Signal", `b` → "1b Lamplight", `c` → "1c After hours"). Update the `docs/DESIGN.md` index.
1. **Tokens.** Merge `tokens.css` into `src/app/globals.css`: the same names plus the new tokens, including the desktop layout tokens and the 1024 and 1280 media blocks. It ships 1c. Only if PALETTE isn't `c`, swap in the two colour blocks plus `--halo` and `--glass-bg` from `palette-swaps.css`. Run `npm run test:tokens` and fix any contrast or ΔE failures. Extend the test with the new pairs listed in the checklist. Don't rename or remove any token.
2. **Fonts.** Swap Inter Tight and JetBrains Mono for IBM Plex Sans, IBM Plex Mono and Newsreader, self-hosted as woff2 with their OFL licences. Rendering must make no external requests.
3. **Icons.** Replace the CDN icon masks with a local sprite or inline SVG. No CDN references may remain in `src/`.
4. **Cover art tone.** Add `--art` extraction to the cover ingest step, clamped exactly as specified (dark L ≤ .30, C ≤ .06; light L ≥ .92, C ≤ .035). Store it with the cover record, write a backfill for existing covers, and unit-test the clamp.
5. **P1 + P3 on /comics.** The "Up now" hero and the slot layout, plus the *All caught up* empty state. Make sure the hero can't collapse in a fixed-height scroll column. See the Chrome note in the checklist.
6. **P1 + P3 on /books and /watch.** Include *Between books*.
7. **P2, the mark-read feedback.** One small client component around the thumb-bar button, plus CSS keyframes. Check it with reduced motion on: every state must still appear, including the green hold.
8. **P6, completion.** The run-complete and block-complete states on the run page, plus the "what this opened" query (specified in the checklist).
9. **P7, copy.** Apply STYLE_GUIDE §15 across dashboards, toasts, empty states and completion.
10. **Tablet.** The 768–1023px layout (D-33, STYLE_GUIDE §14.5).
11. **Desktop.** The 1024px+ layout (D-33, D-25, STYLE_GUIDE §14.6, mockup §11): the icon rail and sidebar, the centred main column and side rail, header verbs, and the contained completion band. Don't build /watch at desktop beyond the shared shell; its rules are still being settled, so stop and ask.
12. **Verify.** Every state at 360, 390, 412, 768, 1024, 1280 and 1440 px, in dark and light, against the accessibility floor and with reduced motion and reduced transparency.

## Rules that don't bend

- Colour has four meanings: `--ready` means read or done, `--brand` means position and the primary action, `--blocked` means held, and `--danger` is for destructive actions only. Nothing on a dashboard is red, and anything with no meaning is grey. Read-elsewhere is always grey and dashed, never green.
- `--art` is content colour. It never carries state, and it must be possible to switch it off.
- No streaks, no confetti, and no progress measured against the whole catalogue. The lens, the stack and the rollup are run-relative or this-year counts.
- The telescope stays horizontal, and `allocate()` is unchanged. The minimum cell is 14px below 900px and 16px at 900px and up, using the desktop rail sizes. The five slots stay in order: Now → Next → Position in the main column, then Situation → Rollup (the side rail on desktop).
- The thumb bar stays fixed at the bottom of dashboards below 1024px, with 44px targets (48 on tablet). At 1024px and up, dashboards have no thumb bar: the same verbs go in the page header, primary last, and the primary names the issue (D-25). The run page keeps its thumb bar at every width.
- Hover reveals only behind `(hover:hover) and (pointer:fine)`. On touch, every control stays visible.
- Counts stay mono (D-32, now Plex Mono). Newsreader appears only in titles, hero names, story titles and completion lines.
- Every movement uses `--dur-*` and goes to 0 under reduced motion. `--dur-hold` is the exception and is not zeroed.
- Use plain CSS custom properties. No Tailwind build step.
- Where the spec and the existing code disagree on layout or copy, the spec wins (D-40 amends D-31). Where it's silent, keep what exists. If something is ambiguous, stop and ask rather than invent.

## When you finish each step

Report briefly: what changed (files), the test results, and anything you had to decide. When everything is done, give a summary listing every deviation from the checklist and why, and confirm the step 12 verification results.
