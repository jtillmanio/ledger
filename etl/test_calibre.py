"""Tests for etl/calibre.py and extract's Calibre fold-in (task 1.18, D-73, D-83).
No network: the Calibre library is a fixture metadata.db each test builds with
sqlite3, and Open Library is faked with recorded search responses.

    py -m unittest discover -s etl -p "test_*.py"
"""

import csv
import io
import json
import os
import sqlite3
import sys
import tempfile
import unittest
from contextlib import redirect_stdout
from pathlib import Path
from unittest import mock

sys.path.insert(0, str(Path(__file__).parent))
import calibre as cal  # noqa: E402
import enrich_books as eb  # noqa: E402
import extract as ex  # noqa: E402
from test_extract import build_books  # noqa: E402

REPO = Path(__file__).resolve().parent.parent


# --------------------------------------------------------------------------
# a Calibre library, as metadata.db stores one
# --------------------------------------------------------------------------

def book(title, *authors, series=None, index=1.0, isbn=None, tags=(), words=None,
         read=None, date=None, kind=None):
    """One Calibre record. `date` is the stored UTC text, as Calibre writes it."""
    return {"title": title, "authors": list(authors) or ["Unknown"], "series": series,
            "index": index, "isbn": isbn, "tags": list(tags), "words": words,
            "read": read, "date": date, "type": kind}


def build_library(folder: Path, books: list[dict], words=("words", 3), date=("date_read", 6),
                  date_format="dd MMM yyyy", read=("read", 1), kind=("type", 15),
                  extra_columns=()) -> Path:
    """A metadata.db with Calibre's tables (the ones calibre.py reads). Each
    custom column is (lookup name without '#', its custom_column_N number), so
    a test can put one at another number; None leaves it out."""
    folder.mkdir(parents=True, exist_ok=True)
    path = folder / "metadata.db"
    if path.exists():
        path.unlink()
    db = sqlite3.connect(path)
    db.executescript("""
        CREATE TABLE books (id INTEGER PRIMARY KEY, title TEXT NOT NULL, sort TEXT,
                            series_index REAL NOT NULL DEFAULT 1.0, path TEXT NOT NULL DEFAULT '');
        CREATE TABLE authors (id INTEGER PRIMARY KEY, name TEXT NOT NULL UNIQUE, sort TEXT);
        CREATE TABLE books_authors_link (id INTEGER PRIMARY KEY, book INTEGER, author INTEGER);
        CREATE TABLE series (id INTEGER PRIMARY KEY, name TEXT NOT NULL UNIQUE);
        CREATE TABLE books_series_link (id INTEGER PRIMARY KEY, book INTEGER, series INTEGER);
        CREATE TABLE identifiers (id INTEGER PRIMARY KEY, book INTEGER, type TEXT, val TEXT);
        CREATE TABLE tags (id INTEGER PRIMARY KEY, name TEXT NOT NULL UNIQUE);
        CREATE TABLE books_tags_link (id INTEGER PRIMARY KEY, book INTEGER, tag INTEGER);
        CREATE TABLE comments (id INTEGER PRIMARY KEY, book INTEGER, text TEXT);
        CREATE TABLE custom_columns (id INTEGER PRIMARY KEY, label TEXT NOT NULL, name TEXT,
                                     datatype TEXT NOT NULL, is_multiple BOOL DEFAULT 0,
                                     normalized BOOL NOT NULL, display TEXT DEFAULT '{}');
    """)

    def column(spec, datatype, normalized=False, display=None):
        if spec is None:
            return None
        label, n = spec
        db.execute("INSERT INTO custom_columns (id, label, name, datatype, normalized, display) "
                   "VALUES (?, ?, ?, ?, ?, ?)",
                   (n, label, label.title(), datatype, normalized, json.dumps(display or {})))
        if normalized:
            db.execute(f"CREATE TABLE custom_column_{n} (id INTEGER PRIMARY KEY, value TEXT UNIQUE)")
            db.execute(f"CREATE TABLE books_custom_column_{n}_link "
                       "(id INTEGER PRIMARY KEY, book INTEGER, value INTEGER)")
        else:
            db.execute(f"CREATE TABLE custom_column_{n} (id INTEGER PRIMARY KEY, book INTEGER, value)")
        return n

    cols = {"words": column(words, "int"), "read": column(read, "bool"),
            "date": column(date, "datetime", display={"date_format": date_format}),
            "type": column(kind, "enumeration", normalized=True)}
    for spec in extra_columns:
        column(spec, "int")

    def ident(table, name):
        row = db.execute(f"SELECT id FROM {table} WHERE name = ?", (name,)).fetchone()
        if row:
            return row[0]
        return db.execute(f"INSERT INTO {table} (name) VALUES (?)", (name,)).lastrowid

    for b in books:
        bid = db.execute("INSERT INTO books (title, series_index) VALUES (?, ?)",
                         (b["title"], b["index"])).lastrowid
        for name in b["authors"]:
            db.execute("INSERT INTO books_authors_link (book, author) VALUES (?, ?)",
                       (bid, ident("authors", name)))
        if b["series"]:
            db.execute("INSERT INTO books_series_link (book, series) VALUES (?, ?)",
                       (bid, ident("series", b["series"])))
        if b["isbn"]:
            db.execute("INSERT INTO identifiers (book, type, val) VALUES (?, 'isbn', ?)", (bid, b["isbn"]))
        for tag in b["tags"]:
            db.execute("INSERT INTO books_tags_link (book, tag) VALUES (?, ?)", (bid, ident("tags", tag)))
        db.execute("INSERT INTO comments (book, text) VALUES (?, ?)", (bid, f"<p>About {b['title']}</p>"))
        for field in ("words", "read", "date"):
            if cols[field] and b[field] is not None:
                db.execute(f"INSERT INTO custom_column_{cols[field]} (book, value) VALUES (?, ?)",
                           (bid, b[field]))
        if cols["type"]:
            n = cols["type"]
            db.execute(f"INSERT OR IGNORE INTO custom_column_{n} (value) VALUES (?)", (b["type"] or "Book",))
            vid = db.execute(f"SELECT id FROM custom_column_{n} WHERE value = ?", (b["type"] or "Book",)).fetchone()[0]
            db.execute(f"INSERT INTO books_custom_column_{n}_link (book, value) VALUES (?, ?)", (bid, vid))
    db.commit()
    db.close()
    return path


