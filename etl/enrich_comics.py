#!/usr/bin/env python3
"""
enrich_comics.py — backfill issue metadata from Metron into sidecar CSVs.

    py etl/enrich_comics.py --dry-run          # 50 labels, report only, writes nothing
    py etl/enrich_comics.py                    # dates, cover URLs, label proposals
    py etl/enrich_comics.py --details --dry-run  # 50 issues, report only
    py etl/enrich_comics.py --details          # story titles and credits (~2 days of quota)
    py etl/enrich_comics.py --details --refresh  # re-ask Metron about issues it credited nobody on

The default pass reads every distinct label in seed/issues.csv, finds its series
on Metron, pulls that series' issue list, and writes:
- cover_dates.csv    cover date per label (run_span derives run years from it)
- issue_details.csv  Metron issue id and cover URL per label
- label_review.csv   proposed label corrections, each waiting for your decision:
                     year_added, oneshot_number, name_style, subtitle, wrong_volume

--details requests each matched issue's detail page (one request per issue) and
fills story titles into issue_details.csv and creator credits into
issue_credits.csv, keeping six roles: writer, artist, inker, colorist, letterer,
cover. Everything is keyed by label so `npm run extract` can fold it onto issues
however the reading orders change.

The cache never expires on its own, so an issue Metron hadn't credited yet stays
uncredited on every re-run. --refresh (with --details) re-requests the detail
page of every issue whose issue_details.csv note says Metron had no credits
(`--refresh titles`: no story title; `--refresh all`: every matched issue),
skipping any page already fetched in the last REFRESH_AFTER_DAYS days, so a
refresh the quota cut short resumes where it stopped.

When label_review.csv accepts a rename, every run first moves the existing rows
in all three files from the old label to the new one, hand rows included.

Rules it keeps:
- Never overwrites a hand-entered value. A cover date or story title whose
  source is anything but `metron` is left exactly as it is, and a (label, role)
  pair with any `hand` credit is left alone entirely.
- Never renames a label. It proposes; extract applies only `accept`.
- Backfill only. Nothing in the app calls Metron.
- 20 requests/minute and the daily quota. It paces itself, honors Retry-After,
  stops cleanly when the daily quota runs out, and resumes from its cache —
  every successful response is kept in etl/.metron-cache.sqlite, so a re-run
  never pays for the same page twice.
- Nothing is guessed. A label whose series or volume can't be pinned down gets
  a status and a note, and a blank date for you to fill in by hand.

Credentials come from .env: METRON_API_TOKEN, or METRON_USERNAME and
METRON_PASSWORD. Standard library only.
"""

from __future__ import annotations

import argparse
import base64
import csv
import json
import math
import os
import re
import sqlite3
import sys
import time
import unicodedata
import urllib.error
import urllib.parse
import urllib.request
from collections import Counter, OrderedDict
from dataclasses import dataclass, field
from pathlib import Path

API = "https://metron.cloud/api/"
USER_AGENT = "ledger-backfill/1.1 (personal media ledger; issue metadata)"
MIN_INTERVAL = 3.2          # seconds between network requests: under 20/min
MAX_SEARCH_PAGES = 8        # a series-name search that needs more is too vague to trust
REFRESH_AFTER_DAYS = 7      # --refresh leaves a detail page fetched this recently alone
REFRESH_NOTES = {"credits": "no credits on Metron", "titles": "no story title on Metron"}

COLUMNS = ["label", "cover_date", "source", "status", "metron_issue_id",
           "metron_series_id", "note"]
DETAIL_COLUMNS = ["label", "story_title", "story_title_source", "cover_url",
                  "metron_issue_id", "status", "note"]
CREDIT_COLUMNS = ["label", "creator", "metron_creator_id", "role", "source"]
REVIEW_COLUMNS = ["label", "proposed_label", "category", "runs", "evidence", "decision"]

# Metron role name (lowercase) -> the six roles the ledger stores. Anything not
# listed — editors, designers, production — is dropped.
ROLE_MAP = {
    "writer": "writer", "script": "writer", "scripter": "writer", "story": "writer",
    "plot": "writer", "plotter": "writer",
    "artist": "artist", "penciller": "artist", "pencils": "artist", "breakdowns": "artist",
    "illustrator": "artist", "layouts": "artist",
    "inker": "inker", "inks": "inker", "embellisher": "inker", "finishes": "inker",
    "colorist": "colorist", "colors": "colorist", "color separations": "colorist",
    "letterer": "letterer", "letters": "letterer",
    "cover": "cover", "cover artist": "cover",
}
WRONG_VOLUME_SLACK = 2      # years either side of the workbook's typed run span

# "Avengers (1998) #56", "Amazing Spider-Man (2018) #16.HU", "Avengers (1963) #1⁄2",
# "Marvel Graphic Novel (1982) #27 - Emperor Doom". The designator is the first
# token after '#'; anything after it is a subtitle and does not affect matching.
LABEL_RE = re.compile(
    r"^(?P<title>.+?)(?:\s*\((?P<year>\d{4})\))?\s*#\s*(?P<num>[^\s:·]+?)(?=$|[\s:·]|\s-)(?P<rest>.*)$")


