#!/usr/bin/env python3
"""
fandom_titles.py — fill missing story titles from Marvel Fandom (marvel.fandom.com).

    py etl/fandom_titles.py --dry-run     # fetch and report; issue_details.csv untouched
    py etl/fandom_titles.py               # write the titles it found
    py etl/fandom_titles.py --limit 20    # only the first 20 series (a trial run)

Either way it rewrites etl/data/fandom_skipped.csv: one row per issue it
couldn't title, with the reason (worst first — a series whose Fandom volume
couldn't be pinned down hides all of its issues), what it tried or found, what
to do about it, and a Fandom link to start from. That file is the to-do list.

You answer it in etl/data/fandom_pages.csv (hand-kept, columns match, fandom,
note), and the next run uses your answer instead of guessing:

    match                        fandom
    Thunderbolts (2006)          Thunderbolts Vol 1          <- a whole series
    Siege Prologue (2009) ...    Siege Prologue Vol 1 1      <- one issue

`match` is copied from the skipped file's `series` column (to fix a series) or
`label` column (to fix one issue). `fandom` is the page name, or its URL pasted
from the browser; a bare volume ("Name Vol N") fixes the series, a full page
("Name Vol N issue") fixes that issue, and `none` records that you looked and
Fandom has no title (a series or an issue; it's reported as "no story title on
Fandom either" without fetching, so the checklist stops asking). An issue row
wins over its series row. A
volume you named is still checked page by page against the cover dates; a page
you named for one issue is trusted as it is.

Takes every current label (seed/issues.csv) whose issue_details.csv row has no
story title, and looks for the issue's page on Fandom. Fandom names pages by
volume ("Alias Vol 1 1"), not by year ("Alias (2001) #1"), so each series is
resolved once: Vol 1..12 of its name (and the name without a leading "The") are
tried for a few of its dated issues, and a volume is accepted only when exactly
one agrees with the cover years Metron gave us (within a year) and none
disagrees. Nothing is guessed — a series with no match, or more than one, is
reported and skipped, and so is an issue whose own page year disagrees with its
cover date.

A found title is written as story_title_source = `hand` — the same thing typing
it in from Fandom would be — and appended to etl/data/fandom_titles.csv so you
can tell which hand titles this script supplied. That file is also yours to add
to: a row you type there (label, story_title; fandom_page and fetched_at are
optional) is applied the same way on the next run, if that issue has no title
yet. A row whose label isn't a current label is reported, with the closest
label it could have meant. Several stories are joined
with "; ", as Metron's are. A title that's already there, from any source, is
never touched.

Page lookups are cached in etl/.fandom-cache.json (just the page's year and
titles, not the page), so a re-run only asks about what it hasn't seen.
Standard library only. Run `npm run sidecars` afterwards to refresh
metadata_todo.md.
"""

from __future__ import annotations

import argparse
import csv
import difflib
import json
import re
import sys
import time
import unicodedata
import urllib.error
import urllib.parse
import urllib.request
from collections import OrderedDict
from dataclasses import dataclass, field
from datetime import date
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent))
import enrich_comics as ec  # noqa: E402

API = "https://marvel.fandom.com/api.php"
USER_AGENT = "ledger-backfill/1.0 (personal media ledger; story titles)"
MIN_INTERVAL = 1.0      # seconds between requests
BATCH = 50              # MediaWiki's page limit per query
MAX_VOLUME = 12         # Captain America and Avengers are past Vol 8
REPS = 3                # dated issues per series used to pick its volume
YEAR_SLACK = 1          # a cover year and Fandom's Year may differ by one (on-sale vs cover)
LOG_COLUMNS = ["fetched_at", "label", "fandom_page", "story_title"]


# --------------------------------------------------------------------------
# parsing — pure functions, covered by test_fandom_titles.py
# --------------------------------------------------------------------------