# --------------------------------------------------------------------------
# Open Library, recorded
# --------------------------------------------------------------------------

def doc(key, title, authors, series=None, position=None, isbn=()):
    """One work as search.json returns it with fields=*: the series fields are
    lists, as Open Library sends them."""
    d = {"key": f"/works/{key}", "title": title, "author_name": authors,
         "number_of_pages_median": 400, "first_publish_year": 2010, "isbn": list(isbn)}
    if series:
        d["series_name"] = [series]
        d["series_position"] = [position] if position else []
    return d


def page(*docs):
    return {"numFound": len(docs), "start": 0, "docs": list(docs)}


RESPONSES = {
    # Open Library agrees with Calibre's series and index.
    "The Way of Kings": page(doc("OL15358691W", "The Way of Kings", ["Brandon Sanderson"],
                                 "The Stormlight Archive", "1", isbn=["9780765326355"])),
    # Open Library contradicts Calibre's series.
    "Mistborn": page(doc("OL15358692W", "Mistborn", ["Brandon Sanderson"], "Mistborn Saga", "1")),
    # Open Library knows the work but has no series for it.
    "Warbreaker": page(doc("OL5738148W", "Warbreaker", ["Brandon Sanderson"])),
}

MASTER = [("The Way of Kings", "Brandon Sanderson", None, "Fantasy", None),
          ("Mistborn", "Brandon Sanderson", None, "Fantasy", 214000)]


class Case(unittest.TestCase):
    """A workbook, a Calibre library, the sidecars, a seed, and a fake Open Library."""

    def setUp(self):
        ex.UNRESOLVED.clear()
        self.dir = Path(tempfile.mkdtemp())
        self.lib = self.dir / "Calibre Library"
        self.seed = self.dir / "seed"
        self.data = self.dir / "data"
        self.data.mkdir()
        self.seed.mkdir()
        self.books_csv = self.data / "calibre_books.csv"
        self.book_review = self.data / "book_review.csv"
        self.workbook = build_books(MASTER)
        self.fetched: list[str] = []
        self.output = ""
        self.unresolved: list[dict] = []

    # -- running ------------------------------------------------------------

    def fake_fetch(self, url, attempt=1):
        self.fetched.append(url)
        title = dict(eb.urllib.parse.parse_qsl(url.split("?", 1)[1]))["title"]
        return json.dumps(RESPONSES.get(title, page()))

    def argv(self, *extra, library=True) -> list[str]:
        argv = ["--env", str(self.dir / "absent.env"), "--seed", str(self.seed),
                "--calibre-books", str(self.books_csv), "--book-review", str(self.book_review),
                "--cache", str(self.dir / "cache.sqlite"), *extra]
        return ["--library", str(self.lib), *argv] if library else argv

    def calibre(self, *extra, library=True):
        buf = io.StringIO()
        with mock.patch.object(eb.OpenLibrary, "_fetch", self.fake_fetch), redirect_stdout(buf):
            code = cal.main(self.argv(*extra, library=library))
        self.output = buf.getvalue()
        return code

    def extract(self):
        ex.UNRESOLVED.clear()
        with redirect_stdout(io.StringIO()):
            ex.extract_books(self.workbook, self.seed, book_review=self.book_review,
                             calibre_books=self.books_csv)
        self.unresolved = list(ex.UNRESOLVED)

    def round(self, *extra):
        """What the owner runs: extract, calibre, extract."""
        self.extract()
        self.assertEqual(self.calibre(*extra), 0)
        self.extract()

    # -- reading ------------------------------------------------------------

    def rows(self, path: Path) -> list[dict]:
        if not path.exists():
            return []
        with path.open(newline="", encoding="utf-8") as fh:
            return list(csv.DictReader(fh))

    def write_rows(self, path: Path, rows: list[dict]) -> None:
        with path.open("w", newline="", encoding="utf-8") as fh:
            w = csv.DictWriter(fh, fieldnames=list(rows[0]))
            w.writeheader()
            w.writerows(rows)

    def seed_rows(self, name: str) -> list[dict]:
        return self.rows(self.seed / f"{name}.csv")

    def book_by_title(self, title: str) -> dict:
        hits = [b for b in self.seed_rows("books") if b["title"] == title]
        self.assertEqual(len(hits), 1, [b["title"] for b in self.seed_rows("books")])
        return hits[0]

    def status_of(self, title: str) -> dict:
        bid = self.book_by_title(title)["id"]
        return next(r for r in self.seed_rows("book_status") if r["book_id"] == bid)

    def series_of(self, title: str) -> tuple[str | None, str]:
        b = self.book_by_title(title)
        names = {s["id"]: s["name"] for s in self.seed_rows("book_series")}
        return names.get(b["series_id"]), b["series_position"]

    def calibre_row(self, title: str) -> dict:
        return next(r for r in self.rows(self.books_csv) if r["title"] == title)

    def reported(self, reason: str) -> list[str]:
        return [u["detail"] for u in self.unresolved if u["reason"] == reason]

    def reasons(self) -> list[str]:
        return [u["reason"] for u in self.unresolved]

    def decide_calibre_pair(self, decision: str, keep: str | None = None) -> None:
        rows = self.rows(self.book_review)
        hit = [r for r in rows if r["reason"] == "calibre"]
        self.assertEqual(len(hit), 1, rows)
        hit[0]["decision"] = decision
        if keep is not None:
            hit[0]["keep"] = keep
        self.write_rows(self.book_review, rows)

    def sidecars(self) -> dict[str, bytes]:
        return {p.name: p.read_bytes() for p in (self.books_csv, self.book_review) if p.exists()}


