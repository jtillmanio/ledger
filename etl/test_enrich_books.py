"""Tests for etl/enrich_books.py (tasks 1.14, 1.14b). No network: Hardcover is
faked with recorded answers in the shape its GraphQL API gives them (the
`editions` and `search` queries), trimmed to the fields the matching reads.

    py -m unittest discover -s etl -p "test_*.py"
"""

import csv
import io
import json
import os
import sys
import tempfile
import unittest
import urllib.error
from pathlib import Path
from unittest import mock

sys.path.insert(0, str(Path(__file__).parent))
import enrich_books as eb  # noqa: E402
import extract as ex  # noqa: E402

TOKEN = "test-token"


# --------------------------------------------------------------------------
# Hardcover, recorded
# --------------------------------------------------------------------------

def hc_book(bid, title, authors, pages=None, cover=None, year=None, subtitle=None,
            compilation=False, readers=100, series=()):
    """A book as `editions { book { ... } }` returns it. `series` is
    (name, position) pairs, the first featured."""
    return {"id": bid, "title": title, "subtitle": subtitle, "slug": ex.slug(title), "pages": pages,
            "release_year": year, "compilation": compilation, "users_count": readers,
            "image": {"url": cover} if cover else None,
            "contributions": [{"author": {"name": a}} for a in authors],
            "book_series": [{"position": p, "featured": i == 0, "series": {"name": n}}
                            for i, (n, p) in enumerate(series)]}


def edition(eid, book, isbn13=None, isbn10=None, pages=None, cover=None):
    return {"id": eid, "isbn_13": isbn13, "isbn_10": isbn10, "pages": pages,
            "image": {"url": cover} if cover else None, "book": book}


def doc(bid, title, authors, pages=None, cover=None, year=None, subtitle=None,
        compilation=False, readers=100, series=None, position=None):
    """A book as a search result's `document` (Hardcover's Typesense index)."""
    d = {"id": str(bid), "title": title, "subtitle": subtitle, "author_names": authors,
         "compilation": compilation, "users_count": readers, "release_year": year, "pages": pages,
         "image": {"url": cover} if cover else {}, "slug": ex.slug(title), "series_names": []}
    if series:
        d["featured_series"] = {"position": position, "series": {"name": series}}
        d["series_names"] = [series]
    return d


def results(*docs):
    return {"found": len(docs), "hits": [{"document": d} for d in docs]}


WOK = hc_book(386446, "The Way of Kings", ["Brandon Sanderson"], pages=1001,
              cover="https://assets.hardcover.app/wok-book.jpg", year=2010,
              series=[("The Stormlight Archive", 1)])
MISTBORN = hc_book(369692, "Mistborn", ["Brandon Sanderson"], pages=541,
                   cover="https://assets.hardcover.app/mistborn-book.jpg", year=2006,
                   series=[("Mistborn", 1)])
ARCANUM = hc_book(264, "Arcanum Unbounded", ["Brandon Sanderson"], pages=672, year=2016, compilation=True)

# ISBN -> the editions Hardcover has for it.
EDITIONS = {
    # An edition with its own pages and cover.
    "9780765326355": [edition(30395390, WOK, isbn13="9780765326355", pages=1007,
                              cover="https://assets.hardcover.app/wok-edition.jpg")],
    # An ISBN-10 whose edition has neither: the book's fill in.
    "0765311780": [edition(31117741, MISTBORN, isbn10="0765311780")],
    # A compilation's edition: never a match.
    "9780765391162": [edition(1, ARCANUM, isbn13="9780765391162", pages=672)],
}

# The search text (title, then author) -> its results.
SEARCHES = {
    "Warbreaker Brandon Sanderson": results(
        doc(31580, "Warbreaker", ["Brandon Sanderson"], 592, "https://assets.hardcover.app/warbreaker.jpg", 2009),
        doc(1001, "Warbreaker (Tor Teen)", ["Brandon Sanderson"], 600, None, 2009, readers=3)),
    "Elantris Brandon Sanderson": results(
        doc(31581, "Elantris", ["Brandon Sanderson"], 638, "https://assets.hardcover.app/elantris.jpg", 2005)),
    # A near spelling: the workbook's title adds a word to Hardcover's.
    "Edgedancer Novella Brandon Sanderson": results(
        doc(31582, "Edgedancer", ["Brandon Sanderson"], 272, None, 2016)),
    # The exact title and author, but a compilation.
    "Arcanum Unbounded Brandon Sanderson": results(
        doc(264, "Arcanum Unbounded", ["Brandon Sanderson"], 672, None, 2016,
            subtitle="The Cosmere Collection", compilation=True)),
    # Two books with exactly the book's title and author: the owner picks.
    "White Sand Brandon Sanderson": results(
        doc(41, "White Sand", ["Brandon Sanderson"], 160, None, 2016, readers=900),
        doc(42, "White Sand", ["Brandon Sanderson"], 480, None, 2018, readers=4000)),
    "Nothing Like It Brandon Sanderson": results(
        doc(1, "A Different Book", ["Someone Else"], 100, None, 1999)),
}