def split_label(label: str) -> tuple[str, int | None, str] | None:
    """(series name, label year, issue number as Fandom writes it)."""
    m = ec.LABEL_RE.match(label.strip())
    if m:
        return m.group("title").strip(), int(m.group("year")) if m.group("year") else None, \
            fandom_number(m.group("num"))
    one = ec.parse_oneshot(label)
    if one:
        return one.title, one.year, "1"
    return None


def fandom_number(raw: str) -> str:
    n = raw.strip().replace("⁄", "/")
    n = re.sub(r"^0+(?=\d)", "", n)
    return "½" if n == "1/2" else n


def series_names(title: str) -> list[str]:
    names = [title]
    if title.startswith("The "):
        names.append(title[4:])
    return names


def page_title(series: str, volume: int, number: str) -> str:
    return f"{series} Vol {volume} {number}"


FIELD_RE = re.compile(r"^\|\s*(StoryTitle(\d+)|Year)\s*=[ \t]*(.*?)\s*$", re.M)


def clean_markup(s: str) -> str:
    s = re.sub(r"<!--.*?-->", "", s, flags=re.S)
    s = re.sub(r"<ref[^>]*/>|<ref[^>]*>.*?</ref>", "", s, flags=re.S)
    s = re.sub(r"<br\s*/?>", " ", s)
    s = re.sub(r"\[\[(?:[^\]|]*\|)?([^\]]*)\]\]", r"\1", s)
    s = re.sub(r"\{\{[^{}]*\}\}", "", s)
    s = s.replace("'''", "").replace("''", "")
    return re.sub(r"\s+", " ", s).strip()


def page_fields(wikitext: str) -> tuple[int | None, str]:
    """(Year, story titles joined with '; ') from an issue page's Comic Template."""
    year, stories = None, {}
    for m in FIELD_RE.finditer(wikitext):
        if m.group(1) == "Year":
            if re.fullmatch(r"\d{4}", m.group(3)):
                year = int(m.group(3))
        else:
            title = clean_markup(m.group(3))
            if title:
                stories[int(m.group(2))] = title
    return year, "; ".join(stories[k] for k in sorted(stories))


def close(a: int | None, b: int | None) -> bool:
    return a is not None and b is not None and abs(a - b) <= YEAR_SLACK


def choose_volume(candidates: dict[tuple[str, int], list[tuple[int | None, int | None]]]
                  ) -> tuple[str, int] | None:
    """candidates: (series name, volume) -> [(page year or None if missing, our cover year)]
    per representative issue. The one volume that some rep agrees with and none
    contradicts, or None. When several fit within a year, the one whose found
    pages all match the cover year exactly wins — if exactly one does."""
    fits = []
    for key, checks in candidates.items():
        agree = sum(1 for page, ours in checks if close(page, ours))
        disagree = sum(1 for page, ours in checks
                       if page is not None and ours is not None and not close(page, ours))
        if agree and not disagree:
            fits.append(key)
    if len(fits) == 1:
        return fits[0]
    exact = [k for k in fits
             if all(page == ours for page, ours in candidates[k] if page is not None)]
    return exact[0] if len(exact) == 1 else None


def candidate_detail(cands: dict[tuple[str, int], list[tuple[int | None, int | None]]]) -> str:
    """Why no single volume was picked: the volumes that fit, else the pages that
    exist but disagree on the year, else what was looked for."""
    def years(checks):
        return ", ".join(f"Fandom {p} vs cover {o}" for p, o in checks if p is not None)
    fits = [k for k, c in cands.items() if any(close(p, o) for p, o in c)]
    if len(fits) > 1:
        return "fits: " + "; ".join(f"{n} Vol {v} ({years(cands[(n, v)])})" for n, v in fits)
    found = [k for k, c in cands.items() if any(p is not None for p, _ in c)]
    if found:
        return "pages exist but the year is off: " + "; ".join(
            f"{n} Vol {v} ({years(cands[(n, v)])})" for n, v in found)
    names = sorted({n for n, _ in cands})
    return f"no page under {' / '.join(repr(n) for n in names)} Vol 1-{MAX_VOLUME}"


