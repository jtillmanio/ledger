#!/usr/bin/env python3
"""
check_sidecars.py — validate and repair the issue sidecars, and list what's left to fill.

    py etl/check_sidecars.py                 # report only; writes etl/data/metadata_todo.md
    py etl/check_sidecars.py --fix           # also applies the safe fixes to the sidecar CSVs
    py etl/check_sidecars.py --prune-orphans # archive and remove rows for labels that no
                                              # longer exist at all (see below)

Reads cover_dates.csv, issue_details.csv and issue_credits.csv against the labels
in seed/issues.csv (with accepted label_review renames applied), so run
`npm run extract` first whenever the workbook or label_review.csv has changed.

Safe fixes (applied with --fix, reported either way):
- whitespace trimmed and collapsed in every cell
- a sidecar label that is not a current label but is one after extract's cleanup
  (`#½` -> `#1⁄2`, en dash -> hyphen) or with `#1` appended is rekeyed to it
- cover_dates.csv: a row shifted one column right (a status word in
  metron_issue_id) is shifted back; a date with no source becomes `hand`; a row
  with a Metron issue id (its own, or issue_details.csv's one-shot listing) that
  isn't `matched` becomes `matched`, so `--details` fetches its credits
- issue_details.csv: a story title with no source becomes `hand`
- issue_credits.csv: a role typed into metron_creator_id is moved back; role
  spellings map onto the six roles (`penciler` -> `artist`); a blank source
  becomes `hand`; a hand credit whose creator is a Metron creator gets that
  metron_creator_id and Metron's spelling (a name listed in creator_aliases.csv
  counts as the creator it maps to); exact duplicates are dropped

Everything else is reported and left for you: unknown roles, unparseable dates,
creators spelled close to (but not as) a Metron creator, and — unless
--prune-orphans is given — orphan labels (see below).

creator_review.csv (written on every run, like the checklist): a hand credit
or a workbook sheet writer whose name is close to a Metron creator — spelled
close, a short or nick first name (Walt/Walter, Mike/Michael, J./John), a
missing suffix (John Romita -> Jr. and Sr.), extra words (VC's Joe Caramagna) —
or a name several Metron creators share gets one row per candidate. Set
`decision` to accept or reject (yes / no work too). An accepted row is an alias
from then on: --fix gives the credit that creator's metron_creator_id and
spelling, and extract reads it like creator_aliases.csv. Decided rows are kept
so a rejected pair is never proposed again; undecided rows are rebuilt each run.

--prune-orphans (off by default, independent of --fix): a sidecar row whose
label is not a current label and can't be rekeyed onto one (the true orphans
that would otherwise sit under "label not in seed/issues.csv" forever) is
appended to --archive (etl/data/pruned_orphans.csv, label/file/removed_at plus
its other fields as JSON) and then removed from the sidecar. Nothing is
deleted without being archived first. A label mid-rename in label_review.csv
is never touched by this — only a label that matches nothing at all.

Never changes a hand value's meaning: no date, title or credit is invented, and
nothing is removed unless --prune-orphans says so — otherwise a value is only
ever moved to the column or label it was meant for. Standard library plus
extract.py's own helpers, so labels are compared exactly as extract does.
"""

from __future__ import annotations

import argparse
import csv
import difflib
import json
import re
import sys
import unicodedata
import urllib.parse
from collections import Counter, OrderedDict, defaultdict
from dataclasses import dataclass, field
from datetime import date
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent))
import enrich_comics as ec  # noqa: E402
import extract as ex  # noqa: E402
import fandom_titles as ft  # noqa: E402

STATUSES = {"matched", "no_series", "not_in_series", "no_number", "ambiguous_volume"}
SOURCES = ("metron", "hand")
REQUIRED = ("date", "writer", "artist")
# Metron's role names plus the spellings people type from other sources.
ROLE_ALIASES = {
    **ec.ROLE_MAP,
    "penciler": "artist", "pencil": "artist", "pencils": "artist", "penciller": "artist",
    "pencilers": "artist", "art": "artist", "ink": "inker", "inkers": "inker",
    "colourist": "colorist", "colours": "colorist", "colour": "colorist", "color": "colorist",
    "writers": "writer", "scripter": "writer", "cover art": "cover", "cover artists": "cover",
    "letterers": "letterer", "colorists": "colorist", "colourists": "colorist",
}


def is_id(v: str | None) -> bool:
    return bool(re.fullmatch(r"\d+", (v or "").strip()))


def as_role(v: str | None) -> str | None:
    return ROLE_ALIASES.get((v or "").strip().lower())


def person_key(name: str) -> str:
    """Loose creator key: accents, case and punctuation ignored."""
    s = unicodedata.normalize("NFKD", name).encode("ascii", "ignore").decode().lower()
    return re.sub(r"[^a-z0-9]+", " ", s).strip()


def series_of(label: str) -> str:
    return re.sub(r"\s*#.*$", "", label).strip() or label


def number_of(label: str) -> str:
    m = re.search(r"#\s*(.+)$", label)
    return m.group(1).strip() if m else ""