class StopRun(Exception):
    """Raised to end the run cleanly (quota exhausted, request budget spent)."""


class AuthError(Exception):
    pass


# --------------------------------------------------------------------------
# parsing and normalization — pure functions, covered by test_enrich_comics.py
# --------------------------------------------------------------------------

@dataclass(frozen=True)
class Parsed:
    title: str
    year: int | None
    number: str            # normalized designator


def normalize_number(raw: str) -> str:
    """Canonical issue designator: '001' -> '1', '1⁄2' / '½' -> '1/2', '16.HU' -> '16.hu'."""
    s = unicodedata.normalize("NFKC", raw).strip().lower()
    s = s.replace("⁄", "/").rstrip(".,;-") or s
    m = re.match(r"^(-?)0*(\d+)(.*)$", s)
    if m:
        s = f"{m.group(1)}{m.group(2)}{m.group(3)}"
    return s


def integer_part(number: str) -> int | None:
    m = re.match(r"^-?\d+$", number)
    return int(number) if m else None


def parse_label(label: str) -> Parsed | None:
    m = LABEL_RE.match(label.strip())
    if not m:
        return None
    return Parsed(m.group("title").strip(),
                  int(m.group("year")) if m.group("year") else None,
                  normalize_number(m.group("num")))


ONESHOT_YEAR = re.compile(r"^(?P<title>.+?)\s*\((?P<year>\d{4})\)$")


def parse_oneshot(label: str) -> Parsed | None:
    """A label with no issue number is usually a one-shot ("Avengers Finale",
    "Avengers Annual (1999)"). Treat it as #1 of a series with that exact name;
    the name match in pick_series is what keeps this honest."""
    label = label.strip()
    if "#" in label or "\u00b7" in label:
        return None
    m = ONESHOT_YEAR.match(label)
    if m:
        return Parsed(m.group("title").strip(), int(m.group("year")), "1")
    return Parsed(label, None, "1")


def name_key(name: str) -> str:
    """Loose series-name key: case, accents, punctuation, '&', a leading 'The'."""
    s = unicodedata.normalize("NFKD", name).encode("ascii", "ignore").decode().lower()
    s = re.sub(r"\s*\(\d{4}\)\s*$", "", s)        # Metron display names carry "(1998)"
    s = s.replace("&", " and ")
    s = re.sub(r"^the\s+", "", s)
    return re.sub(r"[^a-z0-9]", "", s)


def pick_series(title: str, year: int | None, candidates: list[dict],
                max_number: int | None) -> tuple[dict | None, str, str]:
    """Choose one Metron series for a label's title and volume year.

    Returns (series, status, note). status is 'ok', 'no_series' or
    'ambiguous_volume'. With no year in the label, a single volume whose issue
    count reaches the highest number the runs need is accepted and noted;
    anything wider is left for a human, because a wrong volume is a wrong date.
    """
    key = name_key(title)
    same = [c for c in candidates
            if name_key(c.get("series") or c.get("name") or "") == key]
    if not same:
        return None, "no_series", f"no Metron series named {title!r}"
    marvel = [c for c in same if "marvel" in json.dumps(c.get("publisher") or "").lower()]
    if marvel:
        same = marvel
    if year is not None:
        hit = [c for c in same if c.get("year_began") == year]
        if len(hit) == 1:
            return hit[0], "ok", ""
        years = ", ".join(sorted(str(c.get("year_began")) for c in same))
        if len(hit) > 1:
            return None, "ambiguous_volume", f"Metron has {len(hit)} series named {title} from {year}"
        return None, "no_series", f"no {title} volume began in {year} (Metron has {years})"
    if len(same) == 1:
        return same[0], "ok", ""
    fits = same
    if max_number is not None:
        fits = [c for c in same if (c.get("issue_count") or 0) >= max_number]
    years = ", ".join(sorted(str(c.get("year_began")) for c in same))
    if len(fits) == 1:
        return fits[0], "ok", (f"volume {fits[0].get('year_began')} inferred: the only one of "
                               f"{years} with #{max_number}; add a year to the label if wrong")
    return None, "ambiguous_volume", (f"{title} has volumes {years}; add the year to the "
                                      "label or a volume_map.csv rule")


def merge_rows(existing: dict[str, dict], fresh: dict[str, dict]) -> list[dict]:
    """Combine a previous cover_dates.csv with this run's results.

    A row carrying a date from any source other than metron is hand-entered and
    survives untouched. A dated row is never replaced by a fresh result without
    a date: a lookup that fails this time (ambiguous_volume, no_series) must not
    erase a date found earlier or copied in from Metron by hand. Everything else
    is replaced by the fresh result when there is one, and kept otherwise (a
    limited run doesn't erase earlier work).
    """
    out: dict[str, dict] = {}
    for label, row in existing.items():
        out[label] = row
    for label, row in fresh.items():
        old = existing.get(label)
        if old and (old.get("cover_date") or "").strip():
            if (old.get("source") or "").strip().lower() != "metron":
                continue
            if not (row.get("cover_date") or "").strip():
                continue
        out[label] = row
    return [out[k] for k in sorted(out)]