# Seed books: (title, author, Calibre id); and Calibre's ISBN for each id.
BOOKS = [("The Way of Kings", "Brandon Sanderson", "1"), ("Mistborn", "Brandon Sanderson", "2"),
         ("Elantris", "Brandon Sanderson", "3"), ("Arcanum Unbounded", "Brandon Sanderson", "4"),
         ("Warbreaker", "Brandon Sanderson", ""), ("Edgedancer Novella", "Brandon Sanderson", ""),
         ("White Sand", "Brandon Sanderson", ""), ("Nothing Like It", "Brandon Sanderson", "")]
ISBNS = {"1": "978-0-7653-2635-5", "2": "0765311780",
         "3": "9999999999999",     # Hardcover has no edition with it
         "4": "9780765391162"}


class FakeHardcover:
    """What the faked `Hardcover._fetch` answers from, and what it was asked."""

    def __init__(self, editions=None, searches=None):
        self.editions = EDITIONS if editions is None else editions
        self.searches = SEARCHES if searches is None else searches
        self.calls: list[tuple[str, dict]] = []
        self.fail_at: int | None = None

    def kinds(self, kind):
        return [v for k, v in self.calls if k == kind]

    def body(self, query, variables) -> str:
        if "editions(" in query:
            wanted = (variables.get("isbn13") or []) + (variables.get("isbn10") or [])
            eds = {e["id"]: e for i in wanted for e in self.editions.get(i, [])}
            return json.dumps({"data": {"editions": list(eds.values())}})
        return json.dumps({"data": {"search": {"results": self.searches.get(variables["query"], results())}}})

    def fetch(self, query, variables, attempt=1):
        if self.fail_at is not None and len(self.calls) == self.fail_at:
            raise KeyboardInterrupt
        self.calls.append(("editions" if "editions(" in query else "search", variables))
        return self.body(query, variables)


class Fake(unittest.TestCase):
    """A catalog in seed/ form, a Calibre sidecar, a temp sidecar dir, and a fake Hardcover."""

    def setUp(self):
        self.dir = Path(tempfile.mkdtemp())
        self.write_books(BOOKS)
        self.write_calibre(ISBNS)
        self.hc = FakeHardcover()

    def write_books(self, books):
        authors = {}
        with (self.dir / "books.csv").open("w", newline="", encoding="utf-8") as fh:
            w = csv.writer(fh)
            w.writerow(["id", "title", "author_id", "series_id", "series_position", "genre",
                        "book_type", "word_count", "word_count_source", "published_year", "calibre_id"])
            for title, author, *cid in books:
                aid = ex.slug(author) if author else ""
                if author:
                    authors[aid] = author
                w.writerow([ex.slug(title, author or ""), title, aid, "", "", "", "Novel", "", "", "",
                            cid[0] if cid else ""])
        with (self.dir / "authors.csv").open("w", newline="", encoding="utf-8") as fh:
            w = csv.writer(fh)
            w.writerow(["id", "name"])
            w.writerows(authors.items())

    def write_calibre(self, isbns):
        """calibre_books.csv rows: only a title, an author, an ISBN and the id matter here."""
        titles = {cid: (t, a) for t, a, cid in BOOKS if cid}
        with (self.dir / "calibre_books.csv").open("w", newline="", encoding="utf-8") as fh:
            w = csv.DictWriter(fh, fieldnames=ex.CALIBRE_BOOKS_COLUMNS, restval="")
            w.writeheader()
            for cid, isbn in isbns.items():
                t, a = titles.get(cid, (f"Calibre {cid}", "Brandon Sanderson"))
                w.writerow({"title": t, "author": a, "isbn": isbn, "calibre_id": cid})

    def argv(self, *extra):
        return ["--env", str(self.dir / "absent.env"),
                "--books", str(self.dir / "books.csv"), "--authors", str(self.dir / "authors.csv"),
                "--calibre-books", str(self.dir / "calibre_books.csv"),
                "--out", str(self.dir / "book_details.csv"),
                "--book-review", str(self.dir / "book_review.csv"),
                "--hardcover-review", str(self.dir / "hardcover_review.csv"),
                "--cache", str(self.dir / "cache.sqlite"), *extra]

    def run_once(self, *extra, token=TOKEN, stdout=None):
        env = {eb.TOKEN_VAR: token} if token else {}
        with mock.patch.dict(os.environ, env), \
             mock.patch.object(eb.Hardcover, "_fetch", self.hc.fetch), \
             mock.patch("sys.stdout", stdout or io.StringIO()):
            if not token:
                os.environ.pop(eb.TOKEN_VAR, None)
            return eb.main(self.argv(*extra))

    def details(self) -> dict[str, dict]:
        return {r["title"]: r for r in self.read(self.dir / "book_details.csv")}

    @staticmethod
    def read(path) -> list[dict]:
        if not path.exists():
            return []
        with path.open(newline="", encoding="utf-8") as fh:
            return list(csv.DictReader(fh))

    def review(self) -> list[dict]:
        return self.read(self.dir / "book_review.csv")

    def picks(self) -> list[dict]:
        return self.read(self.dir / "hardcover_review.csv")

    def write(self, name, columns, rows):
        with (self.dir / name).open("w", newline="", encoding="utf-8") as fh:
            w = csv.DictWriter(fh, fieldnames=columns, restval="")
            w.writeheader()
            w.writerows(rows)

    def write_details(self, rows):
        self.write("book_details.csv", eb.DETAIL_COLUMNS, rows)

    def write_review(self, rows):
        self.write("book_review.csv", ex.BOOK_REVIEW_COLUMNS, rows)

    def sidecars(self) -> dict[str, bytes]:
        return {n: (self.dir / n).read_bytes()
                for n in ("book_details.csv", "book_review.csv", "hardcover_review.csv")
                if (self.dir / n).exists()}

    def searched(self) -> list[str]:
        return [v["query"] for v in self.hc.kinds("search")]


