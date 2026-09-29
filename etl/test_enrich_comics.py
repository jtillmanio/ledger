"""Tests for etl/enrich_comics.py. No network: Metron is faked.

    py -m unittest discover -s etl -p "test_*.py"
"""

import csv
import json
import sqlite3
import sys
import tempfile
import unittest
from pathlib import Path
from unittest import mock

sys.path.insert(0, str(Path(__file__).parent))
import enrich_comics as ec  # noqa: E402


class ParseLabel(unittest.TestCase):
    def test_shapes_in_the_catalog(self):
        cases = {
            "Avengers (1998) #56": ("Avengers", 1998, "56"),
            "FF #1": ("FF", None, "1"),
            "Thunderbolts: Distant Rumblings #-1": ("Thunderbolts: Distant Rumblings", None, "-1"),
            "Fantastic Four (1961) #605.1": ("Fantastic Four", 1961, "605.1"),
            "Amazing Spider-Man (2018) #16.HU": ("Amazing Spider-Man", 2018, "16.hu"),
            "Avengers (1963) #1⁄2": ("Avengers", 1963, "1/2"),
            "Marvel Graphic Novel (1982) #27 - Emperor Doom": ("Marvel Graphic Novel", 1982, "27"),
            "Fear Itself #7.1: Captain America": ("Fear Itself", None, "7.1"),
            "Empyre #0: Fantastic Four": ("Empyre", None, "0"),
            "Iron Man (1968) #007": ("Iron Man", 1968, "7"),
        }
        for label, want in cases.items():
            p = ec.parse_label(label)
            self.assertIsNotNone(p, label)
            self.assertEqual((p.title, p.year, p.number), want, label)

    def test_freeform_labels_have_no_number(self):
        for label in ["Dark Reign: The Cabal", "Avengers Annual (1999)", "Avengers Finale"]:
            self.assertIsNone(ec.parse_label(label), label)

    def test_trailing_punctuation_on_a_number(self):
        self.assertEqual(ec.parse_label("X-Men (1991) #8-").number, "8")

    def test_freeform_labels_are_tried_as_one_shots(self):
        p = ec.parse_oneshot("Avengers Annual (1999)")
        self.assertEqual((p.title, p.year, p.number), ("Avengers Annual", 1999, "1"))
        p = ec.parse_oneshot("Avengers Finale")
        self.assertEqual((p.title, p.year, p.number), ("Avengers Finale", None, "1"))
        self.assertIsNone(ec.parse_oneshot("Civil War II: The Fallen \u00b7 The Accused"))


class PickSeries(unittest.TestCase):
    def cand(self, sid, name, year, count, publisher="Marvel"):
        return {"id": sid, "series": f"{name} ({year})", "year_began": year,
                "issue_count": count, "publisher": {"id": 1, "name": publisher}}

    def test_year_in_label_selects_that_volume(self):
        c = [self.cand(1, "Avengers", 1963, 402), self.cand(2, "Avengers", 1998, 84)]
        s, status, _ = ec.pick_series("Avengers", 1998, c, 56)
        self.assertEqual((s["id"], status), (2, "ok"))

    def test_similar_names_do_not_match(self):
        c = [self.cand(1, "Avengers Academy", 2010, 39), self.cand(2, "West Coast Avengers", 1985, 102)]
        s, status, _ = ec.pick_series("Avengers", None, c, 5)
        self.assertEqual((s, status), (None, "no_series"))

    def test_yearless_label_infers_only_volume_long_enough(self):
        c = [self.cand(1, "Tales of Suspense", 1959, 99), self.cand(2, "Tales of Suspense", 1995, 1)]
        s, status, note = ec.pick_series("Tales of Suspense", None, c, 97)
        self.assertEqual((s["id"], status), (1, "ok"))
        self.assertIn("inferred", note)

    def test_yearless_label_with_two_plausible_volumes_is_left_for_a_human(self):
        c = [self.cand(1, "Captain America", 1968, 454), self.cand(2, "Captain America", 2002, 50)]
        s, status, _ = ec.pick_series("Captain America", None, c, 8)
        self.assertEqual((s, status), (None, "ambiguous_volume"))

    def test_marvel_preferred_over_other_publishers(self):
        c = [self.cand(1, "Nomad", 1992, 25), self.cand(2, "Nomad", 1992, 4, publisher="Other")]
        s, status, _ = ec.pick_series("Nomad", 1992, c, 4)
        self.assertEqual((s["id"], status), (1, "ok"))


