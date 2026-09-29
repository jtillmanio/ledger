"""Tests for etl/check_sidecars.py. No network.

    py -m unittest discover -s etl -p "test_*.py"
"""

import csv
import json
import sys
import tempfile
import unittest
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent))
import check_sidecars as cs  # noqa: E402


def credit(label, creator, mid="", role="writer", source="hand"):
    return {"label": label, "creator": creator, "metron_creator_id": mid,
            "role": role, "source": source}


class Credits(unittest.TestCase):
    def test_role_typed_in_the_id_column_moves_back(self):
        report = cs.Report()
        rows = cs.fix_credits([credit("Cutting Edge #1", "Angel Medina", mid="penciler", role="")], report)
        self.assertEqual((rows[0]["metron_creator_id"], rows[0]["role"]), ("", "artist"))
        self.assertIn(("issue_credits.csv", "role typed in metron_creator_id"), report.fixes)

    def test_row_shifted_one_column_left_moves_back(self):
        report = cs.Report()
        rows = cs.fix_credits([credit("X #1", "Comicraft", mid="letterer", role="hand", source="")], report)
        self.assertEqual((rows[0]["metron_creator_id"], rows[0]["role"], rows[0]["source"]),
                         ("", "letterer", "hand"))

    def test_penciler_is_artist_and_blank_source_is_hand(self):
        report = cs.Report()
        rows = cs.fix_credits([credit("X #1", "Ron Lim", role="Penciler", source="")], report)
        self.assertEqual((rows[0]["role"], rows[0]["source"]), ("artist", "hand"))

    def test_fandom_plural_roles_map_onto_the_six(self):
        report = cs.Report()
        rows = cs.fix_credits([credit("X #1", "Comicraft", role="Letterers"),
                               credit("X #1", "Chris Sotomayor", role="Colorists"),
                               credit("X #1", "Chris Sotomayor", role="Colourists")], report)
        self.assertEqual([r["role"] for r in rows], ["letterer", "colorist", "colorist"])

    def test_unknown_role_is_reported_not_guessed(self):
        report = cs.Report()
        rows = cs.fix_credits([credit("X #1", "Tom Brevoort", role="editor")], report)
        self.assertEqual(rows[0]["role"], "editor")
        self.assertIn(("issue_credits.csv", "unknown role"), report.problems)

    def test_hand_credit_takes_the_metron_id_and_spelling(self):
        report = cs.Report()
        rows = [credit("A #1", "John Romita Jr.", mid="42", source="metron"),
                credit("B #1", "john romita jr", role="artist")]
        cs.fill_creator_ids(rows, report)
        self.assertEqual((rows[1]["metron_creator_id"], rows[1]["creator"]), ("42", "John Romita Jr."))
        self.assertEqual(rows[1]["source"], "hand")

    def test_a_name_shared_by_two_metron_creators_is_not_filled(self):
        report = cs.Report()
        rows = [credit("A #1", "John Smith", mid="1", source="metron"),
                credit("B #1", "John Smith", mid="2", source="metron"),
                credit("C #1", "John Smith")]
        cs.fill_creator_ids(rows, report)
        self.assertEqual(rows[2]["metron_creator_id"], "")
        self.assertIn(("issue_credits.csv", "creator name matches several Metron creators"),
                      report.problems)

    def test_near_miss_spelling_is_suggested_not_changed(self):
        report = cs.Report()
        rows = [credit("A #1", "Cory Petit", mid="9", role="letterer", source="metron"),
                credit("B #1", "Coby Petit", role="letterer")]
        cs.fill_creator_ids(rows, report)
        self.assertEqual((rows[1]["creator"], rows[1]["metron_creator_id"]), ("Coby Petit", ""))
        self.assertIn("Cory Petit", report.problems[("issue_credits.csv",
                                                     "creator spelled close to a Metron creator")][0])

    def test_hand_credit_under_an_alias_takes_the_metron_id_and_spelling(self):
        report = cs.Report()
        rows = [credit("Thor #337", "Walter Simonson", mid="15", source="metron"),
                credit("Thor #338", "Walt Simonson", role="artist")]
        cs.fill_creator_ids(rows, report, {cs.person_key("Walt Simonson"): ("Walter Simonson", "")})
        self.assertEqual((rows[1]["metron_creator_id"], rows[1]["creator"]), ("15", "Walter Simonson"))
        self.assertEqual(rows[1]["source"], "hand")

    def test_without_an_alias_a_short_name_is_left_alone(self):
        report = cs.Report()
        rows = [credit("Thor #337", "Walter Simonson", mid="15", source="metron"),
                credit("Thor #338", "Walt Simonson", role="artist")]
        cs.fill_creator_ids(rows, report)
        self.assertEqual((rows[1]["metron_creator_id"], rows[1]["creator"]), ("", "Walt Simonson"))

    def test_duplicates_collapse_keeping_the_id(self):
        report = cs.Report()
        rows = cs.dedupe_credits([credit("X #2", "Bob Layton"), credit("X #2", "Bob Layton", mid="7"),
                                  credit("X #2", "Bob Layton", source="metron")], report)
        self.assertEqual(len(rows), 2)                       # hand and metron are different claims
        self.assertEqual(rows[0]["metron_creator_id"], "7")



