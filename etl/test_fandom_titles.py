"""Tests for etl/fandom_titles.py. No network.

    py -m unittest discover -s etl -p "test_*.py"
"""

import csv
import io
import json
import sys
import tempfile
import unittest
from contextlib import redirect_stdout
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent))
import fandom_titles as ft  # noqa: E402


class Labels(unittest.TestCase):
    def test_split_label(self):
        self.assertEqual(ft.split_label("Alias (2001) #1"), ("Alias", 2001, "1"))
        self.assertEqual(ft.split_label("Ultimate Spider-Man (2000) #1⁄2"), ("Ultimate Spider-Man", 2000, "½"))
        self.assertEqual(ft.split_label("Amazing Spider-Man (2018) #16.HU"), ("Amazing Spider-Man", 2018, "16.HU"))
        self.assertEqual(ft.split_label("Avengers Finale (2005)"), ("Avengers Finale", 2005, "1"))

    def test_leading_zeros_drop_but_a_decimal_stays(self):
        self.assertEqual(ft.fandom_number("007"), "7")
        self.assertEqual(ft.fandom_number("605.1"), "605.1")

    def test_series_names_try_without_the(self):
        self.assertEqual(ft.series_names("The Avengers"), ["The Avengers", "Avengers"])
        self.assertEqual(ft.series_names("Alias"), ["Alias"])

    def test_page_title(self):
        self.assertEqual(ft.page_title("Alias", 1, "1"), "Alias Vol 1 1")


class PageFields(unittest.TestCase):
    def test_year_and_stories_in_order_with_markup_cleaned(self):
        text = ("{{Marvel Database:Comic Template\n| Year = 2001\n"
                "| StoryTitle2         = [[Some Page|Second]] <!-- note -->\n"
                "| StoryTitle1         = '''First''' (Part 1 of 5)<ref>x</ref>\n"
                "| StoryTitle3         = \n}}")
        self.assertEqual(ft.page_fields(text), (2001, "First (Part 1 of 5); Second"))

    def test_blank_titles_give_empty(self):
        self.assertEqual(ft.page_fields("| Year = 2005\n| StoryTitle1 = \n"), (2005, ""))


class ChooseVolume(unittest.TestCase):
    def test_one_fit(self):
        self.assertEqual(ft.choose_volume({("Alias", 1): [(2001, 2001)],
                                           ("Alias", 2): [(None, 2001)]}), ("Alias", 1))

    def test_a_contradicting_rep_rules_a_volume_out(self):
        self.assertIsNone(ft.choose_volume({("X", 1): [(2001, 2001), (1990, 2002)]}))

    def test_two_fits_within_a_year_resolve_to_the_exact_one(self):
        self.assertEqual(ft.choose_volume({("Illuminati", 1): [(2006, 2007)],
                                           ("Illuminati", 2): [(2007, 2007)]}), ("Illuminati", 2))

    def test_two_exact_fits_are_left_alone(self):
        self.assertIsNone(ft.choose_volume({("The X", 1): [(2007, 2007)], ("X", 1): [(2007, 2007)]}))

    def test_nothing_found(self):
        self.assertIsNone(ft.choose_volume({("X", 1): [(None, 2007)]}))


class CandidateDetail(unittest.TestCase):
    def test_lists_the_volumes_that_fit(self):
        d = ft.candidate_detail({("T", 1): [(1997, 1997)], ("T", 2): [(1997, 1997)], ("T", 3): [(None, 1997)]})
        self.assertEqual(d, "fits: T Vol 1 (Fandom 1997 vs cover 1997); T Vol 2 (Fandom 1997 vs cover 1997)")

    def test_pages_that_exist_with_the_wrong_year(self):
        d = ft.candidate_detail({("T", 1): [(1990, 2012)], ("T", 2): [(None, 2012)]})
        self.assertEqual(d, "pages exist but the year is off: T Vol 1 (Fandom 1990 vs cover 2012)")

    def test_nothing_at_all(self):
        d = ft.candidate_detail({("The T", 1): [(None, 2012)], ("T", 1): [(None, 2012)]})
        self.assertEqual(d, f"no page under 'T' / 'The T' Vol 1-{ft.MAX_VOLUME}")