def sort_key(label: str):
    num = number_of(label)
    m = re.match(r"-?\d+(?:\.\d+)?", num)
    return (series_of(label).lower(), float(m.group()) if m else float("inf"), num)


# --------------------------------------------------------------------------
# report
# --------------------------------------------------------------------------

@dataclass
class Report:
    fixes: "OrderedDict[tuple[str, str], list[str]]" = field(default_factory=OrderedDict)
    problems: "OrderedDict[tuple[str, str], list[str]]" = field(default_factory=OrderedDict)

    def fix(self, file: str, kind: str, detail: str) -> None:
        self.fixes.setdefault((file, kind), []).append(detail)

    def problem(self, file: str, kind: str, detail: str) -> None:
        self.problems.setdefault((file, kind), []).append(detail)

    def print(self, applied: bool, limit: int = 25) -> None:
        verb = "fixed" if applied else "would fix (run with --fix)"
        for title, groups in ((verb, self.fixes), ("needs you", self.problems)):
            if not groups:
                continue
            print(f"\n== {title}: {sum(len(v) for v in groups.values())}")
            for (file, kind), details in groups.items():
                print(f"  {file}: {kind} ({len(details)})")
                for d in details[:limit]:
                    print(f"      {d}")
                if len(details) > limit:
                    print(f"      … and {len(details) - limit} more")
        if not self.fixes and not self.problems:
            print("\nsidecars are clean")


# --------------------------------------------------------------------------
# fixes — pure functions over lists of row dicts, covered by test_check_sidecars.py
# --------------------------------------------------------------------------

def tidy(rows: list[dict], file: str, report: Report) -> None:
    n = 0
    for r in rows:
        for k, v in r.items():
            if isinstance(v, str):
                t = re.sub(r"\s+", " ", v).strip()
                if t != v:
                    r[k] = t
                    n += 1
    if n:
        report.fix(file, "whitespace trimmed", f"{n} cells")


def label_target(label: str, known: set[str]) -> str | None:
    for cand in (ex.clean(label), f"{ex.clean(label)} #1"):
        if cand and cand in known:
            return cand
    return None


def suggest(label: str, known: list[str]) -> str:
    near = difflib.get_close_matches(label, known, n=3, cutoff=0.8)
    return f" — did you mean {' | '.join(near)}?" if near else ""


def has_hand_value(row: dict) -> bool:
    return "hand" in (row.get("source", "").lower(), row.get("story_title_source", "").lower())


def rekey(rows: list[dict], file: str, known: set[str], tolerated: set[str],
          report: Report, one_per_label: bool, prune: bool = False,
          orphans: list[dict] | None = None) -> list[dict]:
    """Move rows keyed on a near-miss label onto the current label. Returns the
    rows to keep: a stale copy of a row that already exists under the current
    label (same Metron issue, nothing hand-entered) is dropped.

    A row whose label matches nothing at all — not a current label, not a
    rekey target — is a true orphan. With prune=True it is appended to
    `orphans` (tagged with `file`) and dropped instead of kept; otherwise it's
    reported and kept, exactly as before."""
    present = Counter(r["label"] for r in rows)
    held = {r["label"]: r for r in rows}
    ordered = sorted(known)
    keep = []
    for r in rows:
        label = r["label"]
        if label in known or label in tolerated:
            keep.append(r)
            continue
        target = label_target(label, known)
        if target is None:
            if prune:
                if orphans is not None:
                    orphans.append({"file": file, **r})
                continue
            report.problem(file, "label not in seed/issues.csv", label + suggest(label, ordered))
            keep.append(r)
            continue
        if one_per_label and present[target]:
            other = held.get(target) or {}
            if (not has_hand_value(r) and is_id(r.get("metron_issue_id"))
                    and r.get("metron_issue_id") == other.get("metron_issue_id")):
                # Keep what only the dropped copy had (a details pass, a cover URL).
                for k, v in r.items():
                    if v and not other.get(k):
                        other[k] = v
                if r.get("status") == "detailed":
                    other["status"] = "detailed"
                report.fix(file, "stale duplicate row dropped",
                           f"{label} (the same Metron issue as {target})")
                present[label] -= 1
                continue
            report.problem(file, "two rows for one issue",
                           f"{label!r} is {target!r}, which already has a row — merge them by hand")
            keep.append(r)
            continue
        report.fix(file, "label rekeyed", f"{label} -> {target}")
        present[label] -= 1
        present[target] += 1
        r["label"] = target
        keep.append(r)
    if one_per_label:
        for label, n in present.items():
            if n > 1 and label in known:
                report.problem(file, "two rows for one issue", f"{label} ({n} rows)")
    return keep


