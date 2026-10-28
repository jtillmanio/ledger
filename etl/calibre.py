#!/usr/bin/env python3
"""
calibre.py — the owner's Calibre library, into the sidecar extract folds in.

    py etl/calibre.py --dry-run     # the match rate and what changed; writes nothing, asks Open Library nothing
    py etl/calibre.py               # writes the sidecar; asks Open Library about series
    py etl/calibre.py --offline     # Open Library from the cache only

The library is `--library <folder>` or CALIBRE_LIBRARY in .env (task 1.18, D-73,
D-83). Its metadata.db is copied to a temp folder outside the repo and the copy
is opened read-only, so a running Calibre is never locked or written; the copy
is removed after the run. Custom columns are found by lookup name (`#words`,
`#read`, `#date_read`, `#type`, each overridable), never by custom_column_N.

Calibre is the source of truth for a book's data and its reads (D-87): the owner
edits Calibre and nothing else. So nothing here waits on a decision except a
near spelling, and what disagrees is reported (extract's unresolved.csv), never
silently dropped.

Every Calibre book is matched to the books extract wrote (seed/books.csv), by
1.13's rule: title and author compared after extract's clean() and key(), with
book_review.csv's merges applied. A book with several authors matches on any.
- matched    a workbook book with its title and one of its authors
- proposed   a near spelling by the same author (trigram similarity >= 0.5, or
             one title the other plus a `: subtitle`, D-89; the titles not
             differing only by a number), or the same title under another
             author: appended to book_review.csv as reason `calibre`
             with `keep` pre-filled with Calibre's spelling, and held until the
             owner decides (`merge` renames the workbook's book to Calibre's,
             `separate` creates Calibre's)
- unmatched  anything else: extract creates it at Unlisted (D-83, D-86)
Books an earlier run created (seed/calibre_created.csv) are never matched.
A Comic record is skipped and listed; a Fan Fiction record comes in with
book_type `Fan Fiction` (D-88).

What it writes, in etl/data/ and committed like the other sidecars:
- calibre_books.csv    title, author -> Calibre's words, series, index, ISBN,
                       tags, type, read flag, date read (its Eastern day, D-67,
                       or a year) and precision (D-88); `confirmed` lists what
                       Open Library agreed with, and `open_library` is its
                       series where it differs. Comments stay out until
                       books.summary exists (D-88).
- book_review.csv      the `calibre` proposals above.

Open Library is asked about each Calibre series, with 1.14's client and cache
(enrich_books.OpenLibrary), so a workbook book's answer is already cached. Its
answer fills nothing: a different series is reported. An ISBN is compared only
against an answer in hand.

Re-runnable until cutover (D-83): existing rows keep their place, a changed book
is rewritten in place, a new one appends its row, a removed one goes, a run over
an unchanged library changes no byte, and every run prints what changed in
Calibre since the last.
"""

from __future__ import annotations

import argparse
import csv
import io
import json
import os
import re
import shutil
import sqlite3
import sys
import tempfile
import time
from collections import Counter
from datetime import datetime, timezone
from pathlib import Path
from zoneinfo import ZoneInfo

sys.path.insert(0, str(Path(__file__).parent))
import enrich_books as eb  # noqa: E402
import extract as ex  # noqa: E402

EASTERN = ZoneInfo("America/New_York")
SKIPPED_TYPES = {"comic"}
STATUSES = ("matched", "proposed", "unmatched")
MAX_FAILURES = 3        # failed lookups in a row before the run stops asking Open Library
# A Calibre near spelling is proposed at this trigram similarity or more, or as
# a subtitle (ex.subtitled()). Higher than the workbook's own pairs (D-25a's 0.4):
# under 0.5 Calibre's pairs were series patterns, two books (owner, D-89). Open
# Library's near spellings use the same line (enrich_books.SIMILAR_AT, D-92).
SIMILAR_AT = eb.SIMILAR_AT
PROGRESS_SECONDS = 5    # a progress line at most this often while Open Library is asked


