#!/usr/bin/env python3
"""
volumes.py — propose a volume year for every issue label written without one.

This does NOT edit anything. It emits volume_map.csv for you to review and
correct, which extract.py then applies with --volume-map. The split exists
because "assume the initial volume" is right for most series and wrong for the
ones Marvel renumbered, and a wrong year is worse than a missing one: it makes
a label look authoritative when it isn't.

    python3 etl/volumes.py --comics Comics.xlsx --out volume_map.csv
    # review and edit volume_map.csv, set approved=yes on rows you accept
    python3 etl/extract.py --comics Comics.xlsx --books Books.xlsx \
        --out seed --volume-map volume_map.csv
"""

import argparse
import csv
import re
from collections import defaultdict
from pathlib import Path

import pandas as pd

LABEL = re.compile(r"^(?P<title>.*?)(?:\s*\((?P<year>\d{4})\))?\s*#\s*(?P<num>\d+)")

# First-volume years for series where "initial volume" is unambiguous and the
# bare issue numbers in the sheet corroborate it. Everything else is left blank
# for a human. Add to this map as you confirm rows.
KNOWN_FIRST_VOLUME = {
    "Fantastic Four": 1961,
    "Uncanny X-Men": 1963,
    "Amazing Spider-Man": 1963,
    "The Amazing Spider-Man": 1963,
    "Daredevil": 1964,
    "Captain America": 1968,
    "Thor": 1966,
    "Iron Man": 1968,
    "Journey into Mystery": 1952,
    "Marvel Premiere": 1972,
    "X-Factor": 1986,
    "New Mutants": 1983,
    "Excalibur": 1988,
    "Alpha Flight": 1983,
    "Moon Knight": 1980,
    "Hawkeye": 2012,
    "New Avengers": 2005,
    "Secret Avengers": 2010,
    "Secret Warriors": 2009,
    "Ultimate Spider-Man": 2000,
    "Ultimate Comics Spider-Man": 2011,
    "New X-Men": 2004,
    "The Mighty Avengers": 2007,
    "Uncanny Avengers": 2012,
    "Marauders": 2019,
    "Ms. Marvel": 2014,
    "Eternals": 1976,
    "Silver Surfer": 1968,
    "Avengers": 1963,
}

# Series where the blanket rule is actively wrong. Never auto-propose these.
RENUMBER_TRAPS = {
    "Incredible Hulk":
        "vol 1 is 1962 #1-6; the 1968 volume runs #102-474. Bare labels here "
        "span both, so one year cannot be correct for all of them. Split by "
        "issue number: #1-6 -> 1962, #102+ -> 1968.",
    "Secret Wars":
        "bare range is #0-12, which matches Hickman's 2015 series, not the "
        "1984 original. The sheet already writes the original as (1984), so "
        "bare almost certainly means 2015.",
    "Venom":
        "bare range #159-262 does not match any Venom volume's own numbering "
        "— it is legacy numbering applied to a later volume. Needs a look "
        "before any year is assigned.",
    "X-Men":
        "bare range #1-204 fits the 1991 volume, and the sheet also writes "
        "(1991) explicitly. Two spellings of the same volume, not a missing "
        "first volume.",
    "Punisher":
        "bare #1-65 could be the 1987 ongoing, the 2000 Marvel Knights run, "
        "or PunisherMAX. Ambiguous on its face.",
    "Wolverine":
        "bare #1-85 fits the 1988 ongoing, but the sheet writes (1982) for the "
        "Claremont/Miller miniseries and (1988) elsewhere. Confirm which.",
}


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--comics", required=True, type=Path)
    ap.add_argument("--out", default=Path("etl/data/volume_map.csv"), type=Path)
    args = ap.parse_args()

    df = pd.read_excel(args.comics, "Reading Orders")
    df = df[df["Run ID"].notna() & df["Issue"].notna()]

    seen: dict[str, dict] = defaultdict(lambda: {"bare": [], "years": set(), "runs": set()})
    for _, r in df.iterrows():
        m = LABEL.match(str(r["Issue"]).strip())
        if not m:
            continue
        t = m.group("title").strip()
        if m.group("year"):
            seen[t]["years"].add(int(m.group("year")))
        else:
            seen[t]["bare"].append(int(m.group("num")))
            seen[t]["runs"].add(str(r["Run ID"]))

    rows = []
    for title, info in sorted(seen.items()):
        if not info["bare"]:
            continue
        lo, hi = min(info["bare"]), max(info["bare"])
        years = sorted(info["years"])
        trap = RENUMBER_TRAPS.get(title)
        proposed = "" if trap else KNOWN_FIRST_VOLUME.get(title, "")

        if trap:
            conf, note = "review", trap
        elif proposed and years:
            conf, note = "high", (
                f"initial volume; sheet already writes later volumes as "
                f"{', '.join(str(y) for y in years)}")
        elif proposed:
            conf, note = "high", "initial volume, no competing volumes in the sheet"
        elif not years:
            conf, note = "low", (
                "never written with a year anywhere in the sheet — probably "
                "unambiguous as-is; leaving it alone is fine")
        else:
            conf, note = "review", (
                f"no entry in KNOWN_FIRST_VOLUME; sheet uses "
                f"{', '.join(str(y) for y in years)} elsewhere")

        rows.append({
            "series": title,
            "bare_issues": len(info["bare"]),
            "bare_range": f"#{lo}-{hi}",
            "years_used_elsewhere": ";".join(str(y) for y in years),
            "runs": ";".join(sorted(info["runs"])[:4]),
            "proposed_year": proposed,
            "confidence": conf,
            "approved": "yes" if conf == "high" else "",
            "note": note,
        })

    rows.sort(key=lambda r: (-r["bare_issues"],))
    cols = ["series", "bare_issues", "bare_range", "years_used_elsewhere", "runs",
            "proposed_year", "confidence", "approved", "note"]
    with args.out.open("w", newline="", encoding="utf-8") as fh:
        w = csv.DictWriter(fh, fieldnames=cols)
        w.writeheader()
        w.writerows(rows)

    by = defaultdict(int)
    for r in rows:
        by[r["confidence"]] += 1
    total_bare = sum(r["bare_issues"] for r in rows)
    auto = sum(r["bare_issues"] for r in rows if r["approved"] == "yes")

    print(f"{len(rows)} series written without a volume year, {total_bare} labels")
    for k in ("high", "review", "low"):
        n = sum(r['bare_issues'] for r in rows if r['confidence'] == k)
        print(f"  {k:8s} {by[k]:4d} series  {n:5d} labels")
    print(f"\npre-approved: {auto} labels. Review the rest in {args.out}.")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
