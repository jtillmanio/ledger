"""Tests for etl/extract.py: sidecar inputs, issues and placements, labels, credits.

    py -m unittest discover -s etl -p "test_*.py"
"""

import csv
import json
import sys
import tempfile
import unittest
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent))
import extract as ex  # noqa: E402


def write_csv(rows: list[dict]) -> Path:
    path = Path(tempfile.mkdtemp()) / "f.csv"
    with path.open("w", newline="", encoding="utf-8") as fh:
        w = csv.DictWriter(fh, fieldnames=list(rows[0]))
        w.writeheader()
        w.writerows(rows)
    return path


class NormalizeDate(unittest.TestCase):
    def test_partial_dates_keep_their_year(self):
        self.assertEqual(ex.normalize_date("1987"), "1987-01-01")
        self.assertEqual(ex.normalize_date("1987-3"), "1987-03-01")
        self.assertEqual(ex.normalize_date("1987-03-15"), "1987-03-15")

    def test_garbage_is_rejected(self):
        for raw in ["", "March 1987", "1987-13", "2910", "87"]:
            self.assertIsNone(ex.normalize_date(raw), raw)


class CoverDates(unittest.TestCase):
    def setUp(self):
        ex.COVER_DATES.clear()
        ex.UNRESOLVED.clear()

    def test_dated_rows_load_and_undated_or_unsourced_rows_do_not(self):
        ex.load_cover_dates(write_csv([
            {"label": "Avengers (1998) #1", "cover_date": "1998-02-01", "source": "metron",
             "metron_issue_id": "701"},
            {"label": "Dark Reign: The Cabal", "cover_date": "2009-06", "source": "hand",
             "metron_issue_id": ""},
            {"label": "Mystery #1", "cover_date": "", "source": "", "metron_issue_id": ""},
            {"label": "Typo #1", "cover_date": "2001-01-01", "source": "", "metron_issue_id": ""},
        ]))
        self.assertEqual(ex.COVER_DATES["Avengers (1998) #1"], ("1998-02-01", "metron", 701))
        self.assertEqual(ex.COVER_DATES["Dark Reign: The Cabal"], ("2009-06-01", "hand", None))
        self.assertNotIn("Mystery #1", ex.COVER_DATES)
        self.assertNotIn("Typo #1", ex.COVER_DATES)
        self.assertTrue(any(u["reason"] == "date without a valid source" for u in ex.UNRESOLVED))


class WhyReview(unittest.TestCase):
    def setUp(self):
        ex.WHY_REVIEW.clear()
        ex.UNRESOLVED.clear()
        ex.load_why_review(write_csv([
            {"run_id": "a", "decision": "accept", "proposed_why": "Drafted.", "final_why": ""},
            {"run_id": "b", "decision": "edit", "proposed_why": "Drafted.", "final_why": "Mine."},
            {"run_id": "c", "decision": "keep", "proposed_why": "Drafted.", "final_why": ""},
            {"run_id": "d", "decision": "", "proposed_why": "Drafted.", "final_why": ""},
            {"run_id": "e", "decision": "edit", "proposed_why": "Drafted.", "final_why": ""},
        ]))

    def test_decisions(self):
        self.assertEqual(ex.resolve_why("a", "Old."), ("Drafted.", "claude"))
        self.assertEqual(ex.resolve_why("b", "Old."), ("Mine.", "hand"))
        self.assertEqual(ex.resolve_why("c", "Old."), ("Old.", "hand"))
        self.assertEqual(ex.resolve_why("d", "Old."), ("Old.", "hand"))   # unreviewed keeps
        self.assertEqual(ex.resolve_why("z", "Old."), ("Old.", "hand"))   # not in the file
        self.assertEqual(ex.resolve_why("e", "Old."), ("Old.", "hand"))   # edit with no text
        self.assertTrue(any(u["reason"] == "edit with no final_why" for u in ex.UNRESOLVED))



def build_workbook(reading_orders: list[tuple], runs: list[tuple],
                   prereqs: list[tuple] = ()) -> Path:
    """A minimal Comics.xlsx: RUNS, PREREQS, Reading Orders, EVENTS, Master."""
    import pandas as pd
    path = Path(tempfile.mkdtemp()) / "Comics.xlsx"
    with pd.ExcelWriter(path) as xw:
        pd.DataFrame(runs, columns=["Run ID", "Title", "Track", "Writer", "Artists"]) \
            .to_excel(xw, sheet_name="RUNS", index=False)
        pd.DataFrame(list(prereqs), columns=["Run ID", "Prereq Run ID", "Type"]) \
            .to_excel(xw, sheet_name="PREREQS", index=False)
        pd.DataFrame(reading_orders, columns=["Run ID", "Issue", "Completed", "Type", "Notes"]) \
            .to_excel(xw, sheet_name="Reading Orders", index=False)
        pd.DataFrame(columns=["Event", "Year", "Verdict", "Home", "Note", "Runs Touched"]) \
            .to_excel(xw, sheet_name="EVENTS", index=False)
        pd.DataFrame(columns=["Title"]).to_excel(xw, sheet_name="Master", index=False)
    return path


def read(out: Path, name: str) -> list[dict]:
    with (out / f"{name}.csv").open(newline="", encoding="utf-8") as fh:
        return list(csv.DictReader(fh))


class WorkbookCase(unittest.TestCase):
    RUNS = [("a", "Run A", "Avengers", "Kurt Busiek", "George Perez"),
            ("b", "Run B", "Avengers", "Stan Lee", None)]

    def setUp(self):
        for table in (ex.UNRESOLVED, ex.COVER_DATES, ex.WHY_REVIEW, ex.LABEL_RENAMES,
                      ex.ISSUE_DETAILS, ex.ISSUE_CREDITS, ex.VOLUME_MAP, ex.VOLUME_RULES, ex.CREATOR_ALIASES):
            table.clear()
        ex.USED_RENAMES.clear()
        self.out = Path(tempfile.mkdtemp())

    def extract(self, rows):
        from unittest import mock
        with mock.patch("sys.stdout"):
            ex.extract_comics(build_workbook(rows, self.RUNS), self.out)

    def reasons(self):
        return [u["reason"] for u in ex.UNRESOLVED]


class VolumeRules(WorkbookCase):
    COLUMNS = ["series", "run_id", "issue_from", "issue_to", "proposed_year", "approved"]

    def rules(self, *rows):
        """Load a volume map of (series, run, from, to, year, approved) rows, extract, read the CSV."""
        from unittest import mock
        ex.load_volume_map(write_csv([dict(zip(self.COLUMNS, r)) for r in rows]))
        self.extract([("a", "Avengers (1998) #1", False, "Core", None)])
        with mock.patch("sys.stdout"):
            return read(self.out, "volume_rules")

    def test_writes_the_approved_rules_with_a_year(self):
        # AC-1: a run-scoped rule, an any-run rule, and an approved row with no year.
        rules = self.rules(("Avengers", "a", "", "", "1998", "yes"),
                           ("Captain America", "", "", "", "1968", "yes"),
                           ("Thor", "", "", "", "", "yes"),
                           ("Hulk", "", "", "", "1999", "no"))
        self.assertEqual([(r["series"], r["run_id"], r["year"]) for r in rules],
                         [("Avengers", "a", "1998"), ("Captain America", "", "1968")])
        self.assertIn("approved with no year", self.reasons())

    def test_header_and_nulls(self):
        # AC-2: the table's columns in order; a range keeps its bounds, any-issue is empty.
        self.rules(("Avengers", "a", "10", "20", "1998", "yes"),
                   ("Captain America", "", "", "", "1968", "yes"))
        header = (self.out / "volume_rules.csv").read_text(encoding="utf-8").splitlines()[0]
        self.assertEqual(header, "series,run_id,issue_from,issue_to,year")
        ranged, anywhere = read(self.out, "volume_rules")
        self.assertEqual((ranged["issue_from"], ranged["issue_to"]), ("10", "20"))
        self.assertEqual((anywhere["run_id"], anywhere["issue_from"], anywhere["issue_to"]),
                         ("", "", ""))

    def test_rule_for_unknown_run_is_flagged_not_written(self):
        rules = self.rules(("Avengers", "no-such-run", "", "", "1998", "yes"),
                           ("Captain America", "", "", "", "1968", "yes"))
        self.assertEqual([r["series"] for r in rules], ["Captain America"])
        self.assertIn("rule for unknown run", self.reasons())