def classify_label(label: str, canonical: str) -> str | None:
    """How a sheet label differs from Metron's canonical label for the same issue.

    None when they are identical. Otherwise the category shown in
    label_review.csv, so a whole kind of change can be accepted or rejected at once.
    """
    if label == canonical:
        return None
    parsed = parse_label(label)
    if parsed is None:
        return "oneshot_number"
    m = LABEL_RE.match(label.strip())
    if m and m.group("rest").strip():
        return "subtitle"          # text after the number: a subtitle, a note, a second issue
    if parsed.year is None:
        return "year_added"
    return "name_style"


def map_credits(detail: dict) -> list[tuple[str, int | None, str]]:
    """(creator, metron creator id, role) from a Metron issue detail, six roles only.

    A creator with two Metron roles that map to one ledger role (Penciller and
    Breakdowns) yields one credit.
    """
    out: list[tuple[str, int | None, str]] = []
    for credit in detail.get("credits") or []:
        name = (credit.get("creator") or "").strip()
        if not name:
            continue
        for role in credit.get("role") or []:
            mapped = ROLE_MAP.get((role.get("name") or "").strip().lower())
            entry = (name, credit.get("id"), mapped)
            if mapped and entry not in out:
                out.append(entry)
    return out


def story_title(detail: dict) -> str:
    names = detail.get("name") or []
    if isinstance(names, str):
        names = [names]
    return "; ".join(n.strip() for n in names if n and n.strip())


def is_hand(row: dict | None, value: str, source: str) -> bool:
    return bool(row and (row.get(value) or "").strip()
                and (row.get(source) or "").strip().lower() != "metron")


def merge_details(existing: dict[str, dict], fresh: dict[str, dict]) -> list[dict]:
    """issue_details.csv: a hand story title survives; Metron fields refresh."""
    out = dict(existing)
    for label, row in fresh.items():
        old = existing.get(label)
        new = {**(old or {}), **{k: v for k, v in row.items() if v not in (None, "")}}
        if old and old.get("status") == "detailed" and new.get("status") == "listed":
            new["status"] = "detailed"         # a date pass doesn't undo a details pass
        if is_hand(old, "story_title", "story_title_source"):
            new["story_title"] = old["story_title"]
            new["story_title_source"] = old["story_title_source"]
        out[label] = new
    return [out[k] for k in sorted(out)]


def merge_credits(existing: list[dict], fresh: dict[str, list[dict]]) -> list[dict]:
    """issue_credits.csv: fresh Metron credits replace old Metron credits, per
    (label, role). A pair with any hand row is left exactly as it is."""
    by_pair: "OrderedDict[tuple[str, str], list[dict]]" = OrderedDict()
    for r in existing:
        by_pair.setdefault((r["label"], r["role"]), []).append(r)
    for label, rows in fresh.items():
        fresh_pairs: "OrderedDict[tuple[str, str], list[dict]]" = OrderedDict()
        for r in rows:
            fresh_pairs.setdefault((label, r["role"]), []).append(r)
        roles_before = {role for (lab, role) in by_pair if lab == label}
        for pair in set(fresh_pairs) | {(label, r) for r in roles_before}:
            held = by_pair.get(pair, [])
            if any((r.get("source") or "").strip().lower() != "metron" for r in held):
                continue
            if pair in fresh_pairs:
                by_pair[pair] = fresh_pairs[pair]
            else:
                by_pair.pop(pair, None)        # Metron no longer credits this role
    rows = [r for pair in sorted(by_pair) for r in by_pair[pair]]
    return rows


def rekey(rows: list[dict], renames: dict[str, str], one_per_label: bool,
          hand: tuple[str, str] | None = None) -> tuple[list[dict], int]:
    """Move sidecar rows from an old label to its accepted new label.

    one_per_label files (cover_dates, issue_details) keep one row per label: when
    both spellings already have one, a hand value wins, otherwise the row already
    under the new label does. Credit rows move and duplicates collapse.
    """
    moved = 0
    if one_per_label:
        out: dict[str, dict] = {r["label"]: r for r in rows if r["label"] not in renames}
        for r in rows:
            new = renames.get(r["label"])
            if new is None:
                continue
            moved += 1
            r = {**r, "label": new}
            held = out.get(new)
            if held is None or (hand and is_hand(r, *hand) and not is_hand(held, *hand)):
                out[new] = r
        return [out[k] for k in sorted(out)], moved
    seen, out_rows = set(), []
    for r in rows:
        new = renames.get(r["label"])
        if new is not None:
            moved += 1
            r = {**r, "label": new}
        k = tuple(r.get(c, "") for c in CREDIT_COLUMNS)
        if k not in seen:
            seen.add(k)
            out_rows.append(r)
    # A role with hand credits under either spelling keeps only the hand credits.
    hand_pairs = {(r["label"], r["role"]) for r in out_rows
                  if (r.get("source") or "").strip().lower() != "metron"}
    out_rows = [r for r in out_rows if (r["label"], r["role"]) not in hand_pairs
                or (r.get("source") or "").strip().lower() != "metron"]
    return out_rows, moved