def row(title, hid, pages, cover, year, author="Brandon Sanderson"):
    return {"title": title, "author": author, "open_library_id": "", "hardcover_id": str(hid),
            "page_count": str(pages), "cover_url": cover, "published_year": str(year), "source": "hardcover"}


class Check(Fake):
    """1.14b's **Check:**, one test per clause (AC-1)."""

    def test_two_books_with_isbns_match_in_one_request(self):
        self.assertEqual(self.run_once(), 0)
        asked = self.hc.kinds("editions")
        self.assertEqual(len(asked), 1)
        self.assertEqual(sorted(asked[0]["isbn13"] + asked[0]["isbn10"]),
                         ["0765311780", "9780765326355", "9780765391162", "9999999999999"])
        details = self.details()
        self.assertEqual(details["The Way of Kings"],
                         row("The Way of Kings", 386446, 1007, "https://assets.hardcover.app/wok-edition.jpg", 2010))
        self.assertEqual(details["Mistborn"],
                         row("Mistborn", 369692, 541, "https://assets.hardcover.app/mistborn-book.jpg", 2006))

    def test_a_book_with_no_isbn_matches_by_title_and_author(self):
        self.run_once()
        self.assertEqual(self.details()["Warbreaker"],
                         row("Warbreaker", 31580, 592, "https://assets.hardcover.app/warbreaker.jpg", 2009))
        self.assertIn("Warbreaker Brandon Sanderson", self.searched())

    def test_a_near_spelling_is_a_review_row_and_no_details_row(self):
        self.run_once()
        self.assertNotIn("Edgedancer Novella", self.details())
        rows = self.review()
        self.assertEqual(len(rows), 1)
        self.assertEqual({k: rows[0][k] for k in ("kind", "a", "b", "a_author", "b_author",
                                                  "b_tabs", "reason", "keep", "decision")},
                         {"kind": "book", "a": "Edgedancer Novella", "b": "Edgedancer",
                          "a_author": "Brandon Sanderson", "b_author": "Brandon Sanderson",
                          "b_tabs": "Hardcover", "reason": "hardcover", "keep": "Edgedancer", "decision": ""})
        self.assertGreaterEqual(float(rows[0]["similarity"]), eb.SIMILAR_AT)
        # A rerun proposes it once, not twice.
        self.run_once()
        self.assertEqual(len(self.review()), 1)

    def test_a_compilation_never_matches(self):
        """Arcanum Unbounded's ISBN finds a compilation, and so does its search."""
        self.run_once()
        self.assertNotIn("Arcanum Unbounded", self.details())
        self.assertNotIn("Arcanum Unbounded", [r["a"] for r in self.review()])
        self.assertNotIn("Arcanum Unbounded", [r["title"] for r in self.picks()])
        self.assertIn("Arcanum Unbounded Brandon Sanderson", self.searched())
        # Nor is a compilation ever the near spelling proposed.
        near = [eb.from_search(doc(9, "Arcanum Unbound", ["Brandon Sanderson"], compilation=True))]
        self.assertEqual(eb.decide("Arcanum Unbounded", "Brandon Sanderson", near)[0], "unmatched")

    def test_a_hand_row_is_unchanged_and_never_looked_up(self):
        hand = {"title": "The Way of Kings", "author": "Brandon Sanderson", "open_library_id": "",
                "hardcover_id": "", "page_count": "1001", "cover_url": "https://example.org/wok.jpg",
                "published_year": "2010", "source": "hand"}
        self.write_details([hand])
        self.run_once()
        self.run_once()
        self.assertEqual(self.details()["The Way of Kings"], hand)
        asked = [i for v in self.hc.kinds("editions") for i in v["isbn13"] + v["isbn10"]]
        self.assertNotIn("9780765326355", asked)
        self.assertNotIn("The Way of Kings Brandon Sanderson", self.searched())

    def test_calibre_pages_win_over_hardcovers(self):
        """The details row folds into books with Hardcover's id, and Calibre's
        #pages replace its page count (D-90): extract's half of the Check."""
        self.run_once()
        out = self.dir / "seed"
        out.mkdir()
        calibre = self.dir / "calibre_pages.csv"
        with calibre.open("w", newline="", encoding="utf-8") as fh:
            w = csv.DictWriter(fh, fieldnames=ex.CALIBRE_BOOKS_COLUMNS, restval="")
            w.writeheader()
            w.writerow({"title": "The Way of Kings", "author": "Brandon Sanderson", "pages": "1258",
                        "calibre_id": "1"})
        from test_extract import build_books
        ex.UNRESOLVED.clear()
        with mock.patch("sys.stdout", io.StringIO()):
            ex.extract_books(build_books([("The Way of Kings", "Brandon Sanderson", None, None, None),
                                          ("Mistborn", "Brandon Sanderson", None, None, None)]), out,
                             book_details=self.dir / "book_details.csv", calibre_books=calibre)
        books = {r["title"]: r for r in self.read(out / "books.csv")}
        self.assertEqual((books["The Way of Kings"]["page_count"], books["The Way of Kings"]["hardcover_id"]),
                         ("1258", "386446"))
        self.assertEqual((books["Mistborn"]["page_count"], books["Mistborn"]["hardcover_id"]), ("541", "369692"))

    def test_a_429_waits_its_retry_after_and_the_run_resumes(self):
        clock = Clock()
        calls = []

        def urlopen(req, timeout=None):
            calls.append(req)
            if len(calls) == 2:
                raise urllib.error.HTTPError(eb.API, 429, "Too Many Requests", {"Retry-After": "7"}, None)
            payload = json.loads(req.data)
            return Response(self.hc.body(payload["query"], payload["variables"]))

        with clock.patched(), mock.patch.object(eb.urllib.request, "urlopen", urlopen), \
             mock.patch.dict(os.environ, {eb.TOKEN_VAR: TOKEN}), mock.patch("sys.stdout", io.StringIO()):
            self.assertEqual(eb.main(self.argv()), 0)
        self.assertIn(7.0, clock.sleeps)
        # The refused request is asked again, and every book after it is decided.
        self.assertEqual(json.loads(calls[1].data), json.loads(calls[2].data))
        self.assertIn("Warbreaker", self.details())
        self.assertIn("Edgedancer Novella", [r["a"] for r in self.review()])

    def test_an_offline_rerun_leaves_every_sidecar_byte_identical(self):
        self.run_once()
        before = self.sidecars()
        self.assertEqual(set(before), {"book_details.csv", "book_review.csv", "hardcover_review.csv"})
        self.hc.calls.clear()
        self.assertEqual(self.run_once("--offline", token=None), 0)
        self.assertEqual(self.hc.calls, [])
        self.assertEqual(self.sidecars(), before)

    def test_without_the_token_only_offline_runs(self):
        self.run_once()
        before = self.sidecars()
        self.hc.calls.clear()
        err = io.StringIO()
        with mock.patch("sys.stderr", err):
            self.assertEqual(self.run_once(token=None), 1)
        self.assertIn("HARDCOVER_API_TOKEN", err.getvalue())
        self.assertEqual(self.hc.calls, [])
        self.assertEqual(self.sidecars(), before)
        self.assertEqual(self.run_once("--offline", token=None), 0)