class IssuesAndPlacements(WorkbookCase):
    def test_an_issue_in_two_runs_is_one_issue_with_two_placements(self):
        self.extract([("a", "Avengers (1998) #1", True, "Core", None),
                      ("a", "Avengers (1998) #2", False, "Core", None),
                      ("b", "Avengers (1998) #1", False, "Optional", "tie-in")])
        issues = read(self.out, "issues")
        placements = read(self.out, "run_issues")
        self.assertEqual([i["label"] for i in issues], ["Avengers (1998) #1", "Avengers (1998) #2"])
        self.assertEqual(issues[0]["id"], "avengers-1998-1")
        self.assertEqual([(p["id"], p["run_id"], p["sequence"], p["issue_id"], p["type"]) for p in placements],
                         [("1", "a", "1", "avengers-1998-1", "core"), ("2", "a", "2", "avengers-1998-2", "core"),
                          ("3", "b", "1", "avengers-1998-1", "optional")])
        # Read in run a, unread in run b (data model 2.14): one progress row, on
        # run a's placement, and no longer a disagreement to report (task 0.8a).
        self.assertEqual([p["placement_id"] for p in read(self.out, "issue_progress")], ["1"])
        self.assertNotIn("completed in one run, not another", self.reasons())

    def test_an_issue_read_in_two_runs_is_read_in_each(self):
        self.extract([("a", "Avengers (1998) #1", True, "Core", None),
                      ("b", "Avengers (1998) #2", False, "Core", None),
                      ("b", "Avengers (1998) #1", True, "Core", None)])
        self.assertEqual([p["placement_id"] for p in read(self.out, "issue_progress")], ["1", "3"])

    def test_placement_ids_follow_sheet_order_across_runs(self):
        # D-16: ids are sheet positions, interleaved runs included, and contiguous.
        self.extract([("a", "Avengers (1998) #1", False, "Core", None),
                      ("b", "Avengers (1998) #9", False, "Core", None),
                      ("a", "Avengers (1998) #2", False, "Core", None)])
        self.assertEqual([(p["id"], p["run_id"], p["sequence"]) for p in read(self.out, "run_issues")],
                         [("1", "a", "1"), ("2", "b", "1"), ("3", "a", "2")])

    def test_a_label_repeated_inside_a_run_keeps_one_placement(self):
        # D-R2-1: the repeat is dropped and reported, and later sequences stay contiguous.
        self.extract([("a", "X-Men (1991) #8", False, "Core", None),
                      ("a", "X-Men (1991) #8", False, "Optional", None),
                      ("a", "X-Men (1991) #9", False, "Core", None)])
        self.assertEqual(len(read(self.out, "issues")), 2)
        self.assertEqual([(p["sequence"], p["issue_id"]) for p in read(self.out, "run_issues")],
                         [("1", "x-men-1991-8"), ("2", "x-men-1991-9")])
        self.assertIn("repeat placement dropped", self.reasons())

    def test_a_read_repeat_marks_the_kept_placement_read(self):
        # Same run, same issue: the dropped repeat's tick lands on the kept placement.
        self.extract([("a", "X-Men (1991) #8", False, "Core", None),
                      ("a", "X-Men (1991) #8", True, "Core", None)])
        (placement,) = read(self.out, "run_issues")
        self.assertEqual([p["placement_id"] for p in read(self.out, "issue_progress")], [placement["id"]])

    def test_workbook_reads_load_undated_not_stamped_with_the_load_time(self):
        # D-R3-1 / R2-10: no date in the sheet means precision 'none' and a blank completed_at.
        self.extract([("a", "Avengers (1998) #1", True, "Core", None)])
        (row,) = read(self.out, "issue_progress")
        self.assertEqual((row["completed_at"], row["completed_at_precision"]), ("", "none"))

    def test_negative_issue_numbers_get_their_own_id(self):
        self.extract([("a", "Deadpool (1997) #1", False, "Core", None),
                      ("a", "Deadpool (1997) #-1", False, "Core", None)])
        self.assertEqual([i["id"] for i in read(self.out, "issues")],
                         ["deadpool-1997-1", "deadpool-1997-minus-1"])
        self.assertNotIn("labels share a slug", self.reasons())

    def test_runs_no_longer_carry_writer_or_artists(self):
        self.extract([("a", "Avengers (1998) #1", False, "Core", None)])
        self.assertNotIn("writer", read(self.out, "runs")[0])
        wf = {r["id"]: r for r in read(self.out, "workbook_run_fields")}
        self.assertEqual((wf["a"]["writer"], wf["a"]["artists"]), ("Kurt Busiek", "George Perez"))


class LabelReview(WorkbookCase):
    def test_only_accepted_renames_apply_and_stale_ones_are_reported(self):
        ex.load_label_review(write_csv([
            {"label": "Pulse #1", "proposed_label": "The Pulse (2004) #1", "category": "year_added",
             "decision": "accept"},
            {"label": "Pulse #2", "proposed_label": "The Pulse (2004) #2", "category": "year_added",
             "decision": "reject"},
            {"label": "Pulse #3", "proposed_label": "The Pulse (2004) #3", "category": "year_added",
             "decision": ""},
            {"label": "Gone #1", "proposed_label": "Gone (2001) #1", "category": "year_added",
             "decision": "accept"},
        ]))
        ex.COVER_DATES["Pulse #1"] = ("2004-04-01", "hand", None)   # not yet rekeyed
        self.extract([("a", "Pulse #1", False, "Core", None),
                      ("a", "Pulse #2", False, "Core", None),
                      ("b", "The Pulse (2004) #1", True, "Core", None),
                      ("a", "Pulse #3", False, "Core", None)])
        issues = {i["label"]: i for i in read(self.out, "issues")}
        self.assertEqual(sorted(issues), ["Pulse #2", "Pulse #3", "The Pulse (2004) #1"])
        # The renamed row and the already-canonical row are now one issue.
        self.assertEqual(len([p for p in read(self.out, "run_issues")
                              if p["issue_id"] == issues["The Pulse (2004) #1"]["id"]]), 2)
        # The hand date still sat under the old label: used, and reported.
        self.assertEqual(issues["The Pulse (2004) #1"]["cover_date"], "2004-04-01")
        self.assertIn("keyed by pre-rename label", self.reasons())
        self.assertIn("stale label review", self.reasons())


class FractionIssueNumbers(WorkbookCase):
    def test_a_half_issue_gets_its_own_id_not_a_collision_with_twelve(self):
        self.extract([("a", "Ultimate Spider-Man (2000) #12", False, "Core", None),
                      ("a", "Ultimate Spider-Man (2000) #1⁄2", False, "Core", None),
                      ("b", "Wizard (1991) #½", False, "Core", None)])
        ids = {i["id"]: i["label"] for i in read(self.out, "issues")}
        self.assertEqual(ids, {"ultimate-spider-man-2000-12": "Ultimate Spider-Man (2000) #12",
                               "ultimate-spider-man-2000-1-2": "Ultimate Spider-Man (2000) #½",
                               "wizard-1991-1-2": "Wizard (1991) #½"})
        self.assertNotIn("labels share a slug", self.reasons())

    def test_one_and_a_half_keeps_its_glyph_and_is_not_eleven_halves(self):
        self.extract([("a", "Avengers (1998) #1½", False, "Core", None),
                      ("a", "Avengers (1998) #11", False, "Core", None),
                      ("b", "Avengers (1998) #11⁄2", False, "Core", None)])
        ids = {i["id"]: i["label"] for i in read(self.out, "issues")}
        self.assertEqual(ids, {"avengers-1998-11-2": "Avengers (1998) #1½",
                               "avengers-1998-11": "Avengers (1998) #11"})

    def test_clean_puts_fraction_glyphs_back_after_nfkc(self):
        self.assertEqual(ex.clean("Avengers (1998) #1½"), "Avengers (1998) #1½")
        self.assertEqual(ex.clean("Avengers (1998) #11⁄2"), "Avengers (1998) #1½")
        self.assertEqual(ex.clean("Ultimate Spider-Man (2000) #1⁄2"), "Ultimate Spider-Man (2000) #½")
        self.assertEqual(ex.clean("Wizard #¾"), "Wizard #¾")
        self.assertEqual(ex.clean("X #1/2"), "X #1/2")          # ASCII is a label_review matter
        self.assertNotEqual(ex.issue_slug("Wizard #¾"), ex.issue_slug("Wizard #34"))


class SlugParity(unittest.TestCase):
    """Task 1.3c: the app mints an issue's id with a TypeScript twin of
    issue_slug (src/lib/issue-slug.ts). Both sides check this one fixture, so a
    label added in the app and the same label loaded by extract are one issue."""

    def test_clean_and_issue_slug_match_the_shared_fixture(self):
        path = Path(__file__).parent.parent / "test" / "fixtures" / "issue-slugs.json"
        cases = json.loads(path.read_text(encoding="utf-8"))["cases"]
        self.assertTrue(any("½" in c["label"] for c in cases))
        for c in cases:
            with self.subTest(typed=c["typed"]):
                self.assertEqual(ex.clean(c["typed"]), c["label"])
                self.assertEqual(ex.issue_slug(c["label"]), c["id"])

    def test_book_ids_match_the_shared_fixture(self):
        """Task 1.4: a book pasted in the app and the same book loaded by extract
        get one id; a slug another book holds gets `-x`, on both sides."""
        path = Path(__file__).parent.parent / "test" / "fixtures" / "book-ids.json"
        cases = json.loads(path.read_text(encoding="utf-8"))["cases"]
        self.assertTrue(any(c["id"].endswith("-x") for c in cases))
        idx = ex.BookIndex()
        for c in cases:
            with self.subTest(title=c["title"]):
                self.assertEqual(idx.upsert(c["title"], c["author"]), c["id"])


class OrphanedSidecarRows(WorkbookCase):
    def test_sidecar_rows_for_labels_gone_from_the_sheet_are_reported_not_used(self):
        ex.COVER_DATES["Avengers (1998) #1"] = ("1998-02-01", "metron", 1)
        ex.COVER_DATES["Gone (2001) #9"] = ("2001-09-01", "hand", None)
        ex.ISSUE_CREDITS["Gone (2001) #9"] = [("Someone", None, "writer", "metron")]
        self.extract([("a", "Avengers (1998) #1", False, "Core", None)])
        orphans = [u for u in ex.UNRESOLVED
                   if u["reason"] == "sidecar row for a label not in the sheet"]
        self.assertEqual(sorted((u["table"], u["detail"].split(":")[0]) for u in orphans),
                         [("cover_dates", "Gone (2001) #9 (hand-entered)"),
                          ("issue_credits", "Gone (2001) #9")])
        # The label still in the sheet is used and not reported.
        self.assertEqual(read(self.out, "issues")[0]["cover_date"], "1998-02-01")