# --------------------------------------------------------------------------
# the library
# --------------------------------------------------------------------------

def library_path(arg: str | None, env: Path) -> Path:
    load_env(env)
    folder = arg or os.environ.get("CALIBRE_LIBRARY", "").strip()
    if not folder:
        raise SystemExit("calibre: no library: pass --library <folder>, or set CALIBRE_LIBRARY in .env")
    db = Path(folder) / "metadata.db"
    if not db.exists():
        raise SystemExit(f"calibre: {db} not found: --library and CALIBRE_LIBRARY name the folder holding it")
    return db


def load_env(path: Path) -> None:
    if not path.exists():
        return
    for line in path.read_text(encoding="utf-8").splitlines():
        m = re.match(r"^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)$", line)
        if m and m.group(1) not in os.environ:
            os.environ[m.group(1)] = m.group(2).strip().strip('"').strip("'")


def read_library(source: Path, columns: dict[str, str]) -> list[dict]:
    """Every record in a temp copy of metadata.db, in Calibre's id order."""
    folder = Path(tempfile.mkdtemp(prefix="ledger-calibre-"))
    try:
        copy = folder / "metadata.db"
        shutil.copyfile(source, copy)
        db = sqlite3.connect(copy.resolve().as_uri() + "?mode=ro", uri=True)
        try:
            return records(db, columns)
        finally:
            db.close()
    finally:
        shutil.rmtree(folder, ignore_errors=True)


def custom_column(db, lookup: str | None, required: bool) -> tuple[dict, dict] | None:
    """(book -> value, the column's display settings) for a lookup name, or
    None when the library has no such column and it isn't required."""
    if not lookup:
        return None
    row = db.execute("SELECT id, normalized, display FROM custom_columns WHERE label = ?",
                     (lookup.lstrip("#"),)).fetchone()
    if row is None:
        if required:
            raise SystemExit(f"calibre: the library has no custom column {lookup}: name its lookup name "
                             "with --words-column or --date-column")
        print(f"  no column {lookup}: left blank")
        return None
    n, normalized, display = row
    if normalized:
        q = (f"SELECT l.book, v.value FROM books_custom_column_{n}_link l "
             f"JOIN custom_column_{n} v ON v.id = l.value ORDER BY l.id")
    else:
        q = f"SELECT book, value FROM custom_column_{n}"
    values = {}
    for book, value in db.execute(q):
        values.setdefault(book, value)
    return values, json.loads(display or "{}")


def records(db, columns: dict[str, str]) -> list[dict]:
    words = custom_column(db, columns["words"], required=True)
    dates = custom_column(db, columns["date"], required=True)
    flags = custom_column(db, columns["read"], required=False)
    kinds = custom_column(db, columns["type"], required=False)
    date_format = (dates[1].get("date_format") or "") if dates else ""

    def grouped(q):
        out: dict[int, list] = {}
        for book, value in db.execute(q):
            out.setdefault(book, []).append(value)
        return out

    authors = grouped("SELECT l.book, a.name FROM books_authors_link l JOIN authors a ON a.id = l.author "
                      "ORDER BY l.id")
    series = grouped("SELECT l.book, s.name FROM books_series_link l JOIN series s ON s.id = l.series "
                     "ORDER BY l.id")
    isbns = grouped("SELECT book, val FROM identifiers WHERE type = 'isbn' ORDER BY id")
    tags = grouped("SELECT l.book, t.name FROM books_tags_link l JOIN tags t ON t.id = l.tag ORDER BY t.name")
    out = []
    for bid, title, index in db.execute("SELECT id, title, series_index FROM books ORDER BY id"):
        date_read, precision = read_date((dates[0] if dates else {}).get(bid), date_format)
        flag = (flags[0] if flags else {}).get(bid)
        out.append({"title": ex.title_text(title), "authors": [ex.clean(a) for a in authors.get(bid, [])],
                    "series": ex.clean((series.get(bid) or [None])[0]), "index": index,
                    "isbn": ex.clean((isbns.get(bid) or [None])[0]), "tags": tags.get(bid, []),
                    "words": ex.as_int((words[0] if words else {}).get(bid)),
                    "read": "" if flag is None else ("true" if flag else "false"),
                    "date_read": date_read, "precision": precision,
                    "type": ex.clean((kinds[0] if kinds else {}).get(bid)) or ""})
    return out