class MergeRows(unittest.TestCase):
    def test_hand_entered_dates_are_never_overwritten(self):
        existing = {
            "A #1": {"label": "A #1", "cover_date": "1990-05", "source": "hand", "status": "no_series"},
            "B #1": {"label": "B #1", "cover_date": "1991-01-01", "source": "metron", "status": "matched"},
            "C #1": {"label": "C #1", "cover_date": "", "source": "", "status": "no_series"},
            "D #1": {"label": "D #1", "cover_date": "2001-01-01", "source": "metron", "status": "matched"},
        }
        fresh = {
            "A #1": ec.row("A #1", "matched", date="1999-09-01"),
            "B #1": ec.row("B #1", "matched", date="1991-02-01"),
            "C #1": ec.row("C #1", "matched", date="1992-03-01"),
        }
        rows = {r["label"]: r for r in ec.merge_rows(existing, fresh)}
        self.assertEqual(rows["A #1"]["cover_date"], "1990-05")          # hand kept
        self.assertEqual(rows["B #1"]["cover_date"], "1991-02-01")       # metron refreshed
        self.assertEqual(rows["C #1"]["cover_date"], "1992-03-01")       # blank filled
        self.assertEqual(rows["D #1"]["cover_date"], "2001-01-01")       # not in this run, kept

    def test_a_failed_lookup_never_erases_a_date(self):
        existing = {
            "X #1": {"label": "X #1", "cover_date": "2010-05-01", "source": "metron",
                     "status": "matched", "metron_issue_id": "42"},
            "Y #1": {"label": "Y #1", "cover_date": "2011-01-01", "source": "", "status": ""},
        }
        fresh = {
            "X #1": ec.row("X #1", "ambiguous_volume", "Metron has 2 series named X"),
            "Y #1": ec.row("Y #1", "no_series", "no Metron series named 'Y'"),
        }
        rows = {r["label"]: r for r in ec.merge_rows(existing, fresh)}
        self.assertEqual(rows["X #1"]["cover_date"], "2010-05-01")
        self.assertEqual(rows["X #1"]["metron_issue_id"], "42")
        self.assertEqual(rows["Y #1"]["cover_date"], "2011-01-01")


class MetronFake(unittest.TestCase):
    PAGES: dict = {}

    def fake_fetch(self, url, attempt=1):
        self.fetched.append(url)
        key = url.replace(ec.API, "")
        return json.dumps(self.PAGES[key])

    def run_once(self, *extra):
        argv = ["--issues", str(self.dir / "issues.csv"), "--out", str(self.dir / "cover_dates.csv"),
                "--cache", str(self.dir / "cache.sqlite"), "--env", str(self.dir / "none.env"),
                "--run-issues", str(self.dir / "run_issues.csv"),
                "--workbook-runs", str(self.dir / "workbook_run_fields.csv"),
                "--details-out", str(self.dir / "issue_details.csv"),
                "--credits-out", str(self.dir / "issue_credits.csv"),
                "--label-review", str(self.dir / "label_review.csv"), *extra]
        with mock.patch.object(ec.Metron, "_fetch", self.fake_fetch), \
             mock.patch.dict("os.environ", {"METRON_API_TOKEN": "t"}), \
             mock.patch("sys.stdout"):
            return ec.main(argv)