def fix_cover_dates(rows: list[dict], details: dict[str, dict], report: Report) -> None:
    f = "cover_dates.csv"
    for r in rows:
        label = r["label"]
        mid, sid, note = r.get("metron_issue_id", ""), r.get("metron_series_id", ""), r.get("note", "")
        if mid in STATUSES and is_id(sid):
            r["metron_issue_id"], r["metron_series_id"] = sid, note if is_id(note) else ""
            r["note"] = "" if is_id(note) else note
            report.fix(f, "columns shifted back", f"{label}: issue {sid}, series {r['metron_series_id'] or '?'}")
        cover = r.get("cover_date", "")
        source = r.get("source", "").lower()
        if cover and not source:
            source = "hand"
            report.fix(f, "date with no source set to hand", f"{label}: {cover}")
        r["source"] = source
        if cover and source not in SOURCES:
            report.problem(f, "date with an unknown source", f"{label}: {source!r} — use hand")
        if cover and not ex.normalize_date(cover):
            report.problem(f, "unparseable date", f"{label}: {cover!r} — use 1987, 1987-03 or 1987-03-15")
        if r.get("status") == "matched":
            continue
        mid = r.get("metron_issue_id", "")
        listed = (details.get(label) or {}).get("metron_issue_id", "")
        use = mid if is_id(mid) else listed if is_id(listed) else ""
        if not use:
            continue
        r["metron_issue_id"], r["status"] = use, "matched"
        r["note"] = "matched by check_sidecars from a Metron issue id"
        report.fix(f, "Metron issue id promoted to matched", f"{label}: issue {use}")
        if not cover:
            report.problem(f, "matched with no cover date",
                           f"{label}: enter one by hand, or the next date pass sets it back")


def fix_details(rows: list[dict], report: Report) -> None:
    f = "issue_details.csv"
    for r in rows:
        title, source = r.get("story_title", ""), r.get("story_title_source", "").lower()
        if title and not source:
            source = "hand"
            report.fix(f, "story title with no source set to hand", f"{r['label']}: {title}")
        r["story_title_source"] = source
        if title and source not in SOURCES:
            report.problem(f, "story title with an unknown source", f"{r['label']}: {source!r}")


def fix_credits(rows: list[dict], report: Report) -> list[dict]:
    f = "issue_credits.csv"
    keep = []
    for r in rows:
        label, who = r["label"], r.get("creator", "")
        if not who:
            report.problem(f, "credit with no creator", label)
            continue
        mid, role, source = r.get("metron_creator_id", ""), r.get("role", ""), r.get("source", "")
        if mid and not is_id(mid):
            if as_role(mid) and not role:
                role, mid = mid, ""
                report.fix(f, "role typed in metron_creator_id", f"{label}: {who} ({role})")
            elif as_role(mid) and role.lower() in SOURCES and not source:
                source, role, mid = role, mid, ""
                report.fix(f, "row shifted one column left", f"{label}: {who} ({role}, {source})")
            else:
                report.problem(f, "metron_creator_id is not a number", f"{label}: {who} {mid!r}")
        canonical = as_role(role)
        if canonical is None:
            report.problem(f, "unknown role", f"{label}: {who} as {role!r} — use one of {', '.join(ex.ROLES)}")
        elif canonical != role:
            report.fix(f, "role renamed", f"{label}: {who} {role} -> {canonical}")
            role = canonical
        source = source.lower()
        if not source:
            source = "hand"
            report.fix(f, "credit with no source set to hand", f"{label}: {who} ({role})")
        elif source not in SOURCES:
            report.problem(f, "credit with an unknown source", f"{label}: {who} {source!r}")
        r.update({"metron_creator_id": mid, "role": role, "source": source})
        keep.append(r)
    return keep


REVIEW_COLUMNS = ["alias", "creator", "metron_creator_id", "why", "credits", "example", "decision"]
DECISIONS = {"accept": "accept", "yes": "accept", "y": "accept",
             "reject": "reject", "no": "reject", "n": "reject"}
NAME_SUFFIXES = {"jr", "sr", "ii", "iii", "iv"}
# First names that are the same person's name. A prefix (Walt/Walter, Chris/
# Christopher) or an initial (J./John) needs no entry here.
NICKNAMES = [
    {"michael", "mike", "mick", "mickey"}, {"robert", "bob", "rob", "bobby", "robbie"},
    {"william", "bill", "will", "billy", "willie"}, {"james", "jim", "jimmy", "jamie"},
    {"richard", "rick", "dick", "rich", "ricky"}, {"thomas", "tom", "tommy"},
    {"david", "dave", "davey"}, {"joseph", "joe", "joey"}, {"daniel", "dan", "danny"},
    {"steven", "stephen", "steve"}, {"anthony", "tony"}, {"edward", "ed", "eddie", "ted"},
    {"charles", "chuck", "charlie"}, {"gerald", "gerry", "jerry"}, {"eugene", "gene"},
    {"salvatore", "sal"}, {"frederick", "fred"}, {"alexander", "alex"},
    {"lawrence", "larry"}, {"leonard", "len", "lenny"}, {"patrick", "pat"},
    {"kenneth", "ken"}, {"ronald", "ron"}, {"donald", "don"}, {"gregory", "greg"},
    {"matthew", "matt"}, {"nicholas", "nick"}, {"jonathan", "jon"}, {"john", "jack"},
    {"benjamin", "ben"}, {"samuel", "sam"}, {"timothy", "tim"}, {"peter", "pete"},
]