def read_date(value, date_format: str) -> tuple[str, str]:
    """(date_read, precision) for a Calibre date. Calibre stores UTC; the day is
    the Eastern one (D-67). A column shown without its day keeps the stored day
    as `approximate`, and one shown as a year alone is that year (owner, at
    1.18's plan gate; extract loads it as July 1st). Calibre's `0101-01-01`
    means no date."""
    if not value:
        return "", "none"
    try:
        when = datetime.fromisoformat(str(value))
    except ValueError:
        return "", "none"
    if when.year < 1000:
        return "", "none"
    if when.tzinfo is None:
        when = when.replace(tzinfo=timezone.utc)
    day = when.astimezone(EASTERN).date()
    # `iso` is Calibre's name for a full ISO date, which has its day.
    if not date_format or "d" in date_format or date_format.strip().lower() == "iso":
        return day.isoformat(), "exact"
    if "M" not in date_format:
        return str(day.year), "approximate"
    return day.isoformat(), "approximate"


def number(v) -> str:
    """A series index as text: 1.0 -> `1`, 1.5 -> `1.5`."""
    f = ex.as_float(v)
    return "" if f is None else f"{f:g}"


# --------------------------------------------------------------------------
# matching
# --------------------------------------------------------------------------

class Seed:
    """The books extract wrote: the workbook's, matched against, and the ones
    Calibre created, which are only looked up for their series."""

    def __init__(self, folder: Path):
        books = folder / "books.csv"
        if not books.exists():
            raise SystemExit(f"{books} not found — run `npm run extract` first")
        names = {r["id"]: r["name"] for r in read_csv(folder / "authors.csv")}
        series = {r["id"]: r["name"] for r in read_csv(folder / "book_series.csv")}
        created = {r["book_id"] for r in read_csv(folder / "calibre_created.csv")}
        self.books: dict[tuple, dict] = {}
        self.created: dict[tuple, dict] = {}
        self.by_author: dict[str, list[dict]] = {}
        self.by_title: dict[str, list[dict]] = {}
        for r in read_csv(books):
            b = {"title": r["title"], "author": names.get(r["author_id"], ""),
                 "series": series.get(r["series_id"])}
            k = (ex.key(b["title"]), ex.key(b["author"]))
            if r["id"] in created:
                self.created[k] = b
                continue
            self.books[k] = b
            self.by_author.setdefault(ex.key(b["author"]), []).append(b)
            self.by_title.setdefault(ex.key(b["title"]), []).append(b)

    def match(self, title: str, authors: list[str], idx: ex.BookIndex,
              separate: set) -> tuple[str, str, dict | None, dict | None]:
        """(status, the author it keys under, the workbook book, a proposal)."""
        for author in authors:
            t, a = idx.book_identity(title, author)
            hit = self.books.get((ex.key(t), ex.key(a)))
            if hit:
                return "matched", author, hit, None
        best = None
        for author in authors:
            for b in self.by_author.get(ex.key(author), []):
                if ex.differs_only_by_number(title, b["title"]):
                    continue
                sim = ex.trgm_similarity(title, b["title"])
                if (sim >= SIMILAR_AT or ex.subtitled(title, b["title"])) and (best is None or sim > best[0]):
                    best = (sim, author, b)
        if best is None and self.by_title.get(ex.key(title)):
            best = (1.0, authors[0], self.by_title[ex.key(title)][0])
        if best:
            sim, author, b = best
            p = proposal(b, title, author, sim)
            if ex.review_sides(p) not in separate:
                return "proposed", author, b, p
        return "unmatched", authors[0], None, None

    def candidates(self, title: str, authors: list[str]) -> str:
        """The author's closest workbook titles, any worth a look (half the
        proposal threshold or more)."""
        scored = sorted(((ex.trgm_similarity(title, b["title"]), b["title"])
                         for a in authors for b in self.by_author.get(ex.key(a), [])), reverse=True)
        return " | ".join(f"{t} ({s:.2f})" for s, t in scored[:3] if s >= ex.SIMILAR_AT / 2)