def metron(label, creator, mid, role="writer"):
    return credit(label, creator, mid=mid, role=role, source="metron")


class CreatorReview(unittest.TestCase):
    ROWS = [metron("Thor #337", "Walter Simonson", "15"),
            metron("X-Factor #1", "Louise Simonson", "667"),
            metron("FF #1", "Joe Caramagna", "30", role="letterer"),
            metron("Madman #1", "Mike Allred", "40", role="artist"),
            metron("ASM #1", "John Romita Sr.", "50", role="artist"),
            metron("ASM #500", "John Romita Jr.", "51", role="artist")]

    def propose(self, *hand, aliases=None, sheet=None):
        rows = [dict(r) for r in self.ROWS] + list(hand)
        report = cs.Report()
        proposals = cs.fill_creator_ids(rows, report, aliases, sheet)
        return {(p["alias"], p["creator"], p["metron_creator_id"]): p for p in proposals}, rows, report

    def test_short_first_name_nickname_and_extra_words_are_proposed_not_applied(self):
        found, rows, _ = self.propose(credit("Thor #338", "Walt Simonson"),
                                      credit("FF #2", "VC's Joe Caramagna", role="letterer"),
                                      credit("Madman #2", "Michael Allred", role="artist"))
        self.assertEqual(set(found), {("Walt Simonson", "Walter Simonson", "15"),
                                      ("VC's Joe Caramagna", "Joe Caramagna", "30"),
                                      ("Michael Allred", "Mike Allred", "40")})
        self.assertEqual(found[("Walt Simonson", "Walter Simonson", "15")]["why"],
                         "same surname, first name walt / walter")
        self.assertEqual(found[("Walt Simonson", "Walter Simonson", "15")]["example"], "Thor #338")
        self.assertTrue(all(r["metron_creator_id"] == "" for r in rows[len(self.ROWS):]))

    def test_same_surname_different_first_name_is_not_proposed(self):
        found, _, _ = self.propose(credit("X-Factor #2", "Mark Simonson"))
        self.assertEqual(set(found), set())

    def test_a_name_without_its_suffix_proposes_each_creator_it_could_be(self):
        found, _, _ = self.propose(credit("ASM #2", "John Romita", role="artist"))
        self.assertEqual({k[2] for k in found}, {"50", "51"})

    def test_one_row_per_name_counts_its_credits(self):
        found, _, _ = self.propose(credit("Thor #338", "Walt Simonson"),
                                   credit("Thor #339", "Walt Simonson", role="artist"))
        self.assertEqual(found[("Walt Simonson", "Walter Simonson", "15")]["credits"], 2)

    def test_an_accepted_pair_fills_the_id_with_the_creator_it_names(self):
        _, rows, report = self.propose(credit("ASM #2", "John Romita", role="artist"),
                                       aliases={cs.person_key("John Romita"): ("John Romita Jr.", "51")})
        self.assertEqual((rows[-1]["creator"], rows[-1]["metron_creator_id"]), ("John Romita Jr.", "51"))
        self.assertIn(("issue_credits.csv", "Metron creator id added"), report.fixes)

    def test_sheet_writers_are_proposed_and_never_changed(self):
        found, _, report = self.propose(sheet={"Walt Simonson": "simonson-thor", "Various": "hulk-origin"})
        self.assertEqual(found[("Walt Simonson", "Walter Simonson", "15")]["example"],
                         "sheet writer on simonson-thor")
        self.assertEqual(len(found), 1)
        self.assertIn(("workbook_run_fields.csv", "sheet writer spelled close to a Metron creator"),
                      report.problems)

    def test_merge_keeps_decisions_replaces_pending_and_reads_yes_and_no(self):
        report = cs.Report()
        existing = [
            {"alias": "Walt Simonson", "creator": "Walter Simonson", "metron_creator_id": "15",
             "decision": "yes"},
            {"alias": "Lou Simonson", "creator": "Louise Simonson", "metron_creator_id": "667",
             "decision": "No"},
            {"alias": "Old Name", "creator": "Somebody", "metron_creator_id": "9", "decision": ""},
            {"alias": "Maybe", "creator": "Someone", "metron_creator_id": "8", "decision": "later"},
        ]
        proposals = [
            {"alias": "Lou Simonson", "creator": "Louise Simonson", "metron_creator_id": "667",
             "decision": ""},
            {"alias": "Michael Allred", "creator": "Mike Allred", "metron_creator_id": "40",
             "decision": ""},
        ]
        out = cs.merge_review(existing, proposals, report)
        self.assertEqual([(r["alias"], r["decision"]) for r in out],
                         [("Michael Allred", ""), ("Lou Simonson", "reject"),
                          ("Maybe", "later"), ("Walt Simonson", "accept")])
        self.assertIn(("creator_review.csv", "decision is not accept or reject"), report.problems)

    def test_read_aliases_takes_only_accepted_review_rows(self):
        path = Path(tempfile.mkdtemp()) / "creator_review.csv"
        with path.open("w", newline="", encoding="utf-8") as fh:
            w = csv.DictWriter(fh, fieldnames=cs.REVIEW_COLUMNS)
            w.writeheader()
            w.writerow({"alias": "Walt Simonson", "creator": "Walter Simonson",
                        "metron_creator_id": "15", "decision": "Y"})
            w.writerow({"alias": "Lou Simonson", "creator": "Louise Simonson",
                        "metron_creator_id": "667", "decision": "reject"})
            w.writerow({"alias": "Mike", "creator": "Mike Allred", "metron_creator_id": "40",
                        "decision": ""})
        self.assertEqual(cs.read_aliases(path),
                         {"walt simonson": ("Walter Simonson", "15")})

    def test_one_alias_accepted_for_two_creators_applies_neither(self):
        path = Path(tempfile.mkdtemp()) / "creator_review.csv"
        with path.open("w", newline="", encoding="utf-8") as fh:
            w = csv.DictWriter(fh, fieldnames=cs.REVIEW_COLUMNS)
            w.writeheader()
            for mid, name in (("50", "John Romita Sr."), ("51", "John Romita Jr.")):
                w.writerow({"alias": "John Romita", "creator": name, "metron_creator_id": mid,
                            "decision": "accept"})
        report = cs.Report()
        self.assertEqual(cs.read_aliases(path, report), {})
        self.assertIn(("creator_review.csv", "alias accepted for two creators"), report.problems)


