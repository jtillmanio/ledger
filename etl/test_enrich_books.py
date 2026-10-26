"""Tests for etl/enrich_books.py (task 1.14). No network: Open Library is faked
with recorded search responses, trimmed to the fields the matching reads.

    py -m unittest discover -s etl -p "test_*.py"
"""

import csv
import json
import sys
import tempfile
import unittest
from pathlib import Path
from unittest import mock

sys.path.insert(0, str(Path(__file__).parent))
import enrich_books as eb  # noqa: E402
import extract as ex  # noqa: E402


def doc(key, title, authors, pages=None, cover=None, year=None):
    """One work as search.json returns it with fields=*."""
    return {"key": f"/works/{key}", "title": title, "author_name": authors,
            "number_of_pages_median": pages, "cover_i": cover, "first_publish_year": year,
            "isbn": ["9780765326355"], "edition_count": 3}


def page(*docs):
    return {"numFound": len(docs), "start": 0, "docs": list(docs)}


# title -> the response search.json gave for it with the book's author.
RESPONSES = {
    "The Way of Kings": page(
        doc("OL15358691W", "The Way of Kings", ["Brandon Sanderson"], 1008, 14658316, 2010),
        doc("OL22983697W", "The Way of Kings, Part One", ["Brandon Sanderson"], 528, 10504789, 2011)),
    # A near spelling: the workbook's title adds a word to Open Library's.
    "Edgedancer Novella": page(
        doc("OL19356251W", "Edgedancer", ["Brandon Sanderson"], 272, 8231990, 2016)),
    # Two works with exactly the book's title and author: never picked between.
    "Elantris": page(
        doc("OL5738148W", "Elantris", ["Brandon Sanderson"], 638, 8264400, 2005),
        doc("OL27448W", "Elantris", ["Brandon Sanderson"], 492, None, 2005)),
    "Nothing Like It": page(
        doc("OL1W", "A Different Book", ["Someone Else"], 100, None, 1999)),
    "Mistborn": page(
        doc("OL15358692W", "Mistborn", ["Brandon Sanderson"], 541, 9283214, 2006)),
}


class Fake(unittest.TestCase):
    """A catalog in seed/ form, a temp sidecar dir, and a fake Open Library."""

    BOOKS = [("The Way of Kings", "Brandon Sanderson"), ("Edgedancer Novella", "Brandon Sanderson"),
             ("Elantris", "Brandon Sanderson"), ("Nothing Like It", "Brandon Sanderson")]

    def setUp(self):
        self.dir = Path(tempfile.mkdtemp())
        self.write_books(self.BOOKS)
        self.fetched: list[str] = []
        self.fail_at: int | None = None

    def write_books(self, books):
        authors = {}
        with (self.dir / "books.csv").open("w", newline="", encoding="utf-8") as fh:
            w = csv.writer(fh)
            w.writerow(["id", "title", "author_id", "series_id", "series_position", "genre",
                        "book_type", "word_count", "word_count_source", "published_year"])
            for title, author in books:
                aid = ex.slug(author) if author else ""
                if author:
                    authors[aid] = author
                w.writerow([ex.slug(title, author or ""), title, aid, "", "", "", "Novel", "", "", ""])
        with (self.dir / "authors.csv").open("w", newline="", encoding="utf-8") as fh:
            w = csv.writer(fh)
            w.writerow(["id", "name"])
            w.writerows(authors.items())

    def fake_fetch(self, url, attempt=1):
        if self.fail_at is not None and len(self.fetched) == self.fail_at:
            raise KeyboardInterrupt
        self.fetched.append(url)
        title = dict(eb.urllib.parse.parse_qsl(url.split("?", 1)[1]))["title"]
        return json.dumps(RESPONSES.get(title, page()))

    def run_once(self, *extra):
        argv = ["--books", str(self.dir / "books.csv"), "--authors", str(self.dir / "authors.csv"),
                "--out", str(self.dir / "book_details.csv"),
                "--book-review", str(self.dir / "book_review.csv"),
                "--cache", str(self.dir / "cache.sqlite"), *extra]
        with mock.patch.object(eb.OpenLibrary, "_fetch", self.fake_fetch), mock.patch("sys.stdout"):
            return eb.main(argv)

    def details(self) -> dict[str, dict]:
        with (self.dir / "book_details.csv").open(newline="", encoding="utf-8") as fh:
            return {r["title"]: r for r in csv.DictReader(fh)}

    def write_details(self, rows):
        with (self.dir / "book_details.csv").open("w", newline="", encoding="utf-8") as fh:
            w = csv.DictWriter(fh, fieldnames=eb.DETAIL_COLUMNS)
            w.writeheader()
            w.writerows(rows)

    def review(self) -> list[dict]:
        path = self.dir / "book_review.csv"
        if not path.exists():
            return []
        with path.open(newline="", encoding="utf-8") as fh:
            return list(csv.DictReader(fh))

    def write_review(self, rows):
        with (self.dir / "book_review.csv").open("w", newline="", encoding="utf-8") as fh:
            w = csv.DictWriter(fh, fieldnames=ex.BOOK_REVIEW_COLUMNS)
            w.writeheader()
            w.writerows(rows)


