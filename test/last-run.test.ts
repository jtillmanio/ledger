// Roadmap 1.19: comics Add lands on the run you last added issues to. The
// insert's answer writes the run to a cookie (owner, 2026-11-02: per browser,
// no column); a dry run, a refused insert and an undo leave it. The shell reads
// it back, and a soft-deleted run is never the target. The bars drawing the
// href are test/nav-items.test.tsx.
import { NextResponse } from "next/server";
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { requireTestUrl } from "../scripts/lib/testdb.mjs";
import { addHref, LAST_RUN_COOKIE, parseLastRun } from "../src/lib/last-run";
import { testSql, truncateAll } from "./db";

const USER = "test-user";
const jar = vi.hoisted(() => ({ value: undefined as string | undefined, user: "test-user" as string | null }));

vi.mock("@/lib/auth", async (importOriginal) => ({
  ...(await importOriginal<typeof import("../src/lib/auth")>()),
  apiUserId: async () => jar.user,
  currentUserId: async () => jar.user,
}));
vi.mock("next/headers", () => ({
  cookies: async () => ({
    get: (name: string) => (name === LAST_RUN_COOKIE && jar.value !== undefined ? { name, value: jar.value } : undefined),
  }),
}));

const sql = testSql();
let route: typeof import("../src/app/api/runs/[runId]/issues/route");
let LastRun: typeof import("../src/components/nav/LastRun").default;
let appSql: { end: () => Promise<void> };

beforeAll(async () => {
  // src/db reads DATABASE_URL at import time: point it at the TEST database first.
  process.env.DATABASE_URL = requireTestUrl();
  route = await import("../src/app/api/runs/[runId]/issues/route");
  LastRun = (await import("../src/components/nav/LastRun")).default;
  appSql = (await import("../src/db")).sql;
});

afterAll(async () => {
  await appSql.end();
  await sql.end();
});

// Two runs to add to, A holding Thor #1, and a placeholder.
beforeEach(async () => {
  jar.value = undefined;
  jar.user = USER;
  await truncateAll(sql);
  await sql`INSERT INTO users (id, name) VALUES (${USER}, 'Test')`;
  await sql`INSERT INTO runs (id, title) VALUES ('run-a', 'Run A'), ('run-b', 'Run B')`;
  await sql`INSERT INTO runs (id, title, placeholder) VALUES ('later', 'Later', true)`;
  await sql`INSERT INTO issues (id, label) VALUES ('thor-1966-1', 'Thor (1966) #1')`;
  await sql`INSERT INTO run_issues (run_id, sequence, issue_id) VALUES ('run-a', 1, 'thor-1966-1')`;
});

const params = (runId: string) => ({ params: Promise.resolve({ runId }) });
const req = (method: string, body: unknown) =>
  new Request("http://test/api", { method, body: JSON.stringify(body), headers: { "content-type": "application/json" } });

/** The cookie a response sets, as the browser would read its Set-Cookie header. */
const cookieOf = (res: Response) => new NextResponse(null, { headers: res.headers }).cookies.get(LAST_RUN_COOKIE);

/** The POST's status and the run its answer remembers (undefined: it set no cookie). */
async function post(runId: string, body: unknown) {
  const res = await route.POST(req("POST", body), params(runId));
  return { status: res.status, body: await res.json(), cookie: cookieOf(res) };
}

/** What the shell does with the cookie as the browser would send it: the href comics Add gets. */
async function navHref(): Promise<string> {
  const el = await LastRun();
  return addHref(el ? (el.props as { runId: string }).runId : null);
}

describe("the insert remembers its run (AC-3)", () => {
  it("a successful insert makes the run the remembered one, and a later add to B replaces it", async () => {
    const a = await post("run-a", { labels: ["Thor (1966) #2"], after: null });
    expect(a.status).toBe(200);
    expect(a.cookie?.value).toBe("run-a");
    expect(a.cookie).toMatchObject({ httpOnly: true, sameSite: "lax", path: "/", maxAge: 60 * 60 * 24 * 365 });
    jar.value = a.cookie!.value;
    expect(await navHref()).toBe("/comics/run-a/add");

    const b = await post("run-b", { labels: ["Thor (1966) #3"], after: null });
    expect(b.status).toBe(200);
    jar.value = b.cookie!.value;
    expect(await navHref()).toBe("/comics/run-b/add");
  });

  it("an insert that writes nothing new (every label already there) still remembers the run", async () => {
    const res = await post("run-a", { labels: ["Thor (1966) #1"], after: null });
    expect(res.status).toBe(200);
    expect(res.body.created).toEqual([]);
    expect(res.cookie?.value).toBe("run-a");
  });

  it("a dry run does not change it", async () => {
    const res = await post("run-a", { labels: ["Thor (1966) #2"], dryRun: true });
    expect(res.status).toBe(200);
    expect(res.cookie).toBeUndefined();
  });

  it("a refused insert (4xx) does not change it", async () => {
    for (const [runId, body, status] of [
      ["run-a", { labels: [] }, 400],
      ["run-a", { labels: ["Thor (1966) #2"], after: 999 }, 400],
      ["nope", { labels: ["Thor (1966) #2"], after: null }, 404],
      ["later", { labels: ["Thor (1966) #2"], after: null }, 404],
    ] as const) {
      const res = await post(runId, body);
      expect(res.status, `${runId} ${JSON.stringify(body)}`).toBe(status);
      expect(res.cookie, `${runId} ${JSON.stringify(body)}`).toBeUndefined();
    }
    jar.user = null;
    const res = await post("run-a", { labels: ["Thor (1966) #2"], after: null });
    expect(res.status).toBe(401);
    expect(res.cookie).toBeUndefined();
  });

  it("an undo does not change it", async () => {
    const add = await post("run-a", { labels: ["Thor (1966) #2"], after: null });
    const { after, created, restored, revived } = add.body;
    const res = await route.DELETE(req("DELETE", { after, created, restored, revived }), params("run-a"));
    expect(res.status).toBe(200);
    expect(cookieOf(res)).toBeUndefined();
  });
});

describe("the shell's read of the remembered run (AC-3)", () => {
  it("lands on the run list for someone who has added nothing", async () => {
    expect(await navHref()).toBe("/comics/runs");
  });

  it("never lands on a soft-deleted run", async () => {
    jar.value = "run-a";
    expect(await navHref()).toBe("/comics/run-a/add");
    await sql`UPDATE runs SET deleted_at = now() WHERE id = 'run-a'`;
    expect(await navHref()).toBe("/comics/runs");
  });

  it("lands on the run list for a run that is gone, a placeholder, or a value the app never wrote", async () => {
    for (const value of ["no-such-run", "later", "", "x".repeat(201)]) {
      jar.value = value;
      expect(await navHref(), JSON.stringify(value).slice(0, 20)).toBe("/comics/runs");
    }
  });

  it("reads nothing for a signed-out visitor", async () => {
    jar.value = "run-a";
    jar.user = null;
    expect(await navHref()).toBe("/comics/runs");
  });

  it("parses only what the app could have written", () => {
    expect(parseLastRun(undefined)).toBeNull();
    expect(parseLastRun("")).toBeNull();
    expect(parseLastRun("hickman-ff")).toBe("hickman-ff");
  });
});