class RenameKeepsHandValues(WorkbookCase):
    def test_hand_values_under_the_old_label_beat_metron_values_under_the_new(self):
        ex.load_label_review(write_csv([
            {"label": "Pulse #1", "proposed_label": "The Pulse (2004) #1", "category": "year_added",
             "decision": "accept"}]))
        ex.COVER_DATES["Pulse #1"] = ("2004-04-01", "hand", None)
        ex.COVER_DATES["The Pulse (2004) #1"] = ("2004-05-01", "metron", 1)
        ex.ISSUE_CREDITS["Pulse #1"] = [("Me", None, "writer", "hand")]
        ex.ISSUE_CREDITS["The Pulse (2004) #1"] = [("B. Bendis", 5, "writer", "metron"),
                                                   ("Mark Bagley", 6, "artist", "metron")]
        self.extract([("a", "Pulse #1", False, "Core", None)])
        issue = read(self.out, "issues")[0]
        self.assertEqual((issue["cover_date"], issue["cover_date_source"]), ("2004-04-01", "hand"))
        credits = {(c["creator_id"], c["role"]) for c in read(self.out, "issue_credits")}
        self.assertEqual(credits, {("me", "writer"), ("mark-bagley", "artist")})


class DetailsAndCredits(WorkbookCase):
    def test_titles_credits_and_creators(self):
        ex.load_issue_details(write_csv([
            {"label": "Avengers (1998) #1", "story_title": "Once an Avenger", "story_title_source": "metron",
             "cover_url": "https://static.metron.cloud/a1.jpg", "metron_issue_id": "701"},
            {"label": "Avengers (1998) #2", "story_title": "Unsourced", "story_title_source": "",
             "cover_url": "", "metron_issue_id": ""},
        ]))
        ex.load_issue_credits(write_csv([
            {"label": "Avengers (1998) #1", "creator": "Kurt Busiek", "metron_creator_id": "11", "role": "writer", "source": "metron"},
            {"label": "Avengers (1998) #1", "creator": "George Pérez", "metron_creator_id": "12", "role": "artist", "source": "metron"},
            {"label": "Avengers (1998) #1", "creator": "Kurt Busiek", "metron_creator_id": "11", "role": "writer", "source": "metron"},
            {"label": "Avengers (1998) #2", "creator": "Kurt Busiek", "metron_creator_id": "", "role": "writer", "source": "hand"},
            {"label": "Avengers (1998) #2", "creator": "Someone", "metron_creator_id": "", "role": "editor", "source": "metron"},
            {"label": "Old #1", "creator": "Stan Lee", "metron_creator_id": "13", "role": "writer", "source": "metron"},
        ]))
        self.extract([("a", "Avengers (1998) #1", False, "Core", None),
                      ("a", "Avengers (1998) #2", False, "Core", None),
                      ("b", "Old #1", False, "Core", None)])
        issues = {i["label"]: i for i in read(self.out, "issues")}
        a1 = issues["Avengers (1998) #1"]
        self.assertEqual((a1["story_title"], a1["story_title_source"], a1["metron_id"]),
                         ("Once an Avenger", "metron", "701"))
        self.assertEqual(issues["Avengers (1998) #2"]["story_title"], "")
        self.assertIn("story title without a valid source", self.reasons())
        self.assertIn("unknown role", self.reasons())

        creators = {c["id"]: c for c in read(self.out, "creators")}
        self.assertEqual(sorted(creators), ["george-perez", "kurt-busiek", "stan-lee"])
        self.assertEqual(creators["kurt-busiek"]["metron_id"], "11")
        credits = [(c["issue_id"], c["creator_id"], c["role"], c["source"])
                   for c in read(self.out, "issue_credits")]
        # Duplicate row collapsed; the hand credit resolves to the same creator.
        self.assertEqual(credits, [
            ("avengers-1998-1", "kurt-busiek", "writer", "metron"),
            ("avengers-1998-1", "george-perez", "artist", "metron"),
            ("avengers-1998-2", "kurt-busiek", "writer", "hand"),
            ("old-1", "stan-lee", "writer", "metron"),
        ])
        # Both sheet writers (Kurt Busiek, Stan Lee) appear in their runs' credits.
        self.assertNotIn("workbook writer not in credits", self.reasons())

    def test_workbook_writer_that_credits_contradict_is_reported(self):
        ex.load_issue_credits(write_csv([
            {"label": "Avengers (1998) #1", "creator": "Mark Waid", "metron_creator_id": "14",
             "role": "writer", "source": "metron"},
        ]))
        self.extract([("a", "Avengers (1998) #1", False, "Core", None)])
        self.assertIn("workbook writer not in credits", self.reasons())


class CreatorAliases(WorkbookCase):
    RUNS = [("a", "Run A", "Thor", "Walt Simonson", None)]

    def test_sheet_writer_under_another_spelling_matches_the_credits(self):
        ex.load_issue_credits(write_csv([
            {"label": "Thor #337", "creator": "Walter Simonson", "metron_creator_id": "15",
             "role": "writer", "source": "metron"},
        ]))
        ex.load_creator_aliases(write_csv([{"alias": "Walt Simonson", "creator": "Walter Simonson"}]))
        self.extract([("a", "Thor #337", False, "Core", None)])
        self.assertNotIn("workbook writer not in credits", self.reasons())

    def test_hand_credit_under_an_alias_is_the_same_creator(self):
        ex.load_issue_credits(write_csv([
            {"label": "Thor #337", "creator": "Walter Simonson", "metron_creator_id": "15",
             "role": "writer", "source": "metron"},
            {"label": "Thor #338", "creator": "walt simonson", "metron_creator_id": "",
             "role": "artist", "source": "hand"},
        ]))
        ex.load_creator_aliases(write_csv([{"alias": "Walt Simonson", "creator": "Walter Simonson"}]))
        self.extract([("a", "Thor #337", False, "Core", None),
                      ("a", "Thor #338", False, "Core", None)])
        creators = read(self.out, "creators")
        self.assertEqual([(c["id"], c["name"], c["metron_id"]) for c in creators],
                         [("walter-simonson", "Walter Simonson", "15")])
        credits = {(c["issue_id"], c["creator_id"], c["source"]) for c in read(self.out, "issue_credits")}
        self.assertEqual(credits, {("thor-337", "walter-simonson", "metron"),
                                   ("thor-338", "walter-simonson", "hand")})

    def test_without_the_alias_they_stay_apart_and_are_reported(self):
        ex.load_issue_credits(write_csv([
            {"label": "Thor #337", "creator": "Walter Simonson", "metron_creator_id": "15",
             "role": "writer", "source": "metron"},
        ]))
        self.extract([("a", "Thor #337", False, "Core", None)])
        self.assertIn("workbook writer not in credits", self.reasons())

    def test_only_accepted_review_rows_count_as_aliases(self):
        ex.load_creator_aliases(write_csv([
            {"alias": "Walt Simonson", "creator": "Walter Simonson", "metron_creator_id": "15",
             "decision": "yes"},
            {"alias": "Lou Simonson", "creator": "Louise Simonson", "metron_creator_id": "667",
             "decision": "reject"},
            {"alias": "Mike Allred", "creator": "Michael Allred", "metron_creator_id": "40",
             "decision": ""},
        ]))
        self.assertEqual(ex.canonical_creator("Walt Simonson"), "Walter Simonson")
        self.assertEqual(ex.canonical_creator("Lou Simonson"), "Lou Simonson")
        self.assertEqual(ex.canonical_creator("Mike Allred"), "Mike Allred")

    def test_an_alias_claimed_by_two_creators_keeps_the_first_and_is_reported(self):
        ex.load_creator_aliases(write_csv([
            {"alias": "J. Romita", "creator": "John Romita Sr."},
            {"alias": "J. Romita", "creator": "John Romita Jr."},
        ]))
        self.assertEqual(ex.canonical_creator("J. Romita"), "John Romita Sr.")
        self.assertIn("alias names two creators", self.reasons())


class BookWordCountSource(unittest.TestCase):
    """books_word_count_source_check: the source is null exactly when the count is."""

    def test_a_typed_count_is_stated_and_no_count_has_no_source(self):
        idx = ex.BookIndex()
        counted = idx.upsert("Piranesi", "Susanna Clarke", word_count=85000)
        bare = idx.upsert("The Way of Kings", "Brandon Sanderson")
        books = {b["id"]: b for b in idx.by_key.values()}
        self.assertEqual(books[counted]["word_count_source"], "stated")
        self.assertIsNone(books[bare]["word_count"])
        self.assertIsNone(books[bare]["word_count_source"])

    def test_a_count_found_on_a_later_tab_makes_the_book_stated(self):
        idx = ex.BookIndex()
        bid = idx.upsert("Piranesi", "Susanna Clarke")
        idx.upsert("Piranesi", word_count=85000)
        idx.finish()  # task 1.13: an authorless sighting joins its book here
        book = next(b for b in idx.by_key.values() if b["id"] == bid)
        self.assertEqual((book["word_count"], book["word_count_source"]), (85000, "stated"))


