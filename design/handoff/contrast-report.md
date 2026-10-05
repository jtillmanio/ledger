# Contrast and ΔE report — feel pass palettes (measured 2026-10-05)

Computed from the values in `design/ledger-feel-tokens.css` after the fixes marked `~` there: oklch → sRGB with chroma-reduction gamut mapping, WCAG 2.x relative-luminance contrast, ΔE2000 in CIELAB (D65). Glass is `--surface` at α .90 composited in sRGB over pure white (dark) or pure black (light). `npm run test:tokens` is still the gate; these numbers should match it to ±0.05.

**Result: every palette passes every floor** (text 4.5, UI boundary 3, identity ΔE 15). `--ready` text on glass stays barred (SG-D12).

Fixes applied in this pass, all small:
- Light `--ready` L .51–.52 → .50 (and hue 158/152 → 160) in all three: it failed ΔE 15 against `--t3` (13.1 / 14.3 / 11.8) and 4.5 as text on `--sunk`.
- Dark `--blocked` hue 78 → 74 (1b) and 80 → 72 (1c): it failed ΔE 15 against `--t4` (13.4 / 12.1).
- 1c light `--brand` L .52 → .49: it failed 4.5 as text on `--sunk` (4.29) and on glass (4.30).

## What tells them apart (the numbers behind the decision aid)

| Measure | 1a dark | 1b dark | 1c dark | 1a light | 1b light | 1c light |
|---|---|---|---|---|---|---|
| Brand vs page, ΔE (find your place) | 59.2 | 61.6 | 69 | 49.8 | 55.1 | 46.8 |
| Brand text, worst surface | 6.71 | 6.84 | 8.44 | 5.35 | 5.4 | 5.07 |
| Ready vs page, ΔE (reward) | 73.1 | 74 | 80.5 | 47.7 | 47 | 48.1 |
| Blocked vs page, ΔE (held) | 72.2 | 72.5 | 76.3 | 48.8 | 47.1 | 49.2 |
| Blocked vs ready, ΔE | 42.6 | 41.8 | 39.9 | 41.3 | 42.2 | 41.1 |
| Surface vs page, contrast (cards separate) | 1.084 | 1.087 | 1.075 | 1.084 | 1.082 | 1.098 |
| Muted text, worst surface | 6.04 | 6.17 | 6.6 | 5.1 | 4.98 | 4.97 |
| Identity headroom, min ΔE | 16.9 (t4 vs blocked) | 15.5 (t4 vs blocked) | 15.2 (t3 vs ready) | 15.6 (t3 vs ready) | 15.6 (t3 vs ready) | 15.6 (t3 vs ready) |

## 1b Lamplight — dark

**Text on surfaces (floor 4.5)**

| Token | page | surface | raise | sunk | overlay |
|---|---|---|---|---|---|
| `--ink` | 16.66 | 15.33 | 13.84 | 17.21 | 13.24 |
| `--ink-2` | 11.79 | 10.85 | 9.8 | 12.18 | 9.38 |
| `--muted` | 7.76 | 7.14 | 6.45 | 8.01 | 6.17 |
| `--faint` | 7.48 | 6.88 | 6.21 | 7.72 | 5.94 |
| `--brand` | 8.6 | 7.91 | 7.15 | 8.89 | 6.84 |
| `--brand-ink` | 12.58 | 11.58 | 10.46 | 13 | 10 |
| `--ready` | 11.39 | 10.48 | 9.47 | 11.77 | 9.06 |
| `--blocked` | 11.2 | 10.31 | 9.31 | 11.57 | 8.91 |
| `--danger` | 6.99 | 6.43 | 5.81 | 7.22 | 5.56 |

**Pairs (floor 4.5):** ready on ready-soft 7.87 · blocked on blocked-soft 7.71 · danger on danger-soft 5.56 · brand-ink on brand-soft 8.64 · muted on sunk 8.01 · on-brand on brand 8.6 · on-ready on ready 11.39 · toast-ink on toast-bg 11.39 · toast-muted on toast-bg 7.3 · toast-link on toast-bg 8.6

**UI boundaries (floor 3):** faint-deco / surface 3.97 · faint-deco / raise 3.58 · faint-deco / overlay 3.43 · ready / sunk (segment) 11.77 · brand / sunk (head) 8.89 · brand / page (focus) 8.6

