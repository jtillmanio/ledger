#!/usr/bin/env python3
"""
enrich_books.py — Hardcover details for the workbook's books, into a sidecar.

    py etl/enrich_books.py --dry-run     # 100 books, report only, writes nothing
    py etl/enrich_books.py               # every book; ~1 request a second
    py etl/enrich_books.py --offline     # the report again, from the cache only

Reads the books extract loads (seed/books.csv, seed/authors.csv) and each one's
Calibre ISBN (etl/data/calibre_books.csv, found by the book's Calibre id, else
by its title and author), asks Hardcover, and writes etl/data/book_details.csv,
keyed by title and author: Hardcover's book id, a page count, a cover URL and
the book's release year. `npm run extract` folds it into books (task 1.14b,
D-94, replacing 1.14's Open Library, D-44); Calibre's #pages still wins (D-90)
and the year fills only where the workbook has none.

How a book is decided:
- by ISBN     the book's ISBN finds an edition: its book is the match. ISBNs
              go many to a request, so a whole library is a few dozen requests
- by title    no ISBN, or no edition for it: one search a book. Exactly one
              result has the book's title and one of its authors, both after
              extract's clean() and key()
- proposed    no result matches, but the top one is by the same author with a
              near spelling of the title (trigram similarity >= 0.5, or one
              title the other plus a `: subtitle`, D-92; the titles not
              differing only by a number, nor the same words reordered):
              appended to book_review.csv as reason `hardcover`, never matched.
              Accepting it (decision `merge`) renames the book in extract, and
              the next run here moves its details row to the new title.
- ambiguous   two Hardcover books match (two search results, or one ISBN's
              editions under two books): each is a row in hardcover_review.csv.
              Write `pick` on one and the next run matches it (owner,
              2026-10-30); nothing is ranked or guessed
- unmatched   anything else, listed in the report with Hardcover's candidates
A `compilation` never matches, by ISBN or by title, and is never proposed. A
book with no author is not looked up.

Rules it keeps:
- Never overwrites a hand value. A row whose source is anything but
  `hardcover` (or 1.14's `openlibrary`, which every run drops) is never looked
  up or changed, and a failed lookup never erases a Hardcover row.
- Undecided `open library` rows in book_review.csv go; decided ones stay.
- No word count from pages (2.1 estimates one), no ISBNs (books has no column).
- Hardcover's limits (D-94): 60 requests a minute, bursts of 10, 5,000 a day.
  One request a second, waiting for the reset whenever its `RateLimit` header
  says a bucket is empty, and out a 429's `Retry-After`; a User-Agent naming the
  app; the token from HARDCOVER_API_TOKEN (.env), without which only --offline
  runs. Every answer is kept in etl/.hardcover-cache.sqlite, one row per ISBN
  and per search, so a re-run never asks twice and an interrupted run resumes
  where it stopped. calibre.py asks through the same client and cache.

Standard library only, plus extract.py's matching helpers.
"""

from __future__ import annotations

import argparse
import csv
import io
import json
import os
import re
import sqlite3
import sys
import time
import urllib.error
import urllib.request
from collections import Counter
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent))
import extract as ex  # noqa: E402

API = "https://api.hardcover.app/v1/graphql"
BOOK_URL = "https://hardcover.app/books/{}"
USER_AGENT = "ledger-backfill/1.0 (personal media ledger; book metadata; https://github.com/jtillmanio/ledger)"
TOKEN_VAR = "HARDCOVER_API_TOKEN"
MIN_INTERVAL = 1.0      # seconds between requests: 60 a minute
MAX_WAIT = 300          # a wait longer than this (the daily limit) stops the run instead
ISBN_BATCH = 100        # ISBNs in one editions request, which is one request however many it lists
SEARCH_LIMIT = 10       # results per search; the book is near the top when Hardcover has it
SOURCE = "hardcover"
OLD_SOURCE = "openlibrary"  # 1.14's rows, which every run replaces (D-94)
# A near spelling is proposed at this trigram similarity or more, or as a
# subtitle (ex.subtitled()): the line D-89 drew for Calibre's pairs, above the
# workbook's own 0.4 (D-92). Below it the pairs were series patterns.
SIMILAR_AT = 0.5
DETAIL_COLUMNS = ex.BOOK_DETAILS_COLUMNS
# etl/data/hardcover_review.csv: one row per candidate of an ambiguous book.
REVIEW_COLUMNS = ["title", "author", "hardcover_id", "hardcover_title", "hardcover_authors",
                  "year", "readers", "url", "decision"]