# --------------------------------------------------------------------------
# AC-1: the roadmap Check (amended 2026-10-27, D-87)
# --------------------------------------------------------------------------

class Check(Case):
    """1.18's **Check:**, one test per bullet: a fixture of two books with
    `#words` and `#date_read` columns, and recorded Open Library answers."""

    def library(self, books):
        return build_library(self.lib, books, read=None, kind=None)

    def test_an_exact_match_fills_a_count_and_replaces_a_workbook_count_reporting_it(self):
        self.library([book("The Way of Kings", "Brandon Sanderson", words=383389),
                      book("Mistborn", "Brandon Sanderson", words=300000)])
        self.round()
        wok = self.book_by_title("The Way of Kings")
        self.assertEqual((wok["word_count"], wok["word_count_source"]), ("383389", "stated"))
        mistborn = self.book_by_title("Mistborn")
        self.assertEqual((mistborn["word_count"], mistborn["word_count_source"]), ("300000", "stated"))
        self.assertEqual(self.reported("calibre replaced a word count"),
                         ["Mistborn: 214000 -> Calibre's 300000"])

    def test_a_series_open_library_agrees_with_fills(self):
        self.library([book("The Way of Kings", "Brandon Sanderson", series="The Stormlight Archive", index=1.0),
                      book("Mistborn", "Brandon Sanderson")])
        self.round()
        self.assertEqual(self.series_of("The Way of Kings"), ("The Stormlight Archive", "1.0"))
        row = self.calibre_row("The Way of Kings")
        self.assertEqual((row["confirmed"], row["open_library"]), ("series;series_index", ""))
        self.assertEqual(self.reported("open library series differs"), [])

    def test_a_series_open_library_contradicts_still_fills_and_is_reported(self):
        self.library([book("The Way of Kings", "Brandon Sanderson"),
                      book("Mistborn", "Brandon Sanderson", series="The Final Empire Trilogy", index=1.0)])
        self.round()
        self.assertEqual(self.series_of("Mistborn"), ("The Final Empire Trilogy", "1.0"))
        self.assertEqual(self.calibre_row("Mistborn")["open_library"], "Mistborn Saga #1")
        self.assertEqual(self.reported("open library series differs"),
                         ["Mistborn: Calibre's The Final Empire Trilogy #1 loaded, Open Library has Mistborn Saga #1"])

    def test_a_near_spelling_writes_a_book_review_row_keeping_calibres(self):
        self.library([book("The Way of Kings: Book One", "Brandon Sanderson"),
                      book("Mistborn", "Brandon Sanderson")])
        self.round()
        rows = [r for r in self.rows(self.book_review) if r["reason"] == "calibre"]
        self.assertEqual(len(rows), 1, rows)
        self.assertEqual({k: rows[0][k] for k in ("kind", "a", "b", "a_author", "b_author", "keep", "decision")},
                         {"kind": "book", "a": "The Way of Kings", "b": "The Way of Kings: Book One",
                          "a_author": "Brandon Sanderson", "b_author": "Brandon Sanderson",
                          "keep": "The Way of Kings: Book One", "decision": ""})
        self.assertGreaterEqual(float(rows[0]["similarity"]), ex.SIMILAR_AT)
        # Held until the owner decides: no second Way of Kings.
        self.assertEqual(sorted(b["title"] for b in self.seed_rows("books")), ["Mistborn", "The Way of Kings"])
        self.assertIn("calibre book held for review", self.reasons())

    def test_an_unmatched_book_is_one_unlisted_book_and_a_second_run_changes_no_sidecar(self):
        self.library([book("Warbreaker", "Brandon Sanderson", words=190000, tags=("Fantasy",),
                           isbn="9780765320308"),
                      book("Mistborn", "Brandon Sanderson", series="The Final Empire Trilogy", index=1.0)])
        self.round()
        self.assertEqual(self.book_by_title("Warbreaker")["word_count"], "190000")
        self.assertEqual(self.status_of("Warbreaker")["status"], "unlisted")
        before = self.sidecars()
        self.assertEqual(set(before), {"calibre_books.csv", "book_review.csv"})
        self.assertEqual(self.calibre(), 0)
        self.extract()
        self.assertEqual(self.sidecars(), before)
        self.assertIn("no change in Calibre since the last run", self.output)
        self.assertEqual([b["title"] for b in self.seed_rows("books")].count("Warbreaker"), 1)

    def test_a_book_calibre_has_read_loads_one_read_and_one_it_hasnt_loads_none(self):
        self.library([book("The Way of Kings", "Brandon Sanderson", date="2021-03-20 04:00:00+00:00"),
                      book("Mistborn", "Brandon Sanderson")])
        self.round()
        bid = self.book_by_title("The Way of Kings")["id"]
        self.assertEqual(self.seed_rows("read_events"), [
            {"user_id": "$OWNER", "book_id": bid, "finished_on": "2021-03-20",
             "finished_on_precision": "exact"}])
        status = self.status_of("The Way of Kings")
        self.assertEqual((status["status"], status["finished_on"], status["finished_on_precision"]),
                         ("read", "2021-03-20", "exact"))
        self.assertEqual(self.status_of("Mistborn")["status"], "to_read")

    def test_the_library_file_is_never_changed(self):
        db = self.library([book("The Way of Kings", "Brandon Sanderson", words=383389),
                           book("Mistborn", "Brandon Sanderson", date="2021-03-20 04:00:00+00:00")])
        os.utime(db, ns=(1_600_000_000_000_000_000, 1_600_000_000_000_000_000))
        data, mtime = db.read_bytes(), db.stat().st_mtime_ns
        self.round()
        self.assertEqual(db.read_bytes(), data)
        self.assertEqual(db.stat().st_mtime_ns, mtime)