def proposal(workbook: dict, title: str, author: str, sim: float) -> dict:
    """A `calibre` book_review.csv row. `keep` is Calibre's spelling (D-87): on
    a same-title pair the titles are equal, so it names Calibre's author."""
    same_title = ex.key(workbook["title"]) == ex.key(title)
    return {"kind": "book", "a": workbook["title"], "b": title, "a_author": workbook["author"],
            "b_author": author, "a_tabs": "", "b_tabs": "Calibre", "reason": ex.CALIBRE,
            "similarity": f"{sim:.2f}", "keep": author if same_title else title, "decision": ""}


# --------------------------------------------------------------------------
# Open Library
# --------------------------------------------------------------------------

def check(work: dict | None, series: str, index, isbn: str | None) -> tuple[set[str], str]:
    """What Open Library's work confirms of Calibre's series, index and ISBN,
    and its own series (`Name #index`) where that differs. No answer differs
    from nothing, so it is "" (D-87: the series fills either way)."""
    confirmed = set()
    names = (work or {}).get("series_name") or []
    positions = (work or {}).get("series_position") or []
    at = next((i for i, n in enumerate(names) if ex.key(ex.clean(n)) == ex.key(series)), None)
    theirs = ""
    if at is None:
        if names:
            pos = number(positions[0]) if positions else ""
            theirs = f"{ex.clean(names[0])} #{pos}" if pos else ex.clean(names[0])
    else:
        confirmed.add("series")
        pos = number(positions[at]) if at < len(positions) else ""
        if pos == number(index):
            confirmed.add("series_index")
        elif pos:
            theirs = f"{ex.clean(names[at])} #{pos}"
    if work and isbn and isbn in (work.get("isbn") or []):
        confirmed.add("isbn")
    return confirmed, theirs


# --------------------------------------------------------------------------
# run
# --------------------------------------------------------------------------