class EndToEnd(MetronFake):
    """A full run against a fake Metron: pagination, early stop, cache, CSV."""

    PAGES = {
        "series/?name=Avengers&year_began=1998": {
            "next": None, "results": [
                {"id": 7, "series": "Avengers (1998)", "year_began": 1998, "issue_count": 84,
                 "publisher": {"name": "Marvel"}}]},
        "series/7/issue_list/": {
            "next": "https://metron.cloud/api/series/7/issue_list/?page=2", "results": [
                {"id": 701, "number": "1", "cover_date": "1998-02-01"},
                {"id": 702, "number": "2", "cover_date": "1998-03-01"}]},
        "series/7/issue_list/?page=2": {
            "next": "https://metron.cloud/api/series/7/issue_list/?page=3", "results": [
                {"id": 703, "number": "3", "cover_date": "1998-04-01"}]},
        "series/7/issue_list/?page=3": {
            "next": None, "results": [{"id": 799, "number": "84", "cover_date": "2004-08-01"}]},
        "series/?name=Nonexistent": {"next": None, "results": []},
        "series/?name=Dark+Reign%3A+The+Cabal": {"next": None, "results": [
            {"id": 9, "series": "Dark Reign: The Cabal (2009)", "year_began": 2009,
             "issue_count": 1, "publisher": {"name": "Marvel"}}]},
        "series/9/issue_list/": {"next": None, "results": [
            {"id": 901, "number": "1", "cover_date": "2009-08-01"}]},
    }

    def setUp(self):
        self.dir = Path(tempfile.mkdtemp())
        with (self.dir / "issues.csv").open("w", newline="", encoding="utf-8") as fh:
            w = csv.writer(fh)
            w.writerow(["id", "run_id", "sequence", "label", "type", "notes"])
            for n, label in enumerate(["Avengers (1998) #1", "Avengers (1998) #3",
                                       "Avengers (1998) #1", "Nonexistent #4",
                                       "Dark Reign: The Cabal"], start=1):
                w.writerow([f"r#{n:04d}", "r", n, label, "core", ""])
        self.fetched = []

    def test_run_writes_dates_and_second_run_is_free(self):
        self.assertEqual(self.run_once(), 0)
        with (self.dir / "cover_dates.csv").open(encoding="utf-8") as fh:
            rows = {r["label"]: r for r in csv.DictReader(fh)}
        self.assertEqual(rows["Avengers (1998) #1"]["cover_date"], "1998-02-01")
        self.assertEqual(rows["Avengers (1998) #3"]["source"], "metron")
        self.assertEqual(rows["Nonexistent #4"]["status"], "no_series")
        self.assertEqual(rows["Dark Reign: The Cabal"]["cover_date"], "2009-08-01")  # one-shot
        # Stopped paging once #1 and #3 were found: page 3 never requested.
        self.assertFalse(any("page=3" in u for u in self.fetched))
        first = len(self.fetched)
        self.assertEqual(self.run_once(), 0)
        self.assertEqual(len(self.fetched), first, "second run should come entirely from cache")

    def test_dry_run_writes_no_csv(self):
        self.assertEqual(self.run_once("--dry-run"), 0)
        for name in ("cover_dates", "issue_details", "label_review", "issue_credits"):
            self.assertFalse((self.dir / f"{name}.csv").exists(), name)



class ClassifyLabel(unittest.TestCase):
    def test_categories(self):
        cases = [
            ("Avengers (1998) #1", "Avengers (1998) #1", None),
            ("A.X.E.: Avengers", "A.X.E.: Avengers (2022) #1", "oneshot_number"),
            ("AXIS: Carnage #1", "Axis: Carnage (2014) #1", "year_added"),
            ("Amazing Spider-Man (1963) #129", "The Amazing Spider-Man (1963) #129", "name_style"),
            ('Incoming #1 Bar Sinister"', "Incoming (2020) #1", "subtitle"),
            ("Marvel Graphic Novel (1982) #27 - Emperor Doom", "Marvel Graphic Novel (1982) #27", "subtitle"),
        ]
        for label, canonical, want in cases:
            self.assertEqual(ec.classify_label(label, canonical), want, label)


