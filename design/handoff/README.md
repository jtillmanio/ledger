# Ledger feel pass — handoff package (2026-10-05, desktop added 2026-10-06)

What the design pass delivered for Claude Code. The owner adopted it as **D-40**
with palette **1c After hours**. When the package was recorded, its working files
moved up into `design/`, and the build steps were folded into `docs/TASKS.md`.
This folder keeps the delivery record.

The 6 Oct package added the desktop layout (1024px and up), screenshots of every
frame, and two fixes to the mockups. It was recorded the same way.

| File | What it is |
|---|---|
| `CLAUDE_CODE_PROMPT.md` | The prompt as delivered. It ranks below `docs/TASKS.md` (D-1): the steps it lists are now in the tasks named in `IMPLEMENTATION_CHECKLIST.md`. It says `design/handoff/` for files that now sit in `design/` (tables below). |
| `IMPLEMENTATION_CHECKLIST.md` | Steps 0–12 with "done when" tests, including the `--art` extraction, the "what this opened" query and the desktop layout (step 11). Each step names the task that now carries it. |
| `D-40.md` | The decision row as drafted, with the desktop added. The adopted row is in `docs/review/decisions.md`. |
| `palette-swaps.css` | The colour blocks for **1a Signal** and **1b Lamplight**. `design/tokens.css` carries 1c. |
| `contrast-report.md` / `contrast-metrics.json` | Measured contrast and ΔE2000 for all three palettes, plus the desktop pairs for 1c (sidebar, rail, tooltip). Every one passes. |

Moved into `design/` when the package was recorded:

| Now at | What it is |
|---|---|
| `design/tokens.css` | Palette 1c as hex, with every name kept and the new ones marked `+ NEW`, including the desktop layout tokens and the 1024 and 1280 blocks (6 Oct). The 2026-09-30 file is `design/archive/tokens-2026-09-30.css`. |
| `design/STYLE_GUIDE.md` | The full guide, updated. The new material is in §14 (screens and behaviour; §14.6 desktop), §15 (copy) and §16 (departures FP-D1…FP-D18). The 2026-09-30 text is `design/archive/STYLE_GUIDE-2026-09-30.md`. |
| `design/Ledger Feel Review.dc.html` | The review doc with every mockup: comics, mark storyboard, books, watch, run detail, run complete, caught up, block complete, the tablet (§2–§10) and desktop (§11). Open it in a browser, with `support.js` beside it. |
| `design/LedgerDesktop.dc.html` | §11 on its own: 14 frames, 7 screens in dark and light, with builder notes and the desktop contrast table. |
| `design/LedgerNav.dc.html` | The desktop sidebar (224px, 1280 and up) and icon rail (64px, 1024–1279) the desktop frames import. |
| `design/LedgerComics.dc.html` | The comics dashboard component (mark-read is live). |
| `design/ledger-feel-tokens.css` | All three palettes in oklch, which the review page imports. |
| `design/screenshots/` | PNGs of every 1c frame: `phone/` (22 at 390 × 844, 2×), `tablet/` (2 at 768 × 1024) and `desktop/` (14 at 1280 × 900 and 1024 × 768). Its README maps each frame to its task. |

**Changes in the 6 Oct package.**

- **Desktop, 1024px and up** (D-33, D-25): a 64px icon rail from 1024 to 1279px and a 224px sidebar from 1280px; a centred content box with a main column and a side rail; dashboard verbs in the page header, primary last; the run page keeps its thumb bar. STYLE_GUIDE §14.6, departures FP-D15…FP-D18 in §16, tokens in `tokens.css`.
- **Chrome fix:** in the phone mockups the Now hero collapsed to 0px in Chrome. The scrolling column is now a grid with `grid-auto-rows:max-content`. Checklist step 5 says how to carry this into the app.
- **Mockup icons** are inline SVG instead of CSS masks over unpkg, so they render in screenshots. Nothing changes for the app.
- **/watch on desktop is not specified yet** (checklist step 11, TASKS 8.7).

**Status.** D1–D12 were accepted on 5 Oct. D13 and D14 came with the extra states and were adopted with D-40. FP-D15…FP-D18 came with the desktop frames on 6 Oct and are adopted unless the owner rejects them. The copy is approved. The palette is 1c.