def decision_of(row: dict) -> str:
    """accept, reject, blank (not decided yet), or the unrecognised text as typed."""
    raw = (row.get("decision") or "").strip()
    return DECISIONS.get(raw.lower(), raw)


def read_aliases(path: Path, report: Report | None = None) -> dict[str, tuple[str, str]]:
    """creator_aliases.csv, or creator_review.csv's accepted rows, as loose alias
    key -> (the name it means, that creator's Metron id or "")."""
    if not path.exists():
        return {}
    out: dict[str, tuple[str, str]] = {}
    with path.open(newline="", encoding="utf-8-sig") as fh:
        for r in csv.DictReader(fh):
            alias, creator = (r.get("alias") or "").strip(), (r.get("creator") or "").strip()
            if not alias or not creator or ("decision" in r and decision_of(r) != "accept"):
                continue
            key, meant = person_key(alias), (creator, (r.get("metron_creator_id") or "").strip())
            held = out.get(key)
            if held and held != meant:
                if report and held[0]:
                    report.problem(path.name, "alias accepted for two creators",
                                   f"{alias}: {held[0]} and {creator} — keep one")
                out[key] = ("", "")
                continue
            out[key] = meant
    return {k: v for k, v in out.items() if v[0]}


def name_parts(key: str) -> tuple[list[str], str]:
    tokens = key.split()
    if len(tokens) > 1 and tokens[-1] in NAME_SUFFIXES:
        return tokens[:-1], tokens[-1]
    return tokens, ""


def first_names_agree(a: str, b: str) -> bool:
    if a == b or a.startswith(b) or b.startswith(a):
        return True
    return any(a in group and b in group for group in NICKNAMES)


def why_close(name: str, candidate: str) -> str | None:
    """Why two loose creator keys might be one person, or None."""
    (nt, ns), (ct, cs_) = name_parts(name), name_parts(candidate)
    if nt and ct and nt[-1] == ct[-1] and (ns == cs_ or not ns or not cs_):
        if len(nt) > 1 and len(ct) > 1 and first_names_agree(nt[0], ct[0]):
            if nt[0] != ct[0]:
                return f"same surname, first name {nt[0]} / {ct[0]}"
            return "same name but for a middle name or suffix"
        if set(nt) <= set(ct) or set(ct) <= set(nt):
            return "one name holds the other"
    ratio = difflib.SequenceMatcher(None, name, candidate).ratio()
    return f"spelled close ({ratio:.2f})" if ratio >= 0.85 else None


def close_creators(name: str, keys: list[str],
                   by_surname: dict[str, list[str]]) -> list[tuple[str, str]]:
    """Metron creator keys that might be this name, each with why."""
    key = person_key(name)
    tokens, _ = name_parts(key)
    pool = set(by_surname.get(tokens[-1], []) if tokens else [])
    pool.update(difflib.get_close_matches(key, keys, n=3, cutoff=0.85))
    found = [(c, why_close(key, c)) for c in sorted(pool) if c != key]
    return [(c, why) for c, why in found if why]


def fill_creator_ids(rows: list[dict], report: Report,
                     aliases: dict[str, tuple[str, str]] | None = None,
                     sheet_writers: dict[str, str] | None = None) -> list[dict]:
    """Give a hand credit the Metron id and spelling of the creator it names,
    reading the name through creator_aliases.csv and accepted creator_review.csv
    rows (`Walt` -> `Walter Simonson`). Returns creator_review.csv proposals for
    a name close to a Metron creator but not the same, and for a name several
    Metron creators share. `sheet_writers` (name -> run id) are the workbook's
    typed writers, proposed the same way and never changed."""
    f = "issue_credits.csv"
    aliases = aliases or {}
    ids: dict[str, dict[str, Counter]] = defaultdict(lambda: defaultdict(Counter))
    for r in rows:
        if r["source"] == "metron" and is_id(r["metron_creator_id"]):
            ids[person_key(r["creator"])][r["metron_creator_id"]][r["creator"]] += 1
    keys = sorted(ids)
    by_surname: dict[str, list[str]] = defaultdict(list)
    for k in keys:
        tokens, _ = name_parts(k)
        if tokens:
            by_surname[tokens[-1]].append(k)
    proposals: "OrderedDict[tuple[str, str], dict]" = OrderedDict()

    def propose(who: str, spelled: str, mid: str, why: str, example: str) -> None:
        p = proposals.get((person_key(who), mid))
        if p is None:
            proposals[(person_key(who), mid)] = {
                "alias": who, "creator": spelled, "metron_creator_id": mid, "why": why,
                "credits": 1, "example": example, "decision": ""}
        else:
            p["credits"] += 1

    def resolve(who: str) -> dict[str, Counter] | None:
        found = ids.get(person_key(who))
        if found or person_key(who) not in aliases:
            return found
        meant, mid = aliases[person_key(who)]
        found = ids.get(person_key(meant))
        if mid:
            return {mid: found[mid]} if found and mid in found else {mid: Counter({meant: 1})}
        return found

    def suggest(who: str, example: str) -> list[str]:
        named = []
        for c, why in close_creators(who, keys, by_surname):
            for mid, names in ids[c].items():
                spelled = names.most_common(1)[0][0]
                propose(who, spelled, mid, why, example)
                named.append(spelled)
        return named

    for r in rows:
        if r["source"] != "hand" or r["metron_creator_id"]:
            continue
        who = r["creator"]
        found = resolve(who)
        if found and len(found) == 1:
            (mid, names), = found.items()
            spelled = names.most_common(1)[0][0]
            r["metron_creator_id"] = mid
            change = f" (spelled {spelled!r})" if spelled != who else ""
            r["creator"] = spelled
            report.fix(f, "Metron creator id added", f"{r['label']}: {who} -> {mid}{change}")
        elif found:
            report.problem(f, "creator name matches several Metron creators",
                           f"{r['label']}: {who} ({', '.join(sorted(found))}) — "
                           "accept one in creator_review.csv")
            for mid, names in found.items():
                propose(who, names.most_common(1)[0][0], mid,
                        f"same name as {len(found)} Metron creators", r["label"])
        else:
            near = suggest(who, r["label"])
            if near:
                report.problem(f, "creator spelled close to a Metron creator",
                               f"{r['label']}: {who!r} — did you mean {' | '.join(near[:3])}? "
                               "decide in creator_review.csv")

    for who, run_id in (sheet_writers or {}).items():
        if not resolve(who) and suggest(who, f"sheet writer on {run_id}"):
            report.problem("workbook_run_fields.csv", "sheet writer spelled close to a Metron creator",
                           f"{run_id}: {who!r} — decide in creator_review.csv")
    return list(proposals.values())