PICK = "pick"
STATUSES = ("matched", "proposed", "ambiguous", "unmatched", "no_author", "hand")
HOW = ("isbn", "title", "picked")

BOOK_FIELDS = """id title subtitle slug pages release_year compilation users_count
      image { url }
      contributions { author { name } }
      book_series { position featured series { name } }"""
EDITIONS_QUERY = """query Editions($isbn13: [String!], $isbn10: [String!]) {
  editions(where: {_or: [{isbn_13: {_in: $isbn13}}, {isbn_10: {_in: $isbn10}}]}) {
    id isbn_13 isbn_10 pages image { url }
    book { %s }
  }
}""" % BOOK_FIELDS
SEARCH_QUERY = """query Search($query: String!, $per_page: Int!) {
  search(query: $query, query_type: "Book", per_page: $per_page) { results }
}"""


class StopRun(Exception):
    pass


# --------------------------------------------------------------------------
# Hardcover's records, as one shape
# --------------------------------------------------------------------------

def image(obj: dict | None) -> str:
    return ((obj or {}).get("image") or {}).get("url") or ""


def as_id(v) -> int | None:
    try:
        return int(v)
    except (TypeError, ValueError):
        return None


def from_edition(edition: dict) -> dict:
    """A book found by an edition: the edition's pages and cover, else the book's."""
    book = edition.get("book") or {}
    series = sorted(book.get("book_series") or [], key=lambda s: not s.get("featured"))
    return {"id": as_id(book.get("id")), "title": book.get("title") or "",
            "subtitle": book.get("subtitle") or "",
            "authors": [(c.get("author") or {}).get("name") or "" for c in book.get("contributions") or []],
            "compilation": bool(book.get("compilation")), "readers": book.get("users_count") or 0,
            "year": book.get("release_year"), "pages": edition.get("pages") or book.get("pages"),
            "cover": image(edition) or image(book), "slug": book.get("slug") or "",
            "series": [((s.get("series") or {}).get("name") or "", s.get("position")) for s in series]}


def from_search(doc: dict) -> dict:
    """A book as a search result: the default edition's pages, the book's cover."""
    featured = doc.get("featured_series") or {}
    series = []
    name = (featured.get("series") or {}).get("name")
    if name:
        series.append((name, featured.get("position", doc.get("featured_series_position"))))
    series += [(n, None) for n in doc.get("series_names") or [] if not any(same(n, s) for s, _ in series)]
    return {"id": as_id(doc.get("id")), "title": doc.get("title") or "", "subtitle": doc.get("subtitle") or "",
            "authors": list(doc.get("author_names") or []), "compilation": bool(doc.get("compilation")),
            "readers": doc.get("users_count") or 0, "year": doc.get("release_year"),
            "pages": doc.get("pages"), "cover": image(doc), "slug": doc.get("slug") or "",
            "series": series}


def hits(results) -> list[dict]:
    if isinstance(results, str):
        results = json.loads(results)
    return [from_search(h.get("document") or {}) for h in (results or {}).get("hits") or []]


def isbn_books(editions: list[dict]) -> list[dict]:
    """The books an ISBN's editions belong to, once each."""
    out: dict[int, dict] = {}
    for e in editions:
        r = from_edition(e)
        if r["id"] is None:
            continue
        if r["id"] in out:
            out[r["id"]]["pages"] = out[r["id"]]["pages"] or r["pages"]
            out[r["id"]]["cover"] = out[r["id"]]["cover"] or r["cover"]
        else:
            out[r["id"]] = r
    return list(out.values())


