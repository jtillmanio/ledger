# Feel pass frames (D-40)

Screenshots of every phone and tablet frame in `design/Ledger Feel Review.dc.html`, so a session can **look at** the feel pass instead of reading its template source. They're in palette 1c (the owner's pick), dark and light, at 2× and **full length**: each frame grows to its content, so slots below a phone viewport are visible too. The thumb bar sits at the foot.

Covers are the review's striped placeholders. Build with real covers (TASKS 4.3). All figures are sample data (D-7).

| Files | What | Task |
|---|---|---|
| `comics-01…02` | `/comics` at rest: the Now hero with the lens, *Since Tuesday* and *Also reading*; the Up next shelf; the telescope; *Ready when you are*; *2026 so far* | 2.4, 1.10 |
| `mark-01…06` | The mark storyboard: tap (0ms), answer (120–720ms), next (1.3s), dark then light | 1.8b, 1.2 |
| `books-01…04` | `/books` reading, and *Between books* | 2.2 |
| `watch-01…02` | `/watch` (open questions in TASKS 8.7) | 8.7 |
| `run-01…02` | The run detail: art band, telescope, spine | 4.3, 2.5b |
| `complete-01…02` | Run complete | 2.12 |
| `states-01…02` | `/comics` all caught up | 2.4 |
| `states-03…04` | Block complete | 2.12 |
| `states-05…06` | `/comics` tablet at 768 | 1.8, 2.4 |

**What wins.** These are pictures of the review page, so the review page and `design/STYLE_GUIDE.md` §14–§16 win if they ever disagree. Regenerate the PNGs whenever the review page changes:

```
npm i --no-save playwright-core
node design/feel/capture.mjs        # CHROME=<path> to use another Chrome or Edge
```

**Two things the captures correct for.**

- The review page loads its components at runtime, so `capture.mjs` serves `design/` over HTTP. Opened from `file://`, Chrome shows the comics frames blank.
- In Chrome the review page's Now hero collapses to 0px. The hero is an `overflow:hidden` child of a fixed-height flex column, so its `min-height: auto` resolves to 0. The script stops the column's children shrinking. **The shipped hero must not repeat this:** give it `flex-shrink: 0`, or don't put it in a fixed-height flex column.