**Glass worst case:** ink 11.54 · ink-2 8.17 · muted 5.37 · brand 5.96 · ready 7.89 · blocked 7.76 (ready barred)

**ΔE2000 identity vs ready · blocked · danger:** t1 46.2/53.6/41.9 · t2 52.3/57.7/32.6 · t3 20.2/32.8/62.8 · t4 33.2/15.5/45.7 · t5 48.2/54.7/35.4 · t6 30.2/44.8/57.4 · t7 74.2/46.5/20.1 · t8 33.4/36.8/32.5

**Luminance:** page 0.0045 · surface 0.0092 · raise 0.0155 · sunk 0.0027 · overlay 0.0185

## 1b Lamplight — light

**Text on surfaces (floor 4.5)**

| Token | page | surface | raise | sunk | overlay |
|---|---|---|---|---|---|
| `--ink` | 15.81 | 17.1 | 16.47 | 14.32 | 17.1 |
| `--ink-2` | 8.79 | 9.5 | 9.15 | 7.96 | 9.5 |
| `--muted` | 5.49 | 5.94 | 5.72 | 4.98 | 5.94 |
| `--faint` | 5.49 | 5.94 | 5.72 | 4.98 | 5.94 |
| `--brand` | 5.96 | 6.45 | 6.21 | 5.4 | 6.45 |
| `--brand-ink` | 8.39 | 9.07 | 8.74 | 7.6 | 9.07 |
| `--ready` | 5.17 | 5.59 | 5.38 | 4.68 | 5.59 |
| `--blocked` | 5.21 | 5.64 | 5.43 | 4.72 | 5.64 |
| `--danger` | 5.5 | 5.95 | 5.73 | 4.99 | 5.95 |

**Pairs (floor 4.5):** ready on ready-soft 4.97 · blocked on blocked-soft 5.01 · danger on danger-soft 5.26 · brand-ink on brand-soft 7.83 · muted on sunk 4.98 · on-brand on brand 6.54 · on-ready on ready 5.67 · toast-ink on toast-bg 15.12 · toast-muted on toast-bg 9.76 · toast-link on toast-bg 8.79

**UI boundaries (floor 3):** faint-deco / surface 3.32 · faint-deco / raise 3.2 · faint-deco / overlay 3.32 · ready / sunk (segment) 4.68 · brand / sunk (head) 5.4 · brand / page (focus) 5.96

**Glass worst case:** ink 13.64 · ink-2 7.58 · muted 4.74 · brand 5.15 · ready 4.46 · blocked 4.5 (ready barred)

**ΔE2000 identity vs ready · blocked · danger:** t1 45.7/52.2/44.4 · t2 47.5/50.5/34.8 · t3 15.6/36.3/57.3 · t4 27.5/20.8/40.8 · t5 48/54/41 · t6 28.2/43.4/54.2 · t7 69.5/36.2/17.9 · t8 26.5/33/35.2

**Luminance:** page 0.9071 · surface 0.9851 · raise 0.947 · sunk 0.817 · overlay 0.9851

## 1a Signal — dark

**Text on surfaces (floor 4.5)**

| Token | page | surface | raise | sunk | overlay |
|---|---|---|---|---|---|
| `--ink` | 17.03 | 15.71 | 14.23 | 17.56 | 13.62 |
| `--ink-2` | 11.5 | 10.61 | 9.61 | 11.86 | 9.2 |
| `--muted` | 7.55 | 6.96 | 6.31 | 7.78 | 6.04 |
| `--faint` | 7.27 | 6.71 | 6.08 | 7.5 | 5.82 |
| `--brand` | 8.38 | 7.73 | 7 | 8.64 | 6.71 |
| `--brand-ink` | 12.29 | 11.34 | 10.27 | 12.67 | 9.83 |
| `--ready` | 11.12 | 10.26 | 9.29 | 11.46 | 8.9 |
| `--blocked` | 10.88 | 10.04 | 9.1 | 11.22 | 8.71 |
| `--danger` | 6.74 | 6.21 | 5.63 | 6.95 | 5.39 |

