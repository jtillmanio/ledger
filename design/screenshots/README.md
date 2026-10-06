# Feel pass frames (D-40)

Screenshots of every frame in `design/Ledger Feel Review.dc.html`, exported by Claude Design, so a session can **look at** the feel pass instead of reading its template source. Palette 1c, dark and light.

- `phone/`: 390 × 844 at 2×.
- `tablet/`: 768 × 1024.
- `desktop/`: 1280 × 900, plus /comics at 1024 × 768.

Covers are the review's striped placeholders. Build with real covers (TASKS 4.3). All figures are sample data (D-7).

| Files | What | Task |
|---|---|---|
| `phone/01…02` | `/comics` at rest: the Now hero with the lens, *Since Tuesday* and *Also reading*; the Up next shelf; the telescope; *Ready when you are*; *2026 so far* | 2.4, 1.10 |
| `phone/03…08` | The mark storyboard: tap, answer, next; dark then light | 1.8b, 1.2 |
| `phone/09…12` | `/books` reading, and *Between books* | 2.2 |
| `phone/13…14` | `/watch` (open questions in TASKS 8.7) | 8.7 |
| `phone/15…16` | The run detail: art band, telescope, spine | 4.3, 2.5b |
| `phone/17…18` | Run complete | 2.12 |
| `phone/19…20` | `/comics` all caught up | 2.4 |
| `phone/21…22` | Block complete | 2.12 |
| `tablet/01…02` | `/comics` at 768 | 1.8, 2.4 |
| `desktop/01…04` | `/comics` at rest at 1280 (sidebar) and 1024 (icon rail) | 1.8, 2.4 |
| `desktop/05…06` | `/comics` all caught up at 1280 | 1.8, 2.4 |
| `desktop/07…10` | `/books` reading, and *Between books*, at 1280 | 1.8, 2.2 |
| `desktop/11…12` | Run complete at 1280: the contained art band (FP-D17) | 2.12 |
| `desktop/13…14` | Block complete at 1280 | 2.12 |

**What wins.** These are pictures of the review page, so the review page and `design/STYLE_GUIDE.md` §14–§16 win if they ever disagree, and the mockups stay the source for measurements. Re-export them whenever the review page changes.

**The Chrome hero collapse.** The 5 Oct review page put its Now hero, an `overflow:hidden` child, in a fixed-height flex column, and in Chrome its `min-height: auto` resolved to 0. The page now lays the column out as a grid (`grid-auto-rows: max-content`). **The shipped hero must not repeat the bug** (checklist step 5, TASKS 2.4).