def merge_review(existing: dict[str, dict], fresh: dict[str, dict]) -> list[dict]:
    """label_review.csv: a decision survives while its proposal is unchanged.

    Rows are never deleted — an accepted rename must stay after extract has
    applied it and the old label has left seed/issues.csv.
    """
    out = dict(existing)
    for label, row in fresh.items():
        old = existing.get(label)
        if old and (old.get("proposed_label") or "") == row["proposed_label"]:
            out[label] = {**row, "decision": old.get("decision", "")}
        elif old and (old.get("decision") or "").strip():
            out[label] = {**row, "decision": "",
                          "evidence": f"{row['evidence']}; proposal changed from "
                                      f"{old.get('proposed_label')!r}, decision "
                                      f"{old.get('decision')!r} cleared"}
        else:
            out[label] = row
    return [out[k] for k in sorted(out)]


# --------------------------------------------------------------------------
# HTTP with pacing and a response cache
# --------------------------------------------------------------------------

class Metron:
    def __init__(self, cache_path: Path, auth_header: str | None,
                 max_requests: int, offline: bool = False):
        self.db = sqlite3.connect(cache_path)
        self.db.execute("CREATE TABLE IF NOT EXISTS responses "
                        "(url TEXT PRIMARY KEY, body TEXT NOT NULL, fetched_at TEXT NOT NULL)")
        self.auth = auth_header
        self.max_requests = max_requests
        self.offline = offline
        self.network = 0
        self.cached = 0
        self.last = 0.0
        self.sustained_remaining: int | None = None

    def url(self, path: str, params: dict | None = None) -> str:
        q = f"?{urllib.parse.urlencode(params)}" if params else ""
        return f"{API}{path}{q}"

    def get(self, url: str, max_age_days: float | None = None) -> dict:
        """A cached page if there is one (younger than max_age_days, when given),
        otherwise a network request whose response replaces the cached page."""
        row = self.db.execute(
            "SELECT body, fetched_at < datetime('now', ?) FROM responses WHERE url = ?",
            (f"-{max_age_days or 0} days", url)).fetchone()
        if row and not (max_age_days is not None and row[1]):
            self.cached += 1
            return json.loads(row[0])
        if self.offline:
            raise StopRun("offline and not cached")
        if self.network >= self.max_requests:
            raise StopRun(f"request budget of {self.max_requests} spent")
        if self.sustained_remaining is not None and self.sustained_remaining <= 1:
            raise StopRun("Metron's daily quota is used up")
        body = self._fetch(url)
        self.db.execute("INSERT OR REPLACE INTO responses VALUES (?, ?, datetime('now'))",
                        (url, body))
        self.db.commit()
        return json.loads(body)

    def _fetch(self, url: str, attempt: int = 1) -> str:
        wait = self.last + MIN_INTERVAL - time.monotonic()
        if wait > 0:
            time.sleep(wait)
        req = urllib.request.Request(url, headers={
            "User-Agent": USER_AGENT, "Accept": "application/json",
            **({"Authorization": self.auth} if self.auth else {})})
        self.last = time.monotonic()
        self.network += 1
        try:
            with urllib.request.urlopen(req, timeout=60) as resp:
                remaining = resp.headers.get("X-RateLimit-Sustained-Remaining")
                if remaining and remaining.isdigit():
                    self.sustained_remaining = int(remaining)
                return resp.read().decode("utf-8")
        except urllib.error.HTTPError as e:
            if e.code in (401, 403):
                raise AuthError(f"Metron refused the credentials (HTTP {e.code}). "
                                "Check METRON_API_TOKEN or METRON_USERNAME/METRON_PASSWORD in .env")
            if e.code == 404:
                return json.dumps({"count": 0, "next": None, "results": []})
            if e.code == 429:
                retry = float(e.headers.get("Retry-After") or 60)
                if retry > 120:
                    raise StopRun(f"Metron's daily quota is used up (retry in {retry / 3600:.1f} h)")
                print(f"    rate limited, waiting {retry:.0f}s")
                time.sleep(retry)
                return self._fetch(url, attempt)
            if e.code >= 500 and attempt < 4:
                time.sleep(10 * attempt)
                return self._fetch(url, attempt + 1)
            raise
        except urllib.error.URLError:
            if attempt < 4:
                time.sleep(10 * attempt)
                return self._fetch(url, attempt + 1)
            raise


# --------------------------------------------------------------------------
# resolution
# --------------------------------------------------------------------------

@dataclass
class SeriesJob:
    title: str
    year: int | None
    labels: list[tuple[str, str, bool]] = field(default_factory=list)  # (label, number, oneshot)


def resolve_series(api: Metron, job: SeriesJob) -> tuple[dict | None, str, str]:
    params = {"name": job.title}
    if job.year is not None:
        params["year_began"] = job.year
    url = api.url("series/", params)
    candidates: list[dict] = []
    for _ in range(MAX_SEARCH_PAGES):
        page = api.get(url)
        candidates.extend(page.get("results") or [])
        url = page.get("next")
        if not url:
            break
    else:
        return None, "no_series", f"search for {job.title!r} matched too many series to trust"
    numbers = [integer_part(n) for _, n, _ in job.labels]
    max_number = max((n for n in numbers if n is not None), default=None)
    return pick_series(job.title, job.year, candidates, max_number)


