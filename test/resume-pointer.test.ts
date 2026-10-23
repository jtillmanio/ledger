// Task 1.6: the resume pointer. Derived, never stored: the lowest sequence whose
// *placement* is unread (data model 2.14), so an issue read only in another
// run still stops it here. The dashboard's in-progress list names it and links
// to its row on the spine, `#p-<ordinal>`.
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { Window } from "happy-dom";
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { requireTestUrl } from "../scripts/lib/testdb.mjs";
import { markRead, testSql, truncateAll } from "./db";

const USER = "test-user";

vi.mock("@/lib/auth", async (importOriginal) => ({
  ...(await importOriginal<typeof import("../src/lib/auth")>()),
  requireUserId: async () => USER,
}));

// The dashboard draws the thumb bar (task 1.8b): a client tree that needs the app router and the undo stack.
vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh: () => {} }) }));

const sql = testSql();
let q: typeof import("../src/db/queries");
let appSql: { end: () => Promise<void> };

beforeAll(async () => {
  // src/db reads DATABASE_URL at import time: point it at the TEST database first.
  process.env.DATABASE_URL = requireTestUrl();
  q = await import("../src/db/queries");
  appSql = (await import("../src/db")).sql;
});

afterAll(async () => {
  await appSql.end();
  await sql.end();
});

/** Run `a` holds A #1..#9 in order; run `b` holds A #6 and B #1. */
beforeEach(async () => {
  await truncateAll(sql);
  await sql`INSERT INTO users (id, name) VALUES (${USER}, 'Test')`;
  await sql`INSERT INTO runs (id, title) VALUES ('a', 'Run a'), ('b', 'Run b')`;
  for (let n = 1; n <= 9; n++) {
    await sql`INSERT INTO issues (id, label) VALUES (${"a" + n}, ${"A #" + n})`;
    await sql`INSERT INTO run_issues (run_id, sequence, issue_id, notes)
              VALUES ('a', ${n * 10}, ${"a" + n}, ${n === 6 ? "Part six" : null})`;
  }
  await sql`INSERT INTO issues (id, label) VALUES ('b1', 'B #1')`;
  await sql`INSERT INTO run_issues (run_id, sequence, issue_id) VALUES ('b', 1, 'a6'), ('b', 2, 'b1')`;
  for (const n of [1, 2, 3, 4, 5, 7]) await markRead(sql, USER, "a", "a" + n);
});

async function pointer(runId: string) {
  return (await q.inProgressRuns(USER)).find((r) => r.id === runId);
}

describe("the pointer (AC-1, AC-2)", () => {
  it("returns issue 6 when 1-5 and 7 are read", async () => {
    const run = await pointer("a");
    expect(run?.next_label).toBe("A #6");
    expect(run?.next_ordinal).toBe(6);
    expect(run?.next_notes).toBe("Part six");
  });

  it("still returns 6 once 6 is read in another run holding it", async () => {
    await markRead(sql, USER, "b", "a6");
    const run = await pointer("a");
    expect(run?.next_label).toBe("A #6");
    expect(run?.next_ordinal).toBe(6);
  });

  it("skips a soft-deleted placement, and counts the ordinal over live ones", async () => {
    await sql`UPDATE run_issues SET deleted_at = now() WHERE run_id = 'a' AND issue_id = 'a6'`;
    const run = await pointer("a");
    expect(run?.next_label).toBe("A #8");
    expect(run?.next_ordinal).toBe(7);
  });

  it("skips a placement whose issue is soft-deleted", async () => {
    await sql`UPDATE issues SET deleted_at = now() WHERE id = 'a6'`;
    const run = await pointer("a");
    expect(run?.next_label).toBe("A #8");
    expect(run?.next_ordinal).toBe(7);
  });

  it("returns nothing for a run with no live placements", async () => {
    await sql`UPDATE run_issues SET deleted_at = now() WHERE run_id = 'a'`;
    expect(await pointer("a")).toBeUndefined();
  });

  it("returns nothing for a fully read run", async () => {
    for (const n of [6, 8, 9]) await markRead(sql, USER, "a", "a" + n);
    expect(await pointer("a")).toBeUndefined();
  });
});

/** Parse server-rendered HTML into a document. */
function parse(html: string) {
  // happy-dom's own types, read as the DOM's.
  const doc = new Window().document as unknown as Document;
  doc.body.innerHTML = html;
  return doc;
}

describe("the dashboard's in-progress list (AC-3)", () => {
  it("says Continue: <label> for each reading run, linking to the pointer's spine row", async () => {
    await markRead(sql, USER, "b", "a6");
    const Home = (await import("../src/app/comics/(dash)/page")).default;
    const { UndoProvider: Undo } = await import("../src/components/Undo");
    const home = parse(renderToStaticMarkup(createElement(Undo, null, await Home())));

    for (const [runId, label] of [["a", "A #6"], ["b", "B #1"]]) {
      const link = [...home.querySelectorAll("a")].find((a) =>
        (a.getAttribute("href") ?? "").startsWith(`/comics/${runId}#`));
      expect(link, `run ${runId} links to its pointer`).toBeTruthy();
      expect(link!.textContent).toContain(`Continue: ${label}`);

      // The fragment is the id of the pointer's row on that run's spine.
      const fragment = link!.getAttribute("href")!.split("#")[1];
      const detail = (await q.runDetail(USER, runId))!;
      const RunSpine = (await import("../src/components/IssueRow")).default;
      const { UndoProvider } = await import("../src/components/Undo");
      const spine = parse(renderToStaticMarkup(createElement(UndoProvider, null,
        createElement(RunSpine, { runId, title: detail.run.title, issues: detail.issues }))));
      const row = spine.getElementById(fragment);
      expect(row, `#${fragment} on ${runId}'s spine`).toBeTruthy();
      expect(row!.getAttribute("data-next")).toBe("true");
      expect(row!.querySelector(".lbl")!.textContent).toBe(label);
    }
  });
});
