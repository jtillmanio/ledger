#!/usr/bin/env python3
"""
extract.py — one-way migration from the Google Sheets exports into normalized CSVs.

Usage:
    python3 etl/extract.py --comics etl/data/Comics.xlsx --books etl/data/Books.xlsx --out seed/

Reads cached values only (never evaluates formulas), normalizes whitespace,
resolves foreign keys, and writes one CSV per table plus unresolved.csv for
anything that failed a reference check. Run it as many times as you like; it
is idempotent and writes nothing back to the source workbooks.
"""

import argparse
import csv
import datetime
import numbers
import re
import sys
import unicodedata
from collections import OrderedDict
from pathlib import Path

import pandas as pd

# --------------------------------------------------------------------------
# helpers
# --------------------------------------------------------------------------

UNRESOLVED: list[dict] = []
# series -> list of rules: (run_id, issue_from, issue_to, year).
# None means "any". Rules are matched most-specific-first.
VOLUME_MAP: dict[str, list[tuple[str | None, int | None, int | None, int]]] = {}
# The same approved rows, in file order, for seed/volume_rules.csv.
VOLUME_RULES: list[dict] = []

LABEL_RE = re.compile(r"^(?P<title>.*?)(?:\s*\((?P<year>\d{4})\))?\s*#\s*(?P<rest>.+)$")


def load_volume_map(path) -> None:
    """Approved series -> volume year, from etl/volumes.py output."""
    if not path:
        return
    skipped = 0
    with open(path, newline="", encoding="utf-8") as fh:
        for row in csv.DictReader(fh):
            if row.get("approved", "").strip().lower() != "yes":
                continue
            year = as_int(row.get("proposed_year"))
            if not year:
                skipped += 1
                flag("volume_map", "approved with no year",
                     f"{row['series']} — left unchanged")
                continue
            run = (row.get("run_id") or "").strip() or None
            lo = as_int(row.get("issue_from"))
            hi = as_int(row.get("issue_to"))
            VOLUME_MAP.setdefault(row["series"].strip(), []).append((run, lo, hi, year))
            VOLUME_RULES.append({"series": row["series"].strip(), "run_id": run,
                                 "issue_from": lo, "issue_to": hi, "year": year})
    # Most specific first: run + range, then run, then range, then series-wide.
    for rules in VOLUME_MAP.values():
        rules.sort(key=lambda r: (r[0] is None, r[1] is None and r[2] is None))
    rules = sum(len(v) for v in VOLUME_MAP.values())
    print(f"volume map: {len(VOLUME_MAP)} series, {rules} rules"
          + (f", {skipped} approved rows skipped (no year)" if skipped else ""))


TRAILING_YEAR = re.compile(
    r"^(?P<title>.*?)\s*#\s*(?P<num>[0-9A-Za-z.\-]+)\s*\((?P<year>\d{4})\)\s*$")


def normalize_label(label: str) -> str:
    """Move a trailing volume year in front of the issue number.

    11 labels in the sheet are written `Daredevil Annual #1 (2007)` rather than
    the canonical `Daredevil Annual (2007) #1`. The year is present, just in the
    wrong place, so the parser reads them as year-less and they surface as false
    ambiguities in the volume map.
    """
    m = TRAILING_YEAR.match(label)
    if not m:
        return label
    fixed = f"{m.group('title').strip()} ({m.group('year')}) #{m.group('num')}"
    flag("issues", "label reordered",
         f"{label} -> {fixed} (year was after the issue number)")
    return fixed


def apply_volume_year(label: str, run_id: str | None = None) -> str:
    """Insert the approved volume year into a label that omits one."""
    if not VOLUME_MAP:
        return label
    m = LABEL_RE.match(label)
    if not m or m.group("year"):
        return label
    title = m.group("title").strip()
    rules = VOLUME_MAP.get(title)
    if not rules:
        return label
    num_m = re.match(r"\s*(\d+)", m.group("rest"))
    num = as_int(num_m.group(1)) if num_m else None
    for run, lo, hi, year in rules:
        if run is not None and run != run_id:
            continue
        if lo is not None or hi is not None:
            if num is None:
                continue
            if (lo is not None and num < lo) or (hi is not None and num > hi):
                continue
        return f"{title} ({year}) #{m.group('rest')}"
    flag("volume_map", "no rule matched", f"{label} (run {run_id})")
    return label


# label -> (cover_date "YYYY-MM-DD", source, metron_id). From cover_dates.csv.
COVER_DATES: dict[str, tuple[str, str, int | None]] = {}
# run_id -> {"decision", "proposed_why", "final_why"}. From why_review.csv.
WHY_REVIEW: dict[str, dict] = {}

DATE_RE = re.compile(r"^(?P<y>\d{4})(?:-(?P<m>\d{1,2})(?:-(?P<d>\d{1,2}))?)?$")


def normalize_date(raw: str | None) -> str | None:
    """Accept YYYY, YYYY-MM or YYYY-MM-DD; return YYYY-MM-DD or None.

    Hand-entered dates are often only a month or a year. A missing month or day
    becomes 01, which keeps the year — the only part run_span reports — exact.
    """
    m = DATE_RE.match((raw or "").strip())
    if not m:
        return None
    y, mo, d = int(m["y"]), int(m["m"] or 1), int(m["d"] or 1)
    if not (1930 <= y <= 2100 and 1 <= mo <= 12 and 1 <= d <= 31):
        return None
    return f"{y:04d}-{mo:02d}-{d:02d}"


def load_cover_dates(path) -> None:
    """Publication dates per issue label, from etl/enrich_comics.py plus hand entry.

    Keyed by label rather than issue id: ids are run#sequence and shift when a
    reading order changes, while a label is the issue itself and sits in
    several runs (581 labels do).
    """
    if not path:
        return
    if not Path(path).exists():
        print(f"cover dates: {path} not found — issues load undated")
        return
    counts = {"metron": 0, "hand": 0}
    with open(path, newline="", encoding="utf-8-sig") as fh:
        for row in csv.DictReader(fh):
            label = clean(row.get("label"))
            raw = (row.get("cover_date") or "").strip()
            if not label or not raw:
                continue
            source = (row.get("source") or "").strip().lower()
            if source not in counts:
                flag("cover_dates", "date without a valid source",
                     f"{label}: source {source!r} — set it to hand or metron")
                continue
            date = normalize_date(raw)
            if not date:
                flag("cover_dates", "unparseable date", f"{label}: {raw!r}")
                continue
            COVER_DATES[label] = (date, source, as_int(row.get("metron_issue_id")))
            counts[source] += 1
    print(f"cover dates: {counts['metron']} from Metron, {counts['hand']} by hand")


def load_why_review(path) -> None:
    """Reviewed whys. decision: accept | edit | keep (blank counts as keep)."""
    if not path:
        return
    if not Path(path).exists():
        print(f"why review: {path} not found — whys load from the workbook")
        return
    with open(path, newline="", encoding="utf-8-sig") as fh:
        for row in csv.DictReader(fh):
            rid = clean(row.get("run_id"))
            if rid:
                WHY_REVIEW[rid] = row
    print(f"why review: {len(WHY_REVIEW)} runs")


def resolve_why(run_id: str, workbook_why: str | None) -> tuple[str | None, str]:
    """Return (why, why_source) for a run, honoring the review decision."""
    row = WHY_REVIEW.get(run_id)
    if row is None:
        return workbook_why, "hand"
    decision = (row.get("decision") or "").strip().lower()
    if decision == "accept":
        proposed = clean(row.get("proposed_why"))
        if proposed:
            return proposed, "claude"
        flag("why_review", "accepted an empty proposal", f"{run_id}: kept the workbook why")
        return workbook_why, "hand"
    if decision == "edit":
        final = clean(row.get("final_why"))
        if final:
            return final, "hand"
        flag("why_review", "edit with no final_why", f"{run_id}: kept the workbook why")
        return workbook_why, "hand"
    if decision not in {"", "keep"}:
        flag("why_review", "unknown decision", f"{run_id}: {decision!r}, kept the workbook why")
    return workbook_why, "hand"


# label -> accepted replacement label. From label_review.csv.
LABEL_RENAMES: dict[str, str] = {}
USED_RENAMES: set[str] = set()
# label -> {"story_title", "story_title_source", "cover_url", "metron_issue_id"}.
ISSUE_DETAILS: dict[str, dict] = {}
# label -> [(creator name, metron creator id, role, source)]. From issue_credits.csv.
ISSUE_CREDITS: dict[str, list[tuple[str, int | None, str, str]]] = {}
ROLES = ("writer", "artist", "inker", "colorist", "letterer", "cover")
SOURCES = ("metron", "hand")
# slug of another spelling -> the creator name it means. From creator_aliases.csv
# and creator_review.csv's accepted rows,
# so a sheet's "Walt Simonson" and Metron's Walter Simonson are one person.
CREATOR_ALIASES: dict[str, str] = {}


def load_label_review(path) -> None:
    """Label corrections proposed by etl/enrich_comics.py. Only `accept` applies.

    An AI- or Metron-proposed label never reaches the database without an
    explicit accept (CLAUDE.md). Blank and `reject` leave the label as it is.
    """
    if not path:
        return
    if not Path(path).exists():
        print(f"label review: {path} not found — labels load as the sheet has them")
        return
    accepted = 0
    with open(path, newline="", encoding="utf-8-sig") as fh:
        for row in csv.DictReader(fh):
            label = clean(row.get("label"))
            if not label:
                continue
            decision = (row.get("decision") or "").strip().lower()
            proposed = clean(row.get("proposed_label"))
            if decision == "accept":
                if not proposed:
                    flag("label_review", "accepted with no proposed_label", label)
                    continue
                if proposed != label:
                    LABEL_RENAMES[label] = proposed
                    accepted += 1
            elif decision not in {"", "reject"}:
                flag("label_review", "unknown decision", f"{label}: {decision!r}, left unchanged")
    for old, new in LABEL_RENAMES.items():
        if new in LABEL_RENAMES:
            flag("label_review", "rename chain",
                 f"{old} -> {new} -> {LABEL_RENAMES[new]}: only the first step applies")
    print(f"label review: {accepted} renames accepted")