def issue_dates(api: Metron, series_id: int, wanted: set[str]) -> dict[str, dict]:
    """number -> Metron issue-list entry (id, issue, cover_date, image) for the
    wanted designators.

    Pages through the series' issue list and stops as soon as every wanted
    number is found, so a run that needs #1-12 of a 400-issue volume doesn't
    pay for the other 30 pages.
    """
    found: dict[str, dict] = {}
    url = api.url(f"series/{series_id}/issue_list/")
    while url and not wanted <= found.keys():
        page = api.get(url)
        for issue in page.get("results") or []:
            num = normalize_number(str(issue.get("number") or ""))
            if num in wanted and num not in found and issue.get("cover_date"):
                found[num] = issue
        url = page.get("next")
    return found


def row(label: str, status: str, note: str = "", date: str = "", issue_id=None,
        series_id=None) -> dict:
    return {"label": label, "cover_date": date, "source": "metron" if date else "",
            "status": status, "metron_issue_id": issue_id or "",
            "metron_series_id": series_id or "", "note": note}


def run(args) -> int:
    load_env(Path(args.env))
    auth = auth_header()
    if not auth and not args.offline:
        print("No Metron credentials. Add METRON_API_TOKEN, or METRON_USERNAME and "
              "METRON_PASSWORD, to .env", file=sys.stderr)
        return 1
    args.renames = apply_renames(args)
    if args.details:
        return run_details(args, auth)

    labels = current_labels(args)
    total_labels = len(labels)
    if args.limit:
        labels = labels[:args.limit]

    all_series = {(p.title, p.year)
                  for p in (parse_label(x) or parse_oneshot(x) for x in current_labels(args))
                  if p}
    jobs: "OrderedDict[tuple[str, int | None], SeriesJob]" = OrderedDict()
    results: dict[str, dict] = {}
    listings: dict[str, dict] = {}          # label -> Metron issue-list entry
    for label in labels:
        p, oneshot = parse_label(label), False
        if not p:
            p, oneshot = parse_oneshot(label), True
        if not p:
            results[label] = row(label, "no_number",
                                 "no issue number in the label; enter the date by hand")
            continue
        job = jobs.setdefault((p.title, p.year), SeriesJob(p.title, p.year))
        job.labels.append((label, p.number, oneshot))

    api = Metron(Path(args.cache), auth, args.max_requests, offline=args.offline)
    print(f"{len(labels)} of {total_labels} labels, {len(jobs)} series"
          + (" (dry run: no CSV is written)" if args.dry_run else ""))

    stopped = None
    done_series = 0
    try:
        for n, job in enumerate(jobs.values(), start=1):
            series, status, note = resolve_series(api, job)
            if series is None:
                for label, _, oneshot in job.labels:
                    results[label] = (row(label, "no_number", "no issue number in the label, and "
                                          "no Metron series has exactly that name; enter by hand")
                                      if oneshot and status == "no_series"
                                      else row(label, status, note))
            else:
                dates = issue_dates(api, series["id"], {num for _, num, _ in job.labels})
                count = series.get("issue_count") or 0
                for label, num, oneshot in job.labels:
                    why = note
                    if oneshot and count != 1:
                        why = "; ".join(filter(None, [note, f"no issue number in the label: dated "
                                                            f"as #1 of {count} in {series.get('series')}"]))
                    if num in dates:
                        hit = dates[num]
                        results[label] = row(label, "matched", why, hit["cover_date"],
                                             hit.get("id"), series["id"])
                        listings[label] = hit
                    else:
                        results[label] = row(label, "not_in_series",
                                             f"#{num} not in Metron's {series.get('series')}",
                                             series_id=series["id"])
            done_series = n
            if n % 25 == 0:
                print(f"  {n}/{len(jobs)} series · {api.network} requests, "
                      f"{api.cached} from cache")
    except StopRun as e:
        stopped = str(e)
    except KeyboardInterrupt:
        stopped = "interrupted"
    except AuthError as e:
        print(str(e), file=sys.stderr)
        return 1

    report(results, api, done_series, len(jobs), len(all_series), stopped)

    proposals = propose_labels(api, args, results, listings)
    counts = Counter(p["category"] for p in proposals.values())
    print("label proposals: " + (", ".join(f"{c} {n}" for c, n in counts.most_common())
                                 or "none"))

    if args.dry_run:
        return 0
    out = Path(args.out)
    rows = merge_rows(read_existing(out), results)
    write_csv(out, COLUMNS, rows)
    details = {label: {"label": label, "cover_url": hit.get("image") or "",
                       "metron_issue_id": hit.get("id") or "", "status": "listed"}
               for label, hit in listings.items()}
    detail_rows = merge_details(read_existing(Path(args.details_out)), details)
    write_csv(Path(args.details_out), DETAIL_COLUMNS, detail_rows)
    review = merge_review(read_existing(Path(args.label_review)), proposals)
    write_csv(Path(args.label_review), REVIEW_COLUMNS, review)
    if stopped:
        print("Re-run the same command to continue; cached pages cost nothing.")
    return 0