class Lookup(Fake):
    """AC-2: the ISBN first, then exactly one search; the edition's pages and cover first."""

    def test_an_isbn_with_no_edition_makes_the_isbn_request_then_one_search(self):
        self.run_once()
        self.assertIn("9999999999999", self.hc.kinds("editions")[0]["isbn13"])
        self.assertEqual(self.searched().count("Elantris Brandon Sanderson"), 1)
        kinds = [k for k, _ in self.hc.calls]
        self.assertEqual(kinds[0], "editions")
        self.assertEqual(self.details()["Elantris"],
                         row("Elantris", 31581, 638, "https://assets.hardcover.app/elantris.jpg", 2005))

    def test_a_book_matched_by_isbn_makes_no_search(self):
        self.run_once()
        self.assertNotIn("The Way of Kings Brandon Sanderson", self.searched())
        self.assertNotIn("Mistborn Brandon Sanderson", self.searched())

    def test_pages_and_cover_are_the_editions_else_the_books(self):
        self.run_once()
        wok, mistborn = self.details()["The Way of Kings"], self.details()["Mistborn"]
        self.assertEqual((wok["page_count"], wok["cover_url"]),
                         ("1007", "https://assets.hardcover.app/wok-edition.jpg"))
        self.assertEqual((mistborn["page_count"], mistborn["cover_url"]),
                         ("541", "https://assets.hardcover.app/mistborn-book.jpg"))

    def test_the_report_counts_matches_by_isbn_and_by_title(self):
        out = io.StringIO()
        self.run_once(stdout=out)
        report = out.getvalue()
        self.assertIn("matched by isbn 2, title 2, picked 0", report)
        self.assertIn("ambiguous       1", report)
        self.assertIn("unmatched       2", report)
        self.assertIn("proposed        1", report)