def apply_rename(label: str) -> str:
    new = LABEL_RENAMES.get(label)
    if new is None:
        return label
    USED_RENAMES.add(label)
    return new


def load_issue_details(path) -> None:
    """Story titles and cover URLs per label, from etl/enrich_comics.py plus hand entry."""
    if not path:
        return
    if not Path(path).exists():
        print(f"issue details: {path} not found — issues load untitled")
        return
    counts = {"metron": 0, "hand": 0}
    with open(path, newline="", encoding="utf-8-sig") as fh:
        for row in csv.DictReader(fh):
            label = clean(row.get("label"))
            if not label:
                continue
            title = clean(row.get("story_title"))
            source = (row.get("story_title_source") or "").strip().lower()
            if title and source not in SOURCES:
                flag("issue_details", "story title without a valid source",
                     f"{label}: source {source!r} — set it to hand or metron")
                title = None
            ISSUE_DETAILS[label] = {
                "story_title": title,
                "story_title_source": source if title else None,
                "cover_url": clean(row.get("cover_url")),
                "metron_issue_id": as_int(row.get("metron_issue_id")),
            }
            if title:
                counts[source] += 1
    print(f"issue details: {len(ISSUE_DETAILS)} labels, story titles "
          f"{counts['metron']} from Metron, {counts['hand']} by hand")


def load_issue_credits(path) -> None:
    """Creator credits per label and role, from etl/enrich_comics.py plus hand entry."""
    if not path:
        return
    if not Path(path).exists():
        print(f"issue credits: {path} not found — issues load uncredited")
        return
    n = 0
    with open(path, newline="", encoding="utf-8-sig") as fh:
        for row in csv.DictReader(fh):
            label, creator = clean(row.get("label")), clean(row.get("creator"))
            if not label or not creator:
                continue
            role = (row.get("role") or "").strip().lower()
            source = (row.get("source") or "").strip().lower()
            if role not in ROLES:
                flag("issue_credits", "unknown role", f"{label}: {creator} as {role!r}")
                continue
            if source not in SOURCES:
                flag("issue_credits", "credit without a valid source",
                     f"{label}: {creator} ({role}) source {source!r} — set it to hand or metron")
                continue
            entry = (creator, as_int(row.get("metron_creator_id")), role, source)
            credits = ISSUE_CREDITS.setdefault(label, [])
            if entry not in credits:
                credits.append(entry)
                n += 1
    print(f"issue credits: {n} credits on {len(ISSUE_CREDITS)} labels")


def load_creator_aliases(*paths) -> None:
    """Other spellings of a creator's name, each mapped to the name credits use:
    creator_aliases.csv, and creator_review.csv rows whose decision is accept.
    A file with a decision column counts only its accepted rows."""
    for path in paths:
        if path:
            read_creator_aliases(Path(path))
    for key, creator in list(CREATOR_ALIASES.items()):
        if slug(creator) in CREATOR_ALIASES:
            flag("creator_aliases", "alias points at another alias",
                 f"{key} -> {creator} -> {CREATOR_ALIASES[slug(creator)]}; point it at the last")
    print(f"creator aliases: {len(CREATOR_ALIASES)}")


def read_creator_aliases(path: Path) -> None:
    if not path.exists():
        print(f"creator aliases: {path} not found")
        return
    with open(path, newline="", encoding="utf-8-sig") as fh:
        for row in csv.DictReader(fh):
            if "decision" in row and (row["decision"] or "").strip().lower() not in ("accept", "yes", "y"):
                continue
            alias, creator = clean(row.get("alias")), clean(row.get("creator"))
            if not alias or not creator:
                flag("creator_aliases", "alias row missing a name", f"{alias!r} -> {creator!r}")
                continue
            key = slug(alias)
            if key == slug(creator):
                continue
            held = CREATOR_ALIASES.get(key)
            if held and slug(held) != slug(creator):
                flag("creator_aliases", "alias names two creators",
                     f"{alias}: {held} and {creator}; kept {held}")
                continue
            CREATOR_ALIASES[key] = creator


def canonical_creator(name: str) -> str:
    """The name credits use for this person, through creator_aliases.csv."""
    return CREATOR_ALIASES.get(slug(name), name)


def is_hand_entry(name: str, value) -> bool:
    """Does a sidecar entry carry a hand-entered value?"""
    if value is None:
        return False
    if name == "cover_dates":
        return value[1] == "hand"
    if name == "issue_details":
        return value.get("story_title_source") == "hand"
    return any(source == "hand" for _, _, _, source in value)


def sidecar(table: dict, label: str, original: str, name: str):
    """Look a label up in a sidecar, falling back to its pre-rename spelling.

    enrich_comics.py rekeys its files when a rename is accepted; until it has
    run again, the row still sits under the old label. Use it, and say so. When
    both spellings have a row, a hand value under the old spelling still wins —
    an accepted rename must never cost a typed value.
    """
    new = table.get(label)
    old = table.get(original) if original != label else None
    if old is None:
        return new
    if new is not None and not is_hand_entry(name, old):
        return new
    flag(name, "keyed by pre-rename label",
         f"{original} -> {label}: re-run etl/enrich_comics.py to rekey")
    if new is None or name != "issue_credits":
        return old
    # Credits: the old spelling's hand roles, plus the new spelling's other roles.
    hand_roles = {role for _, _, role, source in old if source == "hand"}
    return ([c for c in old if c[2] in hand_roles]
            + [c for c in new if c[2] not in hand_roles])


def flag(table: str, reason: str, detail: str) -> None:
    UNRESOLVED.append({"table": table, "reason": reason, "detail": detail})


# NFKC spells a fraction glyph out with the fraction slash, so `#1½` would become
# `#11⁄2` (eleven halves) and `#½` would become `#1⁄2`. Put the glyph back: one
# spelling per half issue, and it's the one Metron's canonical labels use.
FRACTION_RE = re.compile("(?:1⁄2|1⁄4|3⁄4)(?![0-9])")
FRACTION_GLYPHS = {"1⁄2": "½", "1⁄4": "¼", "3⁄4": "¾"}


def clean(v) -> str | None:
    """Trim, collapse internal whitespace, normalize unicode dashes/quotes.
    Fraction glyphs survive: `#1½` stays `#1½`, and `#1⁄2` becomes `#½`."""
    if v is None or (isinstance(v, float) and pd.isna(v)):
        return None
    s = str(v)
    s = unicodedata.normalize("NFKC", s)
    s = FRACTION_RE.sub(lambda m: FRACTION_GLYPHS[m.group()], s)
    s = s.replace("\u2013", "-").replace("\u2014", "-")
    s = re.sub(r"\s+", " ", s).strip()
    return s or None


def cell_text(v) -> str | None:
    """A cell as the text the owner typed (task 1.14, owner). Excel stores a
    title like 11/22/63 as a date and 1984 as a number, and pandas hands back a
    datetime or a float: a date comes back in Excel's US short date (m/d/yy), a
    whole number without its `.0`. Anything else is str() as before."""
    if v is None or (isinstance(v, float) and pd.isna(v)) or v is pd.NaT:
        return None
    if isinstance(v, (datetime.datetime, datetime.date)):
        return f"{v.month}/{v.day}/{v:%y}"
    if isinstance(v, float) and v.is_integer():
        return str(int(v))
    return str(v)


def title_text(v) -> str | None:
    """A title cell, read as text and then cleaned."""
    return clean(cell_text(v))


def as_int(v) -> int | None:
    if v is None or (isinstance(v, float) and pd.isna(v)):
        return None
    try:
        return int(float(v))
    except (TypeError, ValueError):
        return None


def as_bool(v) -> bool:
    return str(v).strip().upper() in {"TRUE", "1", "YES", "Y"}


def slug(*parts: str) -> str:
    raw = " ".join(p for p in parts if p)
    raw = unicodedata.normalize("NFKD", raw).encode("ascii", "ignore").decode()
    raw = re.sub(r"[^a-zA-Z0-9]+", "-", raw).strip("-").lower()
    return raw[:120] or "unknown"


def issue_slug(label: str) -> str:
    """Issue id from its label. Keeps a negative issue number distinct:
    `Deadpool (1997) #-1` is not `Deadpool (1997) #1`. Keeps a fraction distinct
    too: the ASCII fold would drop `½` and turn `#1½` into `1`, colliding with
    `#1`, so `½` and the fraction slash become `-` first (`#½` -> `...-1-2`,
    `#1½` -> `...-11-2`)."""
    for glyph, spelled in FRACTION_GLYPHS.items():
        label = label.replace(spelled, glyph)
    for glyph, spelled in (("½", "1-2"), ("¼", "1-4"), ("¾", "3-4"), ("⁄", "-")):
        label = label.replace(glyph, spelled)
    return slug(re.sub(r"#\s*-", "# minus ", label))


def key(title: str | None) -> str:
    """Loose match key for dedupe: lowercase, alphanumeric only."""
    return re.sub(r"[^a-z0-9]", "", (title or "").lower())


def write(out: Path, name: str, rows: list[dict], columns: list[str]) -> None:
    path = out / f"{name}.csv"
    with path.open("w", newline="", encoding="utf-8") as fh:
        w = csv.DictWriter(fh, fieldnames=columns, extrasaction="ignore")
        w.writeheader()
        for r in rows:
            w.writerow(r)
    print(f"  {name:<18} {len(rows):>6} rows -> {path}")


def sheet(xl: pd.ExcelFile, name: str, header=0) -> pd.DataFrame:
    if name not in xl.sheet_names:
        flag("_workbook", "missing sheet", name)
        return pd.DataFrame()
    return xl.parse(name, header=header)