def merge_review(existing: list[dict], proposals: list[dict], report: Report) -> list[dict]:
    """creator_review.csv's next contents. A decided row stays for good: an
    accept keeps working as an alias, a reject stops the pair coming back.
    Undecided rows are replaced by this run's proposals."""
    def key(r):
        return person_key(r["alias"]), (r.get("metron_creator_id") or "").strip()
    kept = []
    for r in existing:
        d = decision_of(r)
        if not d:
            continue
        if d not in ("accept", "reject"):
            report.problem("creator_review.csv", "decision is not accept or reject",
                           f"{r['alias']} -> {r['creator']}: {d!r} (yes / no work too)")
        r["decision"] = d
        kept.append(r)
    seen = {key(r) for r in kept}
    fresh = [p for p in proposals if key(p) not in seen]
    return (sorted(fresh, key=lambda r: person_key(r["alias"]))
            + sorted(kept, key=lambda r: person_key(r["alias"])))


def read_review(path: Path) -> list[dict]:
    if not path.exists():
        return []
    try:
        with path.open(newline="", encoding="utf-8-sig") as fh:
            return [{k: (v or "").strip() for k, v in r.items() if k is not None}
                    for r in csv.DictReader(fh) if (r.get("alias") or "").strip()]
    except UnicodeDecodeError:
        raise SystemExit(f"{path} is not UTF-8 — in Excel, Save As → CSV UTF-8")


def read_sheet_writers(path: Path) -> dict[str, str]:
    """Typed writer name -> the first run it is typed on, from workbook_run_fields.csv."""
    if not path.exists():
        return {}
    out: dict[str, str] = {}
    with path.open(newline="", encoding="utf-8") as fh:
        for r in csv.DictReader(fh):
            for name in re.split(r",|&|/|;|\band\b", r.get("writer") or ""):
                if name.strip():
                    out.setdefault(name.strip(), r["id"])
    return out


def dedupe_credits(rows: list[dict], report: Report) -> list[dict]:
    seen: dict[tuple, dict] = {}
    out = []
    for r in rows:
        k = (r["label"], r["role"], person_key(r["creator"]), r["source"])
        held = seen.get(k)
        if held is None:
            seen[k] = r
            out.append(r)
            continue
        if not held["metron_creator_id"] and r["metron_creator_id"]:
            held["metron_creator_id"] = r["metron_creator_id"]
        report.fix("issue_credits.csv", "duplicate credit dropped",
                   f"{r['label']}: {r['creator']} ({r['role']}, {r['source']})")
    return out


ARCHIVE_COLUMNS = ["removed_at", "file", "label", "fields"]


def archive_orphans(path: Path, orphans: list[dict], today: str) -> None:
    """Append each orphan row to `path` (creating it with a header if needed)
    before the caller drops it from the sidecar. `fields` is everything but
    `file` and `label`, JSON-encoded, so every sidecar's shape fits one file."""
    is_new = not path.exists()
    with path.open("a", newline="", encoding="utf-8") as fh:
        w = csv.DictWriter(fh, fieldnames=ARCHIVE_COLUMNS)
        if is_new:
            w.writeheader()
        for o in orphans:
            rest = {k: v for k, v in o.items() if k not in ("file", "label")}
            w.writerow({"removed_at": today, "file": o["file"], "label": o["label"],
                        "fields": json.dumps(rest, ensure_ascii=False)})


