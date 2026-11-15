"""Tests for etl/calibre_sync.py, `npm run calibre:sync` (task 4.4, TASK-082, D-133).
The run end to end, against the app's routes and the TEST database, is
test/calibre-sync-command.test.ts; these are the parts it can't see: that the
library's own metadata.db is never opened, how each value is written for
calibredb, and which way it writes. No network, no calibredb.

    py -m unittest discover -s etl -p "test_calibre_sync.py"
"""

import io
import json
import shutil
import sqlite3
import sys
import tempfile
import unittest
from contextlib import redirect_stderr, redirect_stdout
from pathlib import Path
from unittest import mock

sys.path.insert(0, str(Path(__file__).parent))
import calibre_sync as cs  # noqa: E402
from test_calibre import book, build_library  # noqa: E402

COLUMNS = {"words": "#words", "date": "#date_read", "read": "#read", "type": "#type",
           "superseries": "#superseries", "subseries": "#subseries", "pages": "#pages", "genre": "#genre"}
LOOKUPS = {"#read": "#read", "#date_read": "#date_read", "#ledger_status": "#ledger_status", "#owned": "#owned"}


def add_text_column(path: Path, label: str, n: int, multiple: bool, values: dict[int, list[str]]) -> None:
    """A normalized text column, as Calibre makes #ledger_status and #owned."""
    db = sqlite3.connect(path)
    db.execute("INSERT INTO custom_columns (id, label, name, datatype, is_multiple, normalized, display) "
               "VALUES (?, ?, ?, 'text', ?, 1, '{}')", (n, label, label, multiple))
    db.execute(f"CREATE TABLE custom_column_{n} (id INTEGER PRIMARY KEY, value TEXT UNIQUE)")
    db.execute(f"CREATE TABLE books_custom_column_{n}_link (id INTEGER PRIMARY KEY, book INTEGER, value INTEGER)")
    for bid, vs in values.items():
        for v in vs:
            db.execute(f"INSERT OR IGNORE INTO custom_column_{n} (value) VALUES (?)", (v,))
            vid = db.execute(f"SELECT id FROM custom_column_{n} WHERE value = ?", (v,)).fetchone()[0]
            db.execute(f"INSERT INTO books_custom_column_{n}_link (book, value) VALUES (?, ?)", (bid, vid))
    db.commit()
    db.close()


class Library(unittest.TestCase):
    def setUp(self):
        self.dir = Path(tempfile.mkdtemp())
        self.addCleanup(shutil.rmtree, self.dir, ignore_errors=True)
        self.lib = self.dir / "Calibre Library"
        self.db = build_library(self.lib, [
            book("Piranesi", "Susanna Clarke", isbn="9781635575637", words=85000, read=1,
                 date="2024-08-15T16:00:00+00:00", series="Standalone", index=1.0),
            book("Gideon the Ninth", "Tamsyn Muir"),
        ])

    def test_reads_only_a_copy_never_the_librarys_own_file(self):
        add_text_column(self.db, "ledger_status", 30, False, {1: ["read"]})
        add_text_column(self.db, "owned", 31, True, {1: ["physical", "audio"]})
        opened = []
        real = sqlite3.connect

        def spy(target, *args, **kwargs):
            opened.append(str(target))
            return real(target, *args, **kwargs)

        with mock.patch("sqlite3.connect", spy):
            records, missing = cs.read_library(self.db, COLUMNS, LOOKUPS)
        self.assertEqual(len(opened), 1)
        self.assertTrue(opened[0].endswith("metadata.db?mode=ro"), opened[0])
        own = self.db.resolve().as_uri()
        self.assertNotIn(own, opened[0])
        self.assertNotIn(str(self.lib), opened[0])
        self.assertEqual(missing, [])
        self.assertEqual(records[0]["ledgerStatus"], "read")
        self.assertEqual(records[0]["owned"], ["audio", "physical"])

    def test_records_are_what_the_app_takes(self):
        records, missing = cs.read_library(self.db, COLUMNS, LOOKUPS)
        self.assertEqual(missing, ["#ledger_status", "#owned"])
        piranesi, gideon = records
        self.assertEqual(piranesi, {
            "calibreId": 1, "title": "Piranesi", "authors": ["Susanna Clarke"],
            "series": "Standalone", "seriesIndex": 1.0, "subseries": None, "subseriesIndex": None,
            "superseries": None, "superseriesIndex": None, "genres": [], "tags": [], "isbn": "9781635575637",
            "words": 85000, "pages": None, "type": "Book", "read": True, "dateRead": "2024-08-15",
            "precision": "exact", "ledgerStatus": None, "owned": [],
        })
        self.assertEqual((gideon["read"], gideon["dateRead"], gideon["precision"], gideon["seriesIndex"]),
                         (None, None, None, None))
        json.dumps(records)  # the request body

    def test_a_renamed_date_column_is_read_and_named_for_the_write(self):
        build_library(self.lib, [book("Piranesi", "Susanna Clarke", date="2024-08-15T16:00:00+00:00")],
                      date=("read_date", 6))
        lookups = {**LOOKUPS, "#date_read": "#read_date"}
        records, missing = cs.read_library(self.db, {**COLUMNS, "date": "#read_date"}, lookups)
        self.assertEqual(records[0]["dateRead"], "2024-08-15")
        self.assertNotIn("#date_read", missing)
        args = self.write([{"calibreId": 1, "title": "Piranesi", "column": "#date_read", "to": "2024-06-01"}], lookups)
        self.assertIn("#read_date:2024-06-01T12:00:00-04:00", args[0])

    def write(self, out, lookups=LOOKUPS):
        with mock.patch("subprocess.run") as run:
            run.return_value = mock.Mock(returncode=0, stdout="", stderr="")
            failed = cs.write_back(out, lookups, ["calibredb"], ["--library-path", str(self.lib)])
        self.assertEqual(failed, [])
        return [c.args[0] for c in run.call_args_list]


