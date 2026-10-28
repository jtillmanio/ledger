#!/usr/bin/env python3
"""
enrich_books.py — Open Library details for the workbook's books, into a sidecar.

    py etl/enrich_books.py --dry-run     # 100 books, report only, writes nothing
    py etl/enrich_books.py               # every book; ~1 request a second
    py etl/enrich_books.py --offline     # the report again, from the cache only

Reads the books extract loads (seed/books.csv, seed/authors.csv), searches Open
Library by title and author, and writes etl/data/book_details.csv, keyed by
title and author: the work's Open Library id, its median page count, a cover
URL and its first publish year. `npm run extract` folds it into books (task 1.14,
D-44); the published year fills only where the workbook has none.

How a book is decided:
- matched     exactly one returned work has its title and one of its authors,
              both compared after extract's clean() and key()
- proposed    no work matches, but the top result is by the same author with a
              near spelling of the title (trigram similarity >= 0.5, or one title
              the other plus a `: subtitle`, D-92; the titles not differing only
              by a number): appended to book_review.csv as
              reason `open library`, never matched. Accepting it (decision
              `merge`) renames the book in extract, and the next run here moves
              its details row to the new title.
- ambiguous   two or more works match: nothing is picked
- unmatched   anything else, listed in the report with Open Library's candidates
A book with no author is not looked up.

Rules it keeps:
- Never overwrites a hand value. A row whose source is anything but
  `openlibrary` is never looked up or changed, and a failed lookup never erases
  a row.
- No word count from pages (2.1 estimates one), no ISBNs (books has no column).
- Open Library's courtesy rate: one request a second, with a User-Agent naming
  the app. Every response is kept whole in etl/.openlibrary-cache.sqlite, so a
  re-run never asks twice and an interrupted run resumes where it stopped.
  Task 1.18 reads the same cache for Calibre's ISBN and series check.

Standard library only, plus extract.py's matching helpers.
"""

from __future__ import annotations

import argparse
import csv
import io
import json
import re
import sqlite3
import sys
import time
import urllib.error
import urllib.parse
import urllib.request
from collections import Counter
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent))
import extract as ex  # noqa: E402

API = "https://openlibrary.org/search.json"
COVER = "https://covers.openlibrary.org/b/id/{}-L.jpg"
USER_AGENT = "ledger-backfill/1.0 (personal media ledger; book metadata; https://github.com/jtillmanio/ledger)"
MIN_INTERVAL = 1.0      # seconds between network requests: Open Library's courtesy rate
SEARCH_LIMIT = 10       # works per search; the exact work is near the top when it exists
SOURCE = "openlibrary"
# An Open Library near spelling is proposed at this trigram similarity or more, or
# as a subtitle (ex.subtitled()): the line D-89 drew for Calibre's pairs, above
# the workbook's own 0.4 (D-92). Below it the pairs were series patterns.
SIMILAR_AT = 0.5
DETAIL_COLUMNS = ex.BOOK_DETAILS_COLUMNS
STATUSES = ("matched", "proposed", "ambiguous", "unmatched", "no_author", "hand")


class StopRun(Exception):
    pass


# --------------------------------------------------------------------------
# matching
# --------------------------------------------------------------------------

def same(a: str | None, b: str | None) -> bool:
    return bool(ex.key(ex.clean(a))) and ex.key(ex.clean(a)) == ex.key(ex.clean(b))


def by(work: dict, author: str) -> bool:
    return any(same(name, author) for name in work.get("author_name") or [])


def decide(title: str, author: str, works: list[dict]) -> tuple[str, dict | None, float]:
    """(status, the work it rests on, similarity) for one book's search results."""
    exact = [w for w in works if same(w.get("title"), title) and by(w, author)]
    if len(exact) == 1:
        return "matched", exact[0], 1.0
    if exact:
        return "ambiguous", None, 1.0
    top = works[0] if works else None
    if top and by(top, author) and top.get("title"):
        name = ex.clean(top["title"])
        sim = ex.trgm_similarity(title, name)
        if (sim >= SIMILAR_AT or ex.subtitled(title, name)) and not ex.differs_only_by_number(title, name):
            return "proposed", top, sim
    return "unmatched", None, 0.0


def details(title: str, author: str, work: dict) -> dict:
    cover = work.get("cover_i")
    return {"title": title, "author": author,
            "open_library_id": (work.get("key") or "").rsplit("/", 1)[-1],
            "page_count": work.get("number_of_pages_median") or "",
            "cover_url": COVER.format(cover) if cover else "",
            "published_year": work.get("first_publish_year") or "",
            "source": SOURCE}


def proposal(title: str, author: str, work: dict, sim: float) -> dict:
    name = ex.clean(work["title"])
    return {"kind": "book", "a": title, "b": name, "a_author": author, "b_author": author,
            "a_tabs": "", "b_tabs": "Open Library", "reason": ex.OPEN_LIBRARY,
            "similarity": f"{sim:.2f}", "keep": name, "decision": ""}