def normal_isbn(v: str | None) -> str:
    """An ISBN-13 or ISBN-10 without its hyphens, or "" when it is neither."""
    s = re.sub(r"[^0-9X]", "", (v or "").upper())
    return s if len(s) in (10, 13) else ""


# --------------------------------------------------------------------------
# matching
# --------------------------------------------------------------------------

def same(a: str | None, b: str | None) -> bool:
    return bool(ex.key(ex.clean(a))) and ex.key(ex.clean(a)) == ex.key(ex.clean(b))


def by(record: dict, author: str) -> bool:
    return any(same(name, author) for name in record["authors"])


def full_title(record: dict) -> str:
    return f"{record['title']}: {record['subtitle']}" if record["subtitle"] else record["title"]


def titled(record: dict, title: str) -> bool:
    """Hardcover keeps a subtitle in its own field; the workbook may write it in."""
    return same(record["title"], title) or (bool(record["subtitle"]) and same(full_title(record), title))


def reordered(a: str, b: str) -> bool:
    """`Of Darkness and Dawn` / `Of Dawn and Darkness`: the same words in
    another order score 1.00 and are two books (owner, 2026-10-30)."""
    def words(s):
        return sorted(re.findall(r"[a-z0-9]+", (ex.clean(s) or "").lower()))
    return ex.key(a) != ex.key(b) and words(a) == words(b)


def decide(title: str, author: str, records: list[dict]) -> tuple[str, dict | None, float, list[dict]]:
    """(status, the record it rests on, similarity, the candidates when
    ambiguous) for one book's search results. A compilation is never one."""
    pool = [r for r in records if not r["compilation"] and r["id"] is not None]
    exact = list({r["id"]: r for r in pool if titled(r, title) and by(r, author)}.values())
    if len(exact) == 1:
        return "matched", exact[0], 1.0, []
    if exact:
        return "ambiguous", None, 1.0, exact
    top = pool[0] if pool else None
    if top and by(top, author) and top["title"]:
        name = ex.clean(top["title"])
        sim = ex.trgm_similarity(title, name)
        if (sim >= SIMILAR_AT or ex.subtitled(title, name)) and not ex.differs_only_by_number(title, name) \
                and not reordered(title, name):
            return "proposed", top, sim, []
    return "unmatched", None, 0.0, []


def find(api: "Hardcover", title: str, author: str, isbn: str = "",
         picks: frozenset = frozenset()) -> tuple[str, dict | None, float, str, list[dict]]:
    """(status, record, similarity, how, candidates) for one book: its ISBN
    first, then one search. `picks` are the Hardcover ids the owner picked for
    it in hardcover_review.csv; a candidate with one of them is the match."""
    if isbn:
        books = [r for r in isbn_books(api.editions([isbn]).get(isbn) or []) if not r["compilation"]]
        chosen = [r for r in books if r["id"] in picks]
        if len(chosen) == 1:
            return "matched", chosen[0], 1.0, "picked", []
        if len(books) == 1:
            return "matched", books[0], 1.0, "isbn", []
        if books:
            return "ambiguous", None, 1.0, "isbn", books
    records = api.search(title, author)
    chosen = [r for r in records if r["id"] in picks and not r["compilation"]]
    if len(chosen) == 1:
        return "matched", chosen[0], 1.0, "picked", []
    status, record, sim, candidates = decide(title, author, records)
    return status, record, sim, "title", candidates


def details(title: str, author: str, record: dict) -> dict:
    return {"title": title, "author": author, "open_library_id": "", "hardcover_id": record["id"],
            "page_count": record["pages"] or "", "cover_url": record["cover"] or "",
            "published_year": record["year"] or "", "source": SOURCE}


def proposal(title: str, author: str, record: dict, sim: float) -> dict:
    name = ex.clean(record["title"])
    return {"kind": "book", "a": title, "b": name, "a_author": author, "b_author": author,
            "a_tabs": "", "b_tabs": "Hardcover", "reason": ex.HARDCOVER,
            "similarity": f"{sim:.2f}", "keep": name, "decision": ""}