def prereq_cycles(prereqs: list[dict]) -> list[list[dict]]:
    """Every loop in the prereq graph (task 2.11a): each strongly connected
    component of more than one run, and each run listed as its own prereq, as
    its edges in sheet order. Hard and soft edges alike. Tarjan, iterative so a
    long chain can't hit the recursion limit, visiting nodes and neighbours in
    sorted order so every run reports the same thing; components are ordered
    by their first run."""
    graph: dict[str, list[str]] = {}
    for e in prereqs:
        graph.setdefault(e["run_id"], []).append(e["prereq_run_id"])
        graph.setdefault(e["prereq_run_id"], [])
    graph = {n: sorted(set(nexts)) for n, nexts in graph.items()}

    index: dict[str, int] = {}
    low: dict[str, int] = {}
    stack: list[str] = []
    on_stack: set[str] = set()
    components: list[set[str]] = []
    for root in sorted(graph):
        if root in index:
            continue
        index[root] = low[root] = len(index)
        stack.append(root)
        on_stack.add(root)
        work = [(root, iter(graph[root]))]
        while work:
            node, nexts = work[-1]
            for nxt in nexts:
                if nxt not in index:
                    index[nxt] = low[nxt] = len(index)
                    stack.append(nxt)
                    on_stack.add(nxt)
                    work.append((nxt, iter(graph[nxt])))
                    break
                if nxt in on_stack:
                    low[node] = min(low[node], index[nxt])
            else:
                work.pop()
                if work:
                    parent = work[-1][0]
                    low[parent] = min(low[parent], low[node])
                if low[node] == index[node]:
                    component = set()
                    while True:
                        n = stack.pop()
                        on_stack.discard(n)
                        component.add(n)
                        if n == node:
                            break
                    components.append(component)

    loops = [c for c in components if len(c) > 1 or next(iter(c)) in graph[next(iter(c))]]
    return [[e for e in prereqs if e["run_id"] in c and e["prereq_run_id"] in c]
            for c in sorted(loops, key=min)]


def cycle_detail(edges: list[dict]) -> str:
    """`3 runs: x, y, z | hard: x -> y, z -> x | soft: y -> z`: the runs sorted,
    then the hard edges before the soft, each in sheet order."""
    runs = sorted({e["run_id"] for e in edges} | {e["prereq_run_id"] for e in edges})
    parts = [f"{len(runs)} run{'' if len(runs) == 1 else 's'}: {', '.join(runs)}"]
    for ptype in ("hard", "soft"):
        typed = [f"{e['run_id']} -> {e['prereq_run_id']}" for e in edges if e["type"] == ptype]
        if typed:
            parts.append(f"{ptype}: {', '.join(typed)}")
    return " | ".join(parts)


# --------------------------------------------------------------------------
# comics
# --------------------------------------------------------------------------