class Requests(Fake):
    """AC-3: the rate limit, the token and User-Agent, and what runs without a token."""

    def go(self, responses, clock):
        """Run against a fake urlopen answering from the recorded fake, each
        response carrying the next of `responses`' RateLimit headers."""
        seen = []

        def urlopen(req, timeout=None):
            seen.append(req)
            payload = json.loads(req.data)
            header = responses[len(seen) - 1] if len(seen) <= len(responses) else None
            return Response(self.hc.body(payload["query"], payload["variables"]),
                            {"RateLimit": header} if header else {})

        with clock.patched(), mock.patch.object(eb.urllib.request, "urlopen", urlopen), \
             mock.patch.dict(os.environ, {eb.TOKEN_VAR: TOKEN}), mock.patch("sys.stdout", io.StringIO()):
            self.assertEqual(eb.main(self.argv()), 0)
        return seen

    def test_none_remaining_waits_until_the_reset(self):
        clock = Clock()
        self.go(['"Free";r=0;t=42, "daily";r=4231;t=51234'], clock)
        self.assertEqual(clock.sleeps[0], 42.0)
        # With tokens left, only the one-a-second pace.
        clock = Clock()
        self.dir.joinpath("cache.sqlite").unlink()
        self.go(['"Free";r=8;t=0, "daily";r=4231;t=51234'], clock)
        self.assertTrue(all(s <= eb.MIN_INTERVAL for s in clock.sleeps))

    def test_an_empty_daily_bucket_stops_the_run_and_writes_what_it_has(self):
        clock = Clock()
        out = io.StringIO()
        seen = []

        def urlopen(req, timeout=None):
            seen.append(req)
            payload = json.loads(req.data)
            return Response(self.hc.body(payload["query"], payload["variables"]),
                            {"RateLimit": '"daily";r=0;t=36000'})

        with clock.patched(), mock.patch.object(eb.urllib.request, "urlopen", urlopen), \
             mock.patch.dict(os.environ, {eb.TOKEN_VAR: TOKEN}), mock.patch("sys.stdout", out):
            self.assertEqual(eb.main(self.argv()), 0)
        self.assertEqual(len(seen), 1)
        self.assertIn("stopped: Hardcover's limit resets in 600 min", out.getvalue())
        self.assertIn("The Way of Kings", self.details())

    def test_every_request_carries_the_token_and_the_user_agent(self):
        seen = self.go([], Clock())
        self.assertEqual(len(seen), 1 + 6)     # the ISBNs, then a search for each book left
        for req in seen:
            self.assertEqual(req.full_url, "https://api.hardcover.app/v1/graphql")
            self.assertEqual(req.get_method(), "POST")
            self.assertEqual(req.get_header("Authorization"), f"Bearer {TOKEN}")
            self.assertEqual(req.get_header("User-agent"), eb.USER_AGENT)
        self.assertIn("https://github.com/jtillmanio/ledger", eb.USER_AGENT)

    def test_a_token_already_bearer_is_sent_as_is(self):
        api = eb.Hardcover(self.dir / "cache.sqlite", 10, token="Bearer abc")
        self.assertEqual(api.headers()["authorization"], "Bearer abc")

    def test_no_token_exits_naming_it_and_sends_and_writes_nothing(self):
        self.write_details([row("Mistborn", 1, 2, "", 2006)])
        self.write_review([{"kind": "book", "a": "X", "b": "Y", "a_author": "Z", "b_author": "Z",
                            "reason": "hardcover", "similarity": "0.6", "keep": "Y", "decision": ""}])
        before = self.sidecars()
        err = io.StringIO()
        with mock.patch("sys.stderr", err):
            self.assertNotEqual(self.run_once(token=None), 0)
        self.assertIn("HARDCOVER_API_TOKEN", err.getvalue())
        self.assertEqual(self.hc.calls, [])
        self.assertEqual(self.sidecars(), before)

    def test_the_token_is_read_from_env_written_with_a_space(self):
        """The owner's .env writes `HARDCOVER_API_TOKEN ="..."`."""
        env = self.dir / "test.env"
        env.write_text('HARDCOVER_API_TOKEN ="from-the-file"\n', encoding="utf-8")
        with mock.patch.dict(os.environ):
            os.environ.pop(eb.TOKEN_VAR, None)
            self.assertEqual(eb.token(env), "from-the-file")

    def test_dry_run_with_the_token_writes_nothing(self):
        self.write_details([row("Mistborn", 1, 2, "", 2006)])
        self.write_review([{"kind": "book", "a": "X", "b": "Y", "a_author": "Z", "b_author": "Z",
                            "reason": "open library", "similarity": "0.6", "keep": "Y", "decision": ""}])
        before = self.sidecars()
        out = []
        with mock.patch("builtins.print", lambda *a, **k: out.append(" ".join(map(str, a)))):
            self.assertEqual(self.run_once("--dry-run"), 0)
        self.assertTrue(self.hc.calls)
        self.assertEqual(self.sidecars(), before)
        self.assertFalse((self.dir / "hardcover_review.csv").exists())
        report = "\n".join(out)
        for word in ("match rate", "matched by isbn", "proposed", "ambiguous", "unmatched"):
            self.assertIn(word, report)

    def test_dry_run_takes_100_books_unless_told(self):
        self.write_books([(f"Book {n}", "Brandon Sanderson") for n in range(150)])
        self.run_once("--dry-run")
        self.assertEqual(len(self.searched()), 100)