# --------------------------------------------------------------------------
# AC-2: where the library is, columns by lookup name, the dry run
# --------------------------------------------------------------------------

class Options(Case):
    TWO = [book("The Way of Kings", "Brandon Sanderson", words=383389),
           book("Warbreaker", "Brandon Sanderson", words=190000)]

    def test_the_library_comes_from_calibre_library(self):
        build_library(self.lib, self.TWO)
        self.extract()
        with mock.patch.dict(os.environ, {"CALIBRE_LIBRARY": str(self.lib)}):
            self.assertEqual(self.calibre(library=False), 0)
        self.assertEqual(len(self.rows(self.books_csv)), 2)

    def test_the_library_comes_from_the_env_file(self):
        build_library(self.lib, self.TWO)
        self.extract()
        (self.dir / "absent.env").write_text(f'CALIBRE_LIBRARY="{self.lib}"\n', encoding="utf-8")
        with mock.patch.dict(os.environ, {}, clear=False):
            os.environ.pop("CALIBRE_LIBRARY", None)
            self.assertEqual(self.calibre(library=False), 0)
        self.assertEqual(len(self.rows(self.books_csv)), 2)

    def test_no_library_is_an_error_naming_both(self):
        self.extract()
        with mock.patch.dict(os.environ, {}, clear=False):
            os.environ.pop("CALIBRE_LIBRARY", None)
            with self.assertRaises(SystemExit) as e:
                self.calibre(library=False)
        self.assertIn("--library", str(e.exception.code))
        self.assertIn("CALIBRE_LIBRARY", str(e.exception.code))

    def test_a_words_column_is_found_by_its_lookup_name(self):
        build_library(self.lib, self.TWO)
        self.round()
        expected = {b["title"]: b["word_count"] for b in self.seed_rows("books")}
        self.assertEqual(expected["The Way of Kings"], "383389")

        # The same counts under `#wc`, at custom_column_9, with another int
        # column at custom_column_3 where `#words` was.
        other = Case()
        other.setUp()
        build_library(other.lib, self.TWO, words=("wc", 9), extra_columns=[("pages", 3)])
        other.round("--words-column", "#wc")
        self.assertEqual({b["title"]: b["word_count"] for b in other.seed_rows("books")}, expected)

    def test_a_missing_column_is_named(self):
        build_library(self.lib, self.TWO)
        self.extract()
        with self.assertRaises(SystemExit) as e:
            self.calibre("--words-column", "#count")
        self.assertIn("#count", str(e.exception.code))

    def test_dry_run_reports_the_match_rate_and_writes_nothing(self):
        build_library(self.lib, self.TWO + [book("The Way of Kings: Book One", "Brandon Sanderson")])
        self.round()
        build_library(self.lib, self.TWO + [book("The Way of Kings: Book One", "Brandon Sanderson"),
                                            book("Elantris", "Brandon Sanderson")])
        before = {p: p.read_bytes() for p in [*self.data.iterdir(), *self.seed.iterdir()]}
        self.fetched.clear()
        self.assertEqual(self.calibre("--dry-run"), 0)
        self.assertEqual({p: p.read_bytes() for p in [*self.data.iterdir(), *self.seed.iterdir()]}, before)
        self.assertEqual(self.fetched, [])
        self.assertIn("match rate", self.output)
        self.assertRegex(self.output, r"(?m)^\s*matched\s+1\b")
        self.assertRegex(self.output, r"(?m)^\s*proposed\s+1\b")
        self.assertRegex(self.output, r"(?m)^\s*unmatched\s+2\b")
        # What changed is shown too, and still nothing is written.
        self.assertIn("added    Elantris", self.output)

    def test_dry_run_on_a_fresh_checkout_creates_no_sidecar(self):
        build_library(self.lib, self.TWO)
        self.extract()
        self.assertEqual(self.calibre("--dry-run"), 0)
        self.assertFalse(self.books_csv.exists())


# --------------------------------------------------------------------------
# AC-3: re-runnable, Calibre the source of truth, every disagreement reported
# --------------------------------------------------------------------------