def run(args) -> int:
    source = library_path(args.library, Path(args.env))
    seed = Seed(Path(args.seed))
    columns = {"words": args.words_column, "date": args.date_column,
               "read": args.read_column, "type": args.type_column}
    print(f"calibre <- {source.parent}" + (" (dry run: nothing is written)" if args.dry_run else ""))
    print("reading metadata.db (from a temp copy) …")
    library = read_library(source, columns)
    print(f"  read {len(library)} records")

    review = ex.load_book_review(args.book_review)
    idx = ex.BookIndex(review)
    separate = {ex.review_sides(r) for r in review if r["decision"] == "separate"}
    old_books = read_csv(Path(args.calibre_books), ex.CALIBRE_BOOKS_COLUMNS)
    old = {book_key(r): r for r in old_books}

    api = None if args.dry_run else eb.OpenLibrary(Path(args.cache), args.max_requests, offline=args.offline)
    status: dict[tuple, str] = {}
    books: dict[tuple, dict] = {}
    unchecked: set[tuple] = set()
    failures = 0
    proposals, skipped, duplicates, missed = [], [], [], []
    series_total = sum(1 for r in library if r["series"] and r["type"].lower() not in SKIPPED_TYPES)
    print(f"matching {len(library)} records against {Path(args.seed) / 'books.csv'}"
          + (f", checking {series_total} series with Open Library (about one a second when it isn't cached)"
             if api else "") + " …")
    asked, shown = 0, time.monotonic()

    def progress(final=False):
        nonlocal shown
        if final or time.monotonic() - shown >= PROGRESS_SECONDS:
            shown = time.monotonic()
            print(f"  series {asked}/{series_total} · {api.network} requests, {api.cached} from cache"
                  + (f", {len(unchecked)} not checked" if unchecked else ""))

    try:
        for rec in library:
            if not rec["title"]:
                continue
            if rec["type"].lower() in SKIPPED_TYPES:
                skipped.append(rec)
                continue
            authors = [a for a in rec["authors"] if a] or [""]
            state, author, workbook, p = seed.match(rec["title"], authors, idx, separate)
            k = (ex.key(rec["title"]), ex.key(author))
            if k in books:
                duplicates.append(f"{rec['title']} / {author}")
                continue
            status[k] = state
            if p:
                proposals.append(p)
            if state == "unmatched" and k not in seed.created:
                missed.append((rec["title"], author, seed.candidates(rec["title"], authors)))
            row = {"title": rec["title"], "author": author, "words": rec["words"] or "",
                   "series": rec["series"] or "", "series_index": number(rec["index"]) if rec["series"] else "",
                   "isbn": rec["isbn"] or "", "tags": "; ".join(rec["tags"]),
                   "book_type": "" if rec["type"].lower() in ("", "book") else rec["type"],
                   "read": rec["read"], "date_read": rec["date_read"], "precision": rec["precision"],
                   "confirmed": "", "open_library": ""}
            books[k] = row

            # Open Library's word on the series, to report where it differs. A
            # held book waits for its decision.
            if api is None or not rec["series"] or state == "proposed":
                continue
            target = workbook if state == "matched" else seed.created.get(k)
            title, name = (target["title"], target["author"]) if target else (rec["title"], author)
            asked += 1
            if asked > 1:
                progress()
            try:
                works = api.search(title, name)
            except eb.StopRun:
                unchecked.add(k)
                continue
            except OSError as e:
                # Open Library dropped us after the client's retries. It drops
                # the odd connection, so only a run of failures means it's
                # down: then the rest come from the cache, and the next run asks again.
                failures += 1
                if failures == MAX_FAILURES:
                    print(f"  Open Library failed {failures} times running ({e}); "
                          "the rest come from the cache only")
                    api.offline = True
                unchecked.add(k)
                continue
            failures = 0
            _, work, _ = eb.decide(title, name, works)
            confirmed, row["open_library"] = check(work, rec["series"], rec["index"], rec["isbn"])
            row["confirmed"] = ";".join(f for f in ex.CHECKED_FIELDS if f in confirmed)
    finally:
        if api:
            if asked:
                progress(final=True)
            api.db.close()

    # What Open Library couldn't be asked this run keeps what the last run knew.
    for k in unchecked:
        if k in old:
            books[k]["confirmed"], books[k]["open_library"] = old[k]["confirmed"], old[k]["open_library"]
    report(status, proposals, skipped, duplicates, missed, books, api, unchecked)
    changes(old_books, books)
    if args.dry_run:
        return 0

    print(f"\nwriting {args.calibre_books} …")
    write_csv(Path(args.calibre_books), ex.CALIBRE_BOOKS_COLUMNS, fold(old_books, books))
    # Our own undecided rows follow this run's proposals, as extract rebuilds
    # its own: one the rule no longer makes, or whose book left Calibre, goes.
    proposed = {ex.review_sides(p) for p in proposals}
    kept = [r for r in review
            if r["reason"] != ex.CALIBRE or r["decision"] or ex.review_sides(r) in proposed]
    known = {ex.review_sides(r) for r in kept}
    new = []
    for p in proposals:
        if ex.review_sides(p) not in known:
            known.add(ex.review_sides(p))
            new.append(p)
    if new or len(kept) < len(review):
        write_csv(Path(args.book_review), ex.BOOK_REVIEW_COLUMNS, kept + new)
        print(f"  {len(new)} new Calibre spellings to review in {args.book_review} "
              f"({len(review) - len(kept)} no longer proposed, dropped): "
              "`merge` takes Calibre's, `separate` makes them two books")
    return 0