class ApplyTitles(unittest.TestCase):
    cols = ["label", "story_title", "story_title_source", "cover_url"]

    def test_fills_blank_adds_missing_row_and_never_overwrites(self):
        rows = [{"label": "A #1", "story_title": "", "story_title_source": "", "cover_url": "u"},
                {"label": "B #1", "story_title": "Metron's", "story_title_source": "metron", "cover_url": ""}]
        written = ft.apply_titles(rows, {"A #1": "Found", "B #1": "Other", "C #1": "New"}, self.cols)
        self.assertEqual(written, ["A #1", "C #1"])
        by = {r["label"]: r for r in rows}
        self.assertEqual((by["A #1"]["story_title"], by["A #1"]["story_title_source"], by["A #1"]["cover_url"]),
                         ("Found", "hand", "u"))
        self.assertEqual(by["B #1"]["story_title"], "Metron's")
        self.assertEqual((by["C #1"]["story_title"], by["C #1"]["story_title_source"]), ("New", "hand"))


class EndToEnd(unittest.TestCase):
    def test_offline_run_writes_titles_and_logs_them_and_dry_run_does_not(self):
        with tempfile.TemporaryDirectory() as tmp:
            root = Path(tmp)
            data, seed = root / "data", root / "seed"
            data.mkdir()
            seed.mkdir()

            def put(path, cols, rows):
                with path.open("w", newline="", encoding="utf-8") as fh:
                    w = csv.DictWriter(fh, fieldnames=cols)
                    w.writeheader()
                    w.writerows(rows)

            put(seed / "issues.csv", ["id", "label"],
                [{"id": "a1", "label": "Alias (2001) #1"}, {"id": "a2", "label": "Alias (2001) #2"},
                 {"id": "n1", "label": "Nowhere (1999) #1"}])
            put(data / "issue_details.csv", ft.ec.DETAIL_COLUMNS,
                [{"label": "Alias (2001) #1"}, {"label": "Alias (2001) #2"}])
            put(data / "cover_dates.csv", ft.ec.COLUMNS,
                [{"label": "Alias (2001) #1", "cover_date": "2001-11-01", "source": "metron"},
                 {"label": "Alias (2001) #2", "cover_date": "2001-12-01", "source": "metron"},
                 {"label": "Nowhere (1999) #1", "cover_date": "1999", "source": "hand"}])
            cache = root / "cache.json"
            cache.write_text(json.dumps({
                "Alias Vol 1 1": {"exists": True, "year": 2001, "titles": "Alias Investigations (Part 1 of 5)",
                                  "page": "Alias Vol 1 1"},
                "Alias Vol 1 2": {"exists": True, "year": 2001, "titles": "Alias Investigations (Part 2 of 5)",
                                  "page": "Alias Vol 1 2"},
            }), encoding="utf-8")
            log = data / "fandom_titles.csv"
            skipped = data / "fandom_skipped.csv"
            args = ["--data", str(data), "--seed", str(seed), "--cache", str(cache),
                    "--log", str(log), "--skipped", str(skipped),
                    "--pages", str(data / "fandom_pages.csv"), "--offline"]

            before = (data / "issue_details.csv").read_text(encoding="utf-8")
            ft.main(args + ["--dry-run"])
            self.assertEqual((data / "issue_details.csv").read_text(encoding="utf-8"), before)
            self.assertFalse(log.exists())
            with skipped.open(encoding="utf-8", newline="") as fh:
                rows = list(csv.DictReader(fh))
            self.assertEqual([(r["reason"], r["series"], r["label"]) for r in rows],
                             [("no Fandom volume found", "Nowhere (1999)", "Nowhere (1999) #1")])
            self.assertTrue(rows[0]["fandom_link"].startswith("https://marvel.fandom.com/"))
            self.assertIn("match = Nowhere (1999)", rows[0]["fix"])

            ft.main(args)
            with (data / "issue_details.csv").open(encoding="utf-8", newline="") as fh:
                rows = {r["label"]: r for r in csv.DictReader(fh)}
            self.assertEqual(rows["Alias (2001) #1"]["story_title"], "Alias Investigations (Part 1 of 5)")
            self.assertEqual(rows["Alias (2001) #2"]["story_title_source"], "hand")
            with log.open(encoding="utf-8", newline="") as fh:
                self.assertEqual([r["label"] for r in csv.DictReader(fh)],
                                 ["Alias (2001) #1", "Alias (2001) #2"])

    def test_fandom_pages_csv_names_a_volume_for_a_series_and_a_page_for_an_issue(self):
        with tempfile.TemporaryDirectory() as tmp:
            root = Path(tmp)
            data, seed = root / "data", root / "seed"
            data.mkdir()
            seed.mkdir()

            def put(path, cols, rows):
                with path.open("w", newline="", encoding="utf-8") as fh:
                    w = csv.DictWriter(fh, fieldnames=cols)
                    w.writeheader()
                    w.writerows(rows)

            labels = ["Nowhere (1999) #1", "Nowhere (1999) #2", "Odd One (2010) #1"]
            put(seed / "issues.csv", ["id", "label"], [{"id": str(i), "label": l} for i, l in enumerate(labels)])
            put(data / "issue_details.csv", ft.ec.DETAIL_COLUMNS, [{"label": l} for l in labels])
            put(data / "cover_dates.csv", ft.ec.COLUMNS,
                [{"label": l, "cover_date": l[l.index("(") + 1:l.index(")")], "source": "hand"} for l in labels])
            put(data / "fandom_pages.csv", ft.PAGES_COLUMNS, [
                {"match": "Nowhere (1999)", "fandom": "https://marvel.fandom.com/wiki/Nowhere_Land_Vol_2"},
                {"match": "Nowhere (1999) #2", "fandom": "Elsewhere Vol 1 7"},
                {"match": "Odd One (2010) #1", "fandom": "Odd Vol 1 1"},
            ])
            cache = root / "cache.json"
            cache.write_text(json.dumps({
                "Nowhere Land Vol 2 1": {"exists": True, "year": 1999, "titles": "Series Pick"},
                "Elsewhere Vol 1 7": {"exists": True, "year": 1999, "titles": "Issue Pick"},
                "Odd Vol 1 1": {"exists": True, "year": 1970, "titles": "Trusted Anyway"},
            }), encoding="utf-8")
            ft.main(["--data", str(data), "--seed", str(seed), "--cache", str(cache),
                     "--log", str(data / "log.csv"), "--skipped", str(data / "skipped.csv"),
                     "--pages", str(data / "fandom_pages.csv"), "--offline"])
            with (data / "issue_details.csv").open(encoding="utf-8", newline="") as fh:
                got = {r["label"]: r["story_title"] for r in csv.DictReader(fh)}
            self.assertEqual(got, {"Nowhere (1999) #1": "Series Pick", "Nowhere (1999) #2": "Issue Pick",
                                   "Odd One (2010) #1": "Trusted Anyway"})

    def test_none_marks_a_series_or_an_issue_as_having_no_title_without_fetching(self):
        with tempfile.TemporaryDirectory() as tmp:
            root = Path(tmp)
            data, seed = root / "data", root / "seed"
            data.mkdir()
            seed.mkdir()

            def put(path, cols, rows):
                with path.open("w", newline="", encoding="utf-8") as fh:
                    w = csv.DictWriter(fh, fieldnames=cols)
                    w.writeheader()
                    w.writerows(rows)

            labels = ["Fear Itself: Thor (2012) #7.2", "Age of Ultron (2013) #10AI", "Age of Ultron (2013) #1"]
            put(seed / "issues.csv", ["id", "label"], [{"id": str(i), "label": l} for i, l in enumerate(labels)])
            put(data / "issue_details.csv", ft.ec.DETAIL_COLUMNS, [{"label": l} for l in labels])
            put(data / "cover_dates.csv", ft.ec.COLUMNS, [])
            put(data / "fandom_pages.csv", ft.PAGES_COLUMNS, [
                {"match": "Fear Itself: Thor (2012)", "fandom": "none"},
                {"match": "Age of Ultron (2013) #10AI", "fandom": "no title"},
            ])
            skipped = data / "skipped.csv"
            ft.main(["--data", str(data), "--seed", str(seed), "--cache", str(root / "c.json"),
                     "--log", str(data / "log.csv"), "--skipped", str(skipped),
                     "--pages", str(data / "fandom_pages.csv"), "--offline"])
            with skipped.open(encoding="utf-8", newline="") as fh:
                got = {r["label"]: r["reason"] for r in csv.DictReader(fh)}
            self.assertEqual(got["Fear Itself: Thor (2012) #7.2"], ft.NO_TITLE)
            self.assertEqual(got["Age of Ultron (2013) #10AI"], ft.NO_TITLE)
            self.assertNotEqual(got["Age of Ultron (2013) #1"], ft.NO_TITLE)   # only #10AI was marked
            self.assertFalse((root / "c.json").exists())                         # nothing fetched

    def test_a_row_you_add_to_fandom_titles_csv_is_applied_once_and_not_skipped(self):
        with tempfile.TemporaryDirectory() as tmp:
            root = Path(tmp)
            data, seed = root / "data", root / "seed"
            data.mkdir()
            seed.mkdir()

            def put(path, cols, rows):
                with path.open("w", newline="", encoding="utf-8") as fh:
                    w = csv.DictWriter(fh, fieldnames=cols)
                    w.writeheader()
                    w.writerows(rows)

            put(seed / "issues.csv", ["id", "label"], [{"id": "u", "label": "Age of Ultron (2013) #10AI"}])
            put(data / "issue_details.csv", ft.ec.DETAIL_COLUMNS, [{"label": "Age of Ultron (2013) #10AI"}])
            put(data / "cover_dates.csv", ft.ec.COLUMNS,
                [{"label": "Age of Ultron (2013) #10AI", "cover_date": "2013", "source": "metron"}])
            log = data / "fandom_titles.csv"
            put(log, ft.LOG_COLUMNS, [
                {"label": "Age of Ultron (2013) #10AI", "story_title": "Age of Ultron: Book Ten"},
                {"label": "Age of Ultorn (2013) #10AI", "story_title": "typo'd label"},
            ])
            args = ["--data", str(data), "--seed", str(seed), "--cache", str(root / "c.json"),
                    "--log", str(log), "--skipped", str(data / "skipped.csv"),
                    "--pages", str(data / "none.csv"), "--offline"]

            out = io.StringIO()
            with redirect_stdout(out):
                ft.main(args)
            self.assertIn("did you mean 'Age of Ultron (2013) #10AI'?", out.getvalue())
            with (data / "issue_details.csv").open(encoding="utf-8", newline="") as fh:
                row = next(csv.DictReader(fh))
            self.assertEqual((row["story_title"], row["story_title_source"]), ("Age of Ultron: Book Ten", "hand"))
            with (data / "skipped.csv").open(encoding="utf-8", newline="") as fh:
                self.assertEqual(list(csv.DictReader(fh)), [])
            with log.open(encoding="utf-8", newline="") as fh:
                self.assertEqual(len(list(csv.DictReader(fh))), 2)  # not appended a second time