class Labels(unittest.TestCase):
    known = {"Avengers: The Ultron Imperative #1", "Ultimate Spider-Man (2000) #½",
             "Death Spiral - Body Count (2026) #1"}

    def test_missing_number_and_extract_spelling_rekey(self):
        report = cs.Report()
        rows = [credit("Avengers: The Ultron Imperative", "Roy Thomas"),
                credit("Death Spiral – Body Count (2026) #1", "Someone")]
        rows = cs.rekey(rows, "issue_credits.csv", self.known, set(), report, one_per_label=False)
        self.assertEqual([r["label"] for r in rows],
                         ["Avengers: The Ultron Imperative #1", "Death Spiral - Body Count (2026) #1"])

    def test_stale_copy_of_an_existing_row_is_dropped(self):
        report = cs.Report()
        rows = [{"label": "Ultimate Spider-Man (2000) #½", "metron_issue_id": "73974", "status": "detailed"},
                {"label": "Ultimate Spider-Man (2000) #1⁄2", "metron_issue_id": "73974", "status": "listed"}]
        rows = cs.rekey(rows, "issue_details.csv", self.known, set(), report, one_per_label=True)
        self.assertEqual([(r["label"], r["status"]) for r in rows],
                         [("Ultimate Spider-Man (2000) #½", "detailed")])

    def test_dropped_copy_hands_its_details_pass_to_the_row_kept(self):
        report = cs.Report()
        known = {"Ultimate Spider-Man (2000) #½"}
        rows = [{"label": "Ultimate Spider-Man (2000) #1⁄2", "metron_issue_id": "73974",
                 "status": "detailed", "note": "no story title on Metron", "cover_url": ""},
                {"label": "Ultimate Spider-Man (2000) #½", "metron_issue_id": "73974",
                 "status": "listed", "note": "", "cover_url": "https://x/1.jpg"}]
        rows = cs.rekey(rows, "issue_details.csv", known, set(), report, one_per_label=True)
        self.assertEqual(rows, [{"label": "Ultimate Spider-Man (2000) #½", "metron_issue_id": "73974",
                                 "status": "detailed", "note": "no story title on Metron",
                                 "cover_url": "https://x/1.jpg"}])

    def test_a_conflicting_copy_with_hand_values_is_left_for_you(self):
        report = cs.Report()
        rows = [{"label": "Ultimate Spider-Man (2000) #½", "metron_issue_id": "73974"},
                {"label": "Ultimate Spider-Man (2000) #1⁄2", "metron_issue_id": "73974",
                 "story_title": "Mine", "story_title_source": "hand"}]
        rows = cs.rekey(rows, "issue_details.csv", self.known, set(), report, one_per_label=True)
        self.assertEqual(len(rows), 2)
        self.assertIn(("issue_details.csv", "two rows for one issue"), report.problems)

    def test_orphan_is_reported_with_a_suggestion(self):
        report = cs.Report()
        rows = cs.rekey([credit("Avengers: The Ultron Imperitive #1", "X")], "issue_credits.csv",
                        self.known, set(), report, one_per_label=False)
        self.assertEqual(rows[0]["label"], "Avengers: The Ultron Imperitive #1")
        self.assertIn("did you mean Avengers: The Ultron Imperative #1",
                      report.problems[("issue_credits.csv", "label not in seed/issues.csv")][0])

    def test_renamed_old_labels_are_left_for_enrich(self):
        report = cs.Report()
        cs.rekey([credit("Old #1", "X")], "issue_credits.csv", self.known, {"Old #1"}, report, False)
        self.assertFalse(report.problems)

    def test_prune_true_drops_the_orphan_and_reports_nothing(self):
        report = cs.Report()
        orphans: list = []
        rows = cs.rekey([credit("Gone Forever #1", "X")], "issue_credits.csv", self.known, set(),
                        report, one_per_label=False, prune=True, orphans=orphans)
        self.assertEqual(rows, [])
        self.assertFalse(report.problems)
        self.assertEqual(orphans, [{"file": "issue_credits.csv", **credit("Gone Forever #1", "X")}])

    def test_prune_true_still_rekeys_a_near_miss_instead_of_dropping_it(self):
        report = cs.Report()
        orphans: list = []
        rows = cs.rekey([credit("Avengers: The Ultron Imperative", "X")], "issue_credits.csv",
                        self.known, set(), report, one_per_label=False, prune=True, orphans=orphans)
        self.assertEqual(rows[0]["label"], "Avengers: The Ultron Imperative #1")
        self.assertEqual(orphans, [])

    def test_prune_true_leaves_a_renamed_old_label_alone(self):
        report = cs.Report()
        orphans: list = []
        rows = cs.rekey([credit("Old #1", "X")], "issue_credits.csv", self.known, {"Old #1"},
                        report, one_per_label=False, prune=True, orphans=orphans)
        self.assertEqual(rows[0]["label"], "Old #1")
        self.assertEqual(orphans, [])