class Rerun(Case):
    FIRST = [book("Mistborn", "Brandon Sanderson", series="The Final Empire Trilogy", words=220000,
                  read=1, date="2021-03-20 04:00:00+00:00"),
             book("The Way of Kings", "Brandon Sanderson", words=383389)]

    def test_a_book_added_between_runs_appends_exactly_its_own_row(self):
        build_library(self.lib, self.FIRST)
        self.round()
        before = self.books_csv.read_text(encoding="utf-8")
        build_library(self.lib, self.FIRST + [book("Elantris", "Brandon Sanderson", series="Elantris",
                                                   words=200000, read=1, date="2020-01-05 05:00:00+00:00")])
        self.round()
        text = self.books_csv.read_text(encoding="utf-8")
        self.assertTrue(text.startswith(before))
        added = list(csv.reader(io.StringIO(text[len(before):])))
        self.assertEqual([a[:2] for a in added], [["Elantris", "Brandon Sanderson"]])
        self.assertIn("1 added, 0 removed, 0 renamed, 0 changed", self.output)
        self.assertIn("added    Elantris — Brandon Sanderson", self.output)

    def test_a_book_changed_in_calibre_is_rewritten_in_place_and_reported(self):
        build_library(self.lib, self.FIRST)
        self.round()
        build_library(self.lib, [book("Mistborn", "Brandon Sanderson", series="Mistborn Era One", words=230000,
                                      read=1, date="2021-04-02 04:00:00+00:00"),
                                 book("The Way of Kings", "Brandon Sanderson", words=383389)])
        self.round()
        self.assertEqual([r["title"] for r in self.rows(self.books_csv)], ["Mistborn", "The Way of Kings"])
        row = self.calibre_row("Mistborn")
        self.assertEqual((row["words"], row["series"], row["date_read"]), ("230000", "Mistborn Era One", "2021-04-02"))
        self.assertIn("changed  Mistborn — Brandon Sanderson: words 220000 -> 230000; "
                      "series The Final Empire Trilogy -> Mistborn Era One; "
                      "date_read 2021-03-20 -> 2021-04-02", self.output)
        # Calibre's new values load.
        self.assertEqual(self.series_of("Mistborn"), ("Mistborn Era One", "1.0"))
        self.assertEqual(self.book_by_title("Mistborn")["word_count"], "230000")
        self.assertEqual(self.status_of("Mistborn")["finished_on"], "2021-04-02")

    def test_a_book_removed_from_calibre_loses_its_row_and_is_reported(self):
        build_library(self.lib, [book("Warbreaker", "Brandon Sanderson", read=1),
                                 book("Mistborn", "Brandon Sanderson")])
        self.round()
        self.assertEqual(self.status_of("Warbreaker")["status"], "read")
        build_library(self.lib, [book("Mistborn", "Brandon Sanderson")])
        self.round()
        self.assertEqual([r["title"] for r in self.rows(self.books_csv)], ["Mistborn"])
        self.assertIn("removed  Warbreaker — Brandon Sanderson", self.output)
        self.assertNotIn("Warbreaker", [b["title"] for b in self.seed_rows("books")])
        self.assertEqual(self.seed_rows("read_events"), [])

    def test_a_rename_in_calibre_is_reported_as_one(self):
        build_library(self.lib, [book("Warbreaker", "Brandon Sanderson"), book("Mistborn", "Brandon Sanderson")])
        self.round()
        build_library(self.lib, [book("Warbreaker (Tenth Anniversary)", "Brandon Sanderson"),
                                 book("Mistborn", "Brandon Sanderson")])
        self.round()
        self.assertIn("renamed? Warbreaker -> Warbreaker (Tenth Anniversary) — Brandon Sanderson", self.output)
        self.assertIn("0 added, 0 removed, 1 renamed, 0 changed", self.output)

    def test_a_count_within_ten_percent_replaces_the_workbooks_quietly(self):
        build_library(self.lib, [book("Mistborn", "Brandon Sanderson", words=220000),
                                 book("The Way of Kings", "Brandon Sanderson")])
        self.round()
        self.assertEqual(self.book_by_title("Mistborn")["word_count"], "220000")
        self.assertNotIn("calibre replaced a word count", self.reasons())

    def test_a_different_workbook_series_is_replaced_and_reported(self):
        self.workbook = build_books([("Mistborn", "Brandon Sanderson", "Mistborn #1", "Fantasy", None)])
        build_library(self.lib, [book("Mistborn", "Brandon Sanderson", series="The Final Empire Trilogy", index=1.0),
                                 book("Warbreaker", "Brandon Sanderson")])
        self.round()
        self.assertEqual(self.series_of("Mistborn"), ("The Final Empire Trilogy", "1.0"))
        self.assertEqual(self.reported("calibre replaced a series"),
                         ["Mistborn: Mistborn #1 -> Calibre's The Final Empire Trilogy #1"])

    def test_a_series_calibre_emptied_is_dropped_unless_followed(self):
        """Every book of the workbook's `Xelee Sequence` takes Calibre's
        `Xeelee Sequence`: the misspelling leaves book_series. A followed one
        stays, and is reported."""
        self.workbook = build_books([("Raft", "Stephen Baxter", "Xelee Sequence #1", "SF", None)])
        build_library(self.lib, [book("Raft", "Stephen Baxter", series="Xeelee Sequence", index=1.0),
                                 book("Mistborn", "Brandon Sanderson")])
        self.round()
        self.assertEqual([s["name"] for s in self.seed_rows("book_series")], ["Xeelee Sequence"])

        self.workbook = build_books([("Raft", "Stephen Baxter", "Xelee Sequence #1", "SF", None)],
                                    series=[("Xelee Sequence", 4)])
        self.round()
        self.assertEqual(sorted(s["name"] for s in self.seed_rows("book_series")),
                         ["Xeelee Sequence", "Xelee Sequence"])
        self.assertEqual(self.reported("followed series has no books"),
                         ["Xelee Sequence: Calibre gave every book of it another series; fix the "
                          "workbook's Series tab, or the series in Calibre"])

    def test_the_same_workbook_series_is_not_reported(self):
        self.workbook = build_books([("Mistborn", "Brandon Sanderson", "Mistborn Saga #1", "Fantasy", None)])
        build_library(self.lib, [book("Mistborn", "Brandon Sanderson", series="Mistborn Saga", index=1.0),
                                 book("Warbreaker", "Brandon Sanderson")])
        self.round()
        self.assertEqual(self.series_of("Mistborn"), ("Mistborn Saga", "1.0"))
        self.assertNotIn("calibre replaced a series", self.reasons())

    def test_an_index_open_library_disagrees_with_fills_calibres_and_is_reported(self):
        build_library(self.lib, [book("The Way of Kings", "Brandon Sanderson",
                                      series="The Stormlight Archive", index=2.0),
                                 book("Mistborn", "Brandon Sanderson")])
        self.round()
        self.assertEqual(self.series_of("The Way of Kings"), ("The Stormlight Archive", "2.0"))
        self.assertEqual(self.calibre_row("The Way of Kings")["open_library"], "The Stormlight Archive #1")
        self.assertEqual(len(self.reported("open library series differs")), 1)

    def test_no_open_library_series_fills_and_reports_nothing(self):
        build_library(self.lib, [book("Warbreaker", "Brandon Sanderson", series="Nalthis"),
                                 book("Mistborn", "Brandon Sanderson")])
        self.round()
        self.assertEqual(self.series_of("Warbreaker"), ("Nalthis", "1.0"))
        self.assertEqual(self.calibre_row("Warbreaker")["open_library"], "")
        self.assertNotIn("open library series differs", self.reasons())

    def test_a_merge_takes_calibres_spelling_and_folds_the_book_in(self):
        build_library(self.lib, [book("The Way of Kings: Book One", "Brandon Sanderson", words=383389),
                                 book("Mistborn", "Brandon Sanderson")])
        self.round()
        self.decide_calibre_pair("merge")
        self.round()
        self.assertNotIn("The Way of Kings", [b["title"] for b in self.seed_rows("books")])
        self.assertEqual(self.book_by_title("The Way of Kings: Book One")["word_count"], "383389")
        self.assertEqual(self.status_of("The Way of Kings: Book One")["status"], "to_read")
        self.assertRegex(self.output, r"(?m)^\s*matched\s+2\b")

    def write_review(self, *rows):
        with self.book_review.open("w", newline="", encoding="utf-8") as fh:
            w = csv.DictWriter(fh, fieldnames=ex.BOOK_REVIEW_COLUMNS)
            w.writeheader()
            w.writerows({c: "" for c in ex.BOOK_REVIEW_COLUMNS} | r for r in rows)

    def test_a_calibre_book_under_a_merged_away_author_joins_the_kept_author(self):
        """The owner merged `Brandon Sandersen` into `Brandon Sanderson`: a book
        only Calibre has, spelled the old way, is created under the kept author,
        so the merged-away spelling never becomes a row (D-68)."""
        self.write_review({"kind": "author", "a": "Brandon Sanderson", "b": "Brandon Sandersen",
                           "reason": "similar", "keep": "Brandon Sanderson", "decision": "merge"})
        build_library(self.lib, [book("Warbreaker", "Brandon Sandersen"), book("Mistborn", "Brandon Sanderson")])
        self.round()
        self.assertEqual([a["name"] for a in self.seed_rows("authors")], ["Brandon Sanderson"])
        names = {a["id"]: a["name"] for a in self.seed_rows("authors")}
        self.assertEqual(names[self.book_by_title("Warbreaker")["author_id"]], "Brandon Sanderson")

    def test_a_proposal_against_a_renamed_workbook_book_is_kept(self):
        """An `open library` merge renamed the workbook's `Edgedancer Novella`
        to `Edgedancer`; Calibre's `Edgedancers` is proposed against the new
        spelling, and the row stays until it is decided, holding the book."""
        self.workbook = build_books([("Edgedancer Novella", "Brandon Sanderson", None, "Fantasy", None)])
        self.write_review({"kind": "book", "a": "Edgedancer Novella", "b": "Edgedancer",
                           "a_author": "Brandon Sanderson", "b_author": "Brandon Sanderson",
                           "b_tabs": "Open Library", "reason": "open library", "keep": "Edgedancer",
                           "decision": "merge"})
        build_library(self.lib, [book("Edgedancers", "Brandon Sanderson"), book("Mistborn", "Brandon Sanderson")])
        self.round()
        self.round()
        calibre_rows = [r for r in self.rows(self.book_review) if r["reason"] == "calibre"]
        self.assertEqual([(r["a"], r["b"]) for r in calibre_rows], [("Edgedancer", "Edgedancers")])
        self.assertNotIn("Edgedancers", [b["title"] for b in self.seed_rows("books")])

    def test_calibres_book_type_replaces_the_workbooks_and_is_reported(self):
        build_library(self.lib, [book("Mistborn", "Brandon Sanderson", kind="Fan Fiction"),
                                 book("Warbreaker", "Brandon Sanderson")])
        self.round()
        self.assertEqual(self.book_by_title("Mistborn")["book_type"], "Fan Fiction")
        self.assertEqual(self.reported("calibre replaced a book type"), ["Mistborn: Novel -> Calibre's Fan Fiction"])

    def test_a_held_book_says_its_read_waits_too(self):
        build_library(self.lib, [book("The Way of Kings: Book One", "Brandon Sanderson", read=1,
                                      date="2023-08-02 04:00:00+00:00"),
                                 book("Mistborn", "Brandon Sanderson")])
        self.round()
        [detail] = self.reported("calibre book held for review")
        self.assertIn("its read of 2023-08-02 waits too", detail)

    def test_a_separate_decision_creates_the_calibre_book(self):
        build_library(self.lib, [book("The Way of Kings: Book One", "Brandon Sanderson"),
                                 book("Mistborn", "Brandon Sanderson")])
        self.round()
        self.decide_calibre_pair("separate")
        self.round()
        self.assertEqual(self.status_of("The Way of Kings: Book One")["status"], "unlisted")
        self.assertEqual(self.status_of("The Way of Kings")["status"], "to_read")
        self.assertEqual(len([r for r in self.rows(self.book_review) if r["reason"] == "calibre"]), 1)


