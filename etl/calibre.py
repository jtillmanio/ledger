#!/usr/bin/env python3
"""
calibre.py — the owner's Calibre library, into the sidecar extract folds in.

    py etl/calibre.py --dry-run     # the match rate and what changed; writes nothing, asks Hardcover nothing
    py etl/calibre.py               # writes the sidecar; asks Hardcover about series
    py etl/calibre.py --offline     # Hardcover from the cache only

The library is `--library <folder>` or CALIBRE_LIBRARY in .env (task 1.18, D-73,
D-83). Its metadata.db is copied to a temp folder outside the repo and the copy
is opened read-only, so a running Calibre is never locked or written; the copy
is removed after the run. Custom columns are found by lookup name (`#words`,
`#read`, `#date_read`, `#type`, `#superseries`, `#subseries`, `#pages`, `#genre`,
each overridable), never by custom_column_N.

Calibre is the source of truth for a book's data and its reads (D-87): the owner
edits Calibre and nothing else. So nothing here waits on a decision except a
near spelling, and what disagrees is reported (extract's unresolved.csv), never
silently dropped.

Every Calibre book is matched to the books extract wrote (seed/books.csv, and
the ones it held for review, seed/held_books.csv, task 1.20), by
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
A book the seed already knows by its Calibre id (books.calibre_id, task 1.18b,
D-90) is that book whatever Calibre calls it now: a workbook book Calibre
renamed is a `calibre rename` row in book_review.csv, decided `merge` with
Calibre's spelling kept, so it stays one book under the new title.
A Comic record is skipped and listed; a Fan Fiction record comes in with
book_type `Fan Fiction` (D-88).

What it writes, in etl/data/ and committed like the other sidecars:
- calibre_books.csv    title, author -> Calibre's words, series, index, ISBN,
                       tags, type, read flag, date read (its Eastern day, D-67,
                       or a year) and precision (D-88); `confirmed` lists what
                       Hardcover agreed with, and `hardcover` is its series
                       where it differs (task 1.14b, D-94). Comments stay out until
                       books.summary exists (D-88). Then Calibre's id, page
                       count, superseries (the universe) and subseries, each
                       grouping with its index (task 1.18b, D-90). Then its
                       genres: every #genre value, the full dotted path as
                       Calibre writes it (`Fantasy.Epic Fantasy`), sorted and
                       joined `; ` (task 1.18c).
- book_review.csv      the `calibre` proposals and `calibre rename` rows above.

Hardcover is asked about each Calibre series, with 1.14b's client and cache
(enrich_books.Hardcover, D-94): the ISBNs first, many to a request, then one
title search a book with none found, so enrich:books later finds most answers
cached. Its answer fills nothing: a different series is reported. `isbn` is
confirmed when the ISBN found the book. Without HARDCOVER_API_TOKEN the check
reads the cache only, and says so.

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
MAX_FAILURES = 3        # failed lookups in a row before the run stops asking Hardcover
# A Calibre near spelling is proposed at this trigram similarity or more, or as
# a subtitle (ex.subtitled()). Higher than the workbook's own pairs (D-25a's 0.4):
# under 0.5 Calibre's pairs were series patterns, two books (owner, D-89).
# Hardcover's near spellings use the same line (enrich_books.SIMILAR_AT, D-92).
SIMILAR_AT = eb.SIMILAR_AT
PROGRESS_SECONDS = 5    # a progress line at most this often while Hardcover is asked


# --------------------------------------------------------------------------
# the library
# --------------------------------------------------------------------------

def library_path(arg: str | None, env: Path) -> Path:
    eb.load_env(env)
    folder = arg or os.environ.get("CALIBRE_LIBRARY", "").strip()
    if not folder:
        raise SystemExit("calibre: no library: pass --library <folder>, or set CALIBRE_LIBRARY in .env")
    db = Path(folder) / "metadata.db"
    if not db.exists():
        raise SystemExit(f"calibre: {db} not found: --library and CALIBRE_LIBRARY name the folder holding it")
    return db


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
    row = db.execute("SELECT id, normalized, display, datatype, is_multiple FROM custom_columns WHERE label = ?",
                     (lookup.lstrip("#"),)).fetchone()
    if row is None:
        if required:
            raise SystemExit(f"calibre: the library has no custom column {lookup}: name its lookup name "
                             "with --words-column or --date-column")
        print(f"  no column {lookup}: left blank")
        return None
    n, normalized, display, datatype, multiple = row
    if datatype == "series":
        # A series-type column (#superseries, #subseries): its index is the
        # link's `extra`, so each value is (name, index).
        q = (f"SELECT l.book, v.value, l.extra FROM books_custom_column_{n}_link l "
             f"JOIN custom_column_{n} v ON v.id = l.value ORDER BY l.id")
    elif normalized:
        q = (f"SELECT l.book, v.value FROM books_custom_column_{n}_link l "
             f"JOIN custom_column_{n} v ON v.id = l.value ORDER BY l.id")
    else:
        q = f"SELECT book, value FROM custom_column_{n}"
    values = {}
    for book, *value in db.execute(q):
        if multiple:
            # A multi-valued column (#genre, task 1.18c): every value, in link order.
            values.setdefault(book, []).append(value[0])
        else:
            values.setdefault(book, tuple(value) if datatype == "series" else value[0])
    return values, json.loads(display or "{}")


def records(db, columns: dict[str, str]) -> list[dict]:
    words = custom_column(db, columns["words"], required=True)
    dates = custom_column(db, columns["date"], required=True)
    flags = custom_column(db, columns["read"], required=False)
    kinds = custom_column(db, columns["type"], required=False)
    supers = custom_column(db, columns["superseries"], required=False)
    subs = custom_column(db, columns["subseries"], required=False)
    pages = custom_column(db, columns["pages"], required=False)
    genre = custom_column(db, columns["genre"], required=False)
    date_format = (dates[1].get("date_format") or "") if dates else ""

    def grouping(column, bid) -> tuple[str | None, str]:
        name, index = (column[0] if column else {}).get(bid) or (None, None)
        name = ex.clean(name)
        return name, number(index) if name else ""

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
        superseries, superseries_index = grouping(supers, bid)
        subseries, subseries_index = grouping(subs, bid)
        out.append({"calibre_id": bid, "title": ex.title_text(title),
                    "authors": [ex.clean(a) for a in authors.get(bid, [])],
                    "pages": ex.as_int((pages[0] if pages else {}).get(bid)),
                    "superseries": superseries, "superseries_index": superseries_index,
                    "subseries": subseries, "subseries_index": subseries_index,
                    "genres": ex.genre_list((genre[0] if genre else {}).get(bid) or []),
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
        # Calibre's id -> the seed book that has it (task 1.18b), a workbook
        # book or one Calibre created (`created`): a rename keeps the book.
        self.by_id: dict[int, dict] = {}
        for r in read_csv(books):
            b = {"title": r["title"], "author": names.get(r["author_id"], ""),
                 "series": series.get(r["series_id"]), "created": r["id"] in created}
            k = (ex.key(b["title"]), ex.key(b["author"]))
            if ex.as_int(r.get("calibre_id")) is not None:
                self.by_id[ex.as_int(r["calibre_id"])] = b
            if b["created"]:
                self.created[k] = b
                continue
            self.add(k, b)
        # The books extract held for review (task 1.20) are workbook books
        # too: one Calibre has under a near spelling is a pair, not a new book.
        for r in read_csv(folder / "held_books.csv", ex.HELD_BOOKS_COLUMNS):
            b = {"title": r["title"], "author": r["author"], "series": r["series"] or None, "created": False}
            k = (ex.key(b["title"]), ex.key(b["author"]))
            if k not in self.books:
                self.add(k, b)

    def add(self, k: tuple, b: dict) -> None:
        self.books[k] = b
        self.by_author.setdefault(ex.key(b["author"]), []).append(b)
        self.by_title.setdefault(ex.key(b["title"]), []).append(b)

    def match(self, title: str, authors: list[str], idx: ex.BookIndex,
              separate: set, calibre_id: int | None = None) -> tuple[str, str, dict | None, dict | None]:
        """(status, the author it keys under, the workbook book, a proposal).
        A book the seed knows by its Calibre id is that book, whatever Calibre
        calls it now; a workbook book Calibre renamed brings a `calibre rename`
        row (task 1.18b, D-90)."""
        known = self.by_id.get(calibre_id)
        if known:
            author = next((a for a in authors if ex.key(a) == ex.key(known["author"])), authors[0])
            if known["created"]:
                return "unmatched", author, None, None
            renamed = (ex.key(title), ex.key(author)) != (ex.key(known["title"]), ex.key(known["author"]))
            return "matched", author, known, rename(known, title, author) if renamed else None
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


def rename(workbook: dict, title: str, author: str) -> dict:
    """A `calibre rename` book_review.csv row: the seed's book is Calibre's,
    found by its id, so the merge is decided (D-90): the workbook's spelling
    folds into Calibre's on every extract."""
    row = proposal(workbook, title, author, ex.trgm_similarity(workbook["title"], title))
    return {**row, "reason": ex.CALIBRE_RENAME, "decision": "merge"}


