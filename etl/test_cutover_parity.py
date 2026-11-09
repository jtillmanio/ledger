"""The Sheets parity audit, checked (roadmap 1.25, D-95).

`docs/cutover-parity.md` accounts for every tab of both committed workbooks:
each use the owner relies on ends in a roadmap ID or *won't carry* with a
reason, every open ID it cites gates its workbook's cutover (D-128: a
`Books.xlsx` use is in 1.26's **Depends on**, a `Comics.xlsx` use in 1.28's),
and the owner signed it off. No network.

    py -m unittest discover -s etl -p "test_*.py"
"""

import re
import unittest
from datetime import date
from pathlib import Path

import pandas as pd

ROOT = Path(__file__).resolve().parent.parent
WORKBOOKS = (ROOT / "etl" / "data" / "Comics.xlsx", ROOT / "etl" / "data" / "Books.xlsx")
PARITY = ROOT / "docs" / "cutover-parity.md"
ROADMAP = ROOT / "docs" / "05-roadmap.md"

ID = r"\d+\.\d+[a-z]?"
# An entry is a `### ☐ 1.25 …` heading, or a `- ☐ 5.2 …` bullet (Phases 5–6).
ENTRY_RE = re.compile(rf"^(?:###|-)\s+([☐☑])\s+({ID})\s", re.MULTILINE)
SIGN_OFF_RE = re.compile(r"^\*\*Signed off:\*\* the owner, (\d{4}-\d{2}-\d{2})", re.MULTILINE)
# A use ends in its roadmap IDs, or in won't carry and the owner's reason. An ID
# inside a reason ("6.8 after cutover") names later work and gates nothing.
ENDS_IN_IDS_RE = re.compile(rf"→\s*({ID}(?:\s*,\s*{ID})*)\.?\s*$")
WONT_CARRY_RE = re.compile(r"→\s*won['’]t carry:\s*\S")
# Each workbook has its own cutover (D-128): the books go first, the comics later.
CUTOVERS = {"Books.xlsx": "1.26", "Comics.xlsx": "1.28"}
WORKBOOK_RE = re.compile(r"\b(\w+\.xlsx)\b")


def entries(roadmap_text: str) -> dict[str, bool]:
    """Roadmap ID → open (☐)."""
    return {m.group(2): m.group(1) == "☐" for m in ENTRY_RE.finditer(roadmap_text)}


def cutover_depends_on(roadmap_text: str, cutover: str = "1.26") -> set[str]:
    """The IDs a cutover entry's **Depends on** paragraph names."""
    m = re.search(rf"^###\s+\S\s+{re.escape(cutover)}\s.*?$(.*?)(?=^###\s|\Z)", roadmap_text,
                  re.MULTILINE | re.DOTALL)
    if not m:
        return set()
    dep = re.search(r"^\*\*Depends on:\*\*(.*?)(?:\n\s*\n|\Z)", m.group(1), re.MULTILINE | re.DOTALL)
    return set(re.findall(rf"\b{ID}\b", dep.group(1))) if dep else set()


def sections(parity_text: str) -> list[tuple[str | None, list[str], list[str]]]:
    """Each `###` section: the workbook whose `##` heading it sits under (None
    under no workbook heading), the tab names its heading puts in backticks, and
    its use bullets (a top-level `- ` line, with its indented continuation lines)."""
    out: list[tuple[str | None, list[str], list[str]]] = []
    workbook: str | None = None
    for line in parity_text.splitlines():
        if line.startswith("### "):
            out.append((workbook, re.findall(r"`([^`]+)`", line), []))
        elif line.startswith("## ") or line.startswith("# "):
            wb = WORKBOOK_RE.search(line) if line.startswith("## ") else None
            workbook = wb.group(1) if wb else None
            out.append((None, [], []))  # a higher heading closes the tab section
        elif not out:
            continue
        elif line.startswith("- "):
            out[-1][2].append(line[2:].strip())
        elif line.startswith((" ", "\t")) and line.strip() and out[-1][2]:
            out[-1][2][-1] += " " + line.strip()
    return [s for s in out if s[1]]


