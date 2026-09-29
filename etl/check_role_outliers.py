#!/usr/bin/env python3
"""
check_role_outliers.py — flag Metron credits whose role looks mistagged.

    py etl/check_role_outliers.py              # report only, exit 0
    py etl/check_role_outliers.py --min-total 4 --dominant-share 0.8

Reads etl/data/issue_credits.csv. For every Metron-sourced creator with a
clear dominant role (almost always `writer`, or almost always `cover`) across
the whole catalog, flags the rare issue where that same creator is instead
credited in an interior art role (`artist`, `inker` or `colorist`) — the
pattern Metron's own importer produces when it puts a writer's or a cover
painter's name in the wrong role field (e.g. crediting a painted-cover artist
as the interior artist/inker/colorist too, or a writer as an inker).

This is a heuristic, not a verdict:
- A writer who genuinely draws a fill-in page, or a cover artist who
  genuinely draws interiors sometimes, will be flagged too. Confirm against
  Metron (metron.cloud/issue/<id>/ or the API) before changing anything.
- Only Metron-sourced credits are considered, and only creators with enough
  history (`--min-total`) to call one role dominant.
- Never writes anything. It only reports.
"""

from __future__ import annotations

import argparse
import csv
from collections import Counter, defaultdict
from pathlib import Path

ART_ROLES = {"artist", "inker", "colorist"}
DOMINANT_ROLES = ("writer", "cover")


def read_metron_credits(path: Path) -> list[dict]:
    if not path.exists():
        raise SystemExit(f"{path} not found")
    with path.open(newline="", encoding="utf-8-sig") as fh:
        rows = [r for r in csv.DictReader(fh) if (r.get("source") or "").strip().lower() == "metron"]
    return rows


def creator_role_counts(rows: list[dict]) -> dict[str, Counter]:
    by_creator: dict[str, Counter] = defaultdict(Counter)
    for r in rows:
        by_creator[r["creator"]][r["role"]] += 1
    return by_creator


def find_outliers(by_creator: dict[str, Counter], min_total: int = 6,
                   dominant_share: float = 0.85, max_outliers: int = 2) -> list[dict]:
    """A creator whose Metron history is >= dominant_share writer (or cover),
    with 1..max_outliers credits sitting in an interior art role instead."""
    flags = []
    for creator, counts in by_creator.items():
        total = sum(counts.values())
        if total < min_total:
            continue
        art_total = sum(counts.get(r, 0) for r in ART_ROLES)
        if not (1 <= art_total <= max_outliers):
            continue
        for dominant in DOMINANT_ROLES:
            share = counts.get(dominant, 0) / total
            if share >= dominant_share:
                flags.append({
                    "creator": creator, "dominant_role": dominant,
                    "dominant_count": counts.get(dominant, 0),
                    "outlier_count": art_total, "total": total,
                    "counts": dict(counts),
                })
                break  # a creator can only be flagged once, under their strongest dominant role
    return flags


def outlier_rows(rows: list[dict], flags: list[dict]) -> list[dict]:
    """The specific (label, role) rows behind each flagged creator, i.e. the
    interior-art-role credits for a writer- or cover-dominant creator."""
    dominant_by_creator = {f["creator"]: f["dominant_role"] for f in flags}
    return [r for r in rows
            if r["creator"] in dominant_by_creator and r["role"] in ART_ROLES]


def main(argv=None) -> int:
    ap = argparse.ArgumentParser(description=__doc__.split("\n\n")[0])
    ap.add_argument("--data", default="etl/data")
    ap.add_argument("--min-total", type=int, default=6,
                     help="minimum Metron credits before a creator's dominant role counts")
    ap.add_argument("--dominant-share", type=float, default=0.85,
                     help="share of a creator's credits that must sit in one role to call it dominant")
    ap.add_argument("--max-outliers", type=int, default=2,
                     help="at most this many interior-art credits before it looks like a real second role")
    ap.add_argument("--limit", type=int, default=50, help="max creators to print")
    args = ap.parse_args(argv)

    path = Path(args.data) / "issue_credits.csv"
    rows = read_metron_credits(path)
    by_creator = creator_role_counts(rows)
    flags = find_outliers(by_creator, args.min_total, args.dominant_share, args.max_outliers)
    flags.sort(key=lambda f: -f["dominant_count"])

    if not flags:
        print("no role outliers found")
        return 0

    by_creator_rows: dict[str, list[dict]] = defaultdict(list)
    for r in outlier_rows(rows, flags):
        by_creator_rows[r["creator"]].append(r)

    print(f"{len(flags)} creators flagged (dominant role >= {args.dominant_share:.0%} of "
          f">= {args.min_total} Metron credits, with 1-{args.max_outliers} interior-art outliers)")
    print("this is a heuristic -- confirm against Metron before changing anything\n")
    for f in flags[:args.limit]:
        print(f"{f['creator']} -- {f['dominant_role']} {f['dominant_count']}/{f['total']}, "
              f"{f['outlier_count']} outlier(s): {f['counts']}")
        for r in sorted(by_creator_rows[f["creator"]], key=lambda r: r["label"]):
            print(f"    {r['label']}: {r['role']}")
    if len(flags) > args.limit:
        print(f"\n… and {len(flags) - args.limit} more (raise --limit to see them)")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