class Matching(Fake):
    """The roadmap Check's enrich cases (task 1.14 AC-1)."""

    def test_exact_match_fills_page_count_cover_and_id(self):
        self.assertEqual(self.run_once(), 0)
        row = self.details()["The Way of Kings"]
        self.assertEqual(row, {"title": "The Way of Kings", "author": "Brandon Sanderson",
                               "open_library_id": "OL15358691W", "page_count": "1008",
                               "cover_url": "https://covers.openlibrary.org/b/id/14658316-L.jpg",
                               "published_year": "2010", "source": "openlibrary"})

    def test_near_spelling_writes_a_review_row_and_no_details(self):
        self.run_once()
        self.assertNotIn("Edgedancer Novella", self.details())
        rows = self.review()
        self.assertEqual(len(rows), 1)
        self.assertEqual({k: rows[0][k] for k in ("kind", "a", "b", "a_author", "b_author",
                                                  "b_tabs", "reason", "keep", "decision")},
                         {"kind": "book", "a": "Edgedancer Novella", "b": "Edgedancer",
                          "a_author": "Brandon Sanderson", "b_author": "Brandon Sanderson",
                          "b_tabs": "Open Library", "reason": "open library",
                          "keep": "Edgedancer", "decision": ""})
        self.assertGreaterEqual(float(rows[0]["similarity"]), ex.SIMILAR_AT)
        # A rerun proposes it once, not twice.
        self.run_once()
        self.assertEqual(len(self.review()), 1)

    def test_two_candidate_works_match_nothing(self):
        self.run_once()
        self.assertNotIn("Elantris", self.details())
        self.assertNotIn("Elantris", [r["a"] for r in self.review()])

    def test_a_different_book_by_someone_else_is_unmatched(self):
        self.run_once()
        self.assertNotIn("Nothing Like It", self.details())
        self.assertEqual([r["a"] for r in self.review()], ["Edgedancer Novella"])

    def test_hand_row_survives_a_rerun(self):
        hand = {"title": "The Way of Kings", "author": "Brandon Sanderson", "open_library_id": "",
                "page_count": "1001", "cover_url": "https://example.org/wok.jpg",
                "published_year": "2010", "source": "hand"}
        self.write_details([hand])
        self.run_once()
        self.run_once()
        self.assertEqual(self.details()["The Way of Kings"], hand)
        # A hand row is never looked up at all.
        self.assertFalse(any("Way+of+Kings" in u for u in self.fetched))

    def test_a_failed_lookup_never_erases_a_row(self):
        kept = {"title": "Elantris", "author": "Brandon Sanderson", "open_library_id": "OL5738148W",
                "page_count": "638", "cover_url": "", "published_year": "2005", "source": "openlibrary"}
        self.write_details([kept])
        self.run_once()
        self.assertEqual(self.details()["Elantris"], kept)

    def test_accepted_rename_rekeys_the_details_row(self):
        """The owner accepts the Open Library spelling: extract renames the book,
        and the next enrich run moves its details row (a hand one here, which no
        lookup would ever rewrite) to the new title."""
        self.run_once()
        rows = self.review()
        rows[0]["decision"] = "merge"
        self.write_review(rows)
        hand = {"title": "Edgedancer Novella", "author": "Brandon Sanderson", "open_library_id": "",
                "page_count": "300", "cover_url": "", "published_year": "", "source": "hand"}
        self.write_details([hand])
        # What extract loads after the accept.
        self.write_books([("Edgedancer", "Brandon Sanderson")])
        self.run_once()
        details = self.details()
        self.assertNotIn("Edgedancer Novella", details)
        self.assertEqual(details["Edgedancer"], {**hand, "title": "Edgedancer"})

    def test_initials_are_spaced_in_the_query_and_still_match(self):
        """Open Library finds nothing for `author=S.A. Chakraborty`, and the
        work for `S. A. Chakraborty`."""
        url = eb.OpenLibrary.search_url("The City of Brass", "S.A. Chakraborty")
        self.assertEqual(dict(eb.urllib.parse.parse_qsl(url.split("?", 1)[1]))["author"],
                         "S. A. Chakraborty")
        works = [doc("OL1W", "The City of Brass", ["S. A. Chakraborty"], 533, None, 2017)]
        self.assertEqual(eb.decide("The City of Brass", "S.A. Chakraborty", works)[0], "matched")

    def test_a_title_the_console_cannot_print_does_not_stop_the_run(self):
        """A redirected Windows console is cp1252; Open Library has titles with
        characters it lacks (ʻ). The report prints them as ? and the CSVs are written."""
        import io
        RESPONSES["Hawaiʻi Book"] = page(doc("OL9W", "Hawaiʻi Book Two", ["Someone Else"]))
        self.addCleanup(RESPONSES.pop, "Hawaiʻi Book")
        self.write_books([("Hawaiʻi Book", "Brandon Sanderson"), ("The Way of Kings", "Brandon Sanderson")])
        stream = io.TextIOWrapper(io.BytesIO(), encoding="cp1252")
        argv = ["--books", str(self.dir / "books.csv"), "--authors", str(self.dir / "authors.csv"),
                "--out", str(self.dir / "book_details.csv"),
                "--book-review", str(self.dir / "book_review.csv"),
                "--cache", str(self.dir / "cache.sqlite")]
        with mock.patch.object(eb.OpenLibrary, "_fetch", self.fake_fetch), \
             mock.patch("sys.stdout", stream):
            self.assertEqual(eb.main(argv), 0)
        self.assertIn("The Way of Kings", self.details())

    def test_an_authorless_book_is_not_looked_up(self):
        self.write_books([("Mistborn", None)])
        self.run_once()
        self.assertEqual(self.fetched, [])

    def test_dry_run_reports_match_rate_and_writes_nothing(self):
        out = []
        with mock.patch("builtins.print", lambda *a, **k: out.append(" ".join(map(str, a)))):
            self.assertEqual(self.run_once("--dry-run"), 0)
        self.assertFalse((self.dir / "book_details.csv").exists())
        self.assertFalse((self.dir / "book_review.csv").exists())
        report = "\n".join(out)
        self.assertIn("match rate", report)
        self.assertIn("25%", report)            # 1 of 4 looked up
        self.assertIn("proposed", report)
        self.assertIn("ambiguous", report)
        self.assertIn("unmatched", report)

    def test_dry_run_takes_100_books_unless_told(self):
        self.write_books([(f"Book {n}", "Brandon Sanderson") for n in range(150)])
        self.run_once("--dry-run")
        self.assertEqual(len(self.fetched), 100)