# --------------------------------------------------------------------------
# Hardcover
# --------------------------------------------------------------------------

def check(record: dict | None, series: str, index, by_isbn: bool = False) -> tuple[set[str], str]:
    """What Hardcover's book confirms of Calibre's series, index and ISBN, and
    its own series (`Name #position`, the featured one first) where that
    differs. No answer differs from nothing, so it is "" (D-87: the series
    fills either way)."""
    confirmed = set()
    pairs = [(n, p) for n, p in (record or {}).get("series") or [] if n]
    at = next((i for i, (n, _) in enumerate(pairs) if ex.key(ex.clean(n)) == ex.key(series)), None)
    theirs = ""
    if at is None:
        if pairs:
            name, pos = ex.clean(pairs[0][0]), number(pairs[0][1])
            theirs = f"{name} #{pos}" if pos else name
    else:
        confirmed.add("series")
        pos = number(pairs[at][1])
        if pos == number(index):
            confirmed.add("series_index")
        elif pos:
            theirs = f"{ex.clean(pairs[at][0])} #{pos}"
    if record and by_isbn:
        confirmed.add("isbn")
    return confirmed, theirs


# --------------------------------------------------------------------------
# run
# --------------------------------------------------------------------------

def run(args) -> int:
    source = library_path(args.library, Path(args.env))
    seed = Seed(Path(args.seed))
    columns = {"words": args.words_column, "date": args.date_column,
               "read": args.read_column, "type": args.type_column,
               "superseries": args.superseries_column, "subseries": args.subseries_column,
               "pages": args.pages_column, "genre": args.genre_column}
    print(f"calibre <- {source.parent}" + (" (dry run: nothing is written)" if args.dry_run else ""))
    print("reading metadata.db (from a temp copy) …")
    library = read_library(source, columns)
    print(f"  read {len(library)} records")
    split = sorted({g for r in library for g in r["genres"] if ";" in g})
    if split:
        print(f"  genres with a ';', split in two by calibre_books.csv: {' | '.join(split)}")

    review = ex.load_book_review(args.book_review)
    idx = ex.BookIndex(review)
    separate = {ex.review_sides(r) for r in review if r["decision"] == "separate"}
    old_books = read_csv(Path(args.calibre_books), ex.CALIBRE_BOOKS_COLUMNS)
    old = {book_key(r): r for r in old_books}

    token = os.environ.get(eb.TOKEN_VAR, "").strip() or None   # library_path() read .env
    api = None if args.dry_run else eb.Hardcover(Path(args.cache), args.max_requests, token=token,
                                                 offline=args.offline)
    if api and not token and not args.offline:
        print(f"  {eb.TOKEN_VAR} is not set: series are checked from the Hardcover cache only")
    status: dict[tuple, str] = {}
    books: dict[tuple, dict] = {}
    unchecked: set[tuple] = set()
    failures = 0
    proposals, renames, skipped, duplicates, missed, asks = [], [], [], [], [], []
    series_total = sum(1 for r in library if r["series"] and r["type"].lower() not in SKIPPED_TYPES)
    print(f"matching {len(library)} records against {Path(args.seed) / 'books.csv'}"
          + (f", checking {series_total} series with Hardcover (by ISBN, many to a request; then about "
             "one search a second when it isn't cached)"
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
            state, author, workbook, p = seed.match(rec["title"], authors, idx, separate, rec["calibre_id"])
            k = (ex.key(rec["title"]), ex.key(author))
            if k in books:
                duplicates.append(f"{rec['title']} / {author}")
                continue
            status[k] = state
            if p:
                (renames if p["reason"] == ex.CALIBRE_RENAME else proposals).append(p)
            if state == "unmatched" and k not in seed.created and rec["calibre_id"] not in seed.by_id:
                missed.append((rec["title"], author, seed.candidates(rec["title"], authors)))
            row = {"title": rec["title"], "author": author, "words": rec["words"] or "",
                   "series": rec["series"] or "", "series_index": number(rec["index"]) if rec["series"] else "",
                   "isbn": rec["isbn"] or "", "tags": "; ".join(rec["tags"]),
                   "book_type": "" if rec["type"].lower() in ("", "book") else rec["type"],
                   "read": rec["read"], "date_read": rec["date_read"], "precision": rec["precision"],
                   "confirmed": "", "hardcover": "", "calibre_id": rec["calibre_id"],
                   "pages": rec["pages"] or "", "superseries": rec["superseries"] or "",
                   "superseries_index": rec["superseries_index"], "subseries": rec["subseries"] or "",
                   "subseries_index": rec["subseries_index"], "genres": "; ".join(rec["genres"])}
            books[k] = row

            # Hardcover's word on the series, to report where it differs. A
            # held book waits for its decision.
            if api is None or not rec["series"] or state == "proposed":
                continue
            # A renamed book is asked under Calibre's new title, the one the
            # seed takes next, so the run after it changes nothing.
            renamed = p is not None and p["reason"] == ex.CALIBRE_RENAME
            target = workbook if state == "matched" and not renamed else seed.created.get(k)
            title, name = (target["title"], target["author"]) if target else (rec["title"], author)
            asks.append((k, title, name, eb.normal_isbn(rec["isbn"]), rec))

        # The ISBNs first, many to a request: then each book below finds its
        # editions in the cache, and only a book with none found is searched.
        if asks:
            try:
                api.editions([isbn for _, _, _, isbn, _ in asks])
            except (eb.StopRun, OSError):
                pass  # each book asks again for its own, and the failures below count
        for k, title, name, isbn, rec in asks:
            asked += 1
            if asked > 1:
                progress()
            try:
                found, record, _, how, _ = eb.find(api, title, name, isbn)
            except eb.StopRun:
                unchecked.add(k)
                continue
            except OSError as e:
                # Hardcover dropped us after the client's retries. Only a run
                # of failures means it's down: then the rest come from the
                # cache, and the next run asks again.
                failures += 1
                if failures == MAX_FAILURES:
                    print(f"  Hardcover failed {failures} times running ({e}); "
                          "the rest come from the cache only")
                    api.offline = True
                unchecked.add(k)
                continue
            failures = 0
            row = books[k]
            confirmed, row["hardcover"] = check(record if found in ("matched", "proposed") else None,
                                                rec["series"], rec["index"], by_isbn=how == "isbn")
            row["confirmed"] = ";".join(f for f in ex.CHECKED_FIELDS if f in confirmed)
    finally:
        if api:
            if asked:
                progress(final=True)
            api.db.close()

    # What Hardcover couldn't be asked this run keeps what the last run knew.
    for k in unchecked:
        if k in old:
            books[k]["confirmed"], books[k]["hardcover"] = old[k]["confirmed"], old[k]["hardcover"]
    report(status, proposals, skipped, duplicates, missed, books, api, unchecked)
    changes(old_books, books, header(Path(args.calibre_books)))
    if args.dry_run:
        return 0

    print(f"\nwriting {args.calibre_books} …")
    write_csv(Path(args.calibre_books), ex.CALIBRE_BOOKS_COLUMNS, fold(old_books, books))
    # Our own undecided rows follow this run's proposals, as extract rebuilds
    # its own: one the rule no longer makes, or whose book left Calibre, goes.
    proposed = {ex.review_sides(p) for p in proposals}
    kept = [r for r in review
            if r["reason"] != ex.CALIBRE or r["decision"] or ex.review_sides(r) in proposed]
    # A rename row has a direction the unordered pair hides: a book renamed
    # back (A -> B, then B -> A) replaces its row in place, turned round.
    fresh = {ex.review_sides(p): p for p in renames}
    turned = 0
    for i, r in enumerate(kept):
        p = fresh.get(ex.review_sides(r))
        if r["reason"] == ex.CALIBRE_RENAME and p and book_key({"title": r["a"], "author": r["a_author"]}) \
                != book_key({"title": p["a"], "author": p["a_author"]}):
            kept[i] = p
            turned += 1
    known = {ex.review_sides(r) for r in kept}
    new, renamed = [], turned
    for p in proposals + renames:
        if ex.review_sides(p) not in known:
            known.add(ex.review_sides(p))
            new.append(p)
            renamed += p["reason"] == ex.CALIBRE_RENAME
    if new or turned or len(kept) < len(review):
        write_csv(Path(args.book_review), ex.BOOK_REVIEW_COLUMNS, kept + new)
        print(f"  {len(new) - (renamed - turned)} new Calibre spellings to review in {args.book_review} "
              f"({len(review) - len(kept)} no longer proposed, dropped): "
              "`merge` takes Calibre's, `separate` makes them two books")
        if renamed:
            print(f"  {renamed} workbook books renamed in Calibre: merged into Calibre's title "
                  f"(`{ex.CALIBRE_RENAME}` rows, decided)")
    return 0


def header(path: Path) -> list[str]:
    """A CSV's columns, or none when there is no file yet."""
    if not path.exists():
        return []
    with path.open(newline="", encoding="utf-8-sig") as fh:
        return next(csv.reader(fh), [])


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
CHANGE_FIELDS = ("words", "series", "series_index", "isbn", "tags", "book_type", "read", "date_read", "precision",
                 "pages", "superseries", "superseries_index", "subseries", "subseries_index", "genres")


def changes(old_rows: list[dict], fresh: dict[tuple, dict], old_columns: list[str] = ()) -> None:
    """What changed in Calibre since the last run's calibre_books.csv: books
    added and removed, renames (the same Calibre id under a new title or
    author; with no id, a removed and an added book by one author with near
    titles is likely one), and each changed field, old -> new. A field the
    last run's file didn't have yet is no change (the new columns of tasks
    1.18b and 1.18c)."""
    if not old_rows:
        return
    fields = [f for f in CHANGE_FIELDS if f in old_columns] if old_columns else list(CHANGE_FIELDS)
    old = {book_key(r): r for r in old_rows}
    added = [r for k, r in fresh.items() if k not in old]
    removed = [r for k, r in old.items() if k not in fresh]
    renamed = []
    for r in list(removed):
        twin = next((a for a in added if r["calibre_id"] and str(a["calibre_id"]) == r["calibre_id"]), None)
        guess = twin is None
        if guess:
            twin = next((a for a in added if ex.key(a["author"]) == ex.key(r["author"])
                         and (ex.trgm_similarity(a["title"], r["title"]) >= ex.SIMILAR_AT
                              or ex.key(r["title"]) in ex.key(a["title"])
                              or ex.key(a["title"]) in ex.key(r["title"]))), None)
        if twin:
            renamed.append((r, twin, guess))
            removed.remove(r)
            added.remove(twin)
    changed = []
    for k, r in fresh.items():
        if k in old:
            diffs = [f"{f} {old[k][f] or '(none)'} -> {r[f] or '(none)'}" for f in fields
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
    for r, a, guess in renamed:
        print(f"  renamed{'?' if guess else ' '} {r['title']} -> {a['title']} — {a['author']}")
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
    for field, what in (("superseries", "universes"), ("subseries", "subseries")):
        names = {ex.key(r[field]) for r in books.values() if r[field]}
        filled = sum(1 for r in books.values() if r[field])
        print(f"  {field:<11}{filled:>6} books in {len(names)} {what}")
    print(f"  pages      {sum(1 for r in books.values() if r['pages']):>6}")
    genres = [ex.genre_list(r["genres"].split(";")) for r in books.values()]
    distinct = {g.casefold() for gs in genres for g in gs}
    print(f"  genres     {sum(1 for gs in genres if gs):>6} books in {len(distinct)} genres")
    if api:  # a dry run asks Hardcover nothing, so it has no count to give
        differs = sum(1 for r in books.values() if r["hardcover"])
        print(f"  series Hardcover has differently: {differs} (noted by extract in calibre_changes.csv)")
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
        print(f"\nrequests: {api.network} to Hardcover, {api.cached} from cache")
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
    ap.add_argument("--cache", default="etl/.hardcover-cache.sqlite")
    ap.add_argument("--words-column", default="#words", help="the word-count column's lookup name")
    ap.add_argument("--date-column", default="#date_read", help="the date-read column's lookup name")
    ap.add_argument("--read-column", default="#read", help="the read flag's lookup name (optional)")
    ap.add_argument("--type-column", default="#type", help="Book / Comic / Fan Fiction (optional)")
    ap.add_argument("--superseries-column", default="#superseries",
                    help="the universe, a series-type column with its index (optional)")
    ap.add_argument("--subseries-column", default="#subseries",
                    help="a grouping inside a series, a series-type column with its index (optional)")
    ap.add_argument("--pages-column", default="#pages", help="the page count (optional)")
    ap.add_argument("--genre-column", default="#genre",
                    help="the genres, a multi-valued column of dotted paths (optional)")
    ap.add_argument("--dry-run", action="store_true", help="report the match rate; write nothing")
    ap.add_argument("--offline", action="store_true", help="Hardcover from the cache only")
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