def book_key(r: dict) -> tuple:
    return ex.key(r["title"]), ex.key(r["author"])


def fold(old: list[dict], fresh: dict[tuple, dict]) -> list[dict]:
    """calibre_books.csv's next rows: a book still in Calibre keeps its place
    with Calibre's values, a book gone from Calibre goes, and a new one is
    appended in Calibre's order. An unchanged library gives the same rows."""
    rows, seen = [], set()
    for r in old:
        k = book_key(r)
        if k in fresh and k not in seen:
            rows.append(fresh[k])
            seen.add(k)
    return rows + [r for k, r in fresh.items() if k not in seen]


# What a run reports as changed in Calibre: the fields Calibre owns.
CHANGE_FIELDS = ("words", "series", "series_index", "isbn", "tags", "book_type", "read", "date_read", "precision")


def changes(old_rows: list[dict], fresh: dict[tuple, dict]) -> None:
    """What changed in Calibre since the last run's calibre_books.csv: books
    added and removed (a removed and an added book by one author with near
    titles is likely a rename), and each changed field, old -> new."""
    if not old_rows:
        return
    old = {book_key(r): r for r in old_rows}
    added = [r for k, r in fresh.items() if k not in old]
    removed = [r for k, r in old.items() if k not in fresh]
    renamed = []
    for r in list(removed):
        twin = next((a for a in added if ex.key(a["author"]) == ex.key(r["author"])
                     and (ex.trgm_similarity(a["title"], r["title"]) >= ex.SIMILAR_AT
                          or ex.key(r["title"]) in ex.key(a["title"]) or ex.key(a["title"]) in ex.key(r["title"]))),
                    None)
        if twin:
            renamed.append((r, twin))
            removed.remove(r)
            added.remove(twin)
    changed = []
    for k, r in fresh.items():
        if k in old:
            diffs = [f"{f} {old[k][f] or '(none)'} -> {r[f] or '(none)'}" for f in CHANGE_FIELDS
                     if str(old[k][f]) != str(r[f])]
            if diffs:
                changed.append(f"{r['title']} — {r['author']}: {'; '.join(diffs)}")
    if not (added or removed or renamed or changed):
        print("\nno change in Calibre since the last run")
        return
    print(f"\nchanged in Calibre since the last run: {len(added)} added, {len(removed)} removed, "
          f"{len(renamed)} renamed, {len(changed)} changed")
    for r in added:
        print(f"  added    {r['title']} — {r['author']}")
    for r in removed:
        print(f"  removed  {r['title']} — {r['author']} (leaves the Ledger at the next extract "
              "if only Calibre had it)")
    for r, a in renamed:
        print(f"  renamed? {r['title']} -> {a['title']} — {a['author']}")
    for line in changed:
        print(f"  changed  {line}")