class BookStatusFinishDate(unittest.TestCase):
    """Task 1.5 (D-21): book_status.csv carries a finish date and its precision,
    never a year column. Task 1.13 (D-41): a Read tab loads no read state, so
    every workbook row is an undated to_read; the read is listed for hand entry."""

    def test_a_read_tab_loads_no_read_and_every_row_is_undated(self):
        import pandas as pd
        from unittest import mock
        path = Path(tempfile.mkdtemp()) / "Books.xlsx"
        with pd.ExcelWriter(path) as xw:
            pd.DataFrame([("Piranesi", "Susanna Clarke", None, "Fantasy", None),
                          ("The Way of Kings", "Brandon Sanderson", None, "Fantasy", None)],
                         columns=["Book", "Author", "Series", "Genre", "Words"]) \
                .to_excel(xw, sheet_name="To-Read Master List", index=False)
            pd.DataFrame({"Fantasy": ["Piranesi"]}).to_excel(xw, sheet_name="Read 2024", index=False)
            pd.DataFrame(columns=["Title", "Author", "Series", "Date"]) \
                .to_excel(xw, sheet_name="Coming Out", index=False)
            pd.DataFrame(columns=["Series", "Total Books"]).to_excel(xw, sheet_name="Series", index=False)
        out = Path(tempfile.mkdtemp())
        with mock.patch("sys.stdout"):
            ex.extract_books(path, out)

        with (out / "book_status.csv").open(newline="", encoding="utf-8") as fh:
            header = next(csv.reader(fh))
        self.assertEqual(header, ["user_id", "book_id", "status", "finished_on", "finished_on_precision",
                                  "year_rank", "rating"])
        rows = {r["book_id"].split("-")[0]: r for r in read(out, "book_status")}
        self.assertEqual((rows["piranesi"]["status"], rows["piranesi"]["finished_on"],
                          rows["piranesi"]["finished_on_precision"]), ("to_read", "", "none"))
        self.assertEqual((rows["the"]["status"], rows["the"]["finished_on"],
                          rows["the"]["finished_on_precision"]), ("to_read", "", "none"))
        self.assertEqual([(r["title"], r["year"], r["tab"]) for r in read(out, "workbook_reads")],
                         [("Piranesi", "2024", "Read 2024")])


class ReadingPlanPeriod(unittest.TestCase):
    """Task 1.7 (D-13, D-37): --with-plan writes the To-Read tabs as reading_plan
    rows with one period column and an ordinal; a To-Read tab is a bare year, so
    the ordinal is blank. Without the flag the plan starts empty."""

    def extract(self, with_plan: bool) -> Path:
        import pandas as pd
        from unittest import mock
        path = Path(tempfile.mkdtemp()) / "Books.xlsx"
        with pd.ExcelWriter(path) as xw:
            pd.DataFrame([("Piranesi", "Susanna Clarke", None, "Fantasy", None),
                          ("Light Bringer", "Pierce Brown", None, "Sci-Fi", None)],
                         columns=["Book", "Author", "Series", "Genre", "Words"]) \
                .to_excel(xw, sheet_name="To-Read Master List", index=False)
            # Light Bringer is planned in two years; Piranesi is listed twice in 2027.
            pd.DataFrame({"Fantasy": ["Light Bringer"]}).to_excel(xw, sheet_name="To-Read 2026", index=False)
            pd.DataFrame({"Fantasy": ["Piranesi", "Piranesi"], "Sci-Fi": ["Light Bringer", None]}) \
                .to_excel(xw, sheet_name="To-Read 2027", index=False)
            pd.DataFrame(columns=["Title", "Author", "Series", "Date"]) \
                .to_excel(xw, sheet_name="Coming Out", index=False)
            pd.DataFrame(columns=["Series", "Total Books"]).to_excel(xw, sheet_name="Series", index=False)
        out = Path(tempfile.mkdtemp())
        ex.UNRESOLVED.clear()
        with mock.patch("sys.stdout"):
            ex.extract_books(path, out, with_plan=with_plan)
        return out

    def header(self, out: Path) -> list[str]:
        with (out / "reading_plan.csv").open(newline="", encoding="utf-8") as fh:
            return next(csv.reader(fh))

    def test_with_plan_writes_a_period_and_a_blank_ordinal_per_year(self):
        out = self.extract(with_plan=True)
        self.assertEqual(self.header(out), ["user_id", "book_id", "period", "ordinal"])
        rows = sorted((r["book_id"], r["period"], r["ordinal"]) for r in read(out, "reading_plan"))
        self.assertEqual(rows, [("light-bringer-pierce-brown", "2026", ""),
                                ("light-bringer-pierce-brown", "2027", ""),
                                ("piranesi-susanna-clarke", "2027", "")])
        self.assertTrue(all(r["user_id"] == "$OWNER" for r in read(out, "reading_plan")))
        self.assertIn("duplicate book/period", [u["reason"] for u in ex.UNRESOLVED])

    def test_without_the_flag_no_plan_rows_are_written(self):
        out = self.extract(with_plan=False)
        self.assertEqual(self.header(out), ["user_id", "book_id", "period", "ordinal"])
        self.assertEqual(read(out, "reading_plan"), [])


MASTER_COLUMNS = ["Book", "Author", "Series", "Genre", "Words"]


def build_books(master: list[tuple], tabs: dict | None = None,
                coming_out: list[tuple] = (), series: list[tuple] = ()) -> Path:
    """A minimal Books.xlsx: the master list, Coming Out and Series, plus `tabs`
    (sheet name -> DataFrame)."""
    import pandas as pd
    path = Path(tempfile.mkdtemp()) / "Books.xlsx"
    with pd.ExcelWriter(path) as xw:
        pd.DataFrame(list(master), columns=MASTER_COLUMNS) \
            .to_excel(xw, sheet_name="To-Read Master List", index=False)
        for name, df in (tabs or {}).items():
            df.to_excel(xw, sheet_name=name, index=False)
        pd.DataFrame(list(coming_out), columns=["Title", "Author", "Series", "Date"]) \
            .to_excel(xw, sheet_name="Coming Out", index=False)
        if "Series" not in (tabs or {}):
            pd.DataFrame(list(series), columns=["Series", "Total Books"]) \
                .to_excel(xw, sheet_name="Series", index=False)
    return path


SERIES_COLUMNS = ["Series", "Author", "Percent Read", "Words", "Books Read", "Total Books", "Completed"]


def series_tab(*groups):
    """The workbook's Series tab (task 1.15): a group row (name, author, total
    books, ticked Completed), then one row per listed book (title, words)."""
    import pandas as pd
    rows = []
    for name, author, total, listed in groups:
        rows.append([name, author, 1.0, None, len(listed), total, True])
        rows += [[None, None, None, words, title, None, None] for title, words in listed]
    return pd.DataFrame(rows, columns=SERIES_COLUMNS)


def tab(*books, series=()):
    """An author or universe tab: Completed, Type, Book, Series, Published."""
    series = list(series) or [None] * len(books)
    return df({"Completed": [True] * len(books), "Type": ["Novel"] * len(books), "Book": list(books),
               "Series": series, "Published": [2010] * len(books)})


class BookCase(unittest.TestCase):
    def setUp(self):
        ex.UNRESOLVED.clear()
        self.out = Path(tempfile.mkdtemp())
        self.review = Path(tempfile.mkdtemp()) / "book_review.csv"
        self.printed = ""

    def extract(self, path: Path, with_plan: bool = False) -> None:
        import io
        from contextlib import redirect_stdout
        ex.UNRESOLVED.clear()
        buf = io.StringIO()
        with redirect_stdout(buf):
            ex.extract_books(path, self.out, with_plan=with_plan, book_review=self.review)
        self.printed = buf.getvalue()

    def books(self) -> dict[str, dict]:
        return {b["id"]: b for b in read(self.out, "books")}

    def status(self) -> dict[str, str]:
        return {r["book_id"]: r["status"] for r in read(self.out, "book_status")}

    def review_rows(self) -> list[dict]:
        with self.review.open(newline="", encoding="utf-8") as fh:
            return list(csv.DictReader(fh))

    def decide(self, match, decision: str, keep: str = "") -> None:
        """Decide every review row `match` picks, as the owner would in Excel."""
        rows = self.review_rows()
        hit = [r for r in rows if match(r)]
        self.assertEqual(len(hit), 1, rows)
        hit[0].update(decision=decision, keep=keep)
        with self.review.open("w", newline="", encoding="utf-8") as fh:
            w = csv.DictWriter(fh, fieldnames=ex.BOOK_REVIEW_COLUMNS)
            w.writeheader()
            w.writerows(rows)

    def reasons(self) -> list[str]:
        return [u["reason"] for u in ex.UNRESOLVED]


def df(columns: dict):
    """A tab of ragged columns, padded with blanks."""
    import pandas as pd
    n = max(len(v) for v in columns.values())
    return pd.DataFrame({k: list(v) + [None] * (n - len(v)) for k, v in columns.items()})