class ArchiveOrphans(unittest.TestCase):
    def test_appends_a_header_then_one_row_per_orphan_with_fields_as_json(self):
        with tempfile.TemporaryDirectory() as tmp:
            path = Path(tmp) / "pruned_orphans.csv"
            orphans = [{"file": "issue_credits.csv", "label": "Gone #1",
                       "creator": "X", "role": "writer", "source": "hand"}]
            cs.archive_orphans(path, orphans, today="2026-01-01")
            with path.open(encoding="utf-8", newline="") as fh:
                rows = list(csv.DictReader(fh))
            self.assertEqual(len(rows), 1)
            self.assertEqual(rows[0]["removed_at"], "2026-01-01")
            self.assertEqual(rows[0]["file"], "issue_credits.csv")
            self.assertEqual(rows[0]["label"], "Gone #1")
            self.assertEqual(json.loads(rows[0]["fields"]),
                             {"creator": "X", "role": "writer", "source": "hand"})

    def test_second_call_appends_without_a_second_header(self):
        with tempfile.TemporaryDirectory() as tmp:
            path = Path(tmp) / "pruned_orphans.csv"
            cs.archive_orphans(path, [{"file": "a.csv", "label": "A #1"}], today="2026-01-01")
            cs.archive_orphans(path, [{"file": "b.csv", "label": "B #1"}], today="2026-01-02")
            with path.open(encoding="utf-8", newline="") as fh:
                rows = list(csv.DictReader(fh))
            self.assertEqual([r["label"] for r in rows], ["A #1", "B #1"])