def extract_comics(path: Path, out: Path) -> None:
    xl = pd.ExcelFile(path)
    print(f"\ncomics <- {path.name}")

    # ---- runs ------------------------------------------------------------
    raw = sheet(xl, "RUNS")
    raw = raw[raw["Run ID"].notna()]

    runs, run_tracks, track_names = [], [], OrderedDict()
    workbook_fields = []
    for _, r in raw.iterrows():
        rid = clean(r["Run ID"])
        if not rid:
            continue
        why, why_source = resolve_why(rid, clean(r.get("Why")))
        runs.append({
            "id": rid,
            "title": clean(r.get("Title")),
            "tier": as_int(r.get("Tier")),
            "block": as_int(r.get("Block")),
            "sequence": as_int(r.get("Sequence")),
            "spine": as_bool(r.get("Spine")),
            "rating": as_int(r.get("Rating")),
            "why": why,
            "why_source": why_source,
            "notes": clean(r.get("Notes")),
            "placeholder": False,
        })
        # Series (and Issues), Start Year, End Year, Writer and Artists are not
        # loaded: run_span and run_credit_line derive them from the issues. The
        # typed values are kept as a report so the two can be compared.
        workbook_fields.append({
            "id": rid,
            "writer": clean(r.get("Writer")),
            "artists": clean(r.get("Artists")),
            "series_issues": clean(r.get("Series (and Issues)")),
            "start_year": as_int(r.get("Start Year")),
            "end_year": as_int(r.get("End Year")),
        })
        for t in (clean(r.get("Track")) or "").split(","):
            t = t.strip()
            if not t:
                continue
            track_names.setdefault(t, slug(t))
            run_tracks.append({"run_id": rid, "track_id": track_names[t]})

    run_ids = {r["id"] for r in runs}

    # ---- prereqs ---------------------------------------------------------
    raw = sheet(xl, "PREREQS")
    raw = raw[raw["Run ID"].notna()]
    prereqs = []
    seen_prereqs = set()
    for _, r in raw.iterrows():
        rid, pid = clean(r["Run ID"]), clean(r.get("Prereq Run ID"))
        ptype = (clean(r.get("Type")) or "soft").lower()
        if not rid or not pid:
            continue
        if (rid, pid) in seen_prereqs:
            flag("prereqs", "duplicate edge", f"{rid} -> {pid} appears more than once, kept first")
            continue
        seen_prereqs.add((rid, pid))
        # The sheet allows forward-declared prereq IDs. Materialize them as
        # placeholder runs rather than dropping the edge.
        for missing in (rid, pid):
            if missing not in run_ids:
                run_ids.add(missing)
                runs.append({"id": missing, "title": missing.replace("-", " ").title(),
                             "placeholder": True, "spine": False, "why_source": "hand"})
                flag("runs", "forward-declared prereq target",
                     f"{missing} (referenced by {rid}) inserted as placeholder")
        if ptype not in {"hard", "soft"}:
            flag("prereqs", "unknown type", f"{rid} -> {pid}: {ptype!r}, defaulted to soft")
            ptype = "soft"
        prereqs.append({"run_id": rid, "prereq_run_id": pid, "type": ptype})
    # Task 2.11a (D-2, R0-01): report every loop and load the edges anyway; the
    # owner untangles them in the workbook, and --fail-on-cycle stops cutover.
    for edges in prereq_cycles(prereqs):
        flag("prereqs", "prereq cycle", cycle_detail(edges))

    # ---- issues and placements ------------------------------------------
    # Track and Run Title in this tab are lookup formulas against RUNS.
    # They are dropped: the join replaces them.
    #
    # One issue row per distinct label; one run_issues row per sheet row. The
    # same comic in four runs is one issue, so credits attach once; read state
    # attaches to each placement.
    raw = sheet(xl, "Reading Orders")
    raw = raw[raw["Run ID"].notna() & raw["Issue"].notna()]
    issues: "OrderedDict[str, dict]" = OrderedDict()     # final label -> issue row
    ids_by_slug: dict[str, str] = {}                     # slug -> first label holding it
    placements, seq_by_run, sheet_pos_by_run = [], {}, {}
    placement_by_run_label: dict[tuple[str, str], int] = {}   # (run, label) -> placement id
    read_placements: set[int] = set()
    sheet_labels: set[str] = set()                       # every spelling the sheet uses
    for _, r in raw.iterrows():
        rid = clean(r["Run ID"])
        original = apply_volume_year(normalize_label(clean(r["Issue"])), rid)
        label = apply_rename(original)
        sheet_labels.update((original, label))
        if rid not in run_ids:
            flag("issues", "orphan run_id", f"{rid} / {label}")
            continue
        # One placement per (run, issue) — D-R2-1. The sheet lists 13 comics twice
        # in one run (the same seven issues twice in a row, with different Type
        # values), which looks like a block entered twice, not a planned reread.
        # Keep the first, drop the repeat, and say so. A planned reread is a note
        # on the placement, not a second row (D-19). A ticked repeat marks the
        # kept placement: same run, same issue, so nothing propagates.
        # sheet_pos counts every sheet row, dropped repeats included, so the
        # "sequence renumbered" check still compares like with like.
        sheet_pos = sheet_pos_by_run.get(rid, 0) + 1
        sheet_pos_by_run[rid] = sheet_pos
        kept = placement_by_run_label.get((rid, label))
        if kept is not None:
            flag("run_issues", "repeat placement dropped",
                 f"{rid}: {label} listed again in the sheet — kept the first placement only")
            if as_bool(r.get("Completed")):
                read_placements.add(kept)
            continue

        # The sheet's Sequence column is =IF($B2=$B1,F1+1,1), which restarts
        # whenever a run's rows are not contiguous. Row order is the real
        # reading order, so renumber from it and report the disagreements.
        seq = seq_by_run.get(rid, 0) + 1
        seq_by_run[rid] = seq
        sheet_seq = as_int(r.get("Sequence"))
        if sheet_seq is not None and sheet_seq != sheet_pos:
            flag("issues", "sequence renumbered",
                 f"{rid}: {label} was {sheet_seq} in the sheet, now {seq}")

        issue = issues.get(label)
        if issue is None:
            base = issue_slug(label)
            iid, n = base, 1
            while iid in ids_by_slug:
                n += 1
                iid = f"{base}-{n}"
            if n > 1:
                flag("issues", "labels share a slug",
                     f"{ids_by_slug[base]!r} and {label!r} — possibly one comic spelled two "
                     f"ways; loaded as {base} and {iid}")
            ids_by_slug[iid] = label
            cover_date, cover_source, metron_id = (
                sidecar(COVER_DATES, label, original, "cover_dates") or (None, None, None))
            details = sidecar(ISSUE_DETAILS, label, original, "issue_details") or {}
            issue = {
                "id": iid,
                "label": label,
                "cover_date": cover_date,
                "cover_date_source": cover_source,
                "story_title": details.get("story_title"),
                "story_title_source": details.get("story_title_source"),
                "cover_url": details.get("cover_url"),
                "metron_id": metron_id or details.get("metron_issue_id"),
                "_credits": sidecar(ISSUE_CREDITS, label, original, "issue_credits") or [],
            }
            issues[label] = issue
        # The placement id is its position in the sheet, counted across every run
        # (D-16), so issue_progress.csv can point at it before anything is loaded.
        pid = len(placements) + 1
        placement_by_run_label[(rid, label)] = pid
        if as_bool(r.get("Completed")):
            read_placements.add(pid)
        itype = (clean(r.get("Type")) or "core").lower()
        placements.append({
            "id": pid,
            "run_id": rid,
            "sequence": seq,
            "issue_id": issue["id"],
            "type": itype if itype in {"core", "optional", "recommended"} else "core",
            "notes": clean(r.get("Notes")),
        })

    for old in sorted(set(LABEL_RENAMES) - USED_RENAMES):
        flag("label_review", "stale label review",
             f"{old} -> {LABEL_RENAMES[old]}: accepted, but no sheet row has that label any more")

    # Sidecar rows whose label no sheet row uses any more (R2 L-8). Nothing prunes
    # them, so a label re-created later would silently inherit the old value.
    # Report, never delete: some are hand-typed, and removing them is the owner's call.
    for name, table in (("cover_dates", COVER_DATES), ("issue_details", ISSUE_DETAILS),
                        ("issue_credits", ISSUE_CREDITS)):
        for lab in sorted(set(table) - sheet_labels):
            hand = " (hand-entered)" if is_hand_entry(name, table[lab]) else ""
            flag(name, "sidecar row for a label not in the sheet",
                 f"{lab}{hand}: delete it from {name}.csv if that comic is gone for good")

    labels_by_metron: dict[int, list[str]] = {}
    for i in issues.values():
        if i["metron_id"]:
            labels_by_metron.setdefault(i["metron_id"], []).append(i["label"])
    for mid, labels in labels_by_metron.items():
        if len(labels) > 1:
            flag("issues", "one Metron issue under several labels",
                 f"Metron {mid}: {' | '.join(labels)} — accept a label_review rename to merge them")

    # Completed is per-user progress, not catalog data, and it belongs to the
    # placement: each Reading Orders row carries its own, so an issue ticked in
    # one run and not another is read in one and unread in the other (data model
    # 2.14). The sheet never recorded a date, so these load with precision 'none'
    # and a NULL completed_at (D-R3-1). Letting the column default fire would stamp
    # every pre-cutover read with the load time (R2-10).
    progress = [{"user_id": "$OWNER", "placement_id": pid,
                 "completed_at": "", "completed_at_precision": "none"}
                for pid in sorted(read_placements)]

    # ---- creators and credits --------------------------------------------
    creators: "OrderedDict[str, dict]" = OrderedDict()
    by_metron: dict[int, str] = {}
    credits, seen_credits = [], set()
    for i in issues.values():
        for name, mid, role, source in i.pop("_credits"):
            name = canonical_creator(name)
            if mid is not None and mid in by_metron:
                cid = by_metron[mid]
            else:
                cid = slug(name)
                held = creators.get(cid)
                if held and mid is not None and held["metron_id"] not in (None, mid):
                    cid = f"{cid}-m{mid}"
                    flag("creators", "two Metron creators share a name",
                         f"{name}: Metron {held['metron_id']} and {mid}; the second is {cid}")
                row = creators.setdefault(cid, {"id": cid, "name": name, "metron_id": None})
                if mid is not None and row["metron_id"] is None:
                    row["metron_id"] = mid
                if mid is not None:
                    by_metron[mid] = cid
            key3 = (i["id"], cid, role)
            if key3 in seen_credits:
                continue
            seen_credits.add(key3)
            credits.append({"issue_id": i["id"], "creator_id": cid, "role": role,
                            "source": source})

    # The workbook's typed writer is no longer loaded. Where credits exist and
    # none of the typed names appear among them, say so: one of the two is wrong.
    if credits:
        writers_by_issue: dict[str, set[str]] = {}
        for c in credits:
            if c["role"] == "writer":
                writers_by_issue.setdefault(c["issue_id"], set()).add(c["creator_id"])
        run_writers: dict[str, set[str]] = {}
        for pl in placements:
            run_writers.setdefault(pl["run_id"], set()).update(
                writers_by_issue.get(pl["issue_id"], set()))
        for wf in workbook_fields:
            typed = [slug(canonical_creator(n.strip())) for n in re.split(r",|&|/|;|\band\b", wf.get("writer") or "")
                     if n.strip()]
            derived = run_writers.get(wf["id"], set())
            if typed and derived and not any(
                    w == d or d.startswith(w + "-") for w in typed for d in derived):
                flag("runs", "workbook writer not in credits",
                     f"{wf['id']}: sheet says {wf['writer']!r}; credits say "
                     f"{', '.join(sorted(derived)[:5])}")

    # ---- events ----------------------------------------------------------
    raw = sheet(xl, "EVENTS")
    if "Runs Touched" not in raw.columns:
        raise SystemExit(
            "EVENTS tab has no 'Runs Touched' column — expected header not found, "
            "check for a rename in the sheet")
    raw = raw[raw["Event"].notna()]
    events, event_runs, seen_event_runs = [], [], set()
    for _, r in raw.iterrows():
        name = clean(r["Event"])
        eid = slug(name)
        events.append({
            "id": eid, "name": name, "year": as_int(r.get("Year")),
            "verdict": clean(r.get("Verdict")), "home_run_id": clean(r.get("Home")),
            "note": clean(r.get("Note")),
        })
        for t in (clean(r.get("Runs Touched")) or "").split(","):
            t = t.strip()
            if not t:
                continue
            if t not in run_ids:
                flag("event_runs", "not a known run", f"{name}: {t!r}")
                continue
            pair = (eid, t)
            if pair in seen_event_runs:
                flag("event_runs", "duplicate", f"{name}: {t!r}")
                continue
            seen_event_runs.add(pair)
            event_runs.append({"event_id": eid, "run_id": t})

    # ---- collected editions ---------------------------------------------
    raw = sheet(xl, "Master")
    raw = raw[raw["Title"].notna()]
    editions = []
    for n, (_, r) in enumerate(raw.iterrows(), start=1):
        editions.append({
            "id": f"ed-{n:04d}",
            "title": clean(r["Title"]),
            "book_type": clean(r.get("Book Type")),
            "author": clean(r.get("Author")),
            "character": clean(r.get("Character")),
            "year": as_int(r.get("Year")),
            "issues_text": clean(r.get("Issues")),
            "notes": clean(r.get("Notes")),
            "_collected": as_bool(r.get("Collected")),
            "_read": as_bool(r.get("Read")),
        })

    edition_progress = [
        {"user_id": "$OWNER", "edition_id": e["id"],
         "collected": e["_collected"], "read": e["_read"]}
        for e in editions if e["_collected"] or e["_read"]
    ]

    tracks = [{"id": v, "name": k, "publisher": "Marvel"} for k, v in track_names.items()]

    # ---- blocks ----------------------------------------------------------
    # The sheet's Block number is scoped per track, not globally: block 1 of
    # avengers and block 1 of x-men are different blocks. Derive one row per
    # distinct (track, block) pair and replace runs.block with a foreign key.
    # Runs with no block number keep NULL.
    tracks_by_run = OrderedDict()
    for rt in run_tracks:
        tracks_by_run.setdefault(rt["run_id"], []).append(rt["track_id"])

    blocks, seen_seq = OrderedDict(), OrderedDict()
    for r in runs:
        number = r.pop("block", None)
        r["block_id"] = None
        if number is None:
            continue
        run_track_ids = tracks_by_run.get(r["id"], [])
        if not run_track_ids:
            flag("runs", "block without track",
                 f"{r['id']}: block {number} but no track, block_id left null")
            continue
        # A run can sit on several tracks but carries a single block number.
        # Assign it to the first track listed and say so, rather than
        # inventing a second block membership the sheet does not express.
        track_id = run_track_ids[0]
        if len(run_track_ids) > 1:
            others = ", ".join(run_track_ids[1:])
            flag("runs", "run on multiple tracks",
                 f"{r['id']}: block {number} assigned to {track_id}; also on {others}")
        bid = f"{track_id}-b{number}"
        blocks.setdefault(bid, {"id": bid, "track_id": track_id,
                                "number": number, "name": None})
        r["block_id"] = bid
        seen_seq.setdefault((track_id, number, r.get("sequence")), []).append(r["id"])

    # Duplicate positions are a data problem in the sheet, not something the
    # ETL should paper over. Flag them and leave the numbers alone.
    for (track_id, number, seq), members in seen_seq.items():
        if len(members) > 1:
            flag("runs", "duplicate block sequence",
                 f"{track_id} block {number} sequence {seq}: {', '.join(members)}")

    write(out, "tracks", tracks, ["id", "name", "publisher"])
    write(out, "blocks", list(blocks.values()), ["id", "track_id", "number", "name"])
    # Column order here must match the explicit \copy column lists in
    # etl/load.ps1 and etl/load.sh.
    write(out, "runs", runs, ["id", "title", "tier", "block_id",
                              "sequence", "spine", "rating", "why", "why_source",
                              "notes", "placeholder"])
    write(out, "run_tracks", run_tracks, ["run_id", "track_id"])
    # The table's columns in order, without the serial id. A rule naming a run
    # the workbook lacks is reported, not written: the load's foreign key would
    # refuse it.
    volume_rules = []
    for rule in VOLUME_RULES:
        if rule["run_id"] is not None and rule["run_id"] not in run_ids:
            flag("volume_map", "rule for unknown run",
                 f"{rule['series']} — run {rule['run_id']}")
            continue
        volume_rules.append(rule)
    write(out, "volume_rules", volume_rules,
          ["series", "run_id", "issue_from", "issue_to", "year"])
    write(out, "issues", list(issues.values()),
          ["id", "label", "cover_date", "cover_date_source", "story_title",
           "story_title_source", "cover_url", "metron_id"])
    write(out, "run_issues", placements, ["id", "run_id", "sequence", "issue_id", "type", "notes"])
    write(out, "creators", list(creators.values()), ["id", "name", "metron_id"])
    write(out, "issue_credits", credits, ["issue_id", "creator_id", "role", "source"])
    write(out, "workbook_run_fields", workbook_fields,
          ["id", "series_issues", "start_year", "end_year", "writer", "artists"])
    write(out, "issue_progress", progress,
          ["user_id", "placement_id", "completed_at", "completed_at_precision"])
    write(out, "prereqs", prereqs, ["run_id", "prereq_run_id", "type"])
    write(out, "events", events, ["id", "name", "year", "verdict", "home_run_id", "note"])
    write(out, "event_runs", event_runs, ["event_id", "run_id"])
    write(out, "editions", editions, ["id", "title", "book_type", "author", "character",
                                      "year", "issues_text", "notes"])
    write(out, "edition_progress", edition_progress,
          ["user_id", "edition_id", "collected", "read"])