PAGES_COLUMNS = ["match", "fandom", "note"]
SERIES_PAGE = re.compile(r"^.+ Vol \d+$")
ISSUE_PAGE = re.compile(r"^.+ Vol \d+ \S+$")


def page_name(value: str) -> str:
    """A Fandom page name from what was typed or pasted: 'X Vol 1', 'X_Vol_1', or
    the page's URL."""
    v = value.strip()
    if "/wiki/" in v:
        v = urllib.parse.unquote(v.split("/wiki/", 1)[1].split("?")[0].split("#")[0])
    return re.sub(r"\s+", " ", v.replace("_", " ")).strip()


NONE_VALUES = {"none", "no title", "untitled", "-"}


def read_overrides(rows: list[dict]
                   ) -> tuple[dict[str, str], dict[str, str], set[str], list[str]]:
    """fandom_pages.csv rows -> (series -> 'Name Vol N', label -> 'Name Vol N issue',
    marked none, problems). The shape of `fandom` decides which: a volume fixes
    the whole series, a full page fixes one issue, and `none` says you looked
    and Fandom has no title (for a series or a label, whichever `match` names)."""
    series, issues, blank, problems = {}, {}, set(), []
    for r in rows:
        match, fandom = (r.get("match") or "").strip(), page_name(r.get("fandom") or "")
        if not match and not fandom:
            continue
        if not match or not fandom:
            problems.append(f"{match or fandom!r}: needs both `match` and `fandom`")
        elif fandom.lower() in NONE_VALUES:
            blank.add(match)
        elif SERIES_PAGE.match(fandom):
            series[match] = fandom
        elif ISSUE_PAGE.match(fandom):
            issues[match] = fandom
        else:
            problems.append(f"{match}: {fandom!r} is neither 'Name Vol N', 'Name Vol N issue' nor 'none'")
    return series, issues, blank, problems


def label_key(s: str) -> str:
    """How your rows are matched to labels: dash style, spacing and case don't matter,
    so a row typed with '-' still finds a label renamed to '–'."""
    s = unicodedata.normalize("NFKC", s).replace("–", "-").replace("—", "-")
    return re.sub(r"\s+", " ", s).strip().casefold()


def accepted_renames(path: Path) -> dict[str, str]:
    """label_review.csv's accepted renames, as check_sidecars.py applies them, so both
    scripts call every issue by the same label."""
    renames = {}
    for label, r in (ec.read_existing(path) if path.exists() else {}).items():
        new = (r.get("proposed_label") or "").strip()
        if (r.get("decision") or "").strip().lower() == "accept" and new and new != label:
            renames[label] = new
    return renames


def fandom_link(page: str) -> str:
    return "https://marvel.fandom.com/wiki/" + urllib.parse.quote(page.replace(" ", "_"))


def fandom_search(query: str) -> str:
    return ("https://marvel.fandom.com/wiki/Special:Search?scope=internal&query="
            + urllib.parse.quote(query))


NO_TITLE = "no story title on Fandom either"   # check_sidecars reads this reason too

# Worst first: a series-level miss hides every issue in it.
SKIP_ORDER = ["more than one Fandom volume fits", "no Fandom volume found",
              "no cover date to confirm the volume", "label not understood",
              "Fandom's year disagrees with the cover date", "no Fandom page for the issue",
              NO_TITLE]
SKIP_COLUMNS = ["reason", "series", "label", "detail", "fix", "fandom_link"]
SERIES_REASONS = {"more than one Fandom volume fits", "no Fandom volume found",
                  "no cover date to confirm the volume"}


def fix_hint(reason: str, series: str, label: str) -> str:
    if reason in SERIES_REASONS:
        return f"fandom_pages.csv: match = {series} / fandom = Name Vol N (the whole series)"
    if reason == NO_TITLE:
        return "nothing to fetch; type a title by hand if you find one elsewhere"
    return f"fandom_pages.csv: match = {label} / fandom = Name Vol N issue (this issue only)"