def problems(tabs: list[str], parity_text: str, roadmap_text: str) -> list[str]:
    """Every way the parity file fails roadmap 1.25's Check, one line each."""
    found: list[str] = []
    known = entries(roadmap_text)
    gates = {wb: cutover_depends_on(roadmap_text, rid) for wb, rid in CUTOVERS.items()}
    secs = sections(parity_text)
    covered = {tab for _, names, _ in secs for tab in names}
    for tab in tabs:
        if tab not in covered:
            found.append(f"tab has no section: {tab}")
    for workbook, names, uses in secs:
        label = ", ".join(names)
        if workbook not in CUTOVERS:
            found.append(f"section under no workbook heading ({label}): "
                         f"put it under ## {' or ## '.join(CUTOVERS)}")
            continue
        cutover, gated = CUTOVERS[workbook], gates[workbook]
        if not uses:
            found.append(f"section lists no use: {label}")
        for use in uses:
            if WONT_CARRY_RE.search(use):
                continue
            m = ENDS_IN_IDS_RE.search(use)
            if not m:
                found.append(f"use ends in neither a roadmap ID nor won't carry with a reason ({label}): {use}")
                continue
            for rid in re.findall(ID, m.group(1)):
                if rid not in known:
                    found.append(f"cited ID is not a roadmap entry ({label}): {rid}")
                elif known[rid] and rid not in gated:
                    found.append(f"open ID missing from {cutover}'s Depends on ({label}): {rid}")
    m = SIGN_OFF_RE.search(parity_text)
    if not m:
        found.append("no sign-off line: **Signed off:** the owner, YYYY-MM-DD")
    else:
        try:
            date.fromisoformat(m.group(1))
        except ValueError:
            found.append(f"sign-off date is not a date: {m.group(1)}")
    return found


# ---- fixtures (AC-3): small strings, not the real files -----------------

ROADMAP_FIXTURE = """\
### ☑ 1.9 Status screens · M
### ☐ 1.26 Cut the books over from the Sheets · M
Prose.

**Depends on:** 1.25; 2.1 and
2.2.

**Check:** something.

### ☐ 1.28 Cut the comics over from the Sheets · S
**Depends on:** 1.26; 5.2.

### ☐ 2.1 Capacity view · M
### ☐ 2.2 Books dashboard · M
- ☐ 5.2 Tracks page · S. Prose.
- ☐ 6.8 Events page · S
"""

PARITY_FIXTURE = """\
# Cutover parity

**Signed off:** the owner, 2026-10-29.

## Comics.xlsx

### `TRACKS`

What the tab is.

- Glance at each track's progress → 5.2
- Ready-now count per track → 1.9, 5.2

## Books.xlsx

### `Read 2021` · `Read 2022`

- Count the books read in a year → 1.9, 2.1
- Genre columns: which genre each read was → won't carry: a glance; 6.8 after
  cutover
"""

TABS_FIXTURE = ["TRACKS", "Read 2021", "Read 2022"]