# --------------------------------------------------------------------------
# books
# --------------------------------------------------------------------------

SERIES_RE = re.compile(r"^(?P<name>.+?)\s*#\s*(?P<pos>[\d.]+)\s*$")
# Year tabs are found by name, so a new year's tab needs no code change (task 1.13).
READ_TAB_RE = re.compile(r"^Read (\d{4})$")
TO_READ_TAB_RE = re.compile(r"^To-Read (\d{4})$")
# A To-Read tab for this year or later is speculative (owner, 2026-10-19): it
# loads nothing, and its titles are listed in workbook_plans.csv instead.
SPECULATIVE_FROM = 2028
WORKBOOK_PLANS_COLUMNS = ["title", "year", "genre", "tab"]
# Author and series completion tabs, and the author every book on them has.
AUTHOR_TABS = {"Stephen King": "Stephen King", "Dresden": "Jim Butcher",
               "Cosmere": "Brandon Sanderson", "Riordanverse": "Rick Riordan"}
# What each of those tabs follows (task 1.15, D-43). A universe tab makes every
# row a member of the universe (D-42).
TAB_FOLLOWS = {"Stephen King": ("author", "Stephen King"), "Dresden": ("series", "The Dresden Files"),
               "Cosmere": ("universe", "Cosmere"), "Riordanverse": ("universe", "Riordanverse")}
# Series-tab groups that are universes (owner, 2026-10-26). Any other group that
# names no series, author or universe is reported, never guessed into one.
UNIVERSE_GROUPS = {"Grishaverse"}

# etl/data/book_review.csv (task 1.13, D-25a, D-68): pairs of book, author and
# series names that may be one thing. Extract proposes; the owner decides.
BOOK_REVIEW_COLUMNS = ["kind", "a", "b", "a_author", "b_author", "a_tabs", "b_tabs",
                       "reason", "similarity", "keep", "decision"]
BOOK_REVIEW_DECISIONS = ("merge", "separate", "")
SIMILAR_AT = 0.4  # D-25a: pg_trgm similarity at or above this is worth a look
# A standalone roman numeral from I to XX, or a run of digits.
NUMBER_RE = re.compile(r"\b(?:\d+|xx|x?(?:ix|iv|v?i{1,3}|v)|x)\b")
# A near spelling etl/enrich_books.py found on Open Library (task 1.14, D-44):
# `a` is the workbook's spelling, `b` Open Library's. Extract never proposes one,
# so it keeps the row, undecided, while the workbook still has `a`.
OPEN_LIBRARY = "open library"
# etl/data/book_details.csv (task 1.14, D-44), keyed by title and author.
BOOK_DETAILS_COLUMNS = ["title", "author", "open_library_id", "page_count", "cover_url",
                        "published_year", "source"]
WORKBOOK_READS_COLUMNS = ["title", "year", "genre", "tab", "rank"]


def trigrams(s: str) -> set[str]:
    out = set()
    for word in re.split(r"[\W_]+", s.lower()):
        if word:
            padded = f"  {word} "
            out.update(padded[i:i + 3] for i in range(len(padded) - 2))
    return out


def trgm_similarity(a: str, b: str) -> float:
    """pg_trgm's similarity(), as trigramSimilarity in src/lib/bulk-parse.ts:
    shared trigrams over all trigrams, each word padded."""
    ta, tb = trigrams(a), trigrams(b)
    shared = len(ta & tb)
    union = len(ta) + len(tb) - shared
    return shared / union if union else 0.0


def differs_only_by_number(a: str, b: str) -> bool:
    """`Saga Vol 1` / `Saga Vol 2`, `The Dark Tower II` / `III`: two books in a
    numbered run, never one book spelled twice."""
    def masked(s):
        return " ".join(re.sub(r"[^a-z0-9#]+", " ", NUMBER_RE.sub("#", s.lower())).split())
    return key(a) != key(b) and masked(a) == masked(b)


def review_keep_side(row: dict) -> str | None:
    """Which side a merge row keeps, 'a' or 'b', or None when `keep` names
    neither. On a same-title pair the titles are equal, so `keep` names the
    surviving side's author (D-68)."""
    keep = key(clean(row.get("keep")))
    a, b = key(clean(row.get("a"))), key(clean(row.get("b")))
    if (row.get("kind") or "").strip() == "book" and a == b:
        a, b = key(clean(row.get("a_author"))), key(clean(row.get("b_author")))
    if keep and keep == a != b:
        return "a"
    if keep and keep == b != a:
        return "b"
    return None


def review_sides(row: dict) -> frozenset:
    """A review row's pair, unordered: (name, author) keys for a book, the name
    key alone for an author or a series."""
    kind = (row.get("kind") or "").strip()
    if kind == "book":
        sides = {(key(row.get("a")), key(row.get("a_author"))),
                 (key(row.get("b")), key(row.get("b_author")))}
    else:
        sides = {(key(row.get("a")), ""), (key(row.get("b")), "")}
    return frozenset(sides) | {kind}


def load_book_review(path) -> list[dict]:
    """book_review.csv's rows, or none when there is no file yet."""
    if not path or not Path(path).exists():
        return []
    with open(path, newline="", encoding="utf-8-sig") as fh:
        return [{c: (r.get(c) or "").strip() for c in BOOK_REVIEW_COLUMNS}
                for r in csv.DictReader(fh) if (r.get("a") or "").strip()]