class Replace(Fake):
    """AC-4: 1.14's Open Library rows go; hand rows and decisions stay."""

    OPEN_LIBRARY = {"kind": "book", "a": "Elantris", "b": "Elantris (Tenth Anniversary)",
                    "a_author": "Brandon Sanderson", "b_author": "Brandon Sanderson", "a_tabs": "",
                    "b_tabs": "Open Library", "reason": "open library", "similarity": "0.55",
                    "keep": "Elantris (Tenth Anniversary)", "decision": ""}

    def test_open_library_rows_go_and_hand_and_decided_rows_stay(self):
        hand = {"title": "Warbreaker", "author": "Brandon Sanderson", "open_library_id": "OL1W",
                "hardcover_id": "", "page_count": "600", "cover_url": "", "published_year": "2009",
                "source": "hand"}
        self.write_details([
            {"title": "Mistborn", "author": "Brandon Sanderson", "open_library_id": "OL15358692W",
             "hardcover_id": "", "page_count": "541", "cover_url": "", "published_year": "2006",
             "source": "openlibrary"},
            {"title": "Nothing Like It", "author": "Brandon Sanderson", "open_library_id": "OL9W",
             "hardcover_id": "", "page_count": "100", "cover_url": "", "published_year": "1999",
             "source": "openlibrary"},
            hand])
        decided = {**self.OPEN_LIBRARY, "a": "Mistborn", "b": "Mistborn: The Final Empire",
                   "keep": "Mistborn", "decision": "separate"}
        self.write_review([self.OPEN_LIBRARY, decided])
        self.run_once()
        details = self.details()
        self.assertNotIn("openlibrary", {r["source"] for r in details.values()})
        # Hardcover's row replaces Mistborn's; Nothing Like It has none now.
        self.assertEqual(details["Mistborn"]["source"], "hardcover")
        self.assertNotIn("Nothing Like It", details)
        self.assertEqual(details["Warbreaker"], hand)
        reasons = [(r["a"], r["reason"], r["decision"]) for r in self.review()]
        self.assertIn(("Mistborn", "open library", "separate"), reasons)
        self.assertNotIn(("Elantris", "open library", ""), reasons)
        self.assertEqual([r for r in self.review() if r["a"] == "Mistborn"][0], decided)

    def test_a_stopped_run_keeps_the_open_library_rows_it_didnt_reach(self):
        """Schema review: a run that stops early never empties the sidecar.
        It stops at Warbreaker; Mistborn was reached, Nothing Like It wasn't."""
        ol = {"title": "Nothing Like It", "author": "Brandon Sanderson", "open_library_id": "OL9W",
              "hardcover_id": "", "page_count": "100", "cover_url": "", "published_year": "1999",
              "source": "openlibrary"}
        self.write_details([{**ol, "title": "Mistborn", "open_library_id": "OL2W"}, ol])
        self.hc.fail_at = 3
        self.run_once()
        details = self.details()
        self.assertEqual(details["Mistborn"]["source"], "hardcover")
        self.assertEqual(details["Nothing Like It"], ol)
        # The run that reaches it leaves none.
        self.hc.fail_at = None
        self.run_once()
        self.assertNotIn("openlibrary", {r["source"] for r in self.details().values()})

    def test_a_failed_lookup_never_erases_a_hardcover_row(self):
        kept = row("Nothing Like It", 77, 100, "", 1999)
        self.write_details([kept])
        self.run_once()
        self.assertEqual(self.details()["Nothing Like It"], kept)

    def test_accepted_rename_rekeys_the_details_row(self):
        """The owner accepts the Hardcover spelling: extract renames the book,
        and the next run moves its details row (a hand one here, which no
        lookup would ever rewrite) to the new title."""
        self.run_once()
        rows = self.review()
        rows[0]["decision"] = "merge"
        self.write_review(rows)
        hand = {"title": "Edgedancer Novella", "author": "Brandon Sanderson", "open_library_id": "",
                "hardcover_id": "", "page_count": "300", "cover_url": "", "published_year": "",
                "source": "hand"}
        self.write_details([hand])
        # What extract loads after the accept.
        self.write_books([("Edgedancer", "Brandon Sanderson")])
        self.run_once()
        details = self.details()
        self.assertNotIn("Edgedancer Novella", details)
        self.assertEqual(details["Edgedancer"], {**hand, "title": "Edgedancer"})