def propose_labels(api: Metron, args, results: dict[str, dict],
                   listings: dict[str, dict]) -> dict[str, dict]:
    """label_review.csv rows: Metron's canonical label where it differs, and a
    same-named volume where the matched one is dated outside the run."""
    placements = {}
    for label, runs in read_placements(Path(args.issues), Path(args.run_issues)).items():
        held = placements.setdefault(args.renames.get(label, label), [])
        held.extend(r for r in runs if r not in held)
    spans = read_spans(Path(args.workbook_runs))
    proposals: dict[str, dict] = {}
    for label, hit in listings.items():
        runs = placements.get(label, [])
        canonical = (hit.get("issue") or "").strip()
        year = int(hit["cover_date"][:4]) if hit.get("cover_date") else None
        outside = [r for r in runs if year and r in spans
                   and not spans[r][0] - WRONG_VOLUME_SLACK <= year <= spans[r][1] + WRONG_VOLUME_SLACK]
        if runs and outside and len(outside) == len(runs):
            try:
                proposals[label] = wrong_volume(api, label, year, runs, spans)
            except StopRun as e:
                proposals[label] = {"label": label, "proposed_label": "", "category": "wrong_volume",
                                    "runs": " ".join(runs), "decision": "",
                                    "evidence": f"matched issue is dated {year}, outside the "
                                                f"workbook span; other volumes not searched yet ({e})"}
            continue
        category = classify_label(label, canonical) if canonical else None
        if category:
            proposals[label] = {"label": label, "proposed_label": canonical,
                                "category": category, "runs": " ".join(runs),
                                "evidence": f"Metron issue {hit.get('id')}: {canonical}",
                                "decision": ""}
    return proposals


def wrong_volume(api: Metron, label: str, year: int, runs: list[str],
                 spans: dict[str, tuple[int, int]]) -> dict:
    """Look for a same-named volume that has this issue number and whose cover
    date falls inside the run. Proposes it if exactly one fits."""
    lo = min(spans[r][0] for r in runs) - WRONG_VOLUME_SLACK
    hi = max(spans[r][1] for r in runs) + WRONG_VOLUME_SLACK
    parsed = parse_label(label) or parse_oneshot(label)
    base = {"label": label, "category": "wrong_volume", "runs": " ".join(runs), "decision": ""}
    evidence = (f"matched issue is dated {year}; the workbook puts "
                f"{', '.join(runs)} in {lo + WRONG_VOLUME_SLACK}-{hi - WRONG_VOLUME_SLACK}")
    if parsed is None:
        return {**base, "proposed_label": "", "evidence": evidence}
    url = api.url("series/", {"name": parsed.title})
    candidates: list[dict] = []
    for _ in range(MAX_SEARCH_PAGES):
        page = api.get(url)
        candidates.extend(page.get("results") or [])
        url = page.get("next")
        if not url:
            break
    key = name_key(parsed.title)
    fits = []
    for c in candidates:
        began = c.get("year_began")
        if name_key(c.get("series") or "") != key or began is None or began > hi:
            continue
        if c.get("year_end") and c["year_end"] < lo:
            continue
        hit = issue_dates(api, c["id"], {parsed.number}).get(parsed.number)
        if hit and hit.get("cover_date") and lo <= int(hit["cover_date"][:4]) <= hi:
            fits.append(hit)
    if len(fits) == 1:
        return {**base, "proposed_label": fits[0].get("issue") or "",
                "evidence": f"{evidence}; {fits[0].get('issue')} is dated {fits[0]['cover_date']}"}
    why = "no other volume fits" if not fits else \
        f"{len(fits)} volumes fit: " + " | ".join(f.get("issue") or "" for f in fits)
    return {**base, "proposed_label": "", "evidence": f"{evidence}; {why}"}