class Renames(unittest.TestCase):
    def test_accepted_rename_is_the_label_and_a_hyphen_row_still_matches_it(self):
        with tempfile.TemporaryDirectory() as tmp:
            root = Path(tmp)
            data, seed = root / "data", root / "seed"
            data.mkdir()
            seed.mkdir()

            def put(path, cols, rows):
                with path.open("w", newline="", encoding="utf-8") as fh:
                    w = csv.DictWriter(fh, fieldnames=cols)
                    w.writeheader()
                    w.writerows(rows)

            old, new = "Death Spiral - Body Count (2026) #1", "Death Spiral – Body Count (2026) #1"
            put(seed / "issues.csv", ["id", "label"], [{"id": "d", "label": old}])
            put(data / "label_review.csv", ["label", "proposed_label", "category", "decision"],
                [{"label": old, "proposed_label": new, "category": "name_style", "decision": "accept"}])
            put(data / "issue_details.csv", ft.ec.DETAIL_COLUMNS, [{"label": new}])
            put(data / "cover_dates.csv", ft.ec.COLUMNS, [])
            put(data / "fandom_pages.csv", ft.PAGES_COLUMNS,
                [{"match": "Death Spiral - Body Count (2026)", "fandom": "Death Spiral Body Count Vol 1"}])
            cache = root / "c.json"
            cache.write_text(json.dumps({"Death Spiral Body Count Vol 1 1":
                                         {"exists": True, "year": 2026, "titles": ""}}), encoding="utf-8")
            skipped = data / "skipped.csv"
            ft.main(["--data", str(data), "--seed", str(seed), "--cache", str(cache),
                     "--log", str(data / "log.csv"), "--skipped", str(skipped),
                     "--pages", str(data / "fandom_pages.csv"), "--offline"])
            with skipped.open(encoding="utf-8", newline="") as fh:
                rows = list(csv.DictReader(fh))
            self.assertEqual([(r["label"], r["reason"]) for r in rows], [(new, ft.NO_TITLE)])

    def test_label_key_ignores_dash_style_spacing_and_case(self):
        self.assertEqual(ft.label_key("A – B  (2026)"), ft.label_key("a - b (2026)"))