class Ambiguous(Fake):
    """Q3 at the plan gate (owner, 2026-10-30): two matching books are the
    owner's pick in hardcover_review.csv, never ranked."""

    def test_two_matches_write_their_candidates_and_no_details(self):
        self.run_once()
        self.assertNotIn("White Sand", self.details())
        rows = self.picks()
        self.assertEqual([(r["title"], r["hardcover_id"], r["readers"], r["decision"]) for r in rows],
                         [("White Sand", "42", "4000", ""), ("White Sand", "41", "900", "")])
        self.assertEqual(rows[0]["url"], "https://hardcover.app/books/white-sand")
        self.assertEqual(list(rows[0]), eb.REVIEW_COLUMNS)

    def test_a_pick_matches_on_the_next_run(self):
        self.run_once()
        rows = self.picks()
        rows[1]["decision"] = "pick"           # the one with fewer readers
        self.write("hardcover_review.csv", eb.REVIEW_COLUMNS, rows)
        self.run_once()
        self.assertEqual(self.details()["White Sand"]["hardcover_id"], "41")
        self.assertEqual([(r["hardcover_id"], r["decision"]) for r in self.picks()], [("41", "pick")])

    def test_two_picks_match_nothing_and_say_so(self):
        self.run_once()
        rows = [{**r, "decision": "pick"} for r in self.picks()]
        self.write("hardcover_review.csv", eb.REVIEW_COLUMNS, rows)
        out = io.StringIO()
        self.run_once(stdout=out)
        self.assertNotIn("White Sand", self.details())
        self.assertIn("2 rows picked", out.getvalue())

    def test_a_rekey_never_doubles_a_picked_row(self):
        """Two spellings' picks of one Hardcover book, brought together by a
        merge, are one row."""
        pick = {"title": "White Sand", "author": "Brandon Sanderson", "hardcover_id": "41",
                "hardcover_title": "White Sand", "hardcover_authors": "Brandon Sanderson", "year": "2016",
                "readers": "900", "url": "", "decision": "pick"}
        self.write("hardcover_review.csv", eb.REVIEW_COLUMNS, [{**pick, "title": "White Sand Novella"}, pick])
        self.write_review([{"kind": "book", "a": "White Sand Novella", "b": "White Sand",
                            "a_author": "Brandon Sanderson", "b_author": "Brandon Sanderson",
                            "reason": "same title", "similarity": "0.7", "keep": "White Sand",
                            "decision": "merge"}])
        self.run_once()
        self.assertEqual([(r["title"], r["hardcover_id"], r["decision"]) for r in self.picks()],
                         [("White Sand", "41", "pick")])
        self.assertEqual(self.details()["White Sand"]["hardcover_id"], "41")

    def test_one_isbn_under_two_books_is_ambiguous_too(self):
        two = [edition(1, hc_book(51, "Oathbringer", ["Brandon Sanderson"], 1248), isbn13="9780765326379"),
               edition(2, hc_book(52, "Oathbringer", ["Brandon Sanderson"], 1220), isbn13="9780765326379")]
        self.hc = FakeHardcover(editions={**EDITIONS, "9780765326379": two})
        self.write_books([("Oathbringer", "Brandon Sanderson", "9")])
        self.write_calibre({"9": "9780765326379"})
        self.run_once()
        self.assertNotIn("Oathbringer", self.details())
        self.assertEqual(sorted(r["hardcover_id"] for r in self.picks()), ["51", "52"])
        self.assertEqual(self.searched(), [])