def run_details(args, auth) -> int:
    """Story titles and credits: one detail request per matched Metron issue."""
    current = set(current_labels(args))
    dates = read_existing(Path(args.out))
    by_issue: "OrderedDict[int, list[str]]" = OrderedDict()
    for label in sorted(current):
        r = dates.get(label)
        mid = (r or {}).get("metron_issue_id", "").strip()
        if r and r.get("status") == "matched" and mid.isdigit():
            by_issue.setdefault(int(mid), []).append(label)
    if not by_issue:
        print(f"no matched issues in {args.out} — run `py etl/enrich_comics.py` first")
        return 1
    total = len(by_issue)
    refresh = refresh_ids(args.refresh, by_issue, read_existing(Path(args.details_out)))
    # Issues to refresh go first, so --limit and a short quota spend on them.
    ids = sorted(by_issue, key=lambda mid: mid not in refresh)
    if args.limit:
        ids = ids[:args.limit]
    print(f"{len(ids)} of {total} Metron issues"
          + (f", refreshing up to {len(refresh)} ({args.refresh}) not fetched in "
             f"{REFRESH_AFTER_DAYS} days" if args.refresh else "")
          + (" (dry run: no CSV is written)" if args.dry_run else ""))

    api = Metron(Path(args.cache), auth, args.max_requests, offline=args.offline)
    details: dict[str, dict] = {}
    credits: dict[str, list[dict]] = {}
    stopped, done = None, 0
    roles = Counter()
    try:
        for n, mid in enumerate(ids, start=1):
            detail = api.get(api.url(f"issue/{mid}/"),
                             REFRESH_AFTER_DAYS if mid in refresh else None)
            title = story_title(detail)
            mapped = map_credits(detail)
            notes = [x for x in (("no story title on Metron" if not title else ""),
                                 ("no credits on Metron" if not mapped else "")) if x]
            for label in by_issue[mid]:
                details[label] = {"label": label, "story_title": title,
                                  "story_title_source": "metron" if title else "",
                                  "cover_url": detail.get("image") or "",
                                  "metron_issue_id": mid, "status": "detailed",
                                  "note": "; ".join(notes)}
                credits[label] = [{"label": label, "creator": name, "metron_creator_id": cid or "",
                                   "role": role, "source": "metron"} for name, cid, role in mapped]
            roles.update(role for _, _, role in mapped)
            done = n
            if n % 250 == 0:
                print(f"  {n}/{len(ids)} issues · {api.network} requests, {api.cached} from cache")
    except StopRun as e:
        stopped = str(e)
    except KeyboardInterrupt:
        stopped = "interrupted"
    except AuthError as e:
        print(str(e), file=sys.stderr)
        return 1

    titled = sum(1 for d in details.values() if d["story_title"])
    print(f"\n{done}/{len(ids)} issues detailed" + (f" — stopped: {stopped}" if stopped else ""))
    print(f"  labels with a story title   {titled:>6} of {len(details)}")
    print(f"  labels with credits         {sum(1 for c in credits.values() if c):>6}")
    for role, c in roles.most_common():
        print(f"  {role:<27} {c:>6}")
    print(f"requests: {api.network} to Metron, {api.cached} from cache")
    if api.network and done:
        left = total - done
        print(f"remaining: ~{left:,} requests, ~{left * MIN_INTERVAL / 3600:.1f} h at 20/min, "
              f"~{math.ceil(left / 5000)} day(s) of the 5,000/day quota")

    if args.dry_run:
        return 0
    write_csv(Path(args.details_out), DETAIL_COLUMNS,
              merge_details(read_existing(Path(args.details_out)), details))
    write_csv(Path(args.credits_out), CREDIT_COLUMNS,
              merge_credits(read_rows(Path(args.credits_out)), credits))
    if stopped:
        print("Re-run the same command to continue; cached pages cost nothing.")
    return 0


def refresh_ids(which: str | None, by_issue: dict[int, list[str]],
                details: dict[str, dict]) -> set[int]:
    """Metron issue ids whose cached detail page --refresh should re-request."""
    if not which:
        return set()
    if which == "all":
        return set(by_issue)
    note = REFRESH_NOTES[which]
    return {mid for mid, labels in by_issue.items()
            if any(note in (details.get(label) or {}).get("note", "") for label in labels)}


def current_labels(args) -> list[str]:
    """Labels in seed/issues.csv, with accepted renames already applied — so a
    run before the next extract works on the labels that extract will write."""
    seen: "OrderedDict[str, None]" = OrderedDict()
    for label in read_labels(Path(args.issues)):
        seen.setdefault(args.renames.get(label, label), None)
    return list(seen)


def apply_renames(args) -> dict[str, str]:
    """Move sidecar rows from renamed labels to their accepted new labels."""
    renames = {}
    for label, r in read_existing(Path(args.label_review)).items():
        new = (r.get("proposed_label") or "").strip()
        if (r.get("decision") or "").strip().lower() == "accept" and new and new != label:
            renames[label] = new
    if not renames:
        return renames
    targets = [(Path(args.out), COLUMNS, True, ("cover_date", "source")),
               (Path(args.details_out), DETAIL_COLUMNS, True, ("story_title", "story_title_source")),
               (Path(args.credits_out), CREDIT_COLUMNS, False, None)]
    for path, columns, one, hand in targets:
        if not path.exists():
            continue
        rows, moved = rekey(read_rows(path), renames, one, hand)
        if moved:
            print(f"rekeyed {moved} rows in {path.name} to accepted labels"
                  + (" (dry run: not written)" if args.dry_run else ""))
            if not args.dry_run:
                write_csv(path, columns, rows)
    return renames


def report(results, api, done_series, job_series, all_series, stopped):
    counts = Counter(r["status"] for r in results.values())
    print(f"\n{done_series}/{job_series} series resolved"
          + (f" — stopped: {stopped}" if stopped else ""))
    for status, c in counts.most_common():
        print(f"  {status:<18} {c:>6}")
    if results:
        print(f"  match rate         {counts.get('matched', 0) / len(results):.0%}")
    print(f"requests: {api.network} to Metron, {api.cached} from cache")
    if api.network and done_series:
        est = math.ceil(api.network / done_series * all_series)
        print(f"rough projection for all {all_series} series: ~{est:,} requests, "
              f"~{est * MIN_INTERVAL / 3600:.1f} h at 20/min — the first sample is "
              "small, so treat this as an order of magnitude")