class Values(unittest.TestCase):
    def test_a_finish_is_its_day_at_noon_eastern_and_none_clears(self):
        self.assertEqual(cs.field_value("#date_read", "2023-10-10"), "2023-10-10T12:00:00-04:00")
        self.assertEqual(cs.field_value("#date_read", "2024-01-15"), "2024-01-15T12:00:00-05:00")
        # An approximate year is its July 1st, written as that day.
        self.assertEqual(cs.field_value("#date_read", "2019-07-01"), "2019-07-01T12:00:00-04:00")
        self.assertEqual(cs.field_value("#date_read", None), "")

    def test_read_status_and_owned(self):
        self.assertEqual(cs.field_value("#read", True), "true")
        self.assertEqual(cs.field_value("#read", False), "false")
        self.assertEqual(cs.field_value("#ledger_status", "to_read"), "to_read")
        self.assertEqual(cs.field_value("#ledger_status", None), "")
        self.assertEqual(cs.field_value("#owned", ["audio", "physical"]), "audio,physical")
        self.assertEqual(cs.field_value("#owned", []), "")

    def test_one_calibredb_call_per_book(self):
        out = [{"calibreId": 4, "title": "Gideon", "column": "#read", "to": True},
               {"calibreId": 4, "title": "Gideon", "column": "#owned", "to": ["physical"]},
               {"calibreId": 1, "title": "Ancillary", "column": "#ledger_status", "to": "to_read"}]
        with mock.patch("subprocess.run") as run:
            run.return_value = mock.Mock(returncode=0, stdout="", stderr="")
            cs.write_back(out, LOOKUPS, ["calibredb"], ["--library-path", "L"])
        self.assertEqual([c.args[0] for c in run.call_args_list], [
            ["calibredb", "set_metadata", "--library-path", "L", "4", "--field", "#read:true", "--field", "#owned:physical"],
            ["calibredb", "set_metadata", "--library-path", "L", "1", "--field", "#ledger_status:to_read"],
        ])