class BookIndex:
    """One book per title and author, both compared after clean() and key()
    (task 1.13). A merge row in book_review.csv points one spelling at another
    before the identity is taken, so the merged-away spelling is never a row
    (D-68). A sighting with no author waits for finish()."""

    def __init__(self, review: list[dict] = ()):
        self.by_key: dict[tuple[str, str], dict] = {}
        self.authors: dict[str, dict] = {}
        self.series: dict[str, dict] = {}
        self.universes: dict[str, dict] = {}
        # key() -> id: names are compared by key() but ids are slug()s, and two
        # spellings can share a key with different slugs (J.R.R. / JRR).
        self.author_keys: dict[str, str] = {}
        self.series_keys: dict[str, str] = {}
        self.universe_keys: dict[str, str] = {}
        self.taken: set[str] = set()
        # What the workbook spells, before any merge: proposals pair these.
        self.seen_books: dict[tuple[str, str], dict] = {}
        self.seen_authors: dict[str, dict] = {}
        self.seen_series: dict[str, dict] = {}
        self.merge_books: dict[tuple[str, str], tuple[str, str | None]] = {}
        self.merge_authors: dict[str, str] = {}
        self.merge_series: dict[str, str] = {}
        for row in review:
            self.apply(row)

    def apply(self, row: dict) -> None:
        """Take one book_review.csv row: only `merge` changes anything."""
        decision = row["decision"].lower()
        pair = f"{row['kind']}: {row['a']} / {row['b']}"
        if decision not in BOOK_REVIEW_DECISIONS:
            flag("book_review", "unknown decision", f"{pair}: {decision!r}, left separate")
            return
        if decision != "merge":
            return
        side = review_keep_side(row)
        if side is None:
            flag("book_review", "merge with no valid keep", f"{pair}: keep {row['keep']!r}, left separate")
            return
        other = "b" if side == "a" else "a"
        if row["kind"] == "book":
            gone = (key(row[other]), key(row[f"{other}_author"]))
            # Keeping the spelling of a sighting with no author keeps the author.
            author = row[f"{side}_author"] or row[f"{other}_author"] or None
            self.merge_books[gone] = (row[side], author)
        elif row["kind"] == "author":
            self.merge_authors[key(row[other])] = row[side]
        elif row["kind"] == "series":
            self.merge_series[key(row[other])] = row[side]
        else:
            flag("book_review", "unknown kind", f"{pair}: {row['kind']!r}, left separate")

    @staticmethod
    def follow(merges: dict[str, str], name: str | None) -> str | None:
        """Where a chain of merges ends: `name` until no merge moves it."""
        seen = set()
        while name and key(name) in merges and key(name) not in seen:
            seen.add(key(name))
            name = merges[key(name)]
        return name

    def canonical_author(self, name: str | None) -> str | None:
        return self.follow(self.merge_authors, name)

    def book_identity(self, title: str, author: str | None) -> tuple[str, str | None]:
        """The (title, author) a sighting loads as, once merges are applied. A
        book merge is matched on the spelling it names first, then with the
        author's merge applied, so a book row and an author row compose."""
        seen = set()
        while True:
            for spelled in (author, self.canonical_author(author)):
                bk = (key(title), key(spelled))
                if bk in self.merge_books and bk not in seen:
                    seen.add(bk)
                    title, author = self.merge_books[bk]
                    break
            else:
                return title, self.canonical_author(author)

    def author_id(self, name: str | None) -> str | None:
        name = clean(name)
        if not name:
            return None
        aid = self.author_keys.setdefault(key(name) or name, slug(name))
        self.authors.setdefault(aid, {"id": aid, "name": name})
        return aid

    def find_author(self, name: str | None) -> str | None:
        """The loaded author a name means, after merges, or None."""
        name = self.canonical_author(clean(name))
        return self.author_keys.get(key(name) or name) if name else None

    def series_name(self, raw: str | None) -> str | None:
        return self.follow(self.merge_series, raw)

    def series_id(self, raw: str | None, author_id: str | None) -> tuple[str | None, float | None]:
        raw = clean(raw)
        if not raw:
            return None, None
        m = SERIES_RE.match(raw)
        name, pos = (m.group("name"), float(m.group("pos"))) if m else (raw, None)
        name = self.series_name(name)
        sid = self.series_keys.setdefault(key(name) or name, slug(name))
        self.series.setdefault(sid, {"id": sid, "name": name, "author_id": author_id,
                                     "total_books": None})
        return sid, pos

    def find_series(self, name: str | None) -> str | None:
        """The loaded series a name means, after merges, or None."""
        name = self.series_name(clean(name))
        return self.series_keys.get(key(name) or name) if name else None

    def universe_id(self, name: str) -> str:
        uid = self.universe_keys.setdefault(key(name) or name, slug(name))
        self.universes.setdefault(uid, {"id": uid, "name": name})
        return uid

    def find_universe(self, name: str | None) -> str | None:
        name = clean(name)
        return self.universe_keys.get(key(name) or name) if name else None

    def set_universe(self, book: dict, uid: str, where: str) -> None:
        """A book belongs to one universe: the first that claims it keeps it."""
        if book["universe_id"] and book["universe_id"] != uid:
            flag("books", "two universes for one book",
                 f"{book['title']}: {book['universe_id']} kept, {uid} ({where}) dropped")
            return
        book["universe_id"] = uid

    def find_book(self, title, author: str | None = None) -> dict | None:
        """The loaded book a title and author name, after merges. With no
        author, the one book with that title, if there is exactly one."""
        title = title_text(title)
        if not title:
            return None
        title, author = self.book_identity(title, clean(author))
        if author:
            return self.by_key.get((key(title), key(author)))
        matches = [b for (t, _), b in self.by_key.items() if t == key(title)]
        return matches[0] if len(matches) == 1 else None

    def sight_series(self, name: str, tab: str) -> None:
        """A series name seen with no book (a Series-tab group, task 1.15), so
        the review proposes its near spellings."""
        entry = self.seen_series.setdefault(key(name), {"name": name, "tabs": []})
        if tab not in entry["tabs"]:
            entry["tabs"].append(tab)

    def sight(self, title: str, author: str | None, series: str | None, tab: str | None) -> None:
        def note(table: dict, k, **fields):
            entry = table.setdefault(k, {**fields, "tabs": []})
            if tab and tab not in entry["tabs"]:
                entry["tabs"].append(tab)
        note(self.seen_books, (key(title), key(author)), title=title, author=author)
        if author:
            note(self.seen_authors, key(author), name=author)
        m = SERIES_RE.match(series) if series else None
        name = m.group("name") if m else series
        if name:
            note(self.seen_series, key(name), name=name)

    def upsert(self, title, author=None, series=None, genre=None,
               word_count=None, published_year=None, book_type=None, tab=None) -> str | None:
        title, author = title_text(title), clean(author)
        if not title or len(title) < 2:
            return None
        self.sight(title, author, clean(series), tab)
        title, author = self.book_identity(title, author)
        bk = (key(title), key(author))
        if bk in self.by_key:
            b = self.by_key[bk]
            for field, value in (("genre", clean(genre)), ("word_count", as_int(word_count)),
                                 ("published_year", as_int(published_year)),
                                 ("book_type", clean(book_type))):
                if value and not b.get(field):
                    b[field] = value
            if b["word_count"] is not None:
                b["word_count_source"] = "stated"
            return b["id"]
        aid = self.author_id(author)
        sid, pos = self.series_id(series, aid)
        b = {
            "id": slug(title, author or "")[:100] or f"book-{len(self.by_key)}",
            "title": title, "author_id": aid, "series_id": sid, "series_position": pos,
            "genre": clean(genre), "book_type": clean(book_type) or "Novel",
            "word_count": as_int(word_count), "published_year": as_int(published_year),
            "universe_id": None,
        }
        # Every count in the workbook was typed, so it is stated; null with the
        # count (books_word_count_source_check).
        b["word_count_source"] = "stated" if b["word_count"] is not None else None
        while b["id"] in self.taken:
            b["id"] += "-x"
        self.taken.add(b["id"])
        self.by_key[bk] = b
        return b["id"]

    def finish(self) -> dict[str, str | None]:
        """Fold each authorless book into the one authored book with its title,
        which takes what it knew. With none it stays a book of its own; with
        several it joins none and is reported. Returns old id -> new id (None
        when dropped) for status, plan and releases to follow."""
        authored: dict[str, list[dict]] = {}
        for (t, a), b in self.by_key.items():
            if a:
                authored.setdefault(t, []).append(b)
        remap: dict[str, str | None] = {}
        for (t, a), b in list(self.by_key.items()):
            matches = authored.get(t, [])
            if a or not matches:
                continue
            del self.by_key[(t, a)]
            if len(matches) > 1:
                remap[b["id"]] = None
                tabs = ", ".join(self.seen_books.get((t, ""), {}).get("tabs", []))
                names = " | ".join(self.authors[m["author_id"]]["name"] for m in matches)
                flag("books", "authorless title matches several books",
                     f"{b['title']} ({tabs}): {names} — add the author in the workbook")
                continue
            target = matches[0]
            for field in ("genre", "word_count", "published_year", "series_id", "series_position"):
                if b.get(field) is not None and not target.get(field):
                    target[field] = b[field]
            if target["word_count"] is not None:
                target["word_count_source"] = "stated"
            remap[b["id"]] = target["id"]
        return remap


def review_book_pairs(idx: BookIndex, existing: list[dict]) -> list[dict]:
    """book_review.csv's next contents. Pairs are proposed over what the
    workbook spells, never over merged names, so a decided pair is proposed
    again on every run and matched to its decision. Books: one title under two
    authors is `same title`; one author's titles (or a title with no author
    and no authored match) at SIMILAR_AT or more are `similar`. Authors and
    series: any two names at SIMILAR_AT or more. Names that differ only by a
    number never pair. A decided row stays for good; an undecided one is
    rebuilt each run."""
    proposals: dict[frozenset, dict] = {}

    def propose(kind, a, b, reason, sim):
        if (key(a["name"]), key(a.get("author"))) > (key(b["name"]), key(b.get("author"))):
            a, b = b, a
        row = {"kind": kind, "a": a["name"], "b": b["name"],
               "a_author": a.get("author") or "", "b_author": b.get("author") or "",
               "a_tabs": "; ".join(a["tabs"]), "b_tabs": "; ".join(b["tabs"]),
               "reason": reason, "similarity": f"{sim:.2f}", "keep": "", "decision": ""}
        proposals[review_sides(row)] = row

    def similar_pairs(kind, entries, reason="similar"):
        grams = [(e, trigrams(e["name"])) for e in entries]
        for i, (a, ga) in enumerate(grams):
            for b, gb in grams[i + 1:]:
                if key(a["name"]) == key(b["name"]) or differs_only_by_number(a["name"], b["name"]):
                    continue
                shared = len(ga & gb)
                union = len(ga) + len(gb) - shared
                sim = shared / union if union else 0.0
                if sim >= SIMILAR_AT:
                    propose(kind, a, b, reason, sim)

    books = [{"name": s["title"], "author": s["author"], "tabs": s["tabs"]}
             for s in idx.seen_books.values()]
    by_title: dict[str, list[dict]] = {}
    by_author: dict[str, list[dict]] = {}
    for b in books:
        if b["author"]:
            by_title.setdefault(key(b["name"]), []).append(b)
            by_author.setdefault(key(b["author"]), []).append(b)
    for same in by_title.values():
        for i, a in enumerate(same):
            for b in same[i + 1:]:
                propose("book", a, b, "same title", 1.0)
    for group in by_author.values():
        similar_pairs("book", group)
    # A title seen with no author and no authored match pairs with anything.
    loose = [b for b in books if not b["author"] and key(b["name"]) not in by_title]
    if loose:
        grams = {id(b): trigrams(b["name"]) for b in books}
        for i, a in enumerate(loose):
            for b in [x for x in books if x["author"]] + loose[i + 1:]:
                if differs_only_by_number(a["name"], b["name"]):
                    continue
                shared = len(grams[id(a)] & grams[id(b)])
                union = len(grams[id(a)]) + len(grams[id(b)]) - shared
                if union and shared / union >= SIMILAR_AT:
                    propose("book", a, b, "similar", shared / union)
    similar_pairs("author", [{"name": s["name"], "tabs": s["tabs"]} for s in idx.seen_authors.values()])
    similar_pairs("series", [{"name": s["name"], "tabs": s["tabs"]} for s in idx.seen_series.values()])

    seen = {"book": set(idx.seen_books), "author": {(k, "") for k in idx.seen_authors},
            "series": {(k, "") for k in idx.seen_series}}
    rows = []
    for r in existing:
        pair = review_sides(r)
        if r["reason"] == OPEN_LIBRARY:
            # Only `a` is ever in the workbook, spelled with the author it loads under.
            in_workbook = any(t == key(r["a"]) and key(idx.canonical_author(s["author"])) == key(r["a_author"])
                              for (t, _), s in idx.seen_books.items())
            if r["decision"] or in_workbook:
                rows.append(r)
                proposals.pop(pair, None)
            if r["decision"] and not in_workbook:
                flag("book_review", "stale review",
                     f"{r['kind']}: {r['a']} / {r['b']} ({r['decision']}) — a name is no longer "
                     "in the workbook; delete the row once it's done with")
            continue
        if not r["decision"]:
            continue
        rows.append(r)
        if not (pair - {r["kind"]}) <= seen.get(r["kind"], set()):
            flag("book_review", "stale review",
                 f"{r['kind']}: {r['a']} / {r['b']} ({r['decision']}) — a name is no longer "
                 "in the workbook; delete the row once it's done with")
        proposals.pop(pair, None)
    rows += proposals.values()
    order = {"book": 0, "author": 1, "series": 2}
    rows.sort(key=lambda r: (r["decision"] != "", order.get(r["kind"], 3), r["reason"],
                             r["a"].lower(), r["b"].lower(), r["a_author"].lower()))
    return rows