class CoverDates(unittest.TestCase):
    def test_shifted_row_moves_back(self):
        report = cs.Report()
        rows = [{"label": "Silver Surfer: Homecoming GN (1991) #1", "cover_date": "1991-11-01",
                 "source": "metron", "status": "matched", "metron_issue_id": "no_series",
                 "metron_series_id": "129813", "note": "8919"}]
        cs.fix_cover_dates(rows, {}, report)
        self.assertEqual((rows[0]["metron_issue_id"], rows[0]["metron_series_id"], rows[0]["note"]),
                         ("129813", "8919", ""))

    def test_listed_metron_issue_is_promoted_so_details_fetches_it(self):
        report = cs.Report()
        rows = [{"label": "Savage Hulk (1996) #1", "cover_date": "1996-01", "source": "hand",
                 "status": "no_series", "metron_issue_id": "", "metron_series_id": "", "note": "x"},
                {"label": "Mortal Thor #1", "cover_date": "2025-10-01", "source": "metron",
                 "status": "no_series", "metron_issue_id": "151656", "metron_series_id": "", "note": ""}]
        details = {"Savage Hulk (1996) #1": {"metron_issue_id": "19582", "status": "listed"}}
        cs.fix_cover_dates(rows, details, report)
        self.assertEqual([(r["status"], r["metron_issue_id"]) for r in rows],
                         [("matched", "19582"), ("matched", "151656")])
        self.assertEqual(rows[0]["cover_date"], "1996-01")    # the hand date is untouched
        self.assertEqual(rows[0]["source"], "hand")

    def test_undated_promotion_and_bad_dates_are_reported(self):
        report = cs.Report()
        rows = [{"label": "A #1", "cover_date": "", "source": "", "status": "no_series",
                 "metron_issue_id": "5", "metron_series_id": "", "note": ""},
                {"label": "B #1", "cover_date": "March 1987", "source": "", "status": "no_series",
                 "metron_issue_id": "", "metron_series_id": "", "note": ""}]
        cs.fix_cover_dates(rows, {}, report)
        self.assertIn(("cover_dates.csv", "matched with no cover date"), report.problems)
        self.assertIn(("cover_dates.csv", "unparseable date"), report.problems)
        self.assertEqual(rows[1]["source"], "hand")