def write_skipped(path: Path, records: list[dict]) -> None:
    rank = {r: i for i, r in enumerate(SKIP_ORDER)}
    records = sorted(records, key=lambda r: (rank.get(r["reason"], len(rank)), r["series"], r["label"]))
    write_csv_safely(path, SKIP_COLUMNS, records)


def apply_titles(rows: list[dict], found: dict[str, str], columns: list[str]) -> list[str]:
    """Write found titles into issue_details rows that have none, adding a row for
    a label that has no row yet. Never touches a title that's already there.
    Returns the labels written."""
    by_label = {r["label"]: r for r in rows}
    written = []
    for label, title in found.items():
        r = by_label.get(label)
        if r is None:
            r = {c: "" for c in columns}
            r["label"] = label
            rows.append(r)
            by_label[label] = r
        if (r.get("story_title") or "").strip():
            continue
        r["story_title"] = title
        r["story_title_source"] = "hand"
        written.append(label)
    return written


# --------------------------------------------------------------------------
# Fandom
# --------------------------------------------------------------------------

@dataclass
class Fandom:
    cache_path: Path
    offline: bool = False
    cache: dict = field(default_factory=dict)
    last: float = 0.0
    requests: int = 0

    def __post_init__(self):
        if self.cache_path.exists():
            self.cache = json.loads(self.cache_path.read_text(encoding="utf-8"))

    def save(self) -> None:
        tmp = self.cache_path.with_suffix(".tmp")
        tmp.write_text(json.dumps(self.cache, ensure_ascii=False), encoding="utf-8")
        tmp.replace(self.cache_path)

    def pages(self, titles: list[str]) -> dict[str, dict]:
        """title -> {"exists": bool, "year": int|None, "titles": str}."""
        wanted = [t for t in OrderedDict.fromkeys(titles) if t not in self.cache]
        if wanted and not self.offline:
            for i in range(0, len(wanted), BATCH):
                self._fetch(wanted[i:i + BATCH])
                self.save()
        return {t: self.cache.get(t, {"exists": False, "year": None, "titles": ""}) for t in titles}

    def _fetch(self, titles: list[str]) -> None:
        params = {"action": "query", "format": "json", "formatversion": "2", "redirects": "1",
                  "prop": "revisions", "rvprop": "content", "rvslots": "main",
                  "titles": "|".join(titles)}
        data = self._get(params)["query"]
        final = {t: t for t in titles}
        for step in ("normalized", "redirects"):
            hop = {x["from"]: x["to"] for x in data.get(step, [])}
            final = {t: hop.get(f, f) for t, f in final.items()}
        pages = {p["title"]: p for p in data.get("pages", [])}
        for t, f in final.items():
            p = pages.get(f)
            if not p or p.get("missing") or p.get("invalid"):
                self.cache[t] = {"exists": False, "year": None, "titles": ""}
                continue
            text = p["revisions"][0]["slots"]["main"]["content"]
            year, stories = page_fields(text)
            self.cache[t] = {"exists": True, "year": year, "titles": stories, "page": f}

    def _get(self, params: dict) -> dict:
        url = API + "?" + urllib.parse.urlencode(params)
        for attempt in range(4):
            wait = MIN_INTERVAL - (time.monotonic() - self.last)
            if wait > 0:
                time.sleep(wait)
            self.last = time.monotonic()
            self.requests += 1
            try:
                req = urllib.request.Request(url, headers={"User-Agent": USER_AGENT})
                with urllib.request.urlopen(req, timeout=30) as resp:
                    return json.load(resp)
            except urllib.error.HTTPError as e:
                if e.code not in (429, 500, 502, 503, 504) or attempt == 3:
                    raise
                time.sleep(int(e.headers.get("Retry-After") or 5 * (attempt + 1)))
            except urllib.error.URLError:
                if attempt == 3:
                    raise
                time.sleep(5 * (attempt + 1))
        raise RuntimeError("unreachable")


