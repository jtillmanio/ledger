"""Tests for etl/check_role_outliers.py. No network.

    py -m unittest discover -s etl -p "test_*.py"
"""

import csv
import sys
import tempfile
import unittest
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent))
import check_role_outliers as ro  # noqa: E402


def credit(label, creator, role, source="metron"):
    return {"label": label, "creator": creator, "metron_creator_id": "",
            "role": role, "source": source}


class CreatorRoleCounts(unittest.TestCase):
    def test_counts_per_creator_per_role(self):
        rows = [credit("A #1", "Jane Doe", "writer"), credit("B #1", "Jane Doe", "writer"),
                credit("A #1", "John Roe", "artist")]
        counts = ro.creator_role_counts(rows)
        self.assertEqual(counts["Jane Doe"]["writer"], 2)
        self.assertEqual(counts["John Roe"]["artist"], 1)

    def test_hand_sourced_rows_are_excluded_before_counting(self):
        with tempfile.TemporaryDirectory() as tmp:
            path = Path(tmp) / "issue_credits.csv"
            with path.open("w", newline="", encoding="utf-8") as fh:
                w = csv.DictWriter(fh, fieldnames=["label", "creator", "metron_creator_id",
                                                    "role", "source"])
                w.writeheader()
                w.writerow(credit("A #1", "Jane Doe", "writer", source="metron"))
                w.writerow(credit("A #1", "John Roe", "artist", source="hand"))
            rows = ro.read_metron_credits(path)
        self.assertEqual(len(rows), 1)
        self.assertEqual(rows[0]["creator"], "Jane Doe")


class FindOutliers(unittest.TestCase):
    def test_writer_dominant_creator_with_one_art_credit_is_flagged(self):
        counts = ro.creator_role_counts(
            [credit("A #1", "Jane Doe", "writer")] * 8 + [credit("Z #1", "Jane Doe", "inker")]
        )
        flags = ro.find_outliers(counts, min_total=6, dominant_share=0.85, max_outliers=2)
        self.assertEqual(len(flags), 1)
        self.assertEqual(flags[0]["creator"], "Jane Doe")
        self.assertEqual(flags[0]["dominant_role"], "writer")
        self.assertEqual(flags[0]["outlier_count"], 1)

    def test_cover_dominant_creator_is_flagged_under_cover(self):
        counts = ro.creator_role_counts(
            [credit("A #1", "Ann Roe", "cover")] * 10 + [credit("Z #1", "Ann Roe", "colorist")]
        )
        flags = ro.find_outliers(counts, min_total=6, dominant_share=0.85, max_outliers=2)
        self.assertEqual(flags[0]["dominant_role"], "cover")

    def test_creator_below_min_total_is_not_flagged(self):
        counts = ro.creator_role_counts(
            [credit("A #1", "New Person", "writer")] * 3 + [credit("Z #1", "New Person", "inker")]
        )
        flags = ro.find_outliers(counts, min_total=6, dominant_share=0.85, max_outliers=2)
        self.assertEqual(flags, [])

    def test_a_real_second_role_is_not_flagged(self):
        # penciler/inker combo artist -- three interior-art credits, not 1-2
        counts = ro.creator_role_counts(
            [credit("A #1", "Both Jobs", "writer")] * 6
            + [credit("X #1", "Both Jobs", "artist"), credit("Y #1", "Both Jobs", "artist"),
               credit("Z #1", "Both Jobs", "artist")]
        )
        flags = ro.find_outliers(counts, min_total=6, dominant_share=0.85, max_outliers=2)
        self.assertEqual(flags, [])

    def test_no_dominant_role_is_not_flagged(self):
        counts = ro.creator_role_counts(
            [credit("A #1", "Mixed", "writer")] * 3 + [credit("B #1", "Mixed", "artist")] * 3
            + [credit("Z #1", "Mixed", "inker")]
        )
        flags = ro.find_outliers(counts, min_total=6, dominant_share=0.85, max_outliers=2)
        self.assertEqual(flags, [])


class OutlierRows(unittest.TestCase):
    def test_returns_only_the_flagged_creators_art_role_rows(self):
        rows = [credit("A #1", "Jane Doe", "writer"), credit("Z #1", "Jane Doe", "inker"),
                credit("Q #1", "Other Person", "artist")]
        flags = [{"creator": "Jane Doe", "dominant_role": "writer"}]
        out = ro.outlier_rows(rows, flags)
        self.assertEqual(len(out), 1)
        self.assertEqual(out[0]["label"], "Z #1")


if __name__ == "__main__":
    unittest.main()