# --------------------------------------------------------------------------
# AC-4: reads
# --------------------------------------------------------------------------

class Reads(Case):

    def test_a_book_already_read_gets_no_second_read(self):
        """Two Calibre records of one book: the near spelling is merged into
        the workbook's, so both reads land on it. The first loads; the second
        is reported, not merged."""
        build_library(self.lib, [
            book("The Way of Kings", "Brandon Sanderson", read=1, date="2021-03-20 04:00:00+00:00"),
            book("The Way of Kings: Book One", "Brandon Sanderson", read=1, date="2023-08-02 04:00:00+00:00")])
        self.round()
        self.decide_calibre_pair("merge", keep="The Way of Kings")
        self.round()
        bid = self.book_by_title("The Way of Kings")["id"]
        events = [e for e in self.seed_rows("read_events") if e["book_id"] == bid]
        self.assertEqual([e["finished_on"] for e in events], ["2021-03-20"])
        self.assertIn("calibre read for a book already read", self.reasons())

    def test_a_year_only_date_is_july_first_approximate(self):
        build_library(self.lib, [book("Warbreaker", "Brandon Sanderson", read=1,
                                      date="2019-01-01 05:00:00+00:00"),
                                 book("Mistborn", "Brandon Sanderson")], date_format="yyyy")
        self.round()
        row = self.calibre_row("Warbreaker")
        self.assertEqual((row["date_read"], row["precision"]), ("2019", "approximate"))
        event = self.seed_rows("read_events")[0]
        self.assertEqual((event["finished_on"], event["finished_on_precision"]), ("2019-07-01", "approximate"))

    def test_a_month_format_keeps_the_stored_day_as_approximate(self):
        """The owner's `MMM yyyy` column (D-88)."""
        build_library(self.lib, [book("Warbreaker", "Brandon Sanderson", read=1,
                                      date="2022-05-08 04:00:00+00:00"),
                                 book("Mistborn", "Brandon Sanderson")], date_format="MMM yyyy")
        self.round()
        event = self.seed_rows("read_events")[0]
        self.assertEqual((event["finished_on"], event["finished_on_precision"]), ("2022-05-08", "approximate"))

    def test_calibres_iso_format_is_a_full_date(self):
        """`iso` is Calibre's special format for a full ISO date: no `d` in it,
        and still a day."""
        build_library(self.lib, [book("Warbreaker", "Brandon Sanderson", read=1,
                                      date="2022-05-08 04:00:00+00:00"),
                                 book("Mistborn", "Brandon Sanderson")], date_format="iso")
        self.round()
        row = self.calibre_row("Warbreaker")
        self.assertEqual((row["date_read"], row["precision"]), ("2022-05-08", "exact"))

    def test_a_date_is_its_eastern_day(self):
        """Calibre stores UTC; 03:00 UTC on the 9th is the evening of the 8th in New York (D-67)."""
        build_library(self.lib, [book("Warbreaker", "Brandon Sanderson", read=1,
                                      date="2022-05-09 03:00:00+00:00"),
                                 book("Mistborn", "Brandon Sanderson", read=1,
                                      date="0101-01-01 00:00:00+00:00")])
        self.round()
        self.assertEqual({r["title"]: (r["date_read"], r["precision"]) for r in self.rows(self.books_csv)},
                         {"Warbreaker": ("2022-05-08", "exact"), "Mistborn": ("", "none")})

    def test_a_created_book_calibre_has_read_loads_read_with_its_date(self):
        build_library(self.lib, [book("Warbreaker", "Brandon Sanderson", read=1,
                                      date="2022-05-08 04:00:00+00:00"),
                                 book("Elantris", "Brandon Sanderson")])
        self.round()
        status = self.status_of("Warbreaker")
        self.assertEqual((status["status"], status["finished_on"], status["finished_on_precision"]),
                         ("read", "2022-05-08", "exact"))

    def test_a_created_book_calibre_hasnt_read_loads_unlisted(self):
        build_library(self.lib, [book("Warbreaker", "Brandon Sanderson", read=0),
                                 book("Elantris", "Brandon Sanderson")])
        self.round()
        self.assertEqual(self.status_of("Warbreaker")["status"], "unlisted")
        self.assertEqual(self.status_of("Elantris")["status"], "unlisted")
        self.assertEqual(self.seed_rows("read_events"), [])

    def test_a_read_with_no_date_loads_with_precision_none(self):
        build_library(self.lib, [book("Warbreaker", "Brandon Sanderson", read=1),
                                 book("Mistborn", "Brandon Sanderson")])
        self.round()
        event = self.seed_rows("read_events")[0]
        self.assertEqual((event["finished_on"], event["finished_on_precision"]), ("", "none"))