class BookReview(BookCase):
    """Task 1.13 (D-25a, D-41, D-68): one book per title and author, a merge
    review extract proposes and the owner decides, and no reads from the workbook."""

    def test_two_books_sharing_a_title_load_as_two_rows_with_one_same_title_row(self):
        self.extract(build_books([("Red Queen", "Victoria Aveyard", None, "Fantasy", None),
                                  ("Red Queen", "Christina Henry", None, "Fantasy", None)]))
        self.assertEqual(set(self.books()), {"red-queen-victoria-aveyard", "red-queen-christina-henry"})
        same = [r for r in self.review_rows() if r["reason"] == "same title"]
        self.assertEqual(len(same), 1)
        self.assertEqual((same[0]["kind"], same[0]["a"], same[0]["b"], same[0]["decision"]),
                         ("book", "Red Queen", "Red Queen", ""))
        self.assertEqual({same[0]["a_author"], same[0]["b_author"]}, {"Victoria Aveyard", "Christina Henry"})
        self.assertIn("1 book pairs await review", self.printed)

    def test_an_authorless_to_read_sighting_joins_its_one_authored_match(self):
        self.extract(build_books([("Piranesi", "Susanna Clarke", None, None, None)],
                                 {"To-Read 2027": df({"Fantasy": ["Piranesi"]})}), with_plan=True)
        self.assertEqual(list(self.books()), ["piranesi-susanna-clarke"])
        self.assertEqual(self.books()["piranesi-susanna-clarke"]["genre"], "Fantasy")
        self.assertEqual(self.status(), {"piranesi-susanna-clarke": "to_read"})
        self.assertEqual([r["book_id"] for r in read(self.out, "reading_plan")], ["piranesi-susanna-clarke"])
        self.assertEqual(self.review_rows(), [])

    def test_a_one_letter_typo_is_proposed_not_merged_then_merged_under_keep(self):
        path = build_books([("The Lightning Theif", "Rick Riordan", None, "Fantasy", None)],
                           {"Riordanverse": df({"Book": ["The Lightning Thief", "The Sea of Monsters"]})})
        self.extract(path)
        self.assertEqual(set(self.books()), {"the-lightning-theif-rick-riordan",
                                             "the-lightning-thief-rick-riordan",
                                             "the-sea-of-monsters-rick-riordan"})
        typo = [r for r in self.review_rows() if r["kind"] == "book"]
        self.assertEqual(len(typo), 1, typo)
        self.assertEqual(({typo[0]["a"], typo[0]["b"]}, typo[0]["reason"]),
                         ({"The Lightning Theif", "The Lightning Thief"}, "similar"))
        self.assertGreaterEqual(float(typo[0]["similarity"]), 0.4)

        self.decide(lambda r: r["kind"] == "book", "merge", keep="The Lightning Thief")
        self.extract(path)
        self.assertEqual(set(self.books()), {"the-lightning-thief-rick-riordan",
                                             "the-sea-of-monsters-rick-riordan"})
        self.assertEqual(self.books()["the-lightning-thief-rick-riordan"]["title"], "The Lightning Thief")
        self.assertEqual(self.status(), {"the-lightning-thief-rick-riordan": "to_read"})

    def test_a_series_pattern_under_half_is_not_proposed(self):
        """D-92: Artemis Fowl's own titles score 0.41 to 0.46 against each
        other, and are two books each. They are not worth a review row."""
        titles = ["Artemis Fowl", "Artemis Fowl: The Lost Colony", "Artemis Fowl: The Time Paradox"]
        self.assertTrue(all(ex.SIMILAR_AT <= ex.trgm_similarity(a, b) < ex.PAIR_SIMILAR_AT
                            for a, b in (titles[0:2], titles[1:3])))
        self.extract(build_books([(t, "Eoin Colfer", None, None, None) for t in titles]))
        self.assertEqual(len(self.books()), 3)
        self.assertEqual(self.review_rows(), [])

    def test_names_that_differ_only_by_a_number_are_not_proposed(self):
        self.extract(build_books([("Saga Vol 1", "Brian K. Vaughan", None, None, None),
                                  ("Saga Vol 2", "Brian K. Vaughan", None, None, None),
                                  ("The Dark Tower II", "Stephen King", None, None, None),
                                  ("The Dark Tower III", "Stephen King", None, None, None)]))
        self.assertEqual(len(self.books()), 4)
        self.assertEqual(self.review_rows(), [])

    def test_a_decision_survives_a_second_extract(self):
        path = build_books([("Red Queen", "Victoria Aveyard", None, None, None),
                            ("Red Queen", "Christina Henry", None, None, None)])
        self.extract(path)
        self.decide(lambda r: r["reason"] == "same title", "separate")
        self.extract(path)
        rows = self.review_rows()
        self.assertEqual([(r["reason"], r["decision"]) for r in rows], [("same title", "separate")])
        self.assertIn("0 book pairs await review", self.printed)
        self.assertEqual(len(self.books()), 2)

    def test_reads_in_the_workbook_create_no_book_and_no_read_row(self):
        read_tab = df({"Fantasy": ["The Way of Kings", "Words of Radiance", None, 2, None, "Cosmere"],
                       "Horror": [None, None, None, 0, None, "Brom"],
                       "Unnamed: 2": [None, None, "Books", 2, None, None]})
        top = df({"Unnamed: 0": [1, 2], "2024": ["The Way of Kings", "Dune"]})
        king = df({"Completed": [True, False], "Type": ["Novel", "Novel"], "Book": ["Carrie", "It"],
                   "Series": [None, None], "Word Count": [64000, 444000], "Published": [1974, 1986]})
        self.extract(build_books([("Piranesi", "Susanna Clarke", None, None, None)],
                                 {"Read 2024": read_tab, "Top Books": top, "Stephen King": king}))
        self.assertEqual(set(self.books()), {"piranesi-susanna-clarke", "carrie-stephen-king", "it-stephen-king"})
        self.assertEqual(self.status(), {"piranesi-susanna-clarke": "to_read"})
        reads = [(r["title"], r["year"], r["genre"], r["tab"], r["rank"]) for r in read(self.out, "workbook_reads")]
        self.assertEqual(sorted(reads), sorted([
            ("The Way of Kings", "2024", "Fantasy", "Read 2024", ""),
            ("Words of Radiance", "2024", "Fantasy", "Read 2024", ""),
            ("The Way of Kings", "2024", "", "Top Books", "1"),
            ("Dune", "2024", "", "Top Books", "2"),
            ("Carrie", "", "", "Stephen King", ""),
        ]))

    def test_the_king_tabs_word_count_loads_as_stated(self):
        king = df({"Completed": [False], "Type": ["Novel"], "Book": ["Carrie"], "Series": [None],
                   "Word Count": [64000], "Published": [1974]})
        self.extract(build_books([], {"Stephen King": king}))
        carrie = self.books()["carrie-stephen-king"]
        self.assertEqual((carrie["word_count"], carrie["word_count_source"]), ("64000", "stated"))

    def test_year_tabs_are_found_by_name(self):
        self.extract(build_books([], {"Read 2031": df({"Fantasy": ["Dune", 1]}),
                                      "To-Read 2025": df({"Fantasy": ["Mort"]}),
                                      "To-Read 2031": df({"Fantasy": ["Sourcery"]})}), with_plan=True)
        self.assertEqual([(r["title"], r["year"]) for r in read(self.out, "workbook_reads")], [("Dune", "2031")])
        self.assertEqual(self.status(), {"mort": "to_read"})
        self.assertEqual([(r["book_id"], r["period"]) for r in read(self.out, "reading_plan")], [("mort", "2025")])
        self.assertEqual([(r["title"], r["year"]) for r in read(self.out, "workbook_plans")], [("Sourcery", "2031")])

    def test_a_to_read_tab_from_2028_on_loads_nothing_and_is_listed(self):
        """Owner, 2026-10-19: plans from 2028 on are speculative. Their tabs make
        no book, status or plan row; a title also on the master list still loads
        from there, with no plan (Someday)."""
        self.extract(build_books([("Piranesi", "Susanna Clarke", None, "Fantasy", None)],
                                 {"To-Read 2027": df({"Fantasy": ["Mort"]}),
                                  "To-Read 2028": df({"Fantasy": ["Piranesi", "Sourcery"],
                                                      "Horror": ["The Troop"]})}), with_plan=True)
        self.assertEqual(set(self.books()), {"piranesi-susanna-clarke", "mort"})
        self.assertEqual(self.status(), {"piranesi-susanna-clarke": "to_read", "mort": "to_read"})
        self.assertEqual([(r["book_id"], r["period"]) for r in read(self.out, "reading_plan")], [("mort", "2027")])
        self.assertEqual(sorted((r["title"], r["year"], r["genre"], r["tab"]) for r in read(self.out, "workbook_plans")),
                         [("Piranesi", "2028", "Fantasy", "To-Read 2028"), ("Sourcery", "2028", "Fantasy", "To-Read 2028"),
                          ("The Troop", "2028", "Horror", "To-Read 2028")])

    def test_a_merged_and_a_folded_sighting_of_one_book_in_one_tab_are_one_plan_row(self):
        """1.7's duplicate check runs on the final id: `Piranisi` reaches the
        book through a merge, `Piranesi` through the authorless fold."""
        path = build_books([("Piranesi", "Susanna Clarke", None, None, None)],
                           {"To-Read 2027": df({"Fantasy": ["Piranesi", "Piranisi"]})})
        self.extract(path, with_plan=True)
        self.decide(lambda r: r["kind"] == "book", "merge", keep="Piranesi")
        self.extract(path, with_plan=True)
        self.assertEqual(list(self.books()), ["piranesi-susanna-clarke"])
        self.assertEqual([(r["book_id"], r["period"]) for r in read(self.out, "reading_plan")],
                         [("piranesi-susanna-clarke", "2027")])
        self.assertIn("duplicate book/period", self.reasons())

    def test_trigram_similarity_is_pg_trgms(self):
        self.assertAlmostEqual(ex.trgm_similarity("word", "words"), 4 / 7)
        self.assertAlmostEqual(ex.trgm_similarity("word", "two words"), 4 / 11)


