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



def build_workbook(reading_orders: list[tuple], runs: list[tuple]) -> Path:
    """A minimal Comics.xlsx: RUNS, PREREQS, Reading Orders, EVENTS, Master."""
    import pandas as pd
    path = Path(tempfile.mkdtemp()) / "Comics.xlsx"
    with pd.ExcelWriter(path) as xw:
        pd.DataFrame(runs, columns=["Run ID", "Title", "Track", "Writer", "Artists"]) \
            .to_excel(xw, sheet_name="RUNS", index=False)
        pd.DataFrame(columns=["Run ID", "Prereq Run ID", "Type"]) \
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
                      ex.ISSUE_DETAILS, ex.ISSUE_CREDITS, ex.VOLUME_MAP, ex.CREATOR_ALIASES):
            table.clear()
        ex.USED_RENAMES.clear()
        self.out = Path(tempfile.mkdtemp())

    def extract(self, rows):
        from unittest import mock
        with mock.patch("sys.stdout"):
            ex.extract_comics(build_workbook(rows, self.RUNS), self.out)

    def reasons(self):
        return [u["reason"] for u in ex.UNRESOLVED]


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
        # Read in run a, unread in run b (ARCHITECTURE 2.14): one progress row, on
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
        book = next(b for b in idx.by_key.values() if b["id"] == bid)
        self.assertEqual((book["word_count"], book["word_count_source"]), (85000, "stated"))


if __name__ == "__main__":
    unittest.main()
