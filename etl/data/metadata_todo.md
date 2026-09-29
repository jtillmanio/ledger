# Comic metadata to-do

Generated 2026-09-29 by `npm run sidecars` from `etl/data/*.csv` and `seed/`.
Regenerate after each batch of hand entry: filled items drop off. Tick a box to
mark an item handled, including "looked, nothing to find"; a tick survives
regeneration for as long as the item is still listed.

Writer and artist are the only roles a run's credit line reads, and a run's
years come from its earliest and latest cover dates. Story titles are optional.
Enter values as START-HERE 8c-4 describes: `source` = `hand`, Fandom's
Penciler as `artist`, creators spelled as Metron spells them (the checker
adds the Metron id when the spelling matches).

| Section | Open |
| --- | ---: |
| Not on Metron — hand entry only | 0 |
| On Metron, but Metron credits nobody | 0 |
| On Metron, still missing a writer, artist or date | 0 |
| Story titles only (optional) | 0 issues |

## Runs with an empty credit line

Credit two or three issues per creator and the line fills in; the issues themselves are listed below.

Nothing — every run names a writer and an artist.

## Not on Metron — hand entry only (0)

Metron has no record of these. Marvel Fandom is the source.

Nothing open.

## On Metron, but Metron credits nobody (0)

Metron knows the issue and credits nobody on it. Recent issues may fill in later: `npm run enrich:refresh` asks Metron again. A hand credit claims its role for good, so a refresh won't replace it.

Nothing open.

## On Metron, still missing a writer, artist or date (0)

Metron credited these, just not every role the run needs.

Nothing open.

## Story titles only (optional)

Everything else on these issues is in. One box per series.

917 issues aren't listed here or marked `(+ title)` above: their Fandom page exists and its title is blank, so there's nothing to find (`no story title on Fandom either` in `etl/data/fandom_skipped.csv`). `npm run sidecars -- --keep-fandom-untitled` lists them again.