class Checklist(unittest.TestCase):
    def test_sections_runs_and_ticks(self):
        states = cs.issue_states(
            ["Thor: Man of War", "Ghost Rider (2001) #1", "Hulk (2022) #7", "Done #1", "Titled #1",
             "Mortal Thor #1"],
            dates={l: {"cover_date": "2001-01-01", "metron_issue_id": "" if l == "Thor: Man of War" else "1"}
                   for l in ["Thor: Man of War", "Ghost Rider (2001) #1", "Hulk (2022) #7", "Done #1",
                             "Titled #1", "Mortal Thor #1"]},
            details={"Ghost Rider (2001) #1": {"status": "detailed"},
                     "Hulk (2022) #7": {"status": "detailed", "story_title": "t"},
                     "Done #1": {"status": "detailed", "story_title": "t"},
                     "Titled #1": {"status": "detailed"},
                     "Mortal Thor #1": {"status": "listed"}},
            credits=[credit("Hulk (2022) #7", "Donny Cates", "1", source="metron"),
                     credit("Done #1", "A", "2", source="metron"),
                     credit("Done #1", "B", "3", role="artist", source="metron"),
                     credit("Titled #1", "A", "2", source="metron"),
                     credit("Titled #1", "B", "3", role="artist", source="metron")],
            placements={"Ghost Rider (2001) #1": ["ennis-ghost-rider"], "Done #1": ["done-run"]})
        by = {s.label: s for s in states}
        self.assertEqual(by["Thor: Man of War"].metron, "none")
        self.assertEqual(by["Ghost Rider (2001) #1"].metron, "empty")
        self.assertEqual(by["Hulk (2022) #7"].missing, ["artist"])
        self.assertEqual(by["Mortal Thor #1"].metron, "pending")
        runs = [{"id": "ennis-ghost-rider", "title": "Ghost Rider", "placeholder": "False"},
                {"id": "done-run", "title": "Done", "placeholder": "False"}]
        md = cs.checklist(states, runs, ticks={"Thor: Man of War"}, pending_fix=False, today="2026-09-26")
        self.assertIn("- [x] **Thor: Man of War** — writer, artist (+ title)", md)
        self.assertIn("- [ ] **Hulk (2022) #7** — artist ·", md)
        self.assertIn("- [ ] **ennis-ghost-rider** Ghost Rider — no writer or artist on any of 1 issues", md)
        self.assertNotIn("**done-run**", md)
        self.assertNotIn("**Done #1**", md)
        self.assertIn("- [ ] **Titled — titles** #1 (1)", md)
        self.assertIn("1 issues have a Metron id but no details yet", md)
        self.assertEqual(cs.read_ticks(Path(write(md))), {"Thor: Man of War"})

    def test_compress(self):
        self.assertEqual(cs.compress(["1", "2", "3", "5", "7.1", "8", "9"]), "#1-3, 5, 7.1, 8-9")

    def test_an_issue_fandom_has_no_title_for_is_not_missing_one(self):
        labels = ["Blank (2014) #2", "Open (2014) #1", "Gap (2014) #1"]
        credits = [c for l in labels for c in (credit(l, "A", "2", source="metron"),
                                               credit(l, "B", "3", role="artist", source="metron"))
                   if l != "Gap (2014) #1" or c["role"] == "writer"]
        args = dict(dates={l: {"cover_date": "2014", "metron_issue_id": "1"} for l in labels},
                    details={l: {"status": "detailed"} for l in labels},
                    credits=credits, placements={})
        untitled = {"Blank (2014) #2", "Gap (2014) #1"}
        by = {s.label: s for s in cs.issue_states(labels, **args, untitled=untitled)}
        self.assertEqual(by["Blank (2014) #2"].missing, [])
        self.assertEqual(by["Gap (2014) #1"].missing, ["artist"])
        self.assertEqual(by["Open (2014) #1"].missing, ["title"])
        md = cs.checklist(list(by.values()), [], set(), False, "2026-09-29", untitled_left_out=2)
        self.assertNotIn("Blank", md)
        self.assertIn("- [ ] **Gap (2014) #1** — artist ·", md)   # no "(+ title)"
        self.assertIn("**Open (2014) — titles** #1 (1)", md)
        self.assertIn("2 issues aren't listed here", md)
        # Without the Fandom answer, they're missing a title as before.
        by = {s.label: s for s in cs.issue_states(labels, **args)}
        self.assertEqual(by["Blank (2014) #2"].missing, ["title"])

    def test_fandom_untitled_reads_only_the_blank_title_rows(self):
        path = Path(tempfile.mkdtemp()) / "fandom_skipped.csv"
        with path.open("w", newline="", encoding="utf-8") as fh:
            w = csv.DictWriter(fh, fieldnames=["reason", "series", "label"])
            w.writeheader()
            w.writerow({"reason": cs.ft.NO_TITLE, "series": "B", "label": "Blank (2014) #2"})
            w.writerow({"reason": "no Fandom volume found", "series": "N", "label": "Nowhere #1"})
        self.assertEqual(cs.fandom_untitled(path), {"Blank (2014) #2"})
        self.assertEqual(cs.fandom_untitled(path.with_name("missing.csv")), set())