class Fixtures(unittest.TestCase):
    def test_a_good_file_has_no_problems(self):
        self.assertEqual(problems(TABS_FIXTURE, PARITY_FIXTURE, ROADMAP_FIXTURE), [])

    def test_missing_tab_section_is_named(self):
        text = PARITY_FIXTURE.replace("### `TRACKS`", "### Tracks, unnamed")
        self.assertIn("tab has no section: TRACKS", problems(TABS_FIXTURE, text, ROADMAP_FIXTURE))

    def test_a_tab_named_in_a_shared_section_is_covered(self):
        text = PARITY_FIXTURE.replace(" · `Read 2022`", "")
        self.assertEqual(problems(TABS_FIXTURE, text, ROADMAP_FIXTURE), ["tab has no section: Read 2022"])

    def test_a_tab_named_only_in_prose_is_not_covered(self):
        text = PARITY_FIXTURE.replace("### `TRACKS`\n", "") + "\nThe `TRACKS` tab is above.\n"
        self.assertIn("tab has no section: TRACKS", problems(TABS_FIXTURE, text, ROADMAP_FIXTURE))

    def test_use_without_id_is_named(self):
        text = PARITY_FIXTURE.replace("Glance at each track's progress → 5.2",
                                      "Glance at each track's progress")
        found = problems(TABS_FIXTURE, text, ROADMAP_FIXTURE)
        self.assertEqual(len(found), 1)
        self.assertIn("(TRACKS): Glance at each track's progress", found[0])

    def test_wont_carry_without_a_reason_is_named(self):
        text = PARITY_FIXTURE.replace("won't carry: a glance; 6.8 after\n  cutover", "won't carry:")
        found = problems(TABS_FIXTURE, text, ROADMAP_FIXTURE)
        self.assertEqual(len(found), 1)
        self.assertIn("Genre columns", found[0])

    def test_an_id_then_more_words_is_not_an_ending(self):
        text = PARITY_FIXTURE.replace("→ 1.9, 5.2", "→ 1.9, 5.2 maybe")
        self.assertEqual(len(problems(TABS_FIXTURE, text, ROADMAP_FIXTURE)), 1)

    def test_section_with_no_use_is_named(self):
        text = PARITY_FIXTURE.replace("- Glance at each track's progress → 5.2\n", "") \
                             .replace("- Ready-now count per track → 1.9, 5.2\n", "")
        self.assertIn("section lists no use: TRACKS", problems(TABS_FIXTURE, text, ROADMAP_FIXTURE))

    def test_unknown_id_is_named(self):
        text = PARITY_FIXTURE.replace("→ 5.2\n", "→ 5.99\n")
        self.assertEqual(problems(TABS_FIXTURE, text, ROADMAP_FIXTURE),
                         ["cited ID is not a roadmap entry (TRACKS): 5.99"])

    def test_open_id_missing_from_cutover_depends_on_is_named(self):
        text = PARITY_FIXTURE.replace("→ 5.2\n", "→ 2.2\n")
        self.assertEqual(problems(TABS_FIXTURE, text, ROADMAP_FIXTURE),
                         ["open ID missing from 1.28's Depends on (TRACKS): 2.2"])

    def test_a_books_use_is_gated_by_the_books_cutover(self):
        # 5.2 gates the comics cutover only, so a Books.xlsx use citing it is named (D-128).
        text = PARITY_FIXTURE.replace("→ 1.9, 2.1", "→ 1.9, 5.2")
        self.assertEqual(problems(TABS_FIXTURE, text, ROADMAP_FIXTURE),
                         ["open ID missing from 1.26's Depends on (Read 2021, Read 2022): 5.2"])

    def test_a_section_under_no_workbook_heading_is_named(self):
        text = PARITY_FIXTURE.replace("## Comics.xlsx\n", "## Notes\n")
        found = problems(TABS_FIXTURE, text, ROADMAP_FIXTURE)
        self.assertEqual(len(found), 1)
        self.assertIn("section under no workbook heading (TRACKS)", found[0])

    def test_a_ticked_id_needs_no_depends_on(self):
        self.assertNotIn("1.9", cutover_depends_on(ROADMAP_FIXTURE))
        self.assertEqual(problems(TABS_FIXTURE, PARITY_FIXTURE, ROADMAP_FIXTURE), [])

    def test_an_id_in_a_wont_carry_reason_gates_nothing(self):
        self.assertNotIn("6.8", cutover_depends_on(ROADMAP_FIXTURE))
        self.assertEqual(problems(TABS_FIXTURE, PARITY_FIXTURE, ROADMAP_FIXTURE), [])

    def test_bullet_entries_are_entries(self):
        self.assertEqual(entries(ROADMAP_FIXTURE),
                         {"1.9": False, "1.26": True, "1.28": True, "2.1": True, "2.2": True,
                          "5.2": True, "6.8": True})

    def test_depends_on_reads_only_cutover_paragraph(self):
        self.assertEqual(cutover_depends_on(ROADMAP_FIXTURE), {"1.25", "2.1", "2.2"})
        self.assertEqual(cutover_depends_on(ROADMAP_FIXTURE, "1.28"), {"1.26", "5.2"})

    def test_missing_sign_off_is_named(self):
        text = PARITY_FIXTURE.replace("**Signed off:** the owner, 2026-10-29.\n", "")
        self.assertEqual(problems(TABS_FIXTURE, text, ROADMAP_FIXTURE),
                         ["no sign-off line: **Signed off:** the owner, YYYY-MM-DD"])

    def test_sign_off_without_a_date_is_named(self):
        text = PARITY_FIXTURE.replace("the owner, 2026-10-29", "the owner, soon")
        self.assertIn("no sign-off line: **Signed off:** the owner, YYYY-MM-DD",
                      problems(TABS_FIXTURE, text, ROADMAP_FIXTURE))


# ---- the real files (AC-1, AC-2) ----------------------------------------

class RealParityFile(unittest.TestCase):
    def test_real_parity_file_has_no_problems(self):
        self.assertTrue(PARITY.exists(), f"missing {PARITY.relative_to(ROOT)} (roadmap 1.25)")
        tabs = [n for f in WORKBOOKS for n in pd.ExcelFile(f).sheet_names]
        self.assertGreater(len(tabs), 0)
        found = problems(tabs, PARITY.read_text(encoding="utf-8"), ROADMAP.read_text(encoding="utf-8"))
        self.assertEqual(found, [], "\n".join(found))


if __name__ == "__main__":
    unittest.main()