**Pairs (floor 4.5):** ready on ready-soft 7.89 · blocked on blocked-soft 7.71 · danger on danger-soft 5.32 · brand-ink on brand-soft 8.68 · muted on sunk 7.78 · on-brand on brand 8.38 · on-ready on ready 11.12 · toast-ink on toast-bg 11.54 · toast-muted on toast-bg 7.04 · toast-link on toast-bg 8.33

**UI boundaries (floor 3):** faint-deco / surface 3.85 · faint-deco / raise 3.49 · faint-deco / overlay 3.34 · ready / sunk (segment) 11.46 · brand / sunk (head) 8.64 · brand / page (focus) 8.38

**Glass worst case:** ink 11.87 · ink-2 8.01 · muted 5.26 · brand 5.84 · ready 7.75 · blocked 7.59 (ready barred)

**ΔE2000 identity vs ready · blocked · danger:** t1 48.2/53/41.8 · t2 53/56.6/31.4 · t3 18.5/34.1/65.6 · t4 32.5/16.9/48.5 · t5 49.4/53.8/34.6 · t6 32.4/44.7/59 · t7 75.4/45.4/18.7 · t8 34.4/36.4/32.8

**Luminance:** page 0.0041 · surface 0.0086 · raise 0.0147 · sunk 0.0025 · overlay 0.0176

## 1a Signal — light

**Text on surfaces (floor 4.5)**

| Token | page | surface | raise | sunk | overlay |
|---|---|---|---|---|---|
| `--ink` | 16.69 | 18.1 | 17.34 | 15.41 | 18.1 |
| `--ink-2` | 9.23 | 10 | 9.58 | 8.52 | 10 |
| `--muted` | 5.53 | 5.99 | 5.74 | 5.1 | 5.99 |
| `--faint` | 5.53 | 5.99 | 5.74 | 5.1 | 5.99 |
| `--brand` | 5.79 | 6.28 | 6.02 | 5.35 | 6.28 |
| `--brand-ink` | 8.16 | 8.84 | 8.47 | 7.53 | 8.84 |
| `--ready` | 5.22 | 5.66 | 5.43 | 4.82 | 5.66 |
| `--blocked` | 5.26 | 5.7 | 5.46 | 4.85 | 5.7 |
| `--danger` | 5.6 | 6.08 | 5.82 | 5.17 | 6.08 |

**Pairs (floor 4.5):** ready on ready-soft 5.04 · blocked on blocked-soft 5.06 · danger on danger-soft 5.29 · brand-ink on brand-soft 7.64 · muted on sunk 5.1 · on-brand on brand 6.28 · on-ready on ready 5.66 · toast-ink on toast-bg 15.87 · toast-muted on toast-bg 9.92 · toast-link on toast-bg 9.26

**UI boundaries (floor 3):** faint-deco / surface 3.36 · faint-deco / raise 3.22 · faint-deco / overlay 3.36 · ready / sunk (segment) 4.82 · brand / sunk (head) 5.35 · brand / page (focus) 5.79

**Glass worst case:** ink 14.43 · ink-2 7.98 · muted 4.78 · brand 5.01 · ready 4.52 · blocked 4.55 (ready barred)

**ΔE2000 identity vs ready · blocked · danger:** t1 45.8/52.4/44.7 · t2 47.7/51/34.7 · t3 15.6/35/58.7 · t4 27.6/19.8/42 · t5 48.1/54.4/41 · t6 28.3/43.1/55.1 · t7 69.9/36.8/17.7 · t8 26.6/32.7/35.7

**Luminance:** page 0.9186 · surface 1 · raise 0.9558 · sunk 0.8442 · overlay 1

## 1c After hours (adopted, D-40; `design/tokens.css`) — dark

**Text on surfaces (floor 4.5)**