# --------------------------------------------------------------------------
# checklist
# --------------------------------------------------------------------------

TICK = re.compile(r"^- \[[xX]\] \*\*(.+?)\*\*")


def read_ticks(path: Path) -> set[str]:
    if not path.exists():
        return set()
    with path.open(encoding="utf-8") as fh:
        return {m.group(1) for line in fh if (m := TICK.match(line))}


def fandom(label: str) -> str:
    q = re.sub(r"\s*\(\d{4}\)", "", label).replace("#", "")
    return ("https://marvel.fandom.com/wiki/Special:Search?scope=internal&query="
            + urllib.parse.quote(re.sub(r"\s+", " ", q).strip()))


def compress(nums: list[str]) -> str:
    """'1','2','3','5','7.1' -> '#1-3, 5, 7.1'."""
    out, run = [], []
    for n in nums:
        if n.isdigit() and run and int(n) == int(run[-1]) + 1:
            run.append(n)
            continue
        if run:
            out.append(run[0] if len(run) == 1 else f"{run[0]}-{run[-1]}")
        run = [n] if n.isdigit() else []
        if not n.isdigit():
            out.append(n)
    if run:
        out.append(run[0] if len(run) == 1 else f"{run[0]}-{run[-1]}")
    return "#" + ", ".join(out)


@dataclass
class IssueState:
    label: str
    runs: list[str]
    metron: str          # none | pending | empty | credited
    missing: list[str]   # of date, writer, artist, title


def issue_states(labels: list[str], dates: dict[str, dict], details: dict[str, dict],
                 credits: list[dict], placements: dict[str, list[str]],
                 untitled: set[str] = frozenset()) -> list[IssueState]:
    """`untitled`: labels whose Fandom page exists with a blank title — there is
    no title to find, so they don't count as missing one."""
    roles: dict[str, set[str]] = defaultdict(set)
    metron_credited: set[str] = set()
    for c in credits:
        roles[c["label"]].add(c["role"])
        if c["source"] == "metron":
            metron_credited.add(c["label"])
    out = []
    for label in labels:
        d, t = dates.get(label) or {}, details.get(label) or {}
        has_id = is_id(d.get("metron_issue_id")) or is_id(t.get("metron_issue_id"))
        if not has_id:
            metron = "none"
        elif t.get("status") != "detailed":
            metron = "pending"
        elif label in metron_credited:
            metron = "credited"
        else:
            metron = "empty"
        missing = [m for m, ok in (("date", d.get("cover_date")),
                                   ("writer", "writer" in roles[label]),
                                   ("artist", "artist" in roles[label]),
                                   ("title", t.get("story_title") or label in untitled))
                   if not ok]
        out.append(IssueState(label, placements.get(label, []), metron, missing))
    return out


SECTIONS = [
    ("none", "Not on Metron — hand entry only",
     "Metron has no record of these. Marvel Fandom is the source."),
    ("empty", "On Metron, but Metron credits nobody",
     "Metron knows the issue and credits nobody on it. Recent issues may fill in "
     "later: `npm run enrich:refresh` asks Metron again. A hand credit claims its "
     "role for good, so a refresh won't replace it."),
    ("credited", "On Metron, still missing a writer, artist or date",
     "Metron credited these, just not every role the run needs."),
]


