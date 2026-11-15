// Task 4.4, AC-2: the app's Calibre matcher is a twin of calibre.py's
// Seed.match (D-59, D-61). test/fixtures/calibre-match.json holds both to one
// answer per case; etl/test_calibre.py's SharedMatchFixture runs the Python
// side over the same file.
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { LedgerIndex, type LedgerBook } from "@/lib/calibre-match";
import { bookId } from "@/lib/issue-slug";

type Case = {
  name: string;
  ledger: { title: string; author: string; calibre_id?: number }[];
  record: { calibre_id: number; title: string; authors: string[] };
  separate?: boolean;
  expect: { status: string; author: string; book: string | null; renamed: boolean };
};

const { cases } = JSON.parse(readFileSync(join(__dirname, "fixtures", "calibre-match.json"), "utf8")) as { cases: Case[] };

describe("the Calibre matcher, against calibre.py's answers (AC-2)", () => {
  it("has the fixture's cases", () => {
    expect(cases.length).toBeGreaterThanOrEqual(15);
  });

  it.each(cases.map((c) => [c.name, c] as const))("%s", (_name, c) => {
    const ledger: LedgerBook[] = c.ledger.map((b) => ({
      id: bookId(b.title, b.author), title: b.title, author: b.author, calibreId: b.calibre_id ?? null,
    }));
    const index = new LedgerIndex(ledger);
    const separate = new Set(c.separate ? [c.record.calibre_id] : []);
    const m = index.match({ calibreId: c.record.calibre_id, title: c.record.title, authors: c.record.authors }, separate);
    expect({ status: m.status, author: m.author, book: m.book?.title ?? null, renamed: m.renamed }).toEqual(c.expect);
  });

  it("a held pair carries its similarity, and a subtitle pair may score under the line", () => {
    const index = new LedgerIndex([{ id: "a", title: "Arcanum Unbounded", author: "Brandon Sanderson", calibreId: null }]);
    const m = index.match({ calibreId: 9, title: "Arcanum Unbounded: The Cosmere Collection", authors: ["Brandon Sanderson"] }, new Set());
    expect(m.status).toBe("proposed");
    expect(m.similarity).toBeLessThan(0.5);
  });
});