def candidate(title: str, author: str, record: dict) -> dict:
    return {"title": title, "author": author, "hardcover_id": str(record["id"]),
            "hardcover_title": full_title(record), "hardcover_authors": "; ".join(a for a in record["authors"] if a),
            "year": record["year"] or "", "readers": str(record["readers"]),
            "url": BOOK_URL.format(record["slug"]) if record["slug"] else "", "decision": ""}


def is_hand(row: dict | None) -> bool:
    return row is not None and row.get("source") != SOURCE


def rekey(rows: list[dict], review: list[dict]) -> tuple[dict[tuple, dict], int]:
    """Rows by (title, author) key, each moved through book_review.csv's merges
    (an accepted Hardcover spelling is one) to the book extract now loads.
    When two rows land on one book, a hand row beats a Hardcover one."""
    out: dict[tuple, dict] = {}
    moved_rows, moved = moved_through(rows, review)
    for r in moved_rows:
        k = book_key(r)
        if k not in out or (is_hand(r) and not is_hand(out[k])):
            out[k] = r
    return out, moved


def moved_through(rows: list[dict], review: list[dict]) -> tuple[list[dict], int]:
    """Each row under the (title, author) its book now loads as, and how many moved."""
    idx = ex.BookIndex(review)
    out, moved = [], 0
    for r in rows:
        title, author = idx.book_identity(r["title"], r["author"] or None)
        if (ex.key(title), ex.key(author)) != book_key(r):
            moved += 1
            r = {**r, "title": title, "author": author or ""}
        out.append(r)
    return out, moved


def book_key(r: dict) -> tuple:
    return ex.key(r["title"]), ex.key(r["author"])


# --------------------------------------------------------------------------
# Hardcover
# --------------------------------------------------------------------------

def ratelimit_wait(header: str | None) -> float:
    """Seconds before the next request may go, from a `RateLimit` header
    (`"Free";r=8;t=0, "daily";r=4231;t=51234`): the longest reset among the
    buckets with none remaining."""
    wait = 0.0
    for bucket in (header or "").split(","):
        fields = dict(f.strip().split("=", 1) for f in bucket.split(";")[1:] if "=" in f)
        try:
            remaining, reset = int(fields["r"]), float(fields["t"])
        except (KeyError, ValueError):
            continue
        if remaining <= 0:
            wait = max(wait, reset)
    return wait