def is_hand(row: dict | None) -> bool:
    return row is not None and row.get("source") != SOURCE


def rekey(rows: list[dict], review: list[dict]) -> tuple[dict[tuple, dict], int]:
    """Rows by (title, author) key, each moved through book_review.csv's merges
    (an accepted Open Library spelling is one) to the book extract now loads.
    When two rows land on one book, a hand row beats an Open Library one."""
    idx = ex.BookIndex(review)
    out: dict[tuple, dict] = {}
    moved = 0
    for r in rows:
        title, author = idx.book_identity(r["title"], r["author"] or None)
        k = (ex.key(title), ex.key(author))
        if k != (ex.key(r["title"]), ex.key(r["author"])):
            moved += 1
            r = {**r, "title": title, "author": author or ""}
        if k not in out or (is_hand(r) and not is_hand(out[k])):
            out[k] = r
    return out, moved


# --------------------------------------------------------------------------
# Open Library
# --------------------------------------------------------------------------

class OpenLibrary:
    def __init__(self, cache_path: Path, max_requests: int, offline: bool = False):
        self.db = sqlite3.connect(cache_path)
        self.db.execute("CREATE TABLE IF NOT EXISTS responses "
                        "(url TEXT PRIMARY KEY, body TEXT NOT NULL, fetched_at TEXT NOT NULL)")
        self.max_requests = max_requests
        self.offline = offline
        self.network = 0
        self.cached = 0
        self.last = 0.0

    @staticmethod
    def search_url(title: str, author: str) -> str:
        # fields=* keeps the whole work record (ISBNs, editions, subjects) in the
        # cache for 1.18; the default response has no page count. Open Library's
        # author search finds `S. A. Chakraborty` but nothing for `S.A.`, so
        # initials are spaced; matching compares key()s, which ignore both.
        author = re.sub(r"\.(?=\S)", ". ", author)
        q = urllib.parse.urlencode({"title": title, "author": author,
                                    "limit": SEARCH_LIMIT, "fields": "*"}, safe="*")
        return f"{API}?{q}"

    def search(self, title: str, author: str) -> list[dict]:
        url = self.search_url(title, author)
        row = self.db.execute("SELECT body FROM responses WHERE url = ?", (url,)).fetchone()
        if row:
            self.cached += 1
            return json.loads(row[0]).get("docs") or []
        if self.offline:
            raise StopRun("offline and not cached")
        if self.network >= self.max_requests:
            raise StopRun(f"request budget of {self.max_requests} spent")
        body = self._fetch(url)
        self.db.execute("INSERT OR REPLACE INTO responses VALUES (?, ?, datetime('now'))", (url, body))
        self.db.commit()
        return json.loads(body).get("docs") or []

    def _fetch(self, url: str, attempt: int = 1) -> str:
        wait = self.last + MIN_INTERVAL - time.monotonic()
        if wait > 0:
            time.sleep(wait)
        req = urllib.request.Request(url, headers={"User-Agent": USER_AGENT,
                                                   "Accept": "application/json"})
        self.last = time.monotonic()
        self.network += 1
        try:
            with urllib.request.urlopen(req, timeout=60) as resp:
                return resp.read().decode("utf-8")
        except urllib.error.HTTPError as e:
            if e.code == 429:
                retry = float(e.headers.get("Retry-After") or 60)
                if retry > 300:
                    raise StopRun(f"Open Library asked us to wait {retry / 60:.0f} min")
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
# run
# --------------------------------------------------------------------------

def run(args) -> int:
    review = ex.load_book_review(args.book_review)
    out = Path(args.out)
    existing, moved = rekey(read_rows(out), review)
    if moved:
        print(f"rekeyed {moved} rows in {out.name} to accepted spellings"
              + (" (dry run: not written)" if args.dry_run else ""))
    books = read_books(Path(args.books), Path(args.authors))
    total = len(books)
    if args.limit:
        books = books[:args.limit]
    print(f"{len(books)} of {total} books" + (" (dry run: no CSV is written)" if args.dry_run else ""))

    api = OpenLibrary(Path(args.cache), args.max_requests, offline=args.offline)
    status: dict[tuple, str] = {}
    fresh: dict[tuple, dict] = {}
    proposals: list[dict] = []
    missed: list[tuple[str, str, str, list[dict]]] = []
    stopped = None
    try:
        for n, (title, author) in enumerate(books, start=1):
            k = (ex.key(title), ex.key(author))
            if not author:
                status[k] = "no_author"
                continue
            if is_hand(existing.get(k)):
                status[k] = "hand"
                continue
            works = api.search(title, author)
            status[k], work, sim = decide(title, author, works)
            if status[k] == "matched":
                fresh[k] = details(title, author, work)
            elif status[k] == "proposed":
                proposals.append(proposal(title, author, work, sim))
            else:
                missed.append((status[k], title, author, works))
            if n % 100 == 0:
                print(f"  {n}/{len(books)} books · {api.network} requests, {api.cached} from cache")
    except StopRun as e:
        stopped = str(e)
    except KeyboardInterrupt:
        stopped = "interrupted"
    finally:
        api.db.close()

    report(status, proposals, missed, api, stopped)
    if args.dry_run:
        return 0

    for k, row in fresh.items():
        if not is_hand(existing.get(k)):
            existing[k] = row
    rows = sorted(existing.values(), key=lambda r: (ex.key(r["author"]), ex.key(r["title"])))
    write_csv(out, DETAIL_COLUMNS, rows)

    known = {ex.review_sides(r) for r in review}
    new = []
    for p in proposals:
        if ex.review_sides(p) not in known:
            known.add(ex.review_sides(p))
            new.append(p)
    if new:
        write_csv(Path(args.book_review), ex.BOOK_REVIEW_COLUMNS, review + new)
        print(f"  {len(new)} Open Library spellings to review in {args.book_review}: "
              "`merge` takes Open Library's, `separate` keeps yours")
    if stopped:
        print("Re-run the same command to continue; cached lookups cost nothing.")
    return 0