class BookReviewMerge(BookCase):
    """Task 1.13 AC-2: a merge moves every reference to the kept spelling."""

    def test_merging_two_author_and_series_spellings_moves_every_reference(self):
        path = build_books(
            [("The Hobbit", "J.R.R. Tolkien", "Middle-earth #1", None, None),
             ("The Children of Hurin", "J.R.R. Tolkein", "Middle-earh #3", None, None)],
            coming_out=[("The Silmarillion", "J.R.R. Tolkein", "Middle-earh #2", "2027-09-01")],
            series=[("Middle-earh", 5)])
        self.extract(path)
        self.assertEqual(len(read(self.out, "authors")), 2)
        self.decide(lambda r: r["kind"] == "author", "merge", keep="J.R.R. Tolkien")
        self.decide(lambda r: r["kind"] == "series", "merge", keep="Middle-earth")
        self.extract(path)

        self.assertEqual(read(self.out, "authors"), [{"id": "j-r-r-tolkien", "name": "J.R.R. Tolkien"}])
        books = self.books()
        self.assertEqual(set(books), {"the-hobbit-j-r-r-tolkien", "the-children-of-hurin-j-r-r-tolkien",
                                      "the-silmarillion-j-r-r-tolkien"})
        self.assertEqual({b["author_id"] for b in books.values()}, {"j-r-r-tolkien"})
        self.assertEqual({b["series_id"] for b in books.values()}, {"middle-earth"})
        self.assertEqual([(s["id"], s["name"], s["author_id"], s["total_books"])
                          for s in read(self.out, "book_series")],
                         [("middle-earth", "Middle-earth", "j-r-r-tolkien", "5")])
        self.assertEqual(self.status(), {"the-hobbit-j-r-r-tolkien": "to_read",
                                         "the-children-of-hurin-j-r-r-tolkien": "to_read"})
        self.assertEqual([r["book_id"] for r in read(self.out, "releases")], ["the-silmarillion-j-r-r-tolkien"])

    def test_two_release_dates_that_become_one_book_keep_the_first(self):
        """releases.book_id is the table's key: a merge that joins two dated
        releases keeps the first date and reports the other."""
        path = build_books([], coming_out=[("Wind and Truth", "Brandon Sanderson", None, "2024-12-06"),
                                           ("Wind and Truht", "Brandon Sanderson", None, "2024-12-10")])
        self.extract(path)
        self.decide(lambda r: r["kind"] == "book", "merge", keep="Wind and Truth")
        self.extract(path)
        self.assertEqual(read(self.out, "releases"),
                         [{"book_id": "wind-and-truth-brandon-sanderson", "release_date": "2024-12-06"}])
        self.assertIn("two release dates for one book", self.reasons())


class BookReviewLeftovers(BookCase):
    """Task 1.13 AC-3: a stale decision is kept and reported; an authorless
    title that matches two books joins neither and is reported."""

    def test_a_decided_row_whose_names_are_gone_stays_and_is_reported_stale(self):
        gone = {"kind": "book", "a": "Pet Semetary", "b": "Pet Sematary", "a_author": "Stephen King",
                "b_author": "Stephen King", "a_tabs": "Stephen King", "b_tabs": "To-Read Master List",
                "reason": "similar", "similarity": "0.6", "keep": "Pet Sematary", "decision": "merge"}
        undecided = {**gone, "a": "Gone Titel", "b": "Gone Title", "keep": "", "decision": ""}
        with self.review.open("w", newline="", encoding="utf-8") as fh:
            w = csv.DictWriter(fh, fieldnames=ex.BOOK_REVIEW_COLUMNS)
            w.writeheader()
            w.writerows([gone, undecided])
        self.extract(build_books([("Carrie", "Stephen King", None, None, None)]))
        self.assertEqual([(r["a"], r["decision"]) for r in self.review_rows()], [("Pet Semetary", "merge")])
        self.assertIn("stale review", self.reasons())

    def test_an_authorless_title_matching_two_books_joins_neither(self):
        self.extract(build_books([("Red Queen", "Victoria Aveyard", None, None, None),
                                  ("Red Queen", "Christina Henry", None, None, None)],
                                 {"To-Read 2027": df({"Fantasy": ["Red Queen"]})}), with_plan=True)
        self.assertEqual(set(self.books()), {"red-queen-victoria-aveyard", "red-queen-christina-henry"})
        # UNRESOLVED is what main writes to unresolved.csv.
        flagged = [u for u in ex.UNRESOLVED if u["reason"] == "authorless title matches several books"]
        self.assertEqual(len(flagged), 1)
        self.assertIn("Red Queen", flagged[0]["detail"])
        self.assertEqual(read(self.out, "reading_plan"), [])
        self.assertEqual(set(self.status()), {"red-queen-victoria-aveyard", "red-queen-christina-henry"})


class BookDetails(BookCase):
    """Task 1.14 (D-44): book_details.csv folds into books, the workbook's year
    wins, no word count comes from pages, and the Open Library proposals enrich
    appends to book_review.csv survive extract until they are decided."""

    WOK = {"title": "The Way of Kings", "author": "Brandon Sanderson",
           "open_library_id": "OL15358691W", "page_count": "1008",
           "cover_url": "https://covers.openlibrary.org/b/id/14658316-L.jpg",
           "published_year": "2010", "source": "openlibrary"}
    PROPOSAL = {"kind": "book", "a": "Edgedancer Novella", "b": "Edgedancer",
                "a_author": "Brandon Sanderson", "b_author": "Brandon Sanderson", "a_tabs": "",
                "b_tabs": "Open Library", "reason": "open library", "similarity": "0.58",
                "keep": "Edgedancer", "decision": ""}

    def setUp(self):
        super().setUp()
        self.details = Path(tempfile.mkdtemp()) / "book_details.csv"

    def extract(self, path: Path, with_plan: bool = False) -> None:
        import io
        from contextlib import redirect_stdout
        ex.UNRESOLVED.clear()
        with redirect_stdout(io.StringIO()):
            ex.extract_books(path, self.out, book_review=self.review, book_details=self.details)

    def write_details(self, rows):
        with self.details.open("w", newline="", encoding="utf-8") as fh:
            w = csv.DictWriter(fh, fieldnames=ex.BOOK_DETAILS_COLUMNS)
            w.writeheader()
            w.writerows(rows)

    def write_review(self, rows):
        with self.review.open("w", newline="", encoding="utf-8") as fh:
            w = csv.DictWriter(fh, fieldnames=ex.BOOK_REVIEW_COLUMNS)
            w.writeheader()
            w.writerows(rows)

    def test_details_fold_into_books(self):
        self.write_details([self.WOK])
        self.extract(build_books([("The Way of Kings", "Brandon Sanderson", None, "Fantasy", None),
                                  ("Mistborn", "Brandon Sanderson", None, "Fantasy", 214000)]))
        books = self.books()
        wok = books["the-way-of-kings-brandon-sanderson"]
        self.assertEqual({k: wok[k] for k in ("open_library_id", "page_count", "cover_url",
                                              "published_year")},
                         {"open_library_id": "OL15358691W", "page_count": "1008",
                          "cover_url": "https://covers.openlibrary.org/b/id/14658316-L.jpg",
                          "published_year": "2010"})
        mistborn = books["mistborn-brandon-sanderson"]
        self.assertEqual((mistborn["open_library_id"], mistborn["page_count"], mistborn["cover_url"]),
                         ("", "", ""))

    def test_no_word_count_from_page_count(self):
        self.write_details([self.WOK])
        self.extract(build_books([("The Way of Kings", "Brandon Sanderson", None, None, None)]))
        wok = self.books()["the-way-of-kings-brandon-sanderson"]
        self.assertEqual((wok["word_count"], wok["word_count_source"]), ("", ""))

    def test_workbook_published_year_is_not_replaced(self):
        cosmere = df({"Completed": [False, False], "Type": ["Novel", "Novel"],
                      "Book": ["The Way of Kings", "Elantris"], "Series": [None, None],
                      "Word Count": [None, None], "Published": [2011, None]})
        self.write_details([self.WOK, {**self.WOK, "title": "Elantris", "open_library_id": "OL5738148W",
                                       "published_year": "2005"}])
        self.extract(build_books([], {"Cosmere": cosmere}))
        books = self.books()
        self.assertEqual(books["the-way-of-kings-brandon-sanderson"]["published_year"], "2011")
        self.assertEqual(books["elantris-brandon-sanderson"]["published_year"], "2005")

    def test_a_hand_row_folds_in_like_any_other(self):
        self.write_details([{**self.WOK, "open_library_id": "", "page_count": "1001", "source": "hand"}])
        self.extract(build_books([("The Way of Kings", "Brandon Sanderson", None, None, None)]))
        self.assertEqual(self.books()["the-way-of-kings-brandon-sanderson"]["page_count"], "1001")

    def test_a_details_row_matching_no_book_is_reported(self):
        self.write_details([{**self.WOK, "title": "Words of Radiance"}])
        self.extract(build_books([("The Way of Kings", "Brandon Sanderson", None, None, None)]))
        flagged = [u for u in ex.UNRESOLVED if (u["table"], u["reason"]) == ("book_details", "no such book")]
        self.assertEqual(len(flagged), 1)
        self.assertIn("Words of Radiance", flagged[0]["detail"])

    def test_open_library_row_survives_extract(self):
        gone = {**self.PROPOSAL, "a": "Not In The Workbook", "b": "Not in the Workbook!"}
        self.write_review([self.PROPOSAL, gone])
        self.extract(build_books([("Edgedancer Novella", "Brandon Sanderson", None, None, None)]))
        rows = self.review_rows()
        self.assertEqual([(r["a"], r["reason"], r["decision"]) for r in rows],
                         [("Edgedancer Novella", "open library", "")])
        self.assertNotIn("stale review", self.reasons())

    def test_accepted_open_library_row_renames_the_book_and_details_follow(self):
        self.write_review([{**self.PROPOSAL, "decision": "merge"}])
        self.write_details([{**self.WOK, "title": "Edgedancer", "open_library_id": "OL19356251W",
                             "page_count": "272"}])
        self.extract(build_books([("Edgedancer Novella", "Brandon Sanderson", None, None, None)]))
        books = self.books()
        self.assertEqual(list(books), ["edgedancer-brandon-sanderson"])
        self.assertEqual((books["edgedancer-brandon-sanderson"]["title"],
                          books["edgedancer-brandon-sanderson"]["open_library_id"]),
                         ("Edgedancer", "OL19356251W"))
        self.assertEqual([r["decision"] for r in self.review_rows()], ["merge"])
        self.assertNotIn("stale review", self.reasons())