class Hardcover:
    def __init__(self, cache_path: Path, max_requests: int, token: str | None = None, offline: bool = False):
        self.db = sqlite3.connect(cache_path)
        self.db.execute("CREATE TABLE IF NOT EXISTS responses "
                        "(key TEXT PRIMARY KEY, body TEXT NOT NULL, fetched_at TEXT NOT NULL)")
        self.max_requests = max_requests
        self.token = token
        self.offline = offline or not token
        self.network = 0
        self.cached = 0
        self.last = 0.0
        self.until = 0.0    # no request before this, when a RateLimit bucket is empty

    def cached_body(self, key: str) -> str | None:
        row = self.db.execute("SELECT body FROM responses WHERE key = ?", (key,)).fetchone()
        return row[0] if row else None

    def keep(self, key: str, body: str) -> None:
        self.db.execute("INSERT OR REPLACE INTO responses VALUES (?, ?, datetime('now'))", (key, body))

    def editions(self, isbns: list[str]) -> dict[str, list[dict]]:
        """Each ISBN's editions, an empty list for one Hardcover lacks. The
        uncached ones are asked ISBN_BATCH to a request; each ISBN is cached
        on its own, so a later run with other books still finds it."""
        out, todo = {}, []
        for isbn in dict.fromkeys(i for i in isbns if i):
            body = self.cached_body(f"isbn:{isbn}")
            if body is None:
                todo.append(isbn)
            else:
                self.cached += 1
                out[isbn] = json.loads(body)
        for at in range(0, len(todo), ISBN_BATCH):
            batch = todo[at:at + ISBN_BATCH]
            data = self.query(EDITIONS_QUERY, {"isbn13": [i for i in batch if len(i) == 13],
                                               "isbn10": [i for i in batch if len(i) == 10]})
            found: dict[str, list[dict]] = {i: [] for i in batch}
            for e in data.get("editions") or []:
                for isbn in {e.get("isbn_13"), e.get("isbn_10")}:
                    if isbn in found:
                        found[isbn].append(e)
            for isbn, eds in found.items():
                self.keep(f"isbn:{isbn}", json.dumps(eds, sort_keys=True))
            self.db.commit()
            out.update(found)
        return out

    @staticmethod
    def search_text(title: str, author: str) -> str:
        return f"{title} {author}".strip()

    def search(self, title: str, author: str) -> list[dict]:
        text = self.search_text(title, author)
        key = f"search:{text}"
        body = self.cached_body(key)
        if body is not None:
            self.cached += 1
            return hits(json.loads(body))
        data = self.query(SEARCH_QUERY, {"query": text, "per_page": SEARCH_LIMIT})
        results = (data.get("search") or {}).get("results")
        if isinstance(results, str):
            results = json.loads(results)
        self.keep(key, json.dumps(results or {}, sort_keys=True))
        self.db.commit()
        return hits(results)

    def query(self, query: str, variables: dict) -> dict:
        if self.offline:
            raise StopRun("offline and not cached")
        if self.network >= self.max_requests:
            raise StopRun(f"request budget of {self.max_requests} spent")
        body = json.loads(self._fetch(query, variables))
        if body.get("errors"):
            first = body["errors"][0]
            raise StopRun(f"Hardcover answered with an error: {first.get('message', first) if isinstance(first, dict) else first}")
        return body.get("data") or {}

    def headers(self) -> dict:
        token = self.token or ""
        return {"authorization": token if token.lower().startswith("bearer ") else f"Bearer {token}",
                "content-type": "application/json", "accept": "application/json",
                "user-agent": USER_AGENT}

    def _fetch(self, query: str, variables: dict, attempt: int = 1) -> str:
        wait = max(self.last + MIN_INTERVAL, self.until) - time.monotonic()
        if wait > MAX_WAIT:
            raise StopRun(f"Hardcover's limit resets in {wait / 60:.0f} min")
        if wait > 0:
            time.sleep(wait)
        req = urllib.request.Request(API, data=json.dumps({"query": query, "variables": variables}).encode(),
                                     headers=self.headers(), method="POST")
        self.last = time.monotonic()
        self.network += 1
        try:
            with urllib.request.urlopen(req, timeout=60) as resp:
                self.until = time.monotonic() + ratelimit_wait(resp.headers.get("RateLimit"))
                return resp.read().decode("utf-8")
        except urllib.error.HTTPError as e:
            if e.code == 429:
                retry = float((e.headers or {}).get("Retry-After") or 60)
                if retry > MAX_WAIT:
                    raise StopRun(f"Hardcover asked us to wait {retry / 60:.0f} min (its daily limit?)")
                print(f"    rate limited, waiting {retry:.0f}s")
                time.sleep(retry)
                self.last = time.monotonic()
                return self._fetch(query, variables, attempt)
            if e.code in (401, 403):
                raise StopRun(f"Hardcover refused the request ({e.code}): check {TOKEN_VAR}; {error_text(e)}")
            if (e.code >= 500 or e.code == 408) and attempt < 4:
                time.sleep(10 * attempt)
                return self._fetch(query, variables, attempt + 1)
            raise
        except urllib.error.URLError:
            if attempt < 4:
                time.sleep(10 * attempt)
                return self._fetch(query, variables, attempt + 1)
            raise


def error_text(e: urllib.error.HTTPError) -> str:
    try:
        return e.read().decode("utf-8", "replace")[:200]
    except Exception:  # noqa: BLE001 - the status already says enough
        return ""


def load_env(path: Path) -> None:
    """KEY=value lines from a .env file into os.environ, never over a value
    already set. `KEY = "value"` is read too."""
    if not path.exists():
        return
    for line in path.read_text(encoding="utf-8").splitlines():
        m = re.match(r"^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)$", line)
        if m and m.group(1) not in os.environ:
            os.environ[m.group(1)] = m.group(2).strip().strip('"').strip("'")