def checklist(states: list[IssueState], runs: list[dict], ticks: set[str],
              pending_fix: bool, today: str, untitled_left_out: int = 0) -> str:
    def box(key: str) -> str:
        return "x" if key in ticks else " "

    def issue_line(s: IssueState) -> str:
        need = [m for m in s.missing if m in REQUIRED]
        extra = " (+ title)" if "title" in s.missing else ""
        runs_txt = ", ".join(f"`{r}`" for r in s.runs) or "no run"
        return (f"- [{box(s.label)}] **{s.label}** — {', '.join(need)}{extra} · "
                f"{runs_txt} · [Fandom]({fandom(s.label)})")

    lines = [
        "# Comic metadata to-do",
        "",
        f"Generated {today} by `npm run sidecars` from `etl/data/*.csv` and `seed/`."
        + (" **Assumes the fixes it reported — run `npm run sidecars:fix` to apply them.**"
           if pending_fix else ""),
        "Regenerate after each batch of hand entry: filled items drop off. Tick a box to",
        "mark an item handled, including \"looked, nothing to find\"; a tick survives",
        "regeneration for as long as the item is still listed.",
        "",
        "Writer and artist are the only roles a run's credit line reads, and a run's",
        "years come from its earliest and latest cover dates. Story titles are optional.",
        "Enter values as START-HERE 8c-4 describes: `source` = `hand`, Fandom's",
        "Penciler as `artist`, creators spelled as Metron spells them (the checker",
        "adds the Metron id when the spelling matches).",
        "",
    ]
    by_metron = defaultdict(list)
    for s in states:
        by_metron[s.metron].append(s)
    todo = {k: [s for s in v if any(m in REQUIRED for m in s.missing)] for k, v in by_metron.items()}
    pending = by_metron.get("pending", [])
    titles = [s for s in states if s.missing == ["title"]]

    lines += ["| Section | Open |", "| --- | ---: |"]
    lines += [f"| {title} | {len(todo.get(k, []))} |" for k, title, _ in SECTIONS]
    lines += [f"| Story titles only (optional) | {len(titles)} issues |", ""]
    if pending:
        lines += [f"> **{len(pending)} issues have a Metron id but no details yet.** Run "
                  "`npm run enrich:details` (one request each) before hand-entering them: "
                  + ", ".join(s.label for s in sorted(pending, key=lambda s: sort_key(s.label))[:8])
                  + (" …" if len(pending) > 8 else ""), ""]

    # Runs whose credit line comes out empty or half empty.
    by_run: dict[str, list[IssueState]] = defaultdict(list)
    for s in states:
        for r in s.runs:
            by_run[r].append(s)
    run_lines = []
    for run in runs:
        issues = by_run.get(run["id"], [])
        if not issues or ex.as_bool(run.get("placeholder")):
            continue
        gaps = [role for role in ("writer", "artist")
                if all(role in s.missing for s in issues)]
        if gaps:
            run_lines.append(f"- [{box(run['id'])}] **{run['id']}** {run.get('title', '')} — "
                             f"no {' or '.join(gaps)} on any of {len(issues)} issues")
    lines += ["## Runs with an empty credit line", "",
              "Credit two or three issues per creator and the line fills in; the issues "
              "themselves are listed below.", ""]
    lines += run_lines or ["Nothing — every run names a writer and an artist."]
    lines.append("")

    for key, title, blurb in SECTIONS:
        items = sorted(todo.get(key, []), key=lambda s: sort_key(s.label))
        lines += [f"## {title} ({len(items)})", "", blurb, ""]
        if not items:
            lines += ["Nothing open.", ""]
            continue
        groups: "OrderedDict[str, list[IssueState]]" = OrderedDict()
        for s in items:
            groups.setdefault(series_of(s.label), []).append(s)
        singles = []
        for series, group in groups.items():
            if len(group) == 1:
                singles.append(group[0])
                continue
            lines += [f"### {series} ({len(group)})", ""]
            lines += [issue_line(s) for s in group]
            lines.append("")
        if singles:
            lines += ["### Single issues", ""]
            lines += [issue_line(s) for s in singles]
            lines.append("")

    lines += ["## Story titles only (optional)", "",
              "Everything else on these issues is in. One box per series.", ""]
    if untitled_left_out:
        lines += [f"{untitled_left_out} issues aren't listed here or marked `(+ title)` above: "
                  "their Fandom page exists and its title is blank, so there's nothing to find "
                  "(`no story title on Fandom either` in `etl/data/fandom_skipped.csv`). "
                  "`npm run sidecars -- --keep-fandom-untitled` lists them again.", ""]
    groups = OrderedDict()
    for s in sorted(titles, key=lambda s: sort_key(s.label)):
        groups.setdefault(series_of(s.label), []).append(number_of(s.label))
    for series, nums in groups.items():
        key = f"{series} — titles"
        nums_txt = compress([n for n in nums if n]) if any(nums) else ""
        lines.append(f"- [{box(key)}] **{key}** {nums_txt} ({len(nums)})".rstrip())
    lines.append("")
    return "\n".join(lines)


# --------------------------------------------------------------------------
# io
# --------------------------------------------------------------------------

def read_table(path: Path, default_columns: list[str]) -> tuple[list[str], list[dict]]:
    if not path.exists():
        return default_columns, []
    try:
        with path.open(newline="", encoding="utf-8-sig") as fh:
            reader = csv.DictReader(fh)
            rows = [{k: (v or "") for k, v in r.items() if k is not None} for r in reader
                    if (r.get("label") or "").strip()]
            return list(reader.fieldnames or default_columns), rows
    except UnicodeDecodeError:
        raise SystemExit(f"{path} is not UTF-8 — in Excel, Save As → CSV UTF-8")


def fandom_untitled(path: Path) -> set[str]:
    """Labels fandom_titles.py found on Fandom with a blank story title."""
    if not path.exists():
        return set()
    with path.open(newline="", encoding="utf-8-sig") as fh:
        return {r["label"] for r in csv.DictReader(fh)
                if r.get("reason") == ft.NO_TITLE and r.get("label")}


def accepted_renames(path: Path) -> dict[str, str]:
    renames = {}
    for label, r in ec.read_existing(path).items():
        new = (r.get("proposed_label") or "").strip()
        if (r.get("decision") or "").strip().lower() == "accept" and new and new != label:
            renames[label] = new
    return renames


def warn_if_stale(seed: Path, *sources: Path) -> None:
    if not seed.exists():
        raise SystemExit(f"{seed} not found — run `npm run extract` first")
    newer = [s.name for s in sources if s.exists() and s.stat().st_mtime > seed.stat().st_mtime]
    if newer:
        print(f"warning: {', '.join(newer)} changed after {seed} was written — "
              "run `npm run extract` first so labels line up")