class Credits(unittest.TestCase):
    DETAIL = {"name": ["Once an Avenger", " ", "Backup"], "image": "https://x/1.jpg", "credits": [
        {"id": 11, "creator": "Kurt Busiek", "role": [{"id": 1, "name": "Writer"}]},
        {"id": 12, "creator": "George Pérez", "role": [{"id": 2, "name": "Penciller"},
                                                      {"id": 3, "name": "Breakdowns"},
                                                      {"id": 4, "name": "Cover"}]},
        {"id": 13, "creator": "Tom Brevoort", "role": [{"id": 5, "name": "Editor"}]},
        {"id": 14, "creator": "Al Vey", "role": [{"id": 6, "name": "Inker"}]},
        {"id": 15, "creator": "Tom Smith", "role": [{"id": 7, "name": "Colorist"}]},
        {"id": 16, "creator": "Richard Starkings", "role": [{"id": 8, "name": "Letterer"}]},
    ]}

    def test_six_roles_mapped_editors_dropped_duplicates_collapsed(self):
        self.assertEqual(ec.map_credits(self.DETAIL), [
            ("Kurt Busiek", 11, "writer"), ("George Pérez", 12, "artist"),
            ("George Pérez", 12, "cover"), ("Al Vey", 14, "inker"),
            ("Tom Smith", 15, "colorist"), ("Richard Starkings", 16, "letterer")])
        self.assertEqual(ec.story_title(self.DETAIL), "Once an Avenger; Backup")

    def c(self, label, creator, role, source="metron"):
        return {"label": label, "creator": creator, "metron_creator_id": "", "role": role,
                "source": source}

    def test_hand_credits_own_their_role(self):
        existing = [self.c("A #1", "Me", "writer", "hand"),
                    self.c("A #1", "Old Artist", "artist"),
                    self.c("A #1", "Old Letterer", "letterer"),
                    self.c("B #1", "Untouched", "writer")]
        fresh = {"A #1": [self.c("A #1", "Metron Writer", "writer"),
                          self.c("A #1", "New Artist", "artist")]}
        rows = {(r["label"], r["role"], r["creator"]) for r in ec.merge_credits(existing, fresh)}
        self.assertEqual(rows, {("A #1", "writer", "Me"),            # hand pair left alone
                                ("A #1", "artist", "New Artist"),    # metron refreshed
                                ("B #1", "writer", "Untouched")})    # letterer gone from Metron

    def test_hand_story_title_survives_and_detailed_status_sticks(self):
        existing = {"A #1": {"label": "A #1", "story_title": "Mine", "story_title_source": "hand",
                             "cover_url": "", "status": "detailed"}}
        fresh = {"A #1": {"label": "A #1", "story_title": "Metron's", "story_title_source": "metron",
                          "cover_url": "https://x/1.jpg", "status": "listed"}}
        row = ec.merge_details(existing, fresh)[0]
        self.assertEqual((row["story_title"], row["story_title_source"], row["cover_url"], row["status"]),
                         ("Mine", "hand", "https://x/1.jpg", "detailed"))


class Rekey(unittest.TestCase):
    def test_accepted_rename_moves_rows_and_hand_wins(self):
        renames = {"Pulse #1": "The Pulse (2004) #1", "Pulse #2": "The Pulse (2004) #2"}
        dates = [
            {"label": "Pulse #1", "cover_date": "2004-04", "source": "hand"},
            {"label": "The Pulse (2004) #1", "cover_date": "2004-04-01", "source": "metron"},
            {"label": "Pulse #2", "cover_date": "", "source": ""},
            {"label": "The Pulse (2004) #2", "cover_date": "2004-05-01", "source": "metron"},
        ]
        rows, moved = ec.rekey(dates, renames, True, ("cover_date", "source"))
        by = {r["label"]: r for r in rows}
        self.assertEqual(moved, 2)
        self.assertEqual(sorted(by), ["The Pulse (2004) #1", "The Pulse (2004) #2"])
        self.assertEqual(by["The Pulse (2004) #1"]["source"], "hand")
        self.assertEqual(by["The Pulse (2004) #2"]["cover_date"], "2004-05-01")

    def test_credit_rows_move_and_hand_role_wins(self):
        c = lambda label, who, role, src: {"label": label, "creator": who, "metron_creator_id": "",
                                           "role": role, "source": src}
        rows, moved = ec.rekey([c("Pulse #1", "Bendis", "writer", "hand"),
                                c("The Pulse (2004) #1", "B. M. Bendis", "writer", "metron"),
                                c("The Pulse (2004) #1", "Bagley", "artist", "metron")],
                               {"Pulse #1": "The Pulse (2004) #1"}, False)
        self.assertEqual(moved, 1)
        self.assertEqual({(r["creator"], r["role"]) for r in rows},
                         {("Bendis", "writer"), ("Bagley", "artist")})