def load_book_details(path) -> list[dict]:
    """book_details.csv's rows, or none when there is no file yet."""
    if not path or not Path(path).exists():
        return []
    with open(path, newline="", encoding="utf-8-sig") as fh:
        return [{c: (r.get(c) or "").strip() for c in BOOK_DETAILS_COLUMNS}
                for r in csv.DictReader(fh) if (r.get("title") or "").strip()]


def fold_book_details(idx: BookIndex, details: list[dict]) -> None:
    """Fill each book's Open Library id, page count and cover from its
    book_details.csv row, matched on title and author after clean() and key()
    (task 1.14, D-44). The published year fills only where the workbook has
    none. A page count never becomes a word count: 2.1 estimates that."""
    for b in idx.by_key.values():
        b.update(open_library_id=None, page_count=None, cover_url=None)
    for row in details:
        b = idx.by_key.get((key(clean(row["title"])), key(clean(row["author"]))))
        if b is None:
            flag("book_details", "no such book",
                 f"{row['title']} / {row['author'] or '(no author)'} ({row['source']}) — "
                 "renamed or gone from the workbook; enrich:books rekeys an accepted rename")
            continue
        b["open_library_id"] = clean(row["open_library_id"])
        b["page_count"] = as_int(row["page_count"])
        b["cover_url"] = clean(row["cover_url"])
        if b["published_year"] is None:
            b["published_year"] = as_int(row["published_year"])


def write_book_review(path: Path, rows: list[dict]) -> None:
    with Path(path).open("w", newline="", encoding="utf-8") as fh:
        w = csv.DictWriter(fh, fieldnames=BOOK_REVIEW_COLUMNS, extrasaction="ignore")
        w.writeheader()
        w.writerows(rows)
    pending = sum(1 for r in rows if not r["decision"])
    print(f"  {pending} book pairs await review — merge or separate each in {path}")


def series_groups(raw: pd.DataFrame) -> list[dict]:
    """The Series tab's groups (task 1.15): a row naming a series, an author or
    a universe, then the rows under it listing a book in Books Read with its
    Words. A tab with only Series and Total Books is groups with no books."""
    groups: list[dict] = []
    if raw.empty or "Series" not in raw.columns:
        return groups
    for _, r in raw.iterrows():
        name = clean(r.get("Series"))
        if name:
            groups.append({"name": name, "author": clean(r.get("Author")),
                           "total": r.get("Total Books"), "books": []})
        elif groups and title_text(r.get("Books Read")):
            groups[-1]["books"].append((r.get("Books Read"), r.get("Words")))
    return groups


def year_tabs(xl: pd.ExcelFile, pattern: re.Pattern) -> list[tuple[str, int]]:
    """(tab, year) for every tab whose name matches, oldest first."""
    found = [(name, int(m.group(1))) for name in xl.sheet_names if (m := pattern.match(name))]
    return sorted(found, key=lambda t: t[1])


def is_number(v) -> bool:
    """A count cell: a number as the sheet stores it, never a typed title."""
    return isinstance(v, numbers.Number) and not isinstance(v, bool) and not pd.isna(v)