class Matching(Fake):
    """Q1 at the plan gate, and 1.14's rules kept."""

    def test_reordered_words_are_never_proposed(self):
        """Two books that score 1.00 (owner, 2026-10-30)."""
        title, theirs = "Of Darkness and Dawn", "Of Dawn and Darkness"
        self.assertEqual(ex.trgm_similarity(title, theirs), 1.0)
        records = [eb.from_search(doc(1, theirs, ["Someone"]))]
        self.assertEqual(eb.decide(title, "Someone", records)[0], "unmatched")

    def test_a_subtitle_in_its_own_field_still_matches(self):
        records = [eb.from_search(doc(1, "Zealot", ["Reza Aslan"], subtitle="The Life and Times of Jesus of Nazareth"))]
        self.assertEqual(eb.decide("Zealot: The Life and Times of Jesus of Nazareth", "Reza Aslan", records)[0],
                         "matched")
        self.assertEqual(eb.decide("Zealot", "Reza Aslan", records)[0], "matched")

    def test_a_pair_under_half_is_not_proposed_unless_it_is_a_subtitle(self):
        """D-92: 0.4 to 0.5 is series-pattern territory; a `: subtitle` is the
        same book however low it scores."""
        title, theirs = "The Bone House", "The Bone House (Bright Empires #2)"
        self.assertTrue(ex.SIMILAR_AT <= ex.trgm_similarity(title, theirs) < eb.SIMILAR_AT)
        records = [eb.from_search(doc(1, theirs, ["Stephen R. Lawhead"]))]
        self.assertEqual(eb.decide(title, "Stephen R. Lawhead", records)[0], "unmatched")
        title, theirs = "Good Omens", "Good Omens: The Nice and Accurate Prophecies of Agnes Nutter, Witch"
        records = [eb.from_search(doc(2, theirs, ["Terry Pratchett"]))]
        self.assertEqual(eb.decide(title, "Terry Pratchett", records)[0], "proposed")

    def test_a_title_the_console_cannot_print_does_not_stop_the_run(self):
        """A redirected Windows console is cp1252; Hardcover has titles with
        characters it lacks (ʻ). The report prints them as ? and the CSVs are written."""
        self.hc.searches = {**SEARCHES, "Hawaiʻi Book Brandon Sanderson":
                            results(doc(9, "Hawaiʻi Book Two", ["Someone Else"]))}
        self.write_books([("Hawaiʻi Book", "Brandon Sanderson"), ("The Way of Kings", "Brandon Sanderson", "1")])
        stream = io.TextIOWrapper(io.BytesIO(), encoding="cp1252")
        with mock.patch.dict(os.environ, {eb.TOKEN_VAR: TOKEN}), \
             mock.patch.object(eb.Hardcover, "_fetch", self.hc.fetch), mock.patch("sys.stdout", stream):
            self.assertEqual(eb.main(self.argv()), 0)
        self.assertIn("The Way of Kings", self.details())

    def test_an_authorless_book_is_not_looked_up(self):
        self.write_books([("Mistborn", None, "2")])
        self.run_once()
        self.assertEqual(self.hc.calls, [])

    def test_isbns_lose_their_hyphens_and_anything_else_is_none(self):
        self.assertEqual(eb.normal_isbn("978-0-7653-2635-5"), "9780765326355")
        self.assertEqual(eb.normal_isbn("0-8044-2957-x"), "080442957X")
        self.assertEqual(eb.normal_isbn("B00ABC1234"), "")
        self.assertEqual(eb.normal_isbn(""), "")


class Cache(Fake):
    """A warm cache is free, an interrupted run resumes (1.14 AC-2, kept)."""

    def test_warm_cache_makes_no_requests(self):
        self.run_once()
        self.assertEqual(len(self.hc.calls), 7)
        self.hc.calls.clear()
        self.run_once()
        self.assertEqual(self.hc.calls, [])
        self.assertIn("The Way of Kings", self.details())

    def test_interrupted_run_resumes_from_the_cache(self):
        self.hc.fail_at = 3
        self.run_once()
        done = list(self.hc.calls)
        self.assertEqual(len(done), 3)
        # What finished before the interrupt is written.
        self.assertIn("The Way of Kings", self.details())
        self.hc.fail_at = None
        self.hc.calls.clear()
        self.run_once()
        self.assertEqual(len(self.hc.calls), 4)
        self.assertFalse([c for c in self.hc.calls if c in done], "a completed lookup was repeated")

    def test_each_isbn_is_cached_on_its_own(self):
        """A later run with one more book asks only for the new ISBN."""
        self.run_once()
        self.write_books(BOOKS + [("Oathbringer", "Brandon Sanderson", "9")])
        self.write_calibre({**ISBNS, "9": "9780765326379"})
        self.hc.calls.clear()
        self.run_once()
        self.assertEqual(self.hc.kinds("editions"), [{"isbn13": ["9780765326379"], "isbn10": []}])


# --------------------------------------------------------------------------
# a clock and responses for the HTTP layer
# --------------------------------------------------------------------------

class Clock:
    """time.monotonic and time.sleep, patched: a sleep moves the clock and is recorded."""

    def __init__(self):
        self.now = 1000.0
        self.sleeps: list[float] = []

    def sleep(self, seconds):
        self.sleeps.append(round(seconds, 3))
        self.now += seconds

    def patched(self):
        clock = self

        class Both:
            def __enter__(self):
                self.a = mock.patch.object(eb.time, "monotonic", lambda: clock.now)
                self.b = mock.patch.object(eb.time, "sleep", clock.sleep)
                self.a.start()
                self.b.start()

            def __exit__(self, *exc):
                self.b.stop()
                self.a.stop()
                return False

        return Both()


class Response:
    def __init__(self, body: str, headers: dict | None = None):
        self.body = body.encode()
        self.headers = headers or {}

    def read(self):
        return self.body

    def __enter__(self):
        return self

    def __exit__(self, *exc):
        return False


if __name__ == "__main__":
    unittest.main()