def token(env: Path) -> str | None:
    load_env(env)
    return os.environ.get(TOKEN_VAR, "").strip() or None


# --------------------------------------------------------------------------
# run
# --------------------------------------------------------------------------

def run(args) -> int:
    key_ = token(Path(args.env))
    if not key_ and not args.offline:
        print(f"enrich_books: {TOKEN_VAR} is not set (in .env or the environment). Create a token on "
              "hardcover.app (your account's API page), or run --offline from the cache.", file=sys.stderr)
        return 1
    review = ex.load_book_review(args.book_review)
    out = Path(args.out)
    rows = read_rows(out, DETAIL_COLUMNS)
    dropped = sum(1 for r in rows if r["source"] == OLD_SOURCE)
    existing, moved = rekey([r for r in rows if r["source"] != OLD_SOURCE], review)
    if moved:
        print(f"rekeyed {moved} rows in {out.name} to accepted spellings"
              + (" (dry run: not written)" if args.dry_run else ""))
    if dropped:
        print(f"{dropped} Open Library rows in {out.name} are replaced by this run (D-94)"
              + (" (dry run: not written)" if args.dry_run else ""))
    picked_rows, _ = moved_through(read_rows(Path(args.hardcover_review), REVIEW_COLUMNS), review)
    picks: dict[tuple, set[int]] = {}
    for r in picked_rows:
        if r["decision"].lower() == PICK and as_id(r["hardcover_id"]) is not None:
            picks.setdefault(book_key(r), set()).add(as_id(r["hardcover_id"]))
    by_id, by_key = read_isbns(Path(args.calibre_books), review)
    books = read_books(Path(args.books), Path(args.authors))
    total = len(books)
    if args.limit:
        books = books[:args.limit]
    print(f"{len(books)} of {total} books" + (" (dry run: no CSV is written)" if args.dry_run else ""))

    api = Hardcover(Path(args.cache), args.max_requests, token=key_, offline=args.offline)
    status: dict[tuple, str] = {}
    how: dict[tuple, str] = {}
    fresh: dict[tuple, dict] = {}
    proposals: list[dict] = []
    candidates: dict[tuple, list[dict]] = {}
    missed: list[tuple[str, str, str, list[dict]]] = []
    notes: list[str] = []
    stopped = None
    todo = []
    for title, author, calibre_id in books:
        k = (ex.key(title), ex.key(author))
        if not author:
            status[k] = "no_author"
        elif is_hand(existing.get(k)):
            status[k] = "hand"
        else:
            todo.append((k, title, author, by_id.get(calibre_id) or by_key.get(k, "")))
    try:
        try:
            api.editions([isbn for *_, isbn in todo])
        except StopRun:
            pass  # what is cached still decides; the loop stops at the first book that isn't
        for n, (k, title, author, isbn) in enumerate(todo, start=1):
            mine = picks.get(k, set())
            if len(mine) > 1:
                notes.append(f"{title} — {author}: {len(mine)} rows picked in hardcover_review.csv; "
                             "pick one, until then it matches nothing")
                mine = set()
            status[k], record, sim, how[k], cands = find(api, title, author, isbn, frozenset(mine))
            if status[k] == "matched":
                fresh[k] = details(title, author, record)
            elif status[k] == "proposed":
                proposals.append(proposal(title, author, record, sim))
            else:
                if status[k] == "ambiguous":
                    candidates[k] = [candidate(title, author, r) for r in cands]
                    if mine:
                        notes.append(f"{title} — {author}: the picked Hardcover id {next(iter(mine))} "
                                     "isn't among Hardcover's candidates now")
                missed.append((status[k], title, author, cands or api_top(api, title, author)))
            if n % 100 == 0:
                print(f"  {n}/{len(todo)} books · {api.network} requests, {api.cached} from cache")
    except StopRun as e:
        stopped = str(e)
    except KeyboardInterrupt:
        stopped = "interrupted"
    finally:
        api.db.close()

    report(status, how, proposals, missed, notes, api, stopped)
    if args.dry_run:
        return 0

    for k, row in fresh.items():
        if not is_hand(existing.get(k)):
            existing[k] = row
    rows = sorted(existing.values(), key=lambda r: (ex.key(r["author"]), ex.key(r["title"])))
    write_csv(out, DETAIL_COLUMNS, rows)
    write_hardcover_review(Path(args.hardcover_review), picked_rows, candidates,
                           {k for k, s in status.items() if s in ("matched", "proposed", "ambiguous", "unmatched")})

    # Undecided Open Library proposals go with Open Library (D-94); decided
    # ones are the owner's and stay.
    kept = [r for r in review if r["reason"] != ex.OPEN_LIBRARY or r["decision"]]
    known = {ex.review_sides(r) for r in kept}
    new = []
    for p in proposals:
        if ex.review_sides(p) not in known:
            known.add(ex.review_sides(p))
            new.append(p)
    if new or len(kept) < len(review):
        write_csv(Path(args.book_review), ex.BOOK_REVIEW_COLUMNS, kept + new)
        if len(kept) < len(review):
            print(f"  {len(review) - len(kept)} undecided Open Library spellings dropped from {args.book_review}")
        if new:
            print(f"  {len(new)} Hardcover spellings to review in {args.book_review}: "
                  "`merge` takes Hardcover's, `separate` keeps yours")
    if candidates:
        print(f"  {len(candidates)} books with two Hardcover matches in {args.hardcover_review}: "
              "write `pick` on the right one, and re-run")
    if stopped:
        print("Re-run the same command to continue; cached lookups cost nothing.")
    return 0