class Overrides(unittest.TestCase):
    def test_page_name_from_url_underscores_or_plain(self):
        self.assertEqual(ft.page_name("https://marvel.fandom.com/wiki/X-23_Vol_3?foo=1"), "X-23 Vol 3")
        self.assertEqual(ft.page_name("Journey_into_Mystery_Vol_1"), "Journey into Mystery Vol 1")
        self.assertEqual(ft.page_name(" Siege  Prologue Vol 1 1 "), "Siege Prologue Vol 1 1")

    def test_a_volume_fixes_a_series_a_page_fixes_an_issue(self):
        series, issues, blank, problems = ft.read_overrides([
            {"match": "Thunderbolts (2006)", "fandom": "Thunderbolts Vol 1"},
            {"match": "Siege Prologue (2009) Digital Chapter", "fandom": "Siege Prologue Vol 1 1"},
            {"match": "Fear Itself: Thor (2012)", "fandom": "None"},
            {"match": "X", "fandom": "not a page"},
            {"match": "Y", "fandom": ""},
            {"match": "", "fandom": ""},
        ])
        self.assertEqual(series, {"Thunderbolts (2006)": "Thunderbolts Vol 1"})
        self.assertEqual(issues, {"Siege Prologue (2009) Digital Chapter": "Siege Prologue Vol 1 1"})
        self.assertEqual(blank, {"Fear Itself: Thor (2012)"})
        self.assertEqual(len(problems), 2)

    def test_fix_hint_says_series_or_issue(self):
        self.assertIn("match = T (2006)", ft.fix_hint("no Fandom volume found", "T (2006)", "T (2006) #1"))
        self.assertIn("match = T (2006) #1", ft.fix_hint("no Fandom page for the issue", "T (2006)", "T (2006) #1"))


if __name__ == "__main__":
    unittest.main()
