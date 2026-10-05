# Prompt for Claude Code

Paste everything below the line into Claude Code, at the repo root. Fill in the palette letter on the first line. If you leave it as `b`, the provisional default ships.

---

PALETTE = c    <!-- a = 1a Signal · b = 1b Lamplight · c = 1c After hours -->

You're implementing the Ledger "feel pass", a design change the owner has already approved. The design package is in `design/handoff/`. Read it before writing any code:

1. `design/handoff/README.md`: what each file is.
2. `design/handoff/IMPLEMENTATION_CHECKLIST.md`: the steps and their "done when" tests. **This is your task list. Follow it in order.**
3. `design/handoff/STYLE_GUIDE.md` §14–§16 (screens, copy, departures) and §6 (measured contrast).
4. `design/handoff/tokens.css` and `design/handoff/palette-swaps.css`.
5. `design/handoff/D-40.md`: the decision entry you'll add.
6. In the repo: decisions.md (especially D-24, D-25, D-26, D-29, D-31, D-32 and D-33), ARCHITECTURE §3 (plain CSS custom properties, no Tailwind build step), and the existing `src/app/globals.css`, `npm run test:tokens`, dashboard routes, mark action, cover ingest and readiness view. Find where these live before changing anything.

The mockups are in `design/handoff/mockups/Ledger Feel Review.dc.html` (open it in a browser; it loads `support.js` beside it). They are design artefacts, not code to copy. Rebuild them using the app's own components and conventions. Covers in the mockups are striped placeholders; use the real cover images.

## What to do

Work through the checklist in order, one step per commit, running the step's "done when" test before you move on:

0. **Record.** Copy the handoff files into `design/`. Add D-40 to decisions.md with the palette from the first line (`a` → "1a Signal", `b` → "1b Lamplight", `c` → "1c After hours"). Update the `docs/DESIGN.md` index.
1. **Tokens.** Merge `tokens.css` into `src/app/globals.css`: the same names plus the new tokens. If PALETTE isn't `b`, swap in the two colour blocks plus `--halo` and `--glass-bg` from `palette-swaps.css`. Run `npm run test:tokens` and fix any contrast or ΔE failures. Extend the test with the new pairs listed in the checklist. Don't rename or remove any token.
2. **Fonts.** Swap Inter Tight and JetBrains Mono for IBM Plex Sans, IBM Plex Mono and Newsreader, self-hosted as woff2 with their OFL licences. Rendering must make no external requests.
3. **Icons.** Replace the CDN icon masks with a local sprite or inline SVG. No CDN references may remain in `src/`.
4. **Cover art tone.** Add `--art` extraction to the cover ingest step, clamped exactly as specified (dark L ≤ .30, C ≤ .06; light L ≥ .92, C ≤ .035). Store it with the cover record, write a backfill for existing covers, and unit-test the clamp.
5. **P1 + P3 on /comics.** The "Up now" hero and the slot layout, plus the *All caught up* empty state.
6. **P1 + P3 on /books and /watch.** Include *Between books*.
7. **P2, the mark-read feedback.** One small client component around the thumb-bar button, plus CSS keyframes. Check it with reduced motion on: every state must still appear, including the green hold.
8. **P6, completion.** The run-complete and block-complete states on the run page, plus the "what this opened" query (specified in the checklist).
9. **P7, copy.** Apply STYLE_GUIDE §15 across dashboards, toasts, empty states and completion.
10. **Tablet.** The 768–1023px layout (D-33, STYLE_GUIDE §14.5).
11. **Verify.** Every state at 360, 390, 412 and 768 px, in dark and light, against the accessibility floor and with reduced motion and reduced transparency.

## Rules that don't bend

- Colour has four meanings: `--ready` means read or done, `--brand` means position and the primary action, `--blocked` means held, and `--danger` is for destructive actions only. Nothing on a dashboard is red, and anything with no meaning is grey. Read-elsewhere is always grey and dashed, never green.
- `--art` is content colour. It never carries state, and it must be possible to switch it off.
- No streaks, no confetti, and no progress measured against the whole catalogue. The lens, the stack and the rollup are run-relative or this-year counts.
- The telescope stays horizontal with a 14px minimum cell, and `allocate()` is unchanged. The five slots stay in order. The thumb bar stays fixed at the bottom, with 44px targets (48 on tablet).
- Counts stay mono (D-32, now Plex Mono). Newsreader appears only in titles, hero names, story titles and completion lines.
- Every movement uses `--dur-*` and goes to 0 under reduced motion. `--dur-hold` is the exception and is not zeroed.
- Use plain CSS custom properties. No Tailwind build step.
- Where the spec and the existing code disagree on layout or copy, the spec wins (D-40 amends D-31). Where it's silent, keep what exists. If something is ambiguous, stop and ask rather than invent.

## When you finish each step

Report briefly: what changed (files), the test results, and anything you had to decide. When everything is done, give a summary listing every deviation from the checklist and why, and confirm the step 11 verification results.