def api_top(api: Hardcover, title: str, author: str) -> list[dict]:
    """The search results already in hand for a book, for the report."""
    body = api.cached_body(f"search:{api.search_text(title, author)}")
    return hits(json.loads(body)) if body else []


def write_hardcover_review(path: Path, rows: list[dict], candidates: dict[tuple, list[dict]],
                           looked_up: set[tuple]) -> None:
    """Decided rows stay; a book looked up this run has its undecided rows
    rebuilt from this run's candidates; the rest stay as they were."""
    kept = [r for r in rows if r["decision"] or book_key(r) not in looked_up]
    have = {(book_key(r), r["hardcover_id"]) for r in kept}
    kept += [c for cs in candidates.values() for c in cs if (book_key(c), c["hardcover_id"]) not in have]
    if not kept and not path.exists():
        return
    kept.sort(key=lambda r: (ex.key(r["author"]), ex.key(r["title"]), -(as_id(r["readers"]) or 0),
                             as_id(r["hardcover_id"]) or 0))
    write_csv(path, REVIEW_COLUMNS, kept)


def report(status: dict, how: dict, proposals: list[dict], missed: list, notes: list[str],
           api: Hardcover, stopped) -> None:
    counts = Counter(status.values())
    ways = Counter(how[k] for k, s in status.items() if s == "matched")
    print("\n" + (f"stopped: {stopped}\n" if stopped else ""))
    for s in STATUSES:
        print(f"  {s:<10} {counts.get(s, 0):>6}")
    print("  matched by " + ", ".join(f"{w} {ways.get(w, 0)}" for w in HOW))
    looked_up = sum(counts.get(s, 0) for s in ("matched", "proposed", "ambiguous", "unmatched"))
    if looked_up:
        print(f"  match rate {counts.get('matched', 0) / looked_up:.0%} of {looked_up} looked up")
    if proposals:
        print("\nproposed (book_review.csv):")
        for p in proposals:
            print(f"  {p['a']} — {p['a_author']}  ->  {p['b']}  ({p['similarity']})")
    if missed:
        print("\nambiguous and unmatched, with Hardcover's top candidates:")
        for s, title, author, records in missed:
            cands = " | ".join(f"{full_title(r)} ({', '.join(a for a in r['authors'] if a) or '?'}, {r['id']}"
                               f"{', compilation' if r['compilation'] else ''}, {r['readers']} readers)"
                               for r in records[:3]) or "none"
            print(f"  {s:<9} {title} — {author}: {cands}")
    for line in notes:
        print(f"  note: {line}")
    print(f"\nrequests: {api.network} to Hardcover, {api.cached} from cache")