class SeriesFollows(BookCase):
    """Task 1.15 (D-42, D-43): the Series tab and the author tabs become follows
    at `tracking`; Cosmere, the Riordanverse and the UNIVERSE_GROUPS are
    universes; a group that names nothing is reported, never guessed."""

    def follows(self) -> list[tuple[str, str, str]]:
        out = []
        for kind, column in (("series", "series_id"), ("author", "author_id"), ("universe", "universe_id")):
            for r in read(self.out, f"{kind}_follows"):
                self.assertEqual((r["user_id"], r["state"]), ("$OWNER", "tracking"))
                out.append((kind, r[column]))
        return out

    def unmatched(self) -> list[str]:
        return [u["detail"] for u in ex.UNRESOLVED if u["table"] == "follows"]

    def test_roadmap_fixture_seeds_three_follows_and_one_unresolved(self):
        """The roadmap Check: one series, one author, one universe group and one
        unmatched name; the Cosmere tab's books carry universe_id 'cosmere'."""
        self.extract(build_books(
            [("Red Rising", "Pierce Brown", "Red Rising #1", "Sci-fi", None),
             ("Sphere", "Michael Crichton", None, "Sci-fi", None)],
            {"Cosmere": tab("The Final Empire", "Warbreaker", series=["Mistborn #1", None]),
             "Series": series_tab(("Red Rising", "Pierce Brown", 7, [("Red Rising", None)]),
                                  ("Michael Crichton", "Michael Crichton", 19, [("Sphere", None)]),
                                  ("Cosmere", "Brandon Sanderson", 27, [("Warbreaker", None)]),
                                  ("Zz Nothing", "Nobody", 3, []))}))
        self.assertEqual(self.follows(), [("series", "red-rising"), ("author", "michael-crichton"),
                                          ("universe", "cosmere")])
        self.assertEqual(len(self.unmatched()), 1)
        self.assertIn("Zz Nothing", self.unmatched()[0])
        self.assertEqual(read(self.out, "book_universes"), [{"id": "cosmere", "name": "Cosmere"}])
        universe = {b["id"]: b["universe_id"] for b in self.books().values()}
        self.assertEqual(universe, {"red-rising-pierce-brown": "", "sphere-michael-crichton": "",
                                    "the-final-empire-brandon-sanderson": "cosmere",
                                    "warbreaker-brandon-sanderson": "cosmere"})
        self.assertNotIn("Series-tab book matches no book", self.reasons())
        # The ticked Completed column is not read (D-41): no status but to_read.
        self.assertEqual(set(self.status().values()), {"to_read"})
        self.assertNotIn("Series", {r["tab"] for r in read(self.out, "workbook_reads")})

    def test_seed_headers_are_the_tables_columns(self):
        self.extract(build_books([]))
        for name, header in (("book_universes", "id,name"), ("series_follows", "user_id,series_id,state"),
                             ("author_follows", "user_id,author_id,state"),
                             ("universe_follows", "user_id,universe_id,state")):
            self.assertEqual((self.out / f"{name}.csv").read_text(encoding="utf-8").splitlines()[0], header)
        self.assertTrue((self.out / "books.csv").read_text(encoding="utf-8").splitlines()[0]
                        .endswith(",open_library_id,universe_id"))

    def test_a_group_on_the_hand_list_is_a_universe_of_its_listed_books(self):
        """Owner, 2026-10-26: Grishaverse is a universe because UNIVERSE_GROUPS
        says so. A group named nowhere is reported, and moves no book."""
        self.extract(build_books(
            [("Shadow and Bone", "Leigh Bardugo", None, None, None),
             ("Six of Crows", "Leigh Bardugo", "Six of Crows #1", None, None),
             ("Ninth House", "Leigh Bardugo", None, None, None)],
            {"Series": series_tab(("Grishaverse", "Leigh Bardugo", 8,
                                   [("Shadow and Bone", None), ("Six of Crows", None)]),
                                  ("The Themis Files", "Sylvain Neuvel", 3, [("Ninth House", None)]))}))
        self.assertIn("Grishaverse", ex.UNIVERSE_GROUPS)
        self.assertEqual(self.follows(), [("universe", "grishaverse")])
        universe = {b["id"]: b["universe_id"] for b in self.books().values()}
        self.assertEqual(universe, {"shadow-and-bone-leigh-bardugo": "grishaverse",
                                    "six-of-crows-leigh-bardugo": "grishaverse",
                                    "ninth-house-leigh-bardugo": ""})
        self.assertEqual(len(self.unmatched()), 1)
        self.assertIn("The Themis Files", self.unmatched()[0])

    def test_an_unmatched_group_is_offered_for_review_and_a_merge_makes_it_a_follow(self):
        path = build_books([("Origin", "Dan Brown", "Robert Langdon #5", None, None)],
                           {"Series": series_tab(("Robert Langdom", "Dan Brown", 6, [("Origin", None)]))})
        self.extract(path)
        self.assertEqual(self.follows(), [])
        self.assertEqual(len(self.unmatched()), 1)
        pairs = [{r["a"], r["b"]} for r in self.review_rows() if r["kind"] == "series"]
        self.assertEqual(pairs, [{"Robert Langdom", "Robert Langdon"}])
        self.decide(lambda r: r["kind"] == "series", "merge", keep="Robert Langdon")
        self.extract(path)
        self.assertEqual(self.follows(), [("series", "robert-langdon")])
        self.assertEqual(self.unmatched(), [])
        self.assertNotIn("stale review", self.reasons())

    def test_listed_word_counts_fill_only_empty_counts(self):
        """Owner, 2026-10-26: a listed book's count fills a missing word_count,
        stated, and never replaces one."""
        self.extract(build_books(
            [("Sphere", "Michael Crichton", None, None, None),
             ("Congo", "Michael Crichton", None, None, 90000)],
            {"Series": series_tab(("Michael Crichton", "Michael Crichton", 19,
                                   [("Sphere", 120000), ("Congo", 95000)]))}))
        books = self.books()
        self.assertEqual((books["sphere-michael-crichton"]["word_count"],
                          books["sphere-michael-crichton"]["word_count_source"]), ("120000", "stated"))
        self.assertEqual(books["congo-michael-crichton"]["word_count"], "90000")

    def test_a_listed_book_matching_nothing_is_reported_not_created(self):
        self.extract(build_books([("Sphere", "Michael Crichton", None, None, None)],
                                 {"Series": series_tab(("Michael Crichton", "Michael Crichton", 19,
                                                        [("Sphere", None), ("Zz Missing", 1000)]))}))
        self.assertEqual(list(self.books()), ["sphere-michael-crichton"])
        details = [u["detail"] for u in ex.UNRESOLVED if u["reason"] == "Series-tab book matches no book"]
        self.assertEqual(len(details), 1)
        self.assertIn("Zz Missing", details[0])

    def test_the_author_tabs_follow_what_they_are(self):
        self.extract(build_books([], {
            "Stephen King": tab("Carrie"),
            "Dresden": tab("Storm Front", series=["The Dresden Files #1"]),
            "Riordanverse": tab("The Lightning Thief", series=["Percy Jackson and the Olympians #1"])}))
        self.assertEqual(self.follows(), [("series", "the-dresden-files"), ("author", "stephen-king"),
                                          ("universe", "riordanverse")])
        self.assertEqual(read(self.out, "book_universes"), [{"id": "riordanverse", "name": "Riordanverse"}])
        self.assertEqual(self.books()["the-lightning-thief-rick-riordan"]["universe_id"], "riordanverse")
        self.assertEqual(self.books()["carrie-stephen-king"]["universe_id"], "")

    def test_two_spellings_with_one_key_are_one_author_and_one_series(self):
        """TASK-021's note: `J.R.R. Tolkien` and `JRR Tolkien` slug apart but
        share a key, so they are one author, and a follow sees both books."""
        self.extract(build_books(
            [("The Hobbit", "J.R.R. Tolkien", "D.C. Middle Earth #1", None, None),
             ("The Silmarillion", "JRR Tolkien", "DC Middle Earth #2", None, None)],
            {"Series": series_tab(("JRR Tolkien", "JRR Tolkien", 2, [("The Hobbit", None)]))}))
        self.assertEqual(read(self.out, "authors"), [{"id": "j-r-r-tolkien", "name": "J.R.R. Tolkien"}])
        self.assertEqual([s["id"] for s in read(self.out, "book_series")], ["d-c-middle-earth"])
        self.assertEqual({(b["author_id"], b["series_id"]) for b in self.books().values()},
                         {("j-r-r-tolkien", "d-c-middle-earth")})
        self.assertEqual(self.follows(), [("author", "j-r-r-tolkien")])