# --------------------------------------------------------------------------
# AC-5, AC-6 and what comes in
# --------------------------------------------------------------------------

class Shape(Case):

    def test_books_csv_header_is_unchanged(self):
        build_library(self.lib, [book("Warbreaker", "Brandon Sanderson"), book("Mistborn", "Brandon Sanderson")])
        self.round()
        with (self.seed / "books.csv").open(newline="", encoding="utf-8") as fh:
            header = next(csv.reader(fh))
        self.assertEqual(header, ["id", "title", "author_id", "series_id", "series_position", "genre",
                                  "book_type", "word_count", "word_count_source", "published_year",
                                  "page_count", "cover_url", "open_library_id", "universe_id"])

    def test_the_temp_copy_is_outside_the_repo_and_removed(self):
        build_library(self.lib, [book("Warbreaker", "Brandon Sanderson"), book("Mistborn", "Brandon Sanderson")])
        self.extract()
        made = []
        real = cal.tempfile.mkdtemp

        def mkdtemp(*a, **k):
            made.append(Path(real(*a, **k)))
            return str(made[-1])

        with mock.patch.object(cal.tempfile, "mkdtemp", mkdtemp):
            self.assertEqual(self.calibre(), 0)
        self.assertEqual(len(made), 1)
        self.assertFalse(made[0].resolve().is_relative_to(REPO), made[0])
        self.assertFalse(made[0].exists())

    def test_tags_and_isbn_are_kept_and_comments_are_not(self):
        build_library(self.lib, [book("Warbreaker", "Brandon Sanderson", isbn="9780765320308",
                                      tags=("Fantasy", "Standalone")),
                                 book("Mistborn", "Brandon Sanderson")])
        self.round()
        row = self.calibre_row("Warbreaker")
        self.assertEqual((row["isbn"], row["tags"]), ("9780765320308", "Fantasy; Standalone"))
        self.assertNotIn("comments", row)
        self.assertNotIn("About Warbreaker", self.books_csv.read_text(encoding="utf-8"))

    def test_an_isbn_open_library_lists_is_confirmed(self):
        build_library(self.lib, [book("The Way of Kings", "Brandon Sanderson", series="The Stormlight Archive",
                                      isbn="9780765326355"),
                                 book("Mistborn", "Brandon Sanderson", isbn="9999999999999",
                                      series="Mistborn Saga")])
        self.round()
        self.assertEqual({r["title"]: r["confirmed"] for r in self.rows(self.books_csv)},
                         {"The Way of Kings": "series;series_index;isbn", "Mistborn": "series;series_index"})

    def test_a_comic_is_skipped_and_fan_fiction_comes_in_as_fan_fiction(self):
        build_library(self.lib, [book("Saga Volume 1", "Brian K. Vaughan", kind="Comic", read=1),
                                 book("A Fic", "Someone", kind="Fan Fiction")])
        self.round()
        self.assertNotIn("Saga Volume 1", [b["title"] for b in self.seed_rows("books")])
        self.assertNotIn("Saga Volume 1", self.books_csv.read_text(encoding="utf-8"))
        self.assertEqual(self.seed_rows("read_events"), [])
        self.assertEqual(self.book_by_title("A Fic")["book_type"], "Fan Fiction")
        self.assertIn("Saga Volume 1", self.output)

    def test_a_book_by_two_authors_matches_on_either(self):
        self.workbook = build_books([("Good Omens", "Neil Gaiman", None, "Fantasy", None)])
        build_library(self.lib, [book("Good Omens", "Terry Pratchett", "Neil Gaiman", words=110000),
                                 book("Mistborn", "Brandon Sanderson")])
        self.round()
        self.assertEqual(self.book_by_title("Good Omens")["word_count"], "110000")
        self.assertEqual([b["title"] for b in self.seed_rows("books")].count("Good Omens"), 1)

    def test_one_title_under_another_author_is_a_review_row_keeping_calibres_author(self):
        self.workbook = build_books([("Dune", "Frank Herbert", None, "SF", None)])
        build_library(self.lib, [book("Dune", "Brian Herbert"), book("Mistborn", "Brandon Sanderson")])
        self.round()
        rows = [r for r in self.rows(self.book_review) if r["reason"] == "calibre"]
        self.assertEqual([(r["a"], r["a_author"], r["b"], r["b_author"], r["keep"]) for r in rows],
                         [("Dune", "Frank Herbert", "Dune", "Brian Herbert", "Brian Herbert")])

    def test_a_dropped_connection_skips_one_book_and_asks_about_the_next(self):
        build_library(self.lib, [book("Mistborn", "Brandon Sanderson", series="The Final Empire Trilogy"),
                                 book("Warbreaker", "Brandon Sanderson", series="Nalthis")])
        self.extract()
        real = self.fake_fetch

        def once(_api, url, attempt=1):
            if not self.fetched:
                self.fetched.append(url)
                raise eb.urllib.error.URLError("[WinError 10054] connection forcibly closed")
            return real(url, attempt)

        with mock.patch.object(self, "fake_fetch", once):
            self.assertEqual(self.calibre(), 0)
        self.assertEqual(len(self.fetched), 2)
        self.assertEqual(self.calibre_row("Mistborn")["open_library"], "")
        self.assertIn("1 series not checked", self.output)

    def test_failures_in_a_row_stop_the_lookups_and_still_write_the_rest(self):
        """Open Library drops every connection: after MAX_FAILURES books in a
        row the rest go unchecked without asking, and the sidecar is written."""
        build_library(self.lib, [book(f"Book {n}", "Brandon Sanderson", series="Cosmere") for n in range(4)]
                      + [book("Warbreaker", "Brandon Sanderson", series="Nalthis", read=1)])
        self.extract()

        def dropped(_api, url, attempt=1):
            self.fetched.append(url)
            raise eb.urllib.error.URLError("[WinError 10054] connection forcibly closed")

        buf = io.StringIO()
        with mock.patch.object(eb.OpenLibrary, "_fetch", dropped), redirect_stdout(buf):
            self.assertEqual(cal.main(self.argv()), 0)
        self.assertEqual(len(self.fetched), cal.MAX_FAILURES)
        self.assertEqual(len(self.rows(self.books_csv)), 5)
        self.assertIn("5 series not checked", buf.getvalue())

    def test_offline_checks_nothing_new_and_keeps_what_it_knew(self):
        build_library(self.lib, [book("Mistborn", "Brandon Sanderson", series="The Final Empire Trilogy"),
                                 book("The Way of Kings", "Brandon Sanderson", series="The Stormlight Archive")])
        self.round()
        before = self.sidecars()
        self.assertEqual(self.calibre_row("Mistborn")["open_library"], "Mistborn Saga #1")
        self.dir.joinpath("cache.sqlite").unlink()
        self.fetched.clear()
        self.assertEqual(self.calibre("--offline"), 0)
        self.assertEqual(self.fetched, [])
        self.assertEqual(self.sidecars(), before)


if __name__ == "__main__":
    unittest.main()