# --------------------------------------------------------------------------
# io
# --------------------------------------------------------------------------

def load_env(path: Path) -> None:
    if not path.exists():
        return
    for line in path.read_text(encoding="utf-8").splitlines():
        m = re.match(r"^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)$", line)
        if m and m.group(1) not in os.environ:
            os.environ[m.group(1)] = m.group(2).strip().strip('"').strip("'")


def auth_header() -> str | None:
    token = os.environ.get("METRON_API_TOKEN", "").strip()
    if token:
        return f"Bearer {token}"
    user = os.environ.get("METRON_USERNAME", "").strip()
    pw = os.environ.get("METRON_PASSWORD", "")
    if user and pw:
        return "Basic " + base64.b64encode(f"{user}:{pw}".encode()).decode()
    return None


def read_labels(path: Path) -> list[str]:
    if not path.exists():
        raise SystemExit(f"{path} not found — run `npm run extract` first")
    seen: "OrderedDict[str, None]" = OrderedDict()
    with path.open(newline="", encoding="utf-8") as fh:
        for r in csv.DictReader(fh):
            if r.get("label"):
                seen.setdefault(r["label"], None)
    return list(seen)


def read_rows(path: Path) -> list[dict]:
    if not path.exists():
        return []
    with path.open(newline="", encoding="utf-8-sig") as fh:
        return [r for r in csv.DictReader(fh) if r.get("label")]


def write_csv(path: Path, columns: list[str], rows: list[dict]) -> None:
    with path.open("w", newline="", encoding="utf-8") as fh:
        w = csv.DictWriter(fh, fieldnames=columns, extrasaction="ignore")
        w.writeheader()
        w.writerows(rows)
    print(f"wrote {len(rows)} rows -> {path}")


def read_placements(issues: Path, run_issues: Path) -> dict[str, list[str]]:
    """label -> run ids holding it, from the extract's issues and run_issues."""
    if not run_issues.exists():
        return {}
    with issues.open(newline="", encoding="utf-8") as fh:
        label_by_id = {r["id"]: r["label"] for r in csv.DictReader(fh)}
    out: dict[str, list[str]] = {}
    with run_issues.open(newline="", encoding="utf-8") as fh:
        for r in csv.DictReader(fh):
            label = label_by_id.get(r["issue_id"])
            if label and r["run_id"] not in out.setdefault(label, []):
                out[label].append(r["run_id"])
    return out


def read_spans(path: Path) -> dict[str, tuple[int, int]]:
    """run id -> (start, end) as typed in the workbook. Untrusted, used only as a
    wrong-volume flag."""
    out: dict[str, tuple[int, int]] = {}
    if not path.exists():
        return out
    with path.open(newline="", encoding="utf-8") as fh:
        for r in csv.DictReader(fh):
            try:
                out[r["id"]] = (int(float(r["start_year"])), int(float(r["end_year"])))
            except (TypeError, ValueError, KeyError):
                continue
    return out


def read_existing(path: Path) -> dict[str, dict]:
    if not path.exists():
        return {}
    with path.open(newline="", encoding="utf-8-sig") as fh:
        return {r["label"]: r for r in csv.DictReader(fh) if r.get("label")}


def main(argv=None) -> int:
    ap = argparse.ArgumentParser(description=__doc__.split("\n\n")[0])
    ap.add_argument("--issues", default="seed/issues.csv")
    ap.add_argument("--out", default="etl/data/cover_dates.csv")
    ap.add_argument("--run-issues", default="seed/run_issues.csv")
    ap.add_argument("--workbook-runs", default="seed/workbook_run_fields.csv")
    ap.add_argument("--details-out", default="etl/data/issue_details.csv")
    ap.add_argument("--credits-out", default="etl/data/issue_credits.csv")
    ap.add_argument("--label-review", default="etl/data/label_review.csv")
    ap.add_argument("--details", action="store_true",
                    help="story titles and credits: one request per matched issue")
    ap.add_argument("--refresh", nargs="?", const="credits", choices=["credits", "titles", "all"],
                    help="with --details: re-request cached detail pages of issues Metron had "
                         "no credits for (default), no story title for, or all")
    ap.add_argument("--cache", default="etl/.metron-cache.sqlite")
    ap.add_argument("--env", default=".env")
    ap.add_argument("--dry-run", action="store_true",
                    help="report match rate and request cost; write no CSV (default --limit 50)")
    ap.add_argument("--limit", type=int, default=None,
                    help="only the first N distinct labels (with --details: Metron issues)")
    ap.add_argument("--max-requests", type=int, default=4800,
                    help="stop after this many network requests (daily quota is 5,000)")
    ap.add_argument("--offline", action="store_true", help="use the cache only")
    args = ap.parse_args(argv)
    if args.refresh and not args.details:
        ap.error("--refresh works with --details")
    if args.dry_run and args.limit is None:
        args.limit = 50
    return run(args)


if __name__ == "__main__":
    sys.exit(main())