class PlaceholderTitles(BookCase):
    """Owner, 2026-10-26: a placeholder title (Untitled, Untitled 2, TBA, TBD)
    is not a book yet. It loads no book, status, plan, release or universe
    row, and seed/workbook_placeholders.csv lists every sighting instead."""

    def test_untitled_rows_load_no_book_and_are_each_listed(self):
        self.extract(build_books(
            [("TBA", "Brandon Sanderson", None, "Fantasy", None),
             ("Untitled Book", "Brandon Sanderson", None, "Fantasy", None)],
            {"Cosmere": tab("Warbreaker", "Untitled", "untitled", "Untitled #2",
                            series=[None, "Mistborn: Ghostbloods #1", "Elantris #2", "Elantris #3"]),
             "To-Read 2027": df({"Fantasy": ["TBD"]})},
            coming_out=[("Untitled", "Jim Butcher", "The Dresden Files #19", "2027-03-01")]), with_plan=True)
        # "Untitled Book" names something; only a bare placeholder is skipped.
        self.assertEqual(set(self.books()), {"warbreaker-brandon-sanderson", "untitled-book-brandon-sanderson"})
        self.assertEqual(self.status(), {"untitled-book-brandon-sanderson": "to_read"})
        self.assertEqual(read(self.out, "reading_plan"), [])
        self.assertEqual(read(self.out, "releases"), [])
        # A series named only by placeholders is not made either.
        self.assertEqual(read(self.out, "book_series"), [])
        self.assertEqual(
            sorted((r["title"], r["author"], r["series"], r["tab"]) for r in read(self.out, "workbook_placeholders")),
            sorted([("TBA", "Brandon Sanderson", "", "To-Read Master List"),
                    ("Untitled", "Brandon Sanderson", "Mistborn: Ghostbloods #1", "Cosmere"),
                    ("untitled", "Brandon Sanderson", "Elantris #2", "Cosmere"),
                    ("Untitled #2", "Brandon Sanderson", "Elantris #3", "Cosmere"),
                    ("TBD", "", "", "To-Read 2027"),
                    ("Untitled", "Jim Butcher", "The Dresden Files #19", "Coming Out")]))
        self.assertEqual(self.review_rows(), [])

    def test_is_placeholder(self):
        for title in ("Untitled", "untitled", "UNTITLED", "Untitled 2", "Untitled #3", "TBA", "tbd"):
            self.assertTrue(ex.is_placeholder(title), title)
        for title in ("Untitled Book", "The Untitled", "TBA: A Novel", "Untold", None):
            self.assertFalse(ex.is_placeholder(title), title)


class TitlesAreText(BookCase):
    """Task 1.14 (owner, at the plan gate): a title cell is read as the text
    the owner typed. Excel stores 11/22/63 as a date and 1984 as a number."""

    def test_date_typed_title_reads_as_typed(self):
        import datetime
        king = df({"Completed": [False, False], "Type": ["Novel", "Novel"],
                   "Book": [datetime.datetime(1963, 11, 22), "Carrie"], "Series": [None, None],
                   "Word Count": [None, None], "Published": [2011, 1974]})
        self.extract(build_books([], {"Stephen King": king}))
        books = self.books()
        self.assertIn("11-22-63-stephen-king", books)
        self.assertEqual(books["11-22-63-stephen-king"]["title"], "11/22/63")

    def test_a_to_read_column_stops_at_its_count_row(self):
        """Each To-Read genre column ends in a count of the titles above it
        (owner, task 1.14): it is not a book, and neither is anything below it.
        A title Excel stored as a number is still a book."""
        tabs = {"To-Read 2027": df({"Fantasy": ["Mistborn", 1984, "Dune", 3, None, "Notes"],
                                   "Classics": [0.0]}),
                "To-Read 2028": df({"Fantasy": ["Elantris", 1.0]})}
        self.extract(build_books([], tabs))
        self.assertEqual(sorted(b["title"] for b in self.books().values()), ["1984", "Dune", "Mistborn"])
        self.assertEqual([r["title"] for r in read(self.out, "workbook_plans")], ["Elantris"])

    def test_a_read_column_keeps_a_number_title_and_stops_at_its_count_row(self):
        """The Read tabs too (owner, task 1.14): 1984 is a read, 3 is the count,
        and the summary below it is not a read."""
        tabs = {"Read 2025": df({"Classics": ["Dune", 1984, None, "Emma", 3, None, "Cosmere"]})}
        self.extract(build_books([], tabs))
        self.assertEqual([r["title"] for r in read(self.out, "workbook_reads")], ["Dune", "1984", "Emma"])

    def test_title_text(self):
        import datetime
        import pandas as pd
        self.assertEqual(ex.title_text(pd.Timestamp("1963-11-22")), "11/22/63")
        self.assertEqual(ex.title_text(datetime.datetime(2001, 1, 5)), "1/5/01")
        self.assertEqual(ex.title_text(1984.0), "1984")
        self.assertEqual(ex.title_text(1984), "1984")
        self.assertEqual(ex.title_text("  The   Stand "), "The Stand")
        self.assertIsNone(ex.title_text(float("nan")))


class PrereqCycles(WorkbookCase):
    """Task 2.11a (D-2, D-7, R0-01): every loop in the prereq graph, hard and
    soft edges alike, is one `prereqs,prereq cycle` row naming its runs, hard
    edges first. Extract carries on by default; --fail-on-cycle exits non-zero."""

    RUNS = [(r, f"Run {r}", "Avengers", None, None)
            for r in ("x", "y", "z", "p", "q", "c1", "c2", "c3", "s")]
    # x, y, z mix hard and soft; p, q are soft only; c1 -> c2 -> c3 is a chain.
    PREREQS = [("x", "y", "hard"), ("y", "z", "soft"), ("z", "x", "hard"),
               ("p", "q", "soft"), ("q", "p", "soft"),
               ("c1", "c2", "hard"), ("c2", "c3", "soft")]
    ORDERS = [("x", "Avengers (1998) #1", False, "Core", None)]

    def extract_prereqs(self, prereqs):
        from unittest import mock
        with mock.patch("sys.stdout"):
            ex.extract_comics(build_workbook(self.ORDERS, self.RUNS, prereqs), self.out)

    def cycles(self) -> list[str]:
        return [u["detail"] for u in ex.UNRESOLVED
                if (u["table"], u["reason"]) == ("prereqs", "prereq cycle")]

    def test_each_component_is_one_row_naming_its_runs_hard_edges_first(self):
        self.extract_prereqs(self.PREREQS)
        self.assertEqual(self.cycles(), [
            "2 runs: p, q | soft: p -> q, q -> p",
            "3 runs: x, y, z | hard: x -> y, z -> x | soft: y -> z",
        ])
        self.assertFalse(any("c1" in d or "c2" in d or "c3" in d for d in self.cycles()))
        # The edges themselves still load: the check reports, it doesn't drop.
        self.assertEqual(len(read(self.out, "prereqs")), len(self.PREREQS))

    def test_a_run_listed_as_its_own_prereq_is_a_component(self):
        self.extract_prereqs([("s", "s", "soft"), ("c1", "c2", "hard")])
        self.assertEqual(self.cycles(), ["1 run: s | soft: s -> s"])

    def test_an_acyclic_graph_has_no_cycle_rows(self):
        self.extract_prereqs(self.PREREQS[5:])
        self.assertEqual(self.cycles(), [])

    def main(self, prereqs, *flags) -> tuple[int, str]:
        import io
        from contextlib import redirect_stderr
        from unittest import mock
        comics = build_workbook(self.ORDERS, self.RUNS, prereqs)
        err = io.StringIO()
        with mock.patch("sys.stdout"), redirect_stderr(err):
            code = ex.main(["--comics", str(comics), "--books", str(build_books([])),
                            "--out", str(self.out), *flags])
        return code, err.getvalue()

    def test_by_default_extract_writes_the_rows_and_exits_zero(self):
        code, _ = self.main(self.PREREQS)
        self.assertEqual(code, 0)
        rows = [r for r in read(self.out, "unresolved")
                if (r["table"], r["reason"]) == ("prereqs", "prereq cycle")]
        self.assertEqual([r["detail"] for r in rows], self.cycles())
        self.assertEqual(len(rows), 2)

    def test_calibre_overrides_are_written_apart_from_unresolved(self):
        """D-93: calibre_changes.csv holds what note() collected; unresolved.csv
        does not."""
        ex.CHANGES.clear()
        self.addCleanup(ex.CHANGES.clear)
        ex.note("calibre_books", "calibre replaced a series", "Mistborn: A #1 -> Calibre's B #1")
        self.main(self.PREREQS[5:])
        self.assertEqual(read(self.out, "calibre_changes"),
                         [{"table": "calibre_books", "reason": "calibre replaced a series",
                           "detail": "Mistborn: A #1 -> Calibre's B #1"}])
        self.assertNotIn("calibre replaced a series", [r["reason"] for r in read(self.out, "unresolved")])

    def test_fail_on_cycle_exits_non_zero_naming_the_runs(self):
        code, err = self.main(self.PREREQS, "--fail-on-cycle")
        self.assertNotEqual(code, 0)
        for run in ("x", "y", "z", "p", "q"):
            self.assertRegex(err, rf"\b{run}\b")
        self.assertNotIn("c1", err)
        # Every CSV is still written, the cycle rows included.
        self.assertEqual(len([r for r in read(self.out, "unresolved")
                              if r["reason"] == "prereq cycle"]), 2)

    def test_fail_on_cycle_passes_an_acyclic_graph(self):
        code, err = self.main(self.PREREQS[5:], "--fail-on-cycle")
        self.assertEqual(code, 0)
        self.assertNotIn("--fail-on-cycle", err)


if __name__ == "__main__":
    unittest.main()
