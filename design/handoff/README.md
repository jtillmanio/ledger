# Ledger feel pass — handoff package (2026-10-05)

What the design pass delivered for Claude Code. The owner adopted it as **D-40**
with palette **1c After hours**. When the package was recorded, its working files
moved up into `design/`, and the build steps were folded into `docs/TASKS.md`.
This folder keeps the delivery record.

| File | What it is |
|---|---|
| `CLAUDE_CODE_PROMPT.md` | The prompt as delivered. It ranks below `docs/TASKS.md` (D-1): the steps it lists are now in the tasks named in `IMPLEMENTATION_CHECKLIST.md`. |
| `IMPLEMENTATION_CHECKLIST.md` | Steps 0–11 with "done when" tests, including the `--art` extraction and the "what this opened" query. Each step names the task that now carries it. |
| `D-40.md` | The decision row as drafted. The adopted row is in `docs/review/decisions.md`. |
| `palette-swaps.css` | The colour blocks for **1a Signal** and **1b Lamplight**. `design/tokens.css` carries 1c. |
| `contrast-report.md` / `contrast-metrics.json` | Measured contrast and ΔE2000 for all three palettes. Every one passes. |

Moved into `design/` when the package was recorded:

| Now at | What it is |
|---|---|
| `design/tokens.css` | Palette 1c as hex, with every name kept and the new ones marked `+ NEW`. The 2026-09-30 file is `design/archive/tokens-2026-09-30.css`. |
| `design/STYLE_GUIDE.md` | The full guide, updated. The new material is in §14 (screens and behaviour), §15 (copy) and §16 (departures FP-D1…FP-D14). The 2026-09-30 text is `design/archive/STYLE_GUIDE-2026-09-30.md`. |
| `design/Ledger Feel Review.dc.html` | The review doc with every mockup: comics, mark storyboard, books, watch, run detail, run complete, caught up, block complete, and the tablet. Open it in a browser, with `support.js` beside it. |
| `design/LedgerComics.dc.html` | The comics dashboard component (mark-read is live). |
| `design/ledger-feel-tokens.css` | All three palettes in oklch, which the review page imports. |

**Status.** D1–D12 were accepted on 5 Oct. D13 and D14 came with the extra states and were adopted with D-40. The copy is approved. The palette is 1c.