| Token | page | surface | raise | sunk | overlay |
|---|---|---|---|---|---|
| `--ink` | 17.52 | 16.31 | 14.88 | 18 | 14.08 |
| `--ink-2` | 12.44 | 11.57 | 10.56 | 12.77 | 9.99 |
| `--muted` | 8.21 | 7.64 | 6.97 | 8.43 | 6.6 |
| `--faint` | 7.91 | 7.36 | 6.72 | 8.13 | 6.36 |
| `--brand` | 10.51 | 9.78 | 8.92 | 10.79 | 8.44 |
| `--brand-ink` | 13.98 | 13.01 | 11.87 | 14.35 | 11.23 |
| `--ready` | 12.83 | 11.94 | 10.9 | 13.18 | 10.31 |
| `--blocked` | 11.84 | 11.02 | 10.05 | 12.16 | 9.51 |
| `--danger` | 7.41 | 6.89 | 6.29 | 7.61 | 5.95 |

**Pairs (floor 4.5):** ready on ready-soft 8.67 · blocked on blocked-soft 7.97 · danger on danger-soft 5.77 · brand-ink on brand-soft 9.22 · muted on sunk 8.43 · on-brand on brand 10.51 · on-ready on ready 12.83 · toast-ink on toast-bg 12.18 · toast-muted on toast-bg 7.83 · toast-link on toast-bg 9.71

**UI boundaries (floor 3):** faint-deco / surface 4.09 · faint-deco / raise 3.73 · faint-deco / overlay 3.53 · ready / sunk (segment) 13.18 · brand / sunk (head) 10.79 · brand / page (focus) 10.51

**Glass worst case:** ink 12.44 · ink-2 8.83 · muted 5.83 · brand 7.46 · ready 9.11 · blocked 8.4 (ready barred)

**ΔE2000 identity vs ready · blocked · danger:** t1 51.4/52.1/41.1 · t2 53.7/55.4/30.8 · t3 15.2/32.9/64 · t4 29.9/16.1/47 · t5 51.4/52.9/34 · t6 35.7/43.8/57.8 · t7 75.3/44.5/18.1 · t8 36.8/36/32.3

**Luminance:** page 0.0033 · surface 0.0073 · raise 0.0128 · sunk 0.0019 · overlay 0.0163

## 1c After hours (adopted, D-40; `design/tokens.css`) — light

**Text on surfaces (floor 4.5)**

| Token | page | surface | raise | sunk | overlay |
|---|---|---|---|---|---|
| `--ink` | 16.18 | 17.77 | 16.86 | 14.66 | 17.77 |
| `--ink-2` | 9.17 | 10.06 | 9.55 | 8.3 | 10.06 |
| `--muted` | 5.49 | 6.02 | 5.72 | 4.97 | 6.02 |
| `--faint` | 5.49 | 6.02 | 5.72 | 4.97 | 6.02 |
| `--brand` | 5.6 | 6.14 | 5.83 | 5.07 | 6.14 |
| `--brand-ink` | 7.58 | 8.32 | 7.9 | 6.87 | 8.32 |
| `--ready` | 5.16 | 5.67 | 5.38 | 4.68 | 5.67 |
| `--blocked` | 5.19 | 5.7 | 5.41 | 4.7 | 5.7 |
| `--danger` | 5.5 | 6.04 | 5.73 | 4.98 | 6.04 |

**Pairs (floor 4.5):** ready on ready-soft 4.97 · blocked on blocked-soft 4.99 · danger on danger-soft 5.26 · brand-ink on brand-soft 7.23 · muted on sunk 4.97 · on-brand on brand 6.14 · on-ready on ready 5.67 · toast-ink on toast-bg 15.53 · toast-muted on toast-bg 10.01 · toast-link on toast-bg 9.92

**UI boundaries (floor 3):** faint-deco / surface 3.37 · faint-deco / raise 3.2 · faint-deco / overlay 3.37 · ready / sunk (segment) 4.68 · brand / sunk (head) 5.07 · brand / page (focus) 5.6

**Glass worst case:** ink 14.17 · ink-2 8.03 · muted 4.8 · brand 4.9 · ready 4.52 · blocked 4.55 (ready barred)

**ΔE2000 identity vs ready · blocked · danger:** t1 45.7/52.4/43.9 · t2 47.5/51/34 · t3 15.6/35/57.8 · t4 27.5/19.8/41.4 · t5 48/54.4/40.4 · t6 28.2/43.1/54.3 · t7 69.5/36.8/17 · t8 26.5/32.7/35.1

**Luminance:** page 0.9065 · surface 1 · raise 0.9466 · sunk 0.8165 · overlay 1
