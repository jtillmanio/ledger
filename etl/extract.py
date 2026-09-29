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

    # ---- issues and placements ------------------------------------------
    # Track and Run Title in this tab are lookup formulas against RUNS.
    # They are dropped: the join replaces them.
    #
    # One issue row per distinct label; one run_issues row per sheet row. The
    # same comic in four runs is one issue, so progress and credits attach once.
    raw = sheet(xl, "Reading Orders")
    raw = raw[raw["Run ID"].notna() & raw["Issue"].notna()]
    issues: "OrderedDict[str, dict]" = OrderedDict()     # final label -> issue row
    ids_by_slug: dict[str, str] = {}                     # slug -> first label holding it
    placements, seq_by_run, sheet_pos_by_run = [], {}, {}
    seen_in_run: set[tuple[str, str]] = set()
    completed_by_label: dict[str, set[bool]] = {}
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
        # Keep the first, drop the repeat, and say so. Rereads come back
        # deliberately with per-placement progress (task 0.8), not by accident.
        # sheet_pos counts every sheet row, dropped repeats included, so the
        # "sequence renumbered" check still compares like with like.
        sheet_pos = sheet_pos_by_run.get(rid, 0) + 1
        sheet_pos_by_run[rid] = sheet_pos
        if (rid, label) in seen_in_run:
            flag("run_issues", "repeat placement dropped",
                 f"{rid}: {label} listed again in the sheet — kept the first placement only")
            completed_by_label.setdefault(label, set()).add(as_bool(r.get("Completed")))
            continue
        seen_in_run.add((rid, label))

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
        completed_by_label.setdefault(label, set()).add(as_bool(r.get("Completed")))
        itype = (clean(r.get("Type")) or "core").lower()
        placements.append({
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

    # Completed is per-user progress, not catalog data. Read in any run means read.
    # The sheet never recorded a date, so these load with precision 'none' and a
    # NULL completed_at (D-R3-1). Letting the column default fire would stamp every
    # pre-cutover read with the load time (R2-10).
    progress = []
    for label, values in completed_by_label.items():
        if True in values:
            progress.append({"user_id": "$OWNER", "issue_id": issues[label]["id"],
                             "completed_at": "", "completed_at_precision": "none"})
            if False in values:
                flag("issue_progress", "completed in one run, not another",
                     f"{label} — loaded as read")

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
    write(out, "issues", list(issues.values()),
          ["id", "label", "cover_date", "cover_date_source", "story_title",
           "story_title_source", "cover_url", "metron_id"])
    write(out, "run_issues", placements, ["run_id", "sequence", "issue_id", "type", "notes"])
    write(out, "creators", list(creators.values()), ["id", "name", "metron_id"])
    write(out, "issue_credits", credits, ["issue_id", "creator_id", "role", "source"])
    write(out, "workbook_run_fields", workbook_fields,
          ["id", "series_issues", "start_year", "end_year", "writer", "artists"])
    write(out, "issue_progress", progress,
          ["user_id", "issue_id", "completed_at", "completed_at_precision"])
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

GENRE_TABS = {
    "read": ["Read 2021", "Read 2022", "Read 2023", "Read 2024", "Read 2025"],
    "plan": ["To-Read 2026", "To-Read 2027", "To-Read 2028", "To-Read 2029", "To-Read 2030"],
}
SERIES_RE = re.compile(r"^(?P<name>.+?)\s*#\s*(?P<pos>[\d.]+)\s*$")


class BookIndex:
    """Dedupes books across tabs on a loose title key."""

    def __init__(self):
        self.by_key: dict[str, dict] = {}
        self.authors: dict[str, dict] = {}
        self.series: dict[str, dict] = {}

    def author_id(self, name: str | None) -> str | None:
        name = clean(name)
        if not name:
            return None
        aid = slug(name)
        self.authors.setdefault(aid, {"id": aid, "name": name})
        return aid

    def series_id(self, raw: str | None, author_id: str | None) -> tuple[str | None, float | None]:
        raw = clean(raw)
        if not raw:
            return None, None
        m = SERIES_RE.match(raw)
        name, pos = (m.group("name"), float(m.group("pos"))) if m else (raw, None)
        sid = slug(name)
        self.series.setdefault(sid, {"id": sid, "name": name, "author_id": author_id,
                                     "total_books": None})
        return sid, pos

    def upsert(self, title, author=None, series=None, genre=None,
               word_count=None, published_year=None, book_type=None) -> str | None:
        title = clean(title)
        if not title or len(title) < 2:
            return None
        k = key(title)
        if k in self.by_key:
            b = self.by_key[k]
            for field, value in (("author_id", self.author_id(author)), ("genre", clean(genre)),
                                 ("word_count", as_int(word_count)),
                                 ("published_year", as_int(published_year)),
                                 ("book_type", clean(book_type))):
                if value and not b.get(field):
                    b[field] = value
            return b["id"]
        aid = self.author_id(author)
        sid, pos = self.series_id(series, aid)
        b = {
            "id": slug(title, clean(author) or "")[:100] or f"book-{len(self.by_key)}",
            "title": title, "author_id": aid, "series_id": sid, "series_position": pos,
            "genre": clean(genre), "book_type": clean(book_type) or "Novel",
            "word_count": as_int(word_count), "published_year": as_int(published_year),
        }
        while any(x["id"] == b["id"] for x in self.by_key.values()):
            b["id"] += "-x"
        self.by_key[k] = b
        return b["id"]


def extract_books(path: Path, out: Path, with_plan: bool = False) -> None:
    xl = pd.ExcelFile(path)
    print(f"\nbooks <- {path.name}")
    idx = BookIndex()
    status: dict[str, dict] = {}
    plan, releases, external, wishlist = [], [], [], []
    seen_plan: set[tuple[str, int]] = set()

    def set_status(bid, **kw):
        row = status.setdefault(bid, {"user_id": "$OWNER", "book_id": bid,
                                      "status": "to_read", "finished_year": None,
                                      "year_rank": None, "rating": None})
        row.update({k: v for k, v in kw.items() if v is not None})

    # ---- master to-read list --------------------------------------------
    raw = sheet(xl, "To-Read Master List")
    for _, r in raw[raw["Book"].notna()].iterrows():
        if clean(r["Book"]) == "Book":
            continue
        bid = idx.upsert(r["Book"], r.get("Author"), r.get("Series"),
                         r.get("Genre"), r.get("Words"))
        if bid:
            set_status(bid, status="to_read")

    # ---- author / series completion tabs --------------------------------
    for tab in ("Stephen King", "Dresden", "Cosmere", "Riordanverse"):
        raw = sheet(xl, tab)
        if raw.empty or "Book" not in raw.columns:
            continue
        author = {"Stephen King": "Stephen King", "Dresden": "Jim Butcher",
                  "Cosmere": "Brandon Sanderson", "Riordanverse": "Rick Riordan"}[tab]
        for _, r in raw[raw["Book"].notna()].iterrows():
            pub = as_int(r.get("Published"))
            if pub and not (1800 < pub < 2100):
                flag("books", "implausible year", f"{clean(r['Book'])}: {pub}")
                pub = None
            bid = idx.upsert(r["Book"], author, r.get("Series"),
                             published_year=pub, book_type=r.get("Type"))
            if bid and as_bool(r.get("Completed")):
                set_status(bid, status="read")

    # ---- per-year genre-column tabs -------------------------------------
    for mode, tabs in GENRE_TABS.items():
        for tab in tabs:
            raw = sheet(xl, tab)
            if raw.empty:
                continue
            year = as_int(tab.split()[-1])
            for genre in raw.columns:
                if str(genre).startswith("Unnamed"):
                    continue
                for title in raw[genre].dropna():
                    bid = idx.upsert(title, genre=genre)
                    if not bid:
                        continue
                    if mode == "read":
                        set_status(bid, status="read", finished_year=year)
                    else:
                        # The reading plan starts empty and is built in the app
                        # (R0-04). The sheet's To-Read tabs still create the books;
                        # only the plan rows are skipped unless --with-plan.
                        if not with_plan:
                            continue
                        pkey = (bid, year)
                        if pkey in seen_plan:
                            flag("reading_plan", "duplicate book/year",
                                 f"{clean(title)} ({year})")
                            continue
                        seen_plan.add(pkey)
                        plan.append({"user_id": "$OWNER", "book_id": bid,
                                     "planned_year": year, "planned_quarter": None})

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
                title = clean(r[col])
                if year and title:
                    bid = idx.upsert(title)
                    if bid:
                        set_status(bid, status="read", finished_year=year, year_rank=rank)

    # ---- upcoming releases ----------------------------------------------
    raw = sheet(xl, "Coming Out")
    for _, r in raw[raw["Title"].notna()].iterrows():
        bid = idx.upsert(r["Title"], r.get("Author"), r.get("Series"))
        date = r.get("Date")
        if not bid or pd.isna(date):
            continue
        try:
            releases.append({"book_id": bid,
                             "release_date": str(pd.to_datetime(date).date())})
        except (ValueError, TypeError, pd.errors.ParserError):
            flag("releases", "unparseable date",
                 f"{clean(r['Title'])}: {clean(date)!r} — left unscheduled")

    # ---- unstructured wishlist ------------------------------------------
    raw = sheet(xl, "To-Read")
    for genre in raw.columns:
        if str(genre).startswith("Unnamed") or genre == "Goals":
            continue
        for entry in raw[genre].dropna():
            e = clean(entry)
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
                for line in str(cell).split("\n"):
                    line = clean(line)
                    if not line or line.endswith(":"):
                        continue
                    m = re.match(r"^(?:(\d+)|HM)\.?\s*(.+)$", line)
                    rank = as_int(m.group(1)) if m and m.group(1) else None
                    text = m.group(2) if m else line
                    external.append({"source": str(source), "year": year,
                                     "rank": rank, "raw_title": text, "book_id": ""})

    # ---- series totals ---------------------------------------------------
    raw = sheet(xl, "Series")
    for _, r in raw[raw["Series"].notna()].iterrows():
        sid = slug(clean(r["Series"]))
        if sid in idx.series:
            idx.series[sid]["total_books"] = as_int(r.get("Total Books"))

    books = list(idx.by_key.values())
    write(out, "authors", list(idx.authors.values()), ["id", "name"])
    write(out, "book_series", list(idx.series.values()),
          ["id", "name", "author_id", "total_books"])
    write(out, "books", books, ["id", "title", "author_id", "series_id", "series_position",
                                "genre", "book_type", "word_count", "published_year"])
    write(out, "book_status", list(status.values()),
          ["user_id", "book_id", "status", "finished_year", "year_rank", "rating"])
    write(out, "reading_plan", plan, ["user_id", "book_id", "planned_year", "planned_quarter"])
    write(out, "releases", releases, ["book_id", "release_date"])
    write(out, "wishlist", wishlist, ["genre", "raw_entry", "book_id"])
    write(out, "external_lists", external, ["source", "year", "rank", "raw_title", "book_id"])


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
                    help="also write the workbook's To-Read tabs as reading_plan rows "
                         "(off by default: the plan is built in the app)")
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
    extract_books(args.books, args.out, with_plan=args.with_plan)

    write(args.out, "unresolved", UNRESOLVED, ["table", "reason", "detail"])
    print(f"\n{len(UNRESOLVED)} rows need a human look — see {args.out}/unresolved.csv")
    return 0


if __name__ == "__main__":
    sys.exit(main())
