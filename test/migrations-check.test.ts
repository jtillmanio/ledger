import { existsSync, readdirSync, readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import {
  checkAppendOnly, checkMigrationFiles, describeNewMigrations, destructiveStatements,
} from "../scripts/lib/migrations.mjs";

const additive = `CREATE TABLE "queue" ("id" text PRIMARY KEY);--> statement-breakpoint
ALTER TABLE "runs" ADD COLUMN "why" text;`;
const drops = `ALTER TABLE "runs" DROP COLUMN IF EXISTS "writer";`;
const retypes = `ALTER TABLE "book_status" ALTER COLUMN "finished_on" SET DATA TYPE date USING x::date;`;

describe("destructiveStatements", () => {
  it("finds drops and retypes, and nothing in an additive migration", () => {
    expect(destructiveStatements(additive)).toEqual([]);
    expect(destructiveStatements(drops)[0].kind).toBe("drops a column");
    expect(destructiveStatements(retypes)[0].kind).toBe("retypes a column");
    expect(destructiveStatements(`ALTER TABLE t ALTER COLUMN c TYPE integer;`)[0].kind).toBe("retypes a column");
    expect(destructiveStatements(`DROP TABLE "old";`)[0].kind).toBe("drops a table");
  });

  it("ignores comments, constraints and views", () => {
    expect(destructiveStatements(`-- we DROP COLUMN nothing here\nSELECT 1;`)).toEqual([]);
    expect(destructiveStatements(`/* DROP TABLE x */ SELECT 1;`)).toEqual([]);
    expect(destructiveStatements(`ALTER TABLE t DROP CONSTRAINT c; DROP VIEW v;`)).toEqual([]);
  });
});

describe("checkMigrationFiles", () => {
  const ok = { journalTags: ["0005_a"], sql: { "0005_a": additive }, downTags: [] };

  it("passes an additive migration with no down file", () => {
    expect(checkMigrationFiles(ok)).toEqual([]);
  });

  it("fails a drop or a retype without drizzle/down/<tag>.sql, and passes it with one", () => {
    for (const text of [drops, retypes]) {
      const input = { journalTags: ["0005_a"], sql: { "0005_a": text }, downTags: [] as string[] };
      expect(checkMigrationFiles(input)[0]).toMatch(/no drizzle\/down\/0005_a\.sql/);
      expect(checkMigrationFiles({ ...input, downTags: ["0005_a"] })).toEqual([]);
    }
  });

  it("fails a migration missing from the journal, and a journal entry with no file", () => {
    expect(checkMigrationFiles({ ...ok, journalTags: [] })[0]).toMatch(/not in drizzle\/meta\/_journal\.json/);
    expect(checkMigrationFiles({ ...ok, journalTags: ["0005_a", "0006_b"] })[0]).toMatch(/0006_b\.sql does not exist/);
  });

  it("fails a down file with nothing to reverse", () => {
    expect(checkMigrationFiles({ ...ok, downTags: ["0009_gone"] })[0]).toMatch(/has no drizzle\/0009_gone\.sql to reverse/);
  });

  it("passes the repository's own drizzle/ folder", () => {
    const journal = JSON.parse(readFileSync("drizzle/meta/_journal.json", "utf8")).entries;
    const sql = Object.fromEntries(
      readdirSync("drizzle").filter((f) => f.endsWith(".sql")).map((f) => [f.slice(0, -4), readFileSync(`drizzle/${f}`, "utf8")]),
    );
    const downTags = existsSync("drizzle/down") ? readdirSync("drizzle/down").map((f) => f.slice(0, -4)) : [];
    expect(checkMigrationFiles({ journalTags: journal.map((e: { tag: string }) => e.tag), sql, downTags })).toEqual([]);
  });
});

describe("checkAppendOnly (standing rule 3)", () => {
  const baseJournal = [{ tag: "0004_x", when: 1 }];

  it("allows adding a migration and appending to the journal", () => {
    expect(checkAppendOnly({
      nameStatus: ["A\tdrizzle/0005_a.sql", "M\tdrizzle/meta/_journal.json", "A\tdrizzle/meta/0005_snapshot.json"],
      baseJournal,
      headJournal: [...baseJournal, { tag: "0005_a", when: 2 }],
    })).toEqual([]);
  });

  it("allows editing a down file", () => {
    expect(checkAppendOnly({ nameStatus: ["M\tdrizzle/down/0004_x.sql"], baseJournal, headJournal: baseJournal })).toEqual([]);
  });

  it("fails editing, deleting or renaming a migration the base already has", () => {
    expect(checkAppendOnly({ nameStatus: ["M\tdrizzle/0004_x.sql"], baseJournal, headJournal: baseJournal })[0]).toMatch(/was edited/);
    expect(checkAppendOnly({ nameStatus: ["D\tdrizzle/0004_x.sql"], baseJournal, headJournal: baseJournal })[0]).toMatch(/was deleted/);
    expect(checkAppendOnly({ nameStatus: ["R100\tdrizzle/0004_x.sql\tdrizzle/0004_y.sql"], baseJournal, headJournal: baseJournal })[0])
      .toMatch(/renamed to drizzle\/0004_y\.sql/);
  });

  it("fails rewriting or dropping a journal entry the base already has", () => {
    expect(checkAppendOnly({ nameStatus: [], baseJournal, headJournal: [{ tag: "0004_x", when: 9 }] })[0]).toMatch(/append-only/);
    expect(checkAppendOnly({ nameStatus: [], baseJournal, headJournal: [] })[0]).toMatch(/append-only/);
  });
});

describe("describeNewMigrations", () => {
  it("labels each added migration additive or destructive", () => {
    expect(describeNewMigrations({
      nameStatus: ["A\tdrizzle/0005_a.sql", "A\tdrizzle/0006_b.sql", "A\tdrizzle/down/0006_b.sql", "M\tdrizzle/meta/_journal.json"],
      sql: { "0005_a": additive, "0006_b": drops },
      downTags: ["0006_b"],
    })).toEqual(["0005_a: additive", "0006_b: destructive (drops a column), down file present"]);
  });
});