def report(status: dict, proposals: list[dict], missed: list, api: OpenLibrary, stopped) -> None:
    counts = Counter(status.values())
    print("\n" + (f"stopped: {stopped}\n" if stopped else ""))
    for s in STATUSES:
        print(f"  {s:<10} {counts.get(s, 0):>6}")
    looked_up = sum(counts.get(s, 0) for s in ("matched", "proposed", "ambiguous", "unmatched"))
    if looked_up:
        print(f"  match rate {counts.get('matched', 0) / looked_up:.0%} of {looked_up} looked up")
    if proposals:
        print("\nproposed (book_review.csv):")
        for p in proposals:
            print(f"  {p['a']} — {p['a_author']}  ->  {p['b']}  ({p['similarity']})")
    if missed:
        print("\nambiguous and unmatched, with Open Library's top candidates:")
        for s, title, author, works in missed:
            cands = " | ".join(f"{w.get('title')} ({', '.join(w.get('author_name') or ['?'])}"
                               f"{', ' + w['key'].rsplit('/', 1)[-1] if w.get('key') else ''})"
                               for w in works[:3]) or "none"
            print(f"  {s:<9} {title} — {author}: {cands}")
    print(f"\nrequests: {api.network} to Open Library, {api.cached} from cache")


# --------------------------------------------------------------------------
# io
# --------------------------------------------------------------------------

def read_books(books: Path, authors: Path) -> list[tuple[str, str]]:
    """(title, author name) for every book extract wrote, in its order."""
    if not books.exists():
        raise SystemExit(f"{books} not found — run `npm run extract` first")
    names = {}
    if authors.exists():
        with authors.open(newline="", encoding="utf-8") as fh:
            names = {r["id"]: r["name"] for r in csv.DictReader(fh)}
    with books.open(newline="", encoding="utf-8") as fh:
        return [(r["title"], names.get(r["author_id"], "")) for r in csv.DictReader(fh) if r.get("title")]


def read_rows(path: Path) -> list[dict]:
    if not path.exists():
        return []
    with path.open(newline="", encoding="utf-8-sig") as fh:
        return [{c: (r.get(c) or "").strip() for c in DETAIL_COLUMNS}
                for r in csv.DictReader(fh) if (r.get("title") or "").strip()]


def write_csv(path: Path, columns: list[str], rows: list[dict]) -> None:
    with path.open("w", newline="", encoding="utf-8") as fh:
        w = csv.DictWriter(fh, fieldnames=columns, extrasaction="ignore")
        w.writeheader()
        w.writerows(rows)
    print(f"wrote {len(rows)} rows -> {path}")


def main(argv=None) -> int:
    ap = argparse.ArgumentParser(description=__doc__.split("\n\n")[0])
    ap.add_argument("--books", default="seed/books.csv")
    ap.add_argument("--authors", default="seed/authors.csv")
    ap.add_argument("--out", default="etl/data/book_details.csv")
    ap.add_argument("--book-review", default="etl/data/book_review.csv")
    ap.add_argument("--cache", default="etl/.openlibrary-cache.sqlite")
    ap.add_argument("--dry-run", action="store_true",
                    help="report the match rate; write no CSV (default --limit 100)")
    ap.add_argument("--limit", type=int, default=None, help="only the first N books")
    ap.add_argument("--max-requests", type=int, default=3000,
                    help="stop after this many network requests")
    ap.add_argument("--offline", action="store_true", help="use the cache only")
    args = ap.parse_args(argv)
    if args.dry_run and args.limit is None:
        args.limit = 100
    # A redirected Windows console is cp1252, and Open Library's titles are not:
    # print what it can't show as ?, rather than lose the run to the report.
    if isinstance(sys.stdout, io.TextIOWrapper):
        sys.stdout.reconfigure(errors="replace")
    return run(args)


if __name__ == "__main__":
    sys.exit(main())