class Cache(Fake):
    """Task 1.14 AC-2: a warm cache is free, an interrupted run resumes."""

    def test_warm_cache_makes_no_requests(self):
        self.run_once()
        self.assertEqual(len(self.fetched), 4)
        self.fetched.clear()
        self.run_once()
        self.assertEqual(self.fetched, [])
        self.assertIn("The Way of Kings", self.details())

    def test_interrupted_run_resumes_from_the_cache(self):
        self.fail_at = 2
        self.run_once()
        done = list(self.fetched)
        self.assertEqual(len(done), 2)
        # What finished before the interrupt is written.
        self.assertIn("The Way of Kings", self.details())
        self.fail_at = None
        self.fetched.clear()
        self.run_once()
        self.assertEqual(len(self.fetched), 2)
        self.assertFalse(set(done) & set(self.fetched), "a completed lookup was repeated")

    def test_every_request_carries_the_user_agent(self):
        seen = []

        class Response:
            def __init__(self, body):
                self.body = body

            def read(self):
                return self.body

            def __enter__(self):
                return self

            def __exit__(self, *exc):
                return False

        def urlopen(req, timeout=None):
            seen.append(req)
            title = dict(eb.urllib.parse.parse_qsl(req.full_url.split("?", 1)[1]))["title"]
            return Response(json.dumps(RESPONSES.get(title, page())).encode())

        argv = ["--books", str(self.dir / "books.csv"), "--authors", str(self.dir / "authors.csv"),
                "--out", str(self.dir / "book_details.csv"),
                "--book-review", str(self.dir / "book_review.csv"),
                "--cache", str(self.dir / "cache.sqlite")]
        with mock.patch.object(eb.urllib.request, "urlopen", urlopen), \
             mock.patch.object(eb, "MIN_INTERVAL", 0), mock.patch("sys.stdout"):
            self.assertEqual(eb.main(argv), 0)
        self.assertEqual(len(seen), 4)
        for req in seen:
            self.assertEqual(req.get_header("User-agent"), eb.USER_AGENT)
            self.assertTrue(req.full_url.startswith("https://openlibrary.org/search.json?"))
            self.assertIn("fields=*", req.full_url)
        self.assertIn("ledger", eb.USER_AGENT)
        self.assertIn("https://github.com/jtillmanio/ledger", eb.USER_AGENT)


if __name__ == "__main__":
    unittest.main()