def write(text: str) -> str:
    fh = tempfile.NamedTemporaryFile("w", suffix=".md", delete=False, encoding="utf-8")
    fh.write(text)
    fh.close()
    return fh.name


class EndToEnd(unittest.TestCase):
    def test_fix_writes_back_and_report_mode_does_not(self):
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

            put(seed / "issues.csv", ["id", "label"], [{"id": "x-1", "label": "X #1"}])
            put(seed / "run_issues.csv", ["run_id", "sequence", "issue_id"],
                [{"run_id": "r", "sequence": "1", "issue_id": "x-1"}])
            put(seed / "runs.csv", ["id", "title", "placeholder"], [{"id": "r", "title": "R", "placeholder": "False"}])
            put(data / "cover_dates.csv", cs.ec.COLUMNS, [{"label": "X #1", "cover_date": "2001", "source": ""}])
            put(data / "issue_details.csv", cs.ec.DETAIL_COLUMNS, [{"label": "X #1"}])
            put(data / "issue_credits.csv", cs.ec.CREDIT_COLUMNS,
                [credit("X", " Ron  Lim ", mid="penciler", role="")])
            args = ["--data", str(data), "--seed", str(seed), "--todo", str(data / "todo.md")]

            before = (data / "issue_credits.csv").read_text(encoding="utf-8")
            cs.main(args)
            self.assertEqual((data / "issue_credits.csv").read_text(encoding="utf-8"), before)
            self.assertIn("run `npm run sidecars:fix`", (data / "todo.md").read_text(encoding="utf-8"))

            cs.main(args + ["--fix"])
            with (data / "issue_credits.csv").open(encoding="utf-8") as fh:
                self.assertEqual(list(csv.DictReader(fh)),
                                 [credit("X #1", "Ron Lim", mid="", role="artist", source="hand")])
            with (data / "cover_dates.csv").open(encoding="utf-8") as fh:
                self.assertEqual(next(csv.DictReader(fh))["source"], "hand")
            todo = (data / "todo.md").read_text(encoding="utf-8")
            self.assertIn("- [ ] **X #1** — writer (+ title)", todo)

    def test_creator_review_is_written_then_a_yes_fills_the_id_on_fix(self):
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

            def review():
                with (data / "creator_review.csv").open(encoding="utf-8") as fh:
                    return list(csv.DictReader(fh))

            put(seed / "issues.csv", ["id", "label"],
                [{"id": "thor-337", "label": "Thor #337"}, {"id": "thor-338", "label": "Thor #338"}])
            put(seed / "run_issues.csv", ["run_id", "sequence", "issue_id"],
                [{"run_id": "r", "sequence": "1", "issue_id": "thor-337"},
                 {"run_id": "r", "sequence": "2", "issue_id": "thor-338"}])
            put(seed / "runs.csv", ["id", "title", "placeholder"], [{"id": "r", "title": "R", "placeholder": "False"}])
            put(data / "cover_dates.csv", cs.ec.COLUMNS, [])
            put(data / "issue_details.csv", cs.ec.DETAIL_COLUMNS, [])
            put(data / "issue_credits.csv", cs.ec.CREDIT_COLUMNS,
                [credit("Thor #337", "Walter Simonson", mid="15", source="metron"),
                 credit("Thor #338", "Walt Simonson", role="artist")])
            args = ["--data", str(data), "--seed", str(seed), "--todo", str(data / "todo.md")]

            cs.main(args)
            rows = review()
            self.assertEqual([(r["alias"], r["creator"], r["metron_creator_id"], r["decision"])
                              for r in rows], [("Walt Simonson", "Walter Simonson", "15", "")])

            rows[0]["decision"] = "yes"
            put(data / "creator_review.csv", cs.REVIEW_COLUMNS, rows)
            cs.main(args + ["--fix"])
            with (data / "issue_credits.csv").open(encoding="utf-8") as fh:
                hand = [r for r in csv.DictReader(fh) if r["source"] == "hand"]
            self.assertEqual([(r["creator"], r["metron_creator_id"]) for r in hand],
                             [("Walter Simonson", "15")])
            self.assertEqual([r["decision"] for r in review()], ["accept"])

    def test_prune_orphans_archives_then_removes_and_plain_run_leaves_it_alone(self):
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

            put(seed / "issues.csv", ["id", "label"], [{"id": "x-1", "label": "X #1"}])
            put(seed / "run_issues.csv", ["run_id", "sequence", "issue_id"],
                [{"run_id": "r", "sequence": "1", "issue_id": "x-1"}])
            put(seed / "runs.csv", ["id", "title", "placeholder"], [{"id": "r", "title": "R", "placeholder": "False"}])
            put(data / "cover_dates.csv", cs.ec.COLUMNS, [{"label": "X #1", "cover_date": "2001", "source": "hand"}])
            put(data / "issue_details.csv", cs.ec.DETAIL_COLUMNS, [{"label": "X #1"}])
            put(data / "issue_credits.csv", cs.ec.CREDIT_COLUMNS,
                [credit("X #1", "Someone", role="writer"),
                 credit("Removed From The Workbook #1", "Gone", role="writer")])
            archive = data / "pruned_orphans.csv"
            args = ["--data", str(data), "--seed", str(seed), "--todo", str(data / "todo.md"),
                    "--archive", str(archive)]

            # Plain run: the orphan stays, nothing archived.
            cs.main(args)
            self.assertFalse(archive.exists())
            with (data / "issue_credits.csv").open(encoding="utf-8") as fh:
                labels = {r["label"] for r in csv.DictReader(fh)}
            self.assertIn("Removed From The Workbook #1", labels)

            # --prune-orphans: archived first, then removed.
            cs.main(args + ["--prune-orphans"])
            self.assertTrue(archive.exists())
            with archive.open(encoding="utf-8", newline="") as fh:
                archived = list(csv.DictReader(fh))
            self.assertEqual(len(archived), 1)
            self.assertEqual(archived[0]["label"], "Removed From The Workbook #1")
            self.assertEqual(archived[0]["file"], "issue_credits.csv")
            self.assertEqual(json.loads(archived[0]["fields"])["creator"], "Gone")
            with (data / "issue_credits.csv").open(encoding="utf-8") as fh:
                labels = {r["label"] for r in csv.DictReader(fh)}
            self.assertEqual(labels, {"X #1"})


if __name__ == "__main__":
    unittest.main()