def extract_books(path: Path, out: Path, with_plan: bool = False,
                  book_review: Path | None = None, book_details: Path | None = None) -> None:
    xl = pd.ExcelFile(path)
    print(f"\nbooks <- {path.name}")
    review = load_book_review(book_review)
    idx = BookIndex(review)
    status: dict[str, dict] = {}
    plan, releases, external, wishlist, reads, speculative = [], [], [], [], [], []
    plan_sightings: list[tuple[str, int, str]] = []
    release_sightings: list[tuple[str, str, str]] = []
    seen_plan: set[tuple[str, str]] = set()
    plan_ordinals: dict[str, int] = {}

    def add_plan(bid, period, title):
        """One reading_plan row (task 1.7): a period of '2027', '2027-Q1' or
        'on_deck'. A quarter numbers its books in workbook row order; every
        other level has no ordinal."""
        if (bid, period) in seen_plan:
            flag("reading_plan", "duplicate book/period", f"{clean(title)} ({period})")
            return
        seen_plan.add((bid, period))
        ordinal = None
        if "-Q" in period:
            ordinal = plan_ordinals[period] = plan_ordinals.get(period, 0) + 1
        plan.append({"user_id": "$OWNER", "book_id": bid, "period": period, "ordinal": ordinal})

    def to_read(bid):
        # The workbook loads no read state (D-41): every status it writes is an
        # undated to_read. Reads are listed in workbook_reads.csv for hand entry.
        status.setdefault(bid, {"user_id": "$OWNER", "book_id": bid, "status": "to_read",
                                "finished_on": None, "finished_on_precision": "none",
                                "year_rank": None, "rating": None})

    def listed_read(title, year=None, genre=None, tab=None, rank=None):
        reads.append({"title": title_text(title), "year": year, "genre": genre, "tab": tab, "rank": rank})

    # ---- master to-read list --------------------------------------------
    raw = sheet(xl, "To-Read Master List")
    for _, r in raw[raw["Book"].notna()].iterrows():
        if clean(r["Book"]) == "Book":
            continue
        bid = idx.upsert(r["Book"], r.get("Author"), r.get("Series"),
                         r.get("Genre"), r.get("Words"), tab="To-Read Master List")
        if bid:
            to_read(bid)

    # ---- author / series completion tabs --------------------------------
    tab_follows: list[tuple[str, str, str]] = []
    for tab, author in AUTHOR_TABS.items():
        raw = sheet(xl, tab)
        if raw.empty or "Book" not in raw.columns:
            continue
        kind, name = TAB_FOLLOWS[tab]
        tab_follows.append((tab, kind, name))
        uid = idx.universe_id(name) if kind == "universe" else None
        for _, r in raw[raw["Book"].notna()].iterrows():
            pub = as_int(r.get("Published"))
            if pub and not (1800 < pub < 2100):
                flag("books", "implausible year", f"{clean(r['Book'])}: {pub}")
                pub = None
            bid = idx.upsert(r["Book"], author, r.get("Series"), word_count=r.get("Word Count"),
                             published_year=pub, book_type=r.get("Type"), tab=tab)
            if bid and uid:
                idx.set_universe(idx.find_book(r["Book"], author), uid, tab)
            # A Completed tick is a read: listed, never loaded (D-41).
            if bid and as_bool(r.get("Completed")):
                listed_read(r["Book"], tab=tab)

    # ---- per-year genre-column tabs -------------------------------------
    # A Read tab is read down each genre column to its count row; the summary
    # block below that names series and authors, not books. The count row is
    # a number equal to the titles above it, so a title stored as a number
    # (1984) is still a read (task 1.14).
    for tab, year in year_tabs(xl, READ_TAB_RE):
        raw = sheet(xl, tab)
        for genre in raw.columns:
            if str(genre).startswith("Unnamed"):
                continue
            titles = 0
            for cell in raw[genre]:
                if is_number(cell) and cell == titles:
                    break
                if title_text(cell):
                    titles += 1
                    listed_read(cell, year=year, genre=str(genre), tab=tab)
    for tab, year in year_tabs(xl, TO_READ_TAB_RE):
        raw = sheet(xl, tab)
        for genre in raw.columns:
            if str(genre).startswith("Unnamed"):
                continue
            # A column ends in a count of its titles (task 1.14): not a book. A
            # title Excel stored as a number (1984) is a number that isn't the count.
            titles = 0
            for title in raw[genre].dropna():
                if is_number(title) and title == titles:
                    break
                titles += 1
                if year >= SPECULATIVE_FROM:
                    if title_text(title):
                        speculative.append({"title": title_text(title), "year": year,
                                            "genre": str(genre), "tab": tab})
                    continue
                bid = idx.upsert(title, genre=genre, tab=tab)
                if bid:
                    to_read(bid)
                    # The reading plan starts empty and is built in the app
                    # (R0-04): plan rows only with --with-plan, written once
                    # every sighting has its final id.
                    plan_sightings.append((bid, year, title))

    # ---- top books per year ---------------------------------------------
    raw = sheet(xl, "Top Books")
    if not raw.empty:
        rank_col = raw.columns[0]
        for _, r in raw.iterrows():
            rank = as_int(r[rank_col])
            if rank is None:
                continue
            for col in raw.columns[1:]:
                year = as_int(col)
                if year and title_text(r[col]):
                    listed_read(r[col], year=year, tab="Top Books", rank=rank)

    # ---- upcoming releases ----------------------------------------------
    raw = sheet(xl, "Coming Out")
    for _, r in raw[raw["Title"].notna()].iterrows():
        bid = idx.upsert(r["Title"], r.get("Author"), r.get("Series"), tab="Coming Out")
        date = r.get("Date")
        if not bid or pd.isna(date):
            continue
        try:
            release_sightings.append((bid, str(pd.to_datetime(date).date()), clean(r["Title"])))
        except (ValueError, TypeError, pd.errors.ParserError):
            flag("releases", "unparseable date",
                 f"{clean(r['Title'])}: {clean(date)!r} — left unscheduled")

    # ---- unstructured wishlist ------------------------------------------
    raw = sheet(xl, "To-Read")
    for genre in raw.columns:
        if str(genre).startswith("Unnamed") or genre == "Goals":
            continue
        for entry in raw[genre].dropna():
            e = title_text(entry)
            if not e or e.lower() == "top":
                continue
            wishlist.append({"genre": str(genre), "raw_entry": e, "book_id": ""})

    # ---- external top-10 lists ------------------------------------------
    raw = sheet(xl, "Booktube Top 10", header=0)
    if not raw.empty:
        year_col = raw.columns[0]
        for _, r in raw.iterrows():
            year = as_int(r[year_col])
            if year is None:
                continue
            for source in raw.columns[1:]:
                cell = r[source]
                if pd.isna(cell):
                    continue
                for line in cell_text(cell).split("\n"):
                    line = clean(line)
                    if not line or line.endswith(":"):
                        continue
                    m = re.match(r"^(?:(\d+)|HM)\.?\s*(.+)$", line)
                    rank = as_int(m.group(1)) if m and m.group(1) else None
                    text = m.group(2) if m else line
                    external.append({"source": str(source), "year": year,
                                     "rank": rank, "raw_title": text, "book_id": ""})

    # ---- authorless sightings join their book; references follow ---------
    remap = idx.finish()

    # ---- what the owner follows (task 1.15, D-42, D-43) -------------------
    # Each author tab follows what it is, and each Series-tab group follows the
    # series, author or universe it names, all at `tracking`. A series group
    # also gives its total. The tab's Completed column is never read (D-41).
    follows: dict[str, dict[str, dict]] = {"series": {}, "author": {}, "universe": {}}
    find = {"series": idx.find_series, "author": idx.find_author, "universe": idx.find_universe}

    def follow(kind, eid):
        follows[kind].setdefault(eid, {"user_id": "$OWNER", f"{kind}_id": eid, "state": "tracking"})

    for tab, kind, name in tab_follows:
        eid = find[kind](name)
        if eid:
            follow(kind, eid)
        else:
            flag("follows", "tab follows nothing", f"{tab}: no {kind} named {name}")

    universe_groups = {key(n) for n in UNIVERSE_GROUPS}
    for group in series_groups(sheet(xl, "Series")):
        name = group["name"]
        kind, eid = "series", idx.find_series(name)
        if eid:
            idx.series[eid]["total_books"] = as_int(group["total"])
        else:
            kind, eid = "author", idx.find_author(name)
        if not eid:
            kind, eid = "universe", idx.find_universe(name)
            if not eid and key(name) in universe_groups:
                eid = idx.universe_id(name)
        # A name the workbook spells nowhere else is offered for review, so a
        # near spelling of a series can be merged into it (Robert Langdom).
        if not eid or (kind == "series" and key(name) not in idx.series_keys):
            idx.sight_series(name, "Series")
        if eid:
            follow(kind, eid)
        else:
            kind = None
            flag("follows", "Series-tab group matches nothing",
                 f"{name}: names no series, author or universe; fix it in the workbook, "
                 "merge it in book_review.csv, or add it to UNIVERSE_GROUPS")
        # The books listed under a group: a count fills a missing word_count
        # (owner, 2026-10-26), and a universe group's books are its members.
        # Most that match nothing are reads, which load by hand (D-41).
        author = group["author"] or (name if kind == "author" else None)
        missing = []
        for title, words in group["books"]:
            book = idx.find_book(title, author)
            if book is None:
                missing.append(title_text(title))
                continue
            if book["word_count"] is None and as_int(words):
                book["word_count"], book["word_count_source"] = as_int(words), "stated"
            if kind == "universe":
                idx.set_universe(book, eid, "Series tab")
        if missing:
            flag("books", "Series-tab book matches no book",
                 f"{name}: {' | '.join(missing)} (a read loads by hand, D-41; else fix the title)")
    final = {}
    for bid, row in status.items():
        new = remap.get(bid, bid)
        if new is not None:
            final.setdefault(new, {**row, "book_id": new})
    status = final
    if with_plan:
        for bid, year, title in plan_sightings:
            new = remap.get(bid, bid)
            if new is not None:
                # A To-Read tab is a year with no quarter: a bare-year row.
                add_plan(new, str(year), title)
    dated: dict[str, str] = {}
    for bid, date, title in release_sightings:
        new = remap.get(bid, bid)
        if new is None:
            continue
        if new in dated:
            if dated[new] != date:
                flag("releases", "two release dates for one book",
                     f"{title}: {dated[new]} kept, {date} dropped")
            continue
        dated[new] = date
        releases.append({"book_id": new, "release_date": date})

    if book_review:
        write_book_review(book_review, review_book_pairs(idx, review))
    fold_book_details(idx, load_book_details(book_details))

    books = list(idx.by_key.values())
    write(out, "authors", list(idx.authors.values()), ["id", "name"])
    write(out, "book_series", list(idx.series.values()),
          ["id", "name", "author_id", "total_books"])
    write(out, "book_universes", list(idx.universes.values()), ["id", "name"])
    write(out, "books", books, ["id", "title", "author_id", "series_id", "series_position",
                                "genre", "book_type", "word_count", "word_count_source",
                                "published_year", "page_count", "cover_url", "open_library_id",
                                "universe_id"])
    write(out, "book_status", list(status.values()),
          ["user_id", "book_id", "status", "finished_on", "finished_on_precision",
           "year_rank", "rating"])
    write(out, "reading_plan", plan, ["user_id", "book_id", "period", "ordinal"])
    for kind in ("series", "author", "universe"):
        write(out, f"{kind}_follows", list(follows[kind].values()), ["user_id", f"{kind}_id", "state"])
    write(out, "releases", releases, ["book_id", "release_date"])
    write(out, "wishlist", wishlist, ["genre", "raw_entry", "book_id"])
    write(out, "external_lists", external, ["source", "year", "rank", "raw_title", "book_id"])
    # Not loaded (D-41): the workbook's reads, for the owner to enter by hand.
    write(out, "workbook_reads", reads, WORKBOOK_READS_COLUMNS)
    # Not loaded either: To-Read titles from SPECULATIVE_FROM on, for reference.
    write(out, "workbook_plans", speculative, WORKBOOK_PLANS_COLUMNS)


# --------------------------------------------------------------------------

def main(argv=None) -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--comics", required=True, type=Path)
    ap.add_argument("--books", required=True, type=Path)
    ap.add_argument("--out", default=Path("seed"), type=Path)
    ap.add_argument("--volume-map", type=Path, default=None,
                    help="approved output of etl/volumes.py")
    ap.add_argument("--cover-dates", type=Path, default=None,
                    help="cover_dates.csv from etl/enrich_comics.py plus hand entries")
    ap.add_argument("--why-review", type=Path, default=None,
                    help="why_review.csv with accept / edit / keep decisions")
    ap.add_argument("--label-review", type=Path, default=None,
                    help="label_review.csv from etl/enrich_comics.py; only accepted rows apply")
    ap.add_argument("--issue-details", type=Path, default=None,
                    help="issue_details.csv: story titles and cover URLs")
    ap.add_argument("--issue-credits", type=Path, default=None,
                    help="issue_credits.csv: creators by issue and role")
    ap.add_argument("--creator-aliases", type=Path, action="append", default=[],
                    help="creator_aliases.csv, or creator_review.csv (accepted rows only): "
                         "other spellings of a creator's name; repeatable")
    ap.add_argument("--with-plan", action="store_true",
                    help="also write the workbook's To-Read tabs before 2028 as reading_plan rows "
                         "(off by default: the plan is built in the app)")
    ap.add_argument("--book-review", type=Path, default=None,
                    help="book_review.csv: proposes book, author and series pairs that may be "
                         "one, applies the merge rows, and rewrites the file keeping decisions")
    ap.add_argument("--book-details", type=Path, default=None,
                    help="book_details.csv from etl/enrich_books.py plus hand rows: Open Library "
                         "id, page count, cover URL, and a published year where the workbook has none")
    ap.add_argument("--fail-on-cycle", action="store_true",
                    help="exit non-zero when the prereq graph has a cycle, after writing every "
                         "CSV (task 2.11a; START-HERE Step 14's final extract)")
    args = ap.parse_args(argv)

    load_volume_map(args.volume_map)
    load_cover_dates(args.cover_dates)
    load_why_review(args.why_review)
    load_label_review(args.label_review)
    load_issue_details(args.issue_details)
    load_issue_credits(args.issue_credits)
    load_creator_aliases(*args.creator_aliases)
    args.out.mkdir(parents=True, exist_ok=True)
    # Never leave output from an older schema behind (R2-09): a stale
    # event_tracks.csv or a missing run_issues.csv both pass unnoticed otherwise.
    for old in args.out.glob("*.csv"):
        old.unlink()
    extract_comics(args.comics, args.out)
    extract_books(args.books, args.out, with_plan=args.with_plan, book_review=args.book_review,
                  book_details=args.book_details)

    write(args.out, "unresolved", UNRESOLVED, ["table", "reason", "detail"])
    print(f"\n{len(UNRESOLVED)} rows need a human look — see {args.out}/unresolved.csv")
    cycles = [u["detail"] for u in UNRESOLVED if (u["table"], u["reason"]) == ("prereqs", "prereq cycle")]
    count = f"{len(cycles)} prereq cycle{'' if len(cycles) == 1 else 's'}"
    on, off = ("\033[31m", "\033[0m") if cycles and sys.stdout.isatty() else ("", "")
    print(f"{on}{count}{off} — see the prereq cycle rows in {args.out}/unresolved.csv")
    if cycles and args.fail_on_cycle:
        print(f"extract: --fail-on-cycle: {count}", file=sys.stderr)
        for detail in cycles:
            print(f"  {detail}", file=sys.stderr)
        return 1
    return 0


if __name__ == "__main__":
    sys.exit(main())