def report(status: dict, proposals: list[dict], skipped: list[dict], duplicates: list[str],
           missed: list[tuple], books: dict, api, unchecked: set) -> None:
    counts = Counter(status.values())
    print(f"\n  {len(status) + len(skipped) + len(duplicates)} Calibre records")
    for s in STATUSES:
        print(f"  {s:<10} {counts.get(s, 0):>6}")
    if status:
        print(f"  match rate {counts.get('matched', 0) / len(status):.0%} of {len(status)}")
    reads = sum(1 for r in books.values() if r["read"] == "true" or r["date_read"])
    print(f"  reads      {reads:>6} (each loads, D-87)")
    if api:  # a dry run asks Open Library nothing, so it has no count to give
        differs = sum(1 for r in books.values() if r["open_library"])
        print(f"  series Open Library has differently: {differs} (reported by extract in unresolved.csv)")
    if skipped:
        print(f"\nskipped, {len(skipped)} comics (the Ledger keeps comics as issues):")
        for rec in skipped:
            print(f"  {rec['title']} — {', '.join(a for a in rec['authors'] if a)}")
    if duplicates:
        print(f"\n{len(duplicates)} records repeat a title and author; the first is used:")
        for d in duplicates:
            print(f"  {d}")
    if proposals:
        print("\nproposed (book_review.csv, held until decided):")
        for p in proposals:
            print(f"  {p['b']} — {p['b_author']}  ~  {p['a']} — {p['a_author']}  ({p['similarity']})")
    near = [m for m in missed if m[2]]
    if missed:
        print(f"\nunmatched, created at Unlisted: {len(missed)}; {len(missed) - len(near)} with no "
              "close title by the same author in the workbook" + (". The rest, with candidates:" if near else ""))
        for title, author, cands in near:
            print(f"  {title} — {author}: {cands}")
    if api:
        print(f"\nrequests: {api.network} to Open Library, {api.cached} from cache")
    if unchecked:
        print(f"  {len(unchecked)} series not checked (offline, or the request budget is spent); "
              "they keep what the last run knew. Re-run to finish.")


# --------------------------------------------------------------------------
# io
# --------------------------------------------------------------------------

def read_csv(path: Path, columns: list[str] | None = None) -> list[dict]:
    if not path.exists():
        return []
    with path.open(newline="", encoding="utf-8-sig") as fh:
        rows = list(csv.DictReader(fh))
    if columns is None:
        return rows
    return [{c: (r.get(c) or "").strip() for c in columns} for r in rows if (r.get("title") or "").strip()]


def write_csv(path: Path, columns: list[str], rows: list[dict]) -> None:
    with path.open("w", newline="", encoding="utf-8") as fh:
        w = csv.DictWriter(fh, fieldnames=columns, extrasaction="ignore")
        w.writeheader()
        w.writerows(rows)
    print(f"wrote {len(rows)} rows -> {path}")


def main(argv=None) -> int:
    ap = argparse.ArgumentParser(description=__doc__.split("\n\n")[0])
    ap.add_argument("--library", default=None, help="the Calibre library folder (else CALIBRE_LIBRARY)")
    ap.add_argument("--env", default=".env")
    ap.add_argument("--seed", default="seed")
    ap.add_argument("--calibre-books", default="etl/data/calibre_books.csv")
    ap.add_argument("--book-review", default="etl/data/book_review.csv")
    ap.add_argument("--cache", default="etl/.openlibrary-cache.sqlite")
    ap.add_argument("--words-column", default="#words", help="the word-count column's lookup name")
    ap.add_argument("--date-column", default="#date_read", help="the date-read column's lookup name")
    ap.add_argument("--read-column", default="#read", help="the read flag's lookup name (optional)")
    ap.add_argument("--type-column", default="#type", help="Book / Comic / Fan Fiction (optional)")
    ap.add_argument("--dry-run", action="store_true", help="report the match rate; write nothing")
    ap.add_argument("--offline", action="store_true", help="Open Library from the cache only")
    ap.add_argument("--max-requests", type=int, default=3000, help="stop asking after this many requests")
    args = ap.parse_args(argv)
    # A redirected Windows console is cp1252; print what it can't show as ?.
    # Line-buffered, so the progress lines show while a long run is going,
    # piped to a file or not.
    if isinstance(sys.stdout, io.TextIOWrapper):
        sys.stdout.reconfigure(errors="replace", line_buffering=True)
    return run(args)


if __name__ == "__main__":
    sys.exit(main())