# --------------------------------------------------------------------------
# io
# --------------------------------------------------------------------------

def read_books(books: Path, authors: Path) -> list[tuple[str, str, str]]:
    """(title, author name, Calibre id) for every book extract wrote, in its order."""
    if not books.exists():
        raise SystemExit(f"{books} not found — run `npm run extract` first")
    names = {}
    if authors.exists():
        with authors.open(newline="", encoding="utf-8") as fh:
            names = {r["id"]: r["name"] for r in csv.DictReader(fh)}
    with books.open(newline="", encoding="utf-8") as fh:
        return [(r["title"], names.get(r["author_id"], ""), (r.get("calibre_id") or "").strip())
                for r in csv.DictReader(fh) if r.get("title")]


def read_isbns(path: Path, review: list[dict]) -> tuple[dict[str, str], dict[tuple, str]]:
    """Each Calibre book's ISBN, by its Calibre id and by the (title, author)
    it loads as once book_review.csv's merges apply."""
    idx = ex.BookIndex(review)
    by_id, by_key = {}, {}
    for r in ex.read_sidecar(path, ex.CALIBRE_BOOKS_COLUMNS):
        isbn = normal_isbn(r["isbn"])
        if not isbn:
            continue
        if r["calibre_id"]:
            by_id[r["calibre_id"]] = isbn
        title, author = idx.book_identity(r["title"], r["author"] or None)
        by_key.setdefault((ex.key(title), ex.key(author)), isbn)
    return by_id, by_key


def read_rows(path: Path, columns: list[str]) -> list[dict]:
    if not path.exists():
        return []
    with path.open(newline="", encoding="utf-8-sig") as fh:
        return [{c: (r.get(c) or "").strip() for c in columns}
                for r in csv.DictReader(fh) if (r.get("title") or "").strip()]


def write_csv(path: Path, columns: list[str], rows: list[dict]) -> None:
    with path.open("w", newline="", encoding="utf-8") as fh:
        w = csv.DictWriter(fh, fieldnames=columns, extrasaction="ignore")
        w.writeheader()
        w.writerows(rows)
    print(f"wrote {len(rows)} rows -> {path}")


def main(argv=None) -> int:
    ap = argparse.ArgumentParser(description=__doc__.split("\n\n")[0])
    ap.add_argument("--env", default=".env", help=f"where {TOKEN_VAR} is read from")
    ap.add_argument("--books", default="seed/books.csv")
    ap.add_argument("--authors", default="seed/authors.csv")
    ap.add_argument("--calibre-books", default="etl/data/calibre_books.csv",
                    help="npm run calibre's sidecar: each book's ISBN")
    ap.add_argument("--out", default="etl/data/book_details.csv")
    ap.add_argument("--book-review", default="etl/data/book_review.csv")
    ap.add_argument("--hardcover-review", default="etl/data/hardcover_review.csv",
                    help="the candidates of each book two Hardcover books match; `pick` one")
    ap.add_argument("--cache", default="etl/.hardcover-cache.sqlite")
    ap.add_argument("--dry-run", action="store_true",
                    help="report the match rate; write no CSV (default --limit 100)")
    ap.add_argument("--limit", type=int, default=None, help="only the first N books")
    ap.add_argument("--max-requests", type=int, default=3000,
                    help="stop after this many network requests (Hardcover allows 5,000 a day)")
    ap.add_argument("--offline", action="store_true", help="use the cache only; needs no token")
    args = ap.parse_args(argv)
    if args.dry_run and args.limit is None:
        args.limit = 100
    # A redirected Windows console is cp1252, and Hardcover's titles are not:
    # print what it can't show as ?, rather than lose the run to the report.
    if isinstance(sys.stdout, io.TextIOWrapper):
        sys.stdout.reconfigure(errors="replace")
    return run(args)


if __name__ == "__main__":
    sys.exit(main())