def main(argv=None) -> int:
    ap = argparse.ArgumentParser(description=__doc__.split("\n\n")[0])
    ap.add_argument("--fix", action="store_true", help="write the safe fixes back to the CSVs")
    ap.add_argument("--prune-orphans", action="store_true",
                     help="archive and remove sidecar rows whose label no longer exists at all")
    ap.add_argument("--archive", default="etl/data/pruned_orphans.csv",
                     help="where --prune-orphans archives rows before removing them")
    ap.add_argument("--data", default="etl/data")
    ap.add_argument("--seed", default="seed")
    ap.add_argument("--todo", default="etl/data/metadata_todo.md")
    ap.add_argument("--fandom-skipped", default="etl/data/fandom_skipped.csv",
                     help="fandom_titles.py's report; issues it found with a blank title aren't missing one")
    ap.add_argument("--keep-fandom-untitled", action="store_true",
                     help="list issues Fandom has no title for as missing one anyway")
    args = ap.parse_args(argv)

    data, seed = Path(args.data), Path(args.seed)
    paths = {"dates": data / "cover_dates.csv", "details": data / "issue_details.csv",
             "credits": data / "issue_credits.csv"}
    warn_if_stale(seed / "issues.csv", data / "Comics.xlsx", data / "label_review.csv")

    renames = accepted_renames(data / "label_review.csv")
    labels = list(OrderedDict.fromkeys(renames.get(l, l) for l in ec.read_labels(seed / "issues.csv")))
    known = set(labels)

    date_cols, dates = read_table(paths["dates"], ec.COLUMNS)
    detail_cols, details = read_table(paths["details"], ec.DETAIL_COLUMNS)
    credit_cols, credits = read_table(paths["credits"], ec.CREDIT_COLUMNS)

    report = Report()
    tidy(dates, "cover_dates.csv", report)
    tidy(details, "issue_details.csv", report)
    tidy(credits, "issue_credits.csv", report)
    orphans: list[dict] = []
    dates = rekey(dates, "cover_dates.csv", known, set(renames), report, one_per_label=True,
                  prune=args.prune_orphans, orphans=orphans)
    details = rekey(details, "issue_details.csv", known, set(renames), report, one_per_label=True,
                     prune=args.prune_orphans, orphans=orphans)
    credits = rekey(credits, "issue_credits.csv", known, set(renames), report, one_per_label=False,
                     prune=args.prune_orphans, orphans=orphans)
    details_by = {r["label"]: r for r in details}
    fix_cover_dates(dates, details_by, report)
    fix_details(details, report)
    credits = fix_credits(credits, report)
    review_path = data / "creator_review.csv"
    aliases = {**read_aliases(review_path, report), **read_aliases(data / "creator_aliases.csv")}
    proposals = fill_creator_ids(credits, report, aliases,
                                 read_sheet_writers(seed / "workbook_run_fields.csv"))
    existing_review = read_review(review_path)
    review = merge_review(existing_review, proposals, report)
    credits = dedupe_credits(credits, report)
    report.print(applied=args.fix)

    if orphans:
        archive_path = Path(args.archive)
        archive_orphans(archive_path, orphans, today=date.today().isoformat())
        print(f"\npruned {len(orphans)} orphan row(s), archived to {archive_path}")
        for o in orphans[:25]:
            print(f"  {o['file']}: {o['label']}")
        if len(orphans) > 25:
            print(f"  … and {len(orphans) - 25} more")
    elif args.prune_orphans:
        print("\nno orphan rows found")

    if review or review_path.exists():
        ec.write_csv(review_path, REVIEW_COLUMNS, review)
        pending = sum(1 for r in review if not r["decision"])
        if pending:
            print(f"creator review: {pending} to decide — accept or reject each in {review_path}")

    if (args.fix and report.fixes) or orphans:
        ec.write_csv(paths["dates"], date_cols, sorted(dates, key=lambda r: r["label"]))
        ec.write_csv(paths["details"], detail_cols, sorted(details, key=lambda r: r["label"]))
        ec.write_csv(paths["credits"], credit_cols, credits)

    with (seed / "runs.csv").open(newline="", encoding="utf-8") as fh:
        runs = list(csv.DictReader(fh))
    placements = ec.read_placements(seed / "issues.csv", seed / "run_issues.csv")
    placements = {renames.get(l, l): r for l, r in placements.items()}
    untitled = set() if args.keep_fandom_untitled else fandom_untitled(Path(args.fandom_skipped))
    left_out = sum(1 for l in labels if l in untitled and not (details_by.get(l) or {}).get("story_title"))
    states = issue_states(labels, {r["label"]: r for r in dates}, details_by, credits, placements,
                          untitled)
    todo = Path(args.todo)
    todo.write_text(checklist(states, runs, read_ticks(todo),
                              pending_fix=bool(report.fixes) and not args.fix,
                              today=date.today().isoformat(), untitled_left_out=left_out),
                    encoding="utf-8")
    print(f"\nchecklist -> {todo}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