# --------------------------------------------------------------------------
# run
# --------------------------------------------------------------------------

def read_csv(path: Path) -> tuple[list[str], list[dict]]:
    with path.open(newline="", encoding="utf-8-sig") as fh:
        reader = csv.DictReader(fh)
        return list(reader.fieldnames or []), [{k: v or "" for k, v in r.items() if k} for r in reader]


def write_csv_safely(path: Path, columns: list[str], rows: list[dict]) -> None:
    tmp = path.with_suffix(".csv.tmp")
    with tmp.open("w", newline="", encoding="utf-8") as fh:
        w = csv.DictWriter(fh, fieldnames=columns, extrasaction="ignore")
        w.writeheader()
        w.writerows(rows)
    with tmp.open(newline="", encoding="utf-8") as fh:
        check = list(csv.reader(fh))
    if len(check) != len(rows) + 1 or any(len(r) != len(columns) for r in check):
        raise SystemExit(f"{tmp} failed validation; {path} left as it was")
    tmp.replace(path)


def main(argv=None) -> int:
    ap = argparse.ArgumentParser(description=__doc__.split("\n\n")[0])
    ap.add_argument("--dry-run", action="store_true",
                     help="report only; issue_details.csv and the log are not written")
    ap.add_argument("--limit", type=int, help="only the first N series")
    ap.add_argument("--offline", action="store_true", help="use the cache only; no requests")
    ap.add_argument("--data", default="etl/data")
    ap.add_argument("--seed", default="seed")
    ap.add_argument("--cache", default="etl/.fandom-cache.json")
    ap.add_argument("--log", default="etl/data/fandom_titles.csv")
    ap.add_argument("--skipped", default="etl/data/fandom_skipped.csv",
                     help="every issue it couldn't title, and why (rewritten each run)")
    ap.add_argument("--pages", default="etl/data/fandom_pages.csv",
                     help="hand-kept: which Fandom volume or page a series or issue is")
    args = ap.parse_args(argv)

    data, seed = Path(args.data), Path(args.seed)
    if not (seed / "issues.csv").exists():
        raise SystemExit(f"{seed / 'issues.csv'} not found — run `npm run extract` first")
    renames = accepted_renames(data / "label_review.csv")
    labels = list(OrderedDict.fromkeys(renames.get(l, l) for l in ec.read_labels(seed / "issues.csv")))
    by_key = {label_key(l): l for l in labels}
    detail_cols, details = read_csv(data / "issue_details.csv")
    if any(None in r for r in details):
        raise SystemExit("issue_details.csv has a malformed row — run `npm run sidecars` first")
    titled = {r["label"] for r in details if (r.get("story_title") or "").strip()}

    # Rows you added to fandom_titles.csv yourself: applied to untitled issues, not fetched.
    log_path, known = Path(args.log), set(labels)
    from_log: dict[str, str] = {}
    for r in (read_csv(log_path)[1] if log_path.exists() else []):
        label, title = (r.get("label") or "").strip(), (r.get("story_title") or "").strip()
        label = by_key.get(label_key(label), label)
        if not label or label in titled:
            continue
        if label not in known:
            near = difflib.get_close_matches(label, labels, n=1, cutoff=0.85)
            print(f"  {log_path.name}: {label!r} isn't a current label"
                  + (f" — did you mean {near[0]!r}?" if near else ""))
        elif not title:
            print(f"  {log_path.name}: {label!r} has no story_title")
        else:
            from_log[label] = title

    _, dates = read_csv(data / "cover_dates.csv")
    cover_year = {r["label"]: int(r["cover_date"][:4]) for r in dates
                  if re.match(r"\d{4}", r.get("cover_date") or "")}

    # Group the untitled issues by series.
    groups: "OrderedDict[tuple[str, int | None], list[tuple[str, str]]]" = OrderedDict()
    unparsed = []
    for label in labels:
        if label in titled or label in from_log:
            continue
        parts = split_label(label)
        if not parts:
            unparsed.append(label)
            continue
        series, year, number = parts
        groups.setdefault((series, year), []).append((label, number))
    keys = list(groups)[:args.limit] if args.limit else list(groups)
    print(f"{sum(len(groups[k]) for k in keys)} untitled issues in {len(keys)} series"
          + (" (dry run: issue_details.csv is not written)" if args.dry_run else ""))

    fandom = Fandom(Path(args.cache), offline=args.offline)

    # Your answers from fandom_pages.csv: a volume for a series, a page for an
    # issue, or `none` for either. An answer about one issue beats its series'.
    pages_path = Path(args.pages)
    series_over, issue_over, blank, problems = read_overrides(
        read_csv(pages_path)[1] if pages_path.exists() else [])
    for p in problems:
        print(f"  {pages_path.name}: {p}")
    def series_name(k):
        return f"{k[0]} ({k[1]})" if k[1] else k[0]
    series_of = {l: series_name(k) for k in keys for l, _ in groups[k]}
    untitled = set(unparsed) | set(series_of)
    # Your `match` as typed -> the series or label it means, ignoring dash style/spacing/case.
    canon = {label_key(x): x for x in untitled | set(series_of.values())}
    series_over = {canon.get(label_key(m), m): v for m, v in series_over.items()}
    issue_over = {canon.get(label_key(m), m): v for m, v in issue_over.items()}
    blank = {canon.get(label_key(m), m) for m in blank}
    marked = {l for l in untitled if l in blank
              or (series_of.get(l) in blank and l not in issue_over)}
    issue_over = {l: p for l, p in issue_over.items() if l not in marked}
    handled = marked | set(issue_over)
    series_names_now = set(series_of.values())
    unused = [m for m in series_over if m not in series_names_now] + \
             [m for m in issue_over if m not in untitled] + \
             [m for m in blank if m not in untitled and m not in series_names_now]

    # Pick each remaining series' Fandom volume from a few of its dated issues.
    auto = [k for k in keys if series_name(k) not in series_over and series_name(k) not in blank]
    reps = {k: [(l, n) for l, n in groups[k] if l in cover_year and l not in handled][:REPS]
            for k in auto}
    fandom.pages([page_title(name, v, n) for k in auto for name in series_names(k[0])
                  for v in range(1, MAX_VOLUME + 1) for _, n in reps[k]])
    volume: dict[tuple[str, int | None], str] = {k: series_over[series_name(k)]
                                                 for k in keys if series_name(k) in series_over}
    skipped: list[dict] = []

    def skip(reason: str, series: str, label: str, detail: str, link: str) -> None:
        skipped.append({"reason": reason, "series": series, "label": label, "detail": detail,
                        "fix": fix_hint(reason, series, label), "fandom_link": link})

    for label in sorted(marked):
        skip(NO_TITLE, series_of.get(label, ""), label,
             f"marked `none` in {pages_path.name}: you looked, and Fandom has no title",
             fandom_search(label))
    for label in unparsed:
        if label not in handled:
            skip("label not understood", "", label, "couldn't split it into series and number",
                 fandom_search(label))
    for k in auto:
        series = series_name(k)
        rest = [l for l, _ in groups[k] if l not in handled]
        if not rest:
            continue
        if not reps[k]:
            for l in rest:
                skip("no cover date to confirm the volume", series, l,
                     "none of the series' untitled issues has a cover date", fandom_search(k[0]))
            continue
        cands = {}
        for name in series_names(k[0]):
            for v in range(1, MAX_VOLUME + 1):
                checks = []
                for l, n in reps[k]:
                    p = fandom.cache.get(page_title(name, v, n), {})
                    checks.append((p.get("year") if p.get("exists") else None, cover_year[l]))
                cands[(name, v)] = checks
        pick = choose_volume(cands)
        if pick:
            volume[k] = f"{pick[0]} Vol {pick[1]}"
            continue
        fits = sum(1 for c in cands.values() if any(close(p, o) for p, o in c))
        reason = "more than one Fandom volume fits" if fits > 1 else "no Fandom volume found"
        detail = candidate_detail(cands)
        for l in rest:
            skip(reason, series, l, detail, fandom_search(k[0]))

    # Fetch every untitled issue: its own page if you named one, else its series' volume.
    wanted = {l: f"{volume[k]} {n}" for k in volume for l, n in groups[k] if l not in handled}
    wanted.update({l: p for l, p in issue_over.items() if l in untitled})
    pages = fandom.pages(list(wanted.values()))
    found: dict[str, str] = {}
    for label, t in wanted.items():
        p = pages[t]
        yours = label in issue_over or series_of.get(label) in series_over
        where = f"{pages_path.name} says {t!r}" if yours else f"the series matched {t.rsplit(' ', 1)[0]!r}"
        if not p["exists"]:
            skip("no Fandom page for the issue", series_of.get(label, ""), label,
                 f"{where}, but there's no such page", fandom_link(t))
        elif (label not in issue_over and label in cover_year and p["year"] is not None
              and not close(p["year"], cover_year[label])):
            skip("Fandom's year disagrees with the cover date", series_of.get(label, ""), label,
                 f"{t}: Fandom {p['year']} vs cover {cover_year[label]}", fandom_link(t))
        elif not p["titles"]:
            skip(NO_TITLE, series_of.get(label, ""), label,
                 f"{t} has a blank StoryTitle", fandom_link(p.get("page", t)))
        else:
            found[label] = p["titles"]
    if unused:
        print(f"  {len(unused)} {pages_path.name} rows matched nothing untitled "
              f"(already titled, or a typo): {', '.join(unused[:5])}")

    print(f"{fandom.requests} requests; {len(volume)} of {len(keys)} series matched a volume; "
          f"titles found for {len(found)} issues"
          + (f", plus {len(from_log)} you added to {log_path.name}" if from_log else ""))
    counts: dict[str, set] = {}
    for r in skipped:
        counts.setdefault(r["reason"], set()).add(r["series"] or r["label"])
    for reason in SKIP_ORDER:
        n_issues = sum(1 for r in skipped if r["reason"] == reason)
        if n_issues:
            print(f"  {reason}: {n_issues} issues in {len(counts[reason])} series")
    write_skipped(Path(args.skipped), skipped)
    print(f"skipped issues, with why -> {args.skipped}")

    if args.dry_run or not (found or from_log):
        for label, title in list(from_log.items())[:15]:
            print(f"  would write  {label}: {title}  (your {log_path.name} row)")
        for label, title in list(found.items())[:15]:
            print(f"  would write  {label}: {title}")
        return 0

    written = apply_titles(details, {**found, **from_log}, detail_cols)
    details.sort(key=lambda r: r["label"])
    write_csv_safely(data / "issue_details.csv", detail_cols, details)

    new_log = not log_path.exists()
    with log_path.open("a", newline="", encoding="utf-8") as fh:
        w = csv.DictWriter(fh, fieldnames=LOG_COLUMNS)
        if new_log:
            w.writeheader()
        today = date.today().isoformat()
        for label in written:
            if label in from_log:
                continue  # already in the log: it's your row
            w.writerow({"fetched_at": today, "label": label,
                        "fandom_page": fandom.cache[wanted[label]].get("page", wanted[label]),
                        "story_title": found[label]})
    print(f"\nwrote {len(written)} story titles to issue_details.csv (source hand); logged in {log_path}")
    print("run `npm run sidecars` to refresh metadata_todo.md")
    return 0


if __name__ == "__main__":
    sys.exit(main())