class Writer(unittest.TestCase):
    def test_through_the_content_server_while_it_answers_else_the_folder(self):
        folder = Path("C:/Books/Calibre Library")
        with mock.patch.object(cs, "server_answers", return_value=True):
            self.assertEqual(cs.library_option("http://localhost:8080", folder),
                             ["--with-library", "http://localhost:8080/#Calibre_Library"])
            self.assertEqual(cs.library_option("http://localhost:8080/#Mine", folder),
                             ["--with-library", "http://localhost:8080/#Mine"])
        with mock.patch.object(cs, "server_answers", return_value=False):
            self.assertEqual(cs.library_option("http://localhost:8080", folder), ["--library-path", str(folder)])

    def test_empty_settings_are_the_defaults(self):
        # As .env.example ships them: load_env puts "" in the environment.
        empty = {"CALIBRE_SYNC_URL": "", "CALIBRE_SERVER_URL": "", "CALIBREDB": "", "CALIBRE_SYNC_READS": "false"}
        self.assertEqual(cs.settings(empty), {"url": "http://localhost:3000", "server": "http://localhost:8080",
                                              "calibredb": "", "reads": False})
        self.assertEqual(cs.settings({})["server"], "http://localhost:8080")
        self.assertEqual(cs.settings({"CALIBRE_SERVER_URL": " http://localhost:9090 ", "CALIBRE_SYNC_READS": "true"}),
                         {"url": "http://localhost:3000", "server": "http://localhost:9090", "calibredb": "",
                          "reads": True})

    def test_calibredb_gets_no_secrets(self):
        with mock.patch.dict("os.environ", {"DATABASE_URL": "postgres://x", "APP_PASSCODE": "p",
                                            "HARDCOVER_API_TOKEN": "t", "SESSION_SECRET": "s", "PATH": "/bin"}):
            env = cs.child_env()
            with mock.patch("subprocess.run") as run:
                run.return_value = mock.Mock(returncode=0, stdout="", stderr="")
                cs.write_back([{"calibreId": 1, "title": "T", "column": "#read", "to": True}], LOOKUPS,
                              ["calibredb"], ["--library-path", "L"])
        for k in ("DATABASE_URL", "APP_PASSCODE", "HARDCOVER_API_TOKEN", "SESSION_SECRET"):
            self.assertNotIn(k, env)
            self.assertNotIn(k, run.call_args.kwargs["env"])
        self.assertEqual(env["PATH"], "/bin")

    def test_a_down_server_does_not_answer(self):
        self.assertFalse(cs.server_answers("http://127.0.0.1:9"))

    def test_calibredb_setting(self):
        self.assertEqual(cs.calibredb_command('"C:/node.exe" "C:/fake.mjs"'), ["C:/node.exe", "C:/fake.mjs"])
        with mock.patch("shutil.which", return_value="/usr/bin/calibredb"):
            self.assertEqual(cs.calibredb_command(""), ["/usr/bin/calibredb"])


class Backfill(unittest.TestCase):
    def setUp(self):
        quiet = io.StringIO()
        for stream in (redirect_stdout(quiet), redirect_stderr(quiet)):
            stream.__enter__()
            self.addCleanup(stream.__exit__, None, None, None)

    def test_follows_next_and_waits_out_a_stop(self):
        answers = iter([(200, {"status": "done", "looked": 100, "next": "b100"}),
                        (200, {"status": "stopped", "looked": 3, "next": "b103", "retryIn": 7}),
                        (200, {"status": "done", "looked": 20, "next": None})])
        app = mock.Mock()
        app.post.side_effect = lambda path, body: next(answers)
        slept = []
        self.assertEqual(cs.backfill(app, {"b1": "9781635575637"}, sleep=slept.append), 0)
        bodies = [c.args[1] for c in app.post.call_args_list]
        self.assertEqual([b.get("after") for b in bodies], [None, "b100", "b103"])
        self.assertTrue(all(b["dryRun"] is False and b["isbns"] == {"b1": "9781635575637"} for b in bodies))
        self.assertEqual(slept, [7])

    def test_no_hardcover_where_the_app_runs_is_not_a_failure(self):
        app = mock.Mock()
        app.post.return_value = (503, {"error": "HARDCOVER_API_TOKEN is not set"})
        self.assertEqual(cs.backfill(app, {}), 0)
        app.post.return_value = (500, {"error": "boom"})
        self.assertEqual(cs.backfill(app, {}), 1)

    def test_only_isbns_the_app_takes(self):
        self.assertTrue(cs.is_isbn("978-1-63557-563-7"))
        self.assertTrue(cs.is_isbn("080442957X"))
        self.assertFalse(cs.is_isbn("B00ABC1234"))
        self.assertFalse(cs.is_isbn(None))


if __name__ == "__main__":
    unittest.main()