class MergeReview(unittest.TestCase):
    def row(self, label, proposed, decision=""):
        return {"label": label, "proposed_label": proposed, "category": "year_added",
                "runs": "r", "evidence": "e", "decision": decision}

    def test_decisions_survive_unchanged_proposals_and_rows_are_never_deleted(self):
        existing = {"A #1": self.row("A #1", "A (2001) #1", "accept"),
                    "B #1": self.row("B #1", "B (2001) #1", "reject"),
                    "Gone #1": self.row("Gone #1", "Gone (1990) #1", "accept")}
        fresh = {"A #1": self.row("A #1", "A (2001) #1"),
                 "B #1": self.row("B #1", "B (2011) #1")}
        rows = {r["label"]: r for r in ec.merge_review(existing, fresh)}
        self.assertEqual(rows["A #1"]["decision"], "accept")
        self.assertEqual(rows["B #1"]["decision"], "")          # proposal changed: ask again
        self.assertIn("decision 'reject' cleared", rows["B #1"]["evidence"])
        self.assertEqual(rows["Gone #1"]["decision"], "accept")  # already applied; kept


class Proposals(MetronFake):
    """Label proposals and cover URLs from the date pass; wrong volumes."""

    PAGES = {
        **EndToEnd.PAGES,
        "series/?name=AXIS%3A+Carnage": {"next": None, "results": [
            {"id": 30, "series": "Axis: Carnage (2014)", "year_began": 2014, "issue_count": 3,
             "publisher": {"name": "Marvel"}}]},
        "series/7/issue_list/": {"next": None, "results": [
            {"id": 701, "number": "1", "issue": "Avengers (1998) #1", "cover_date": "1998-02-01",
             "image": "https://x/701.jpg"},
            {"id": 703, "number": "3", "issue": "Avengers (1998) #3", "cover_date": "1998-04-01"}]},
        "series/?name=Axis%3A+Carnage&year_began=2014": {"next": None, "results": [
            {"id": 30, "series": "Axis: Carnage (2014)", "year_began": 2014, "issue_count": 3,
             "publisher": {"name": "Marvel"}}]},
        "series/?name=Axis%3A+Carnage": {"next": None, "results": [
            {"id": 30, "series": "Axis: Carnage (2014)", "year_began": 2014, "issue_count": 3,
             "publisher": {"name": "Marvel"}}]},
        "series/30/issue_list/": {"next": None, "results": [
            {"id": 3001, "number": "1", "issue": "Axis: Carnage (2014) #1", "cover_date": "2014-12-01"}]},
        "series/?name=Secret+Wars&year_began=2015": {"next": None, "results": [
            {"id": 40, "series": "Secret Wars (2015)", "year_began": 2015, "issue_count": 9,
             "publisher": {"name": "Marvel"}}]},
        "series/40/issue_list/": {"next": None, "results": [
            {"id": 4001, "number": "1", "issue": "Secret Wars (2015) #1", "cover_date": "2015-07-01"}]},
        "series/?name=Secret+Wars": {"next": None, "results": [
            {"id": 40, "series": "Secret Wars (2015)", "year_began": 2015, "year_end": 2016,
             "issue_count": 9, "publisher": {"name": "Marvel"}},
            {"id": 41, "series": "Marvel Super Heroes Secret Wars (1984)", "year_began": 1984,
             "issue_count": 12, "publisher": {"name": "Marvel"}},
            {"id": 42, "series": "Secret Wars (1984)", "year_began": 1984, "year_end": 1985,
             "issue_count": 12, "publisher": {"name": "Marvel"}}]},
        "series/42/issue_list/": {"next": None, "results": [
            {"id": 4201, "number": "1", "issue": "Secret Wars (1984) #1", "cover_date": "1984-05-01"}]},
        "issue/701/": {"name": ["Once an Avenger"], "image": "https://x/701.jpg", "credits": [
            {"id": 11, "creator": "Kurt Busiek", "role": [{"id": 1, "name": "Writer"}]},
            {"id": 12, "creator": "George Pérez", "role": [{"id": 2, "name": "Penciller"}]}]},
        "issue/703/": {"name": [], "credits": []},
        "issue/4001/": {"name": ["Omega"], "credits": []},
        "issue/3001/": {"name": ["Chapter One"], "credits": [
            {"id": 21, "creator": "Rick Remender", "role": [{"id": 1, "name": "Writer"}]}]},
    }

    def setUp(self):
        self.dir = Path(tempfile.mkdtemp())
        labels = [("avengers-1998-1", "Avengers (1998) #1", "r"), ("avengers-1998-3", "Avengers (1998) #3", "r"),
                  ("axis-carnage-1", "AXIS: Carnage #1", "r"), ("secret-wars-2015-1", "Secret Wars (2015) #1", "sw")]
        with (self.dir / "issues.csv").open("w", newline="", encoding="utf-8") as fh:
            w = csv.writer(fh)
            w.writerow(["id", "label"])
            w.writerows((i, label) for i, label, _ in labels)
        with (self.dir / "run_issues.csv").open("w", newline="", encoding="utf-8") as fh:
            w = csv.writer(fh)
            w.writerow(["run_id", "sequence", "issue_id", "type", "notes"])
            w.writerows((run, n, i, "core", "") for n, (i, _, run) in enumerate(labels, start=1))
        with (self.dir / "workbook_run_fields.csv").open("w", newline="", encoding="utf-8") as fh:
            w = csv.writer(fh)
            w.writerow(["id", "series_issues", "start_year", "end_year", "writer", "artists"])
            w.writerow(["r", "", "1998", "2015", "", ""])
            w.writerow(["sw", "", "1984", "1985", "", ""])
        self.fetched = []

    def csv(self, name):
        with (self.dir / f"{name}.csv").open(encoding="utf-8") as fh:
            return {r["label"]: r for r in csv.DictReader(fh)}

    def test_proposals_and_cover_urls(self):
        self.assertEqual(self.run_once(), 0)
        review = self.csv("label_review")
        self.assertEqual(set(review), {"AXIS: Carnage #1", "Secret Wars (2015) #1"})
        self.assertEqual((review["AXIS: Carnage #1"]["proposed_label"], review["AXIS: Carnage #1"]["category"]),
                         ("Axis: Carnage (2014) #1", "year_added"))
        sw = review["Secret Wars (2015) #1"]
        # Dated 2015 in a run the workbook puts in 1984-85: the 1984 volume is proposed,
        # and "Marvel Super Heroes Secret Wars" is not mistaken for a same-named series.
        self.assertEqual((sw["category"], sw["proposed_label"]), ("wrong_volume", "Secret Wars (1984) #1"))
        self.assertEqual(self.csv("issue_details")["Avengers (1998) #1"]["cover_url"], "https://x/701.jpg")

    def test_decisions_survive_a_rerun_and_accepts_rekey_sidecars(self):
        self.run_once()
        rows = list(self.csv("label_review").values())
        for r in rows:
            r["decision"] = "accept" if r["label"] == "AXIS: Carnage #1" else "reject"
        ec.write_csv(self.dir / "label_review.csv", ec.REVIEW_COLUMNS, rows)
        dates = list(self.csv("cover_dates").values())
        for r in dates:
            if r["label"] == "AXIS: Carnage #1":
                r.update(cover_date="2014-12", source="hand")
        ec.write_csv(self.dir / "cover_dates.csv", ec.COLUMNS, dates)
        self.assertEqual(self.run_once(), 0)
        self.assertEqual(self.csv("label_review")["AXIS: Carnage #1"]["decision"], "accept")
        moved = self.csv("cover_dates")
        self.assertNotIn("AXIS: Carnage #1", moved)
        self.assertEqual((moved["Axis: Carnage (2014) #1"]["cover_date"],
                          moved["Axis: Carnage (2014) #1"]["source"]), ("2014-12", "hand"))

    def test_details_pass_writes_titles_and_credits_and_keeps_hand_credits(self):
        self.run_once()
        ec.write_csv(self.dir / "issue_credits.csv", ec.CREDIT_COLUMNS, [
            {"label": "Avengers (1998) #1", "creator": "Kurt Busiek", "metron_creator_id": "",
             "role": "writer", "source": "hand"}])
        self.assertEqual(self.run_once("--details", "--dry-run"), 0)
        self.assertNotIn("George Pérez", (self.dir / "issue_credits.csv").read_text(encoding="utf-8"))
        self.assertEqual(self.run_once("--details"), 0)
        details = self.csv("issue_details")
        self.assertEqual((details["Avengers (1998) #1"]["story_title"],
                          details["Avengers (1998) #1"]["status"]), ("Once an Avenger", "detailed"))
        self.assertIn("no credits on Metron", details["Avengers (1998) #3"]["note"])
        with (self.dir / "issue_credits.csv").open(encoding="utf-8") as fh:
            credits = [(r["label"], r["creator"], r["role"], r["source"]) for r in csv.DictReader(fh)]
        self.assertIn(("Avengers (1998) #1", "Kurt Busiek", "writer", "hand"), credits)
        self.assertIn(("Avengers (1998) #1", "George Pérez", "artist", "metron"), credits)
        self.assertNotIn(("Avengers (1998) #1", "Kurt Busiek", "writer", "metron"), credits)
        # Every detail page is cached: a second details pass costs nothing.
        first = len(self.fetched)
        self.assertEqual(self.run_once("--details"), 0)
        self.assertEqual(len(self.fetched), first)

    def test_refresh_re_asks_only_about_uncredited_issues_and_resumes(self):
        self.run_once()
        self.run_once("--details")
        self.PAGES = {**self.PAGES, "issue/703/": {"name": ["Late Title"], "credits": [
            {"id": 13, "creator": "Kurt Busiek", "role": [{"id": 1, "name": "Writer"}]}]}}
        first = len(self.fetched)
        self.run_once("--details", "--refresh")         # fetched moments ago: too fresh to re-ask
        self.assertEqual(len(self.fetched), first)
        db = sqlite3.connect(self.dir / "cache.sqlite")
        db.execute("UPDATE responses SET fetched_at = datetime('now', '-30 days')")
        db.commit()
        db.close()
        self.assertEqual(self.run_once("--details", "--refresh"), 0)
        # Both issues Metron credited nobody on are re-asked; the credited one isn't.
        self.assertEqual(sorted(u.replace(ec.API, "") for u in self.fetched[first:]),
                         ["issue/4001/", "issue/703/"])
        with (self.dir / "issue_credits.csv").open(encoding="utf-8") as fh:
            credits = [(r["label"], r["creator"], r["role"]) for r in csv.DictReader(fh)]
        self.assertIn(("Avengers (1998) #3", "Kurt Busiek", "writer"), credits)
        self.assertEqual(self.csv("issue_details")["Avengers (1998) #3"]["story_title"], "Late Title")
        # The refreshed page is fresh again, so a re-run (say, after the quota ran out) skips it.
        self.run_once("--details", "--refresh")
        self.assertEqual(len(self.fetched), first + 2)

    def test_refresh_needs_details(self):
        with self.assertRaises(SystemExit), mock.patch("sys.stderr"):
            self.run_once("--refresh")


if __name__ == "__main__":
    unittest.main()
