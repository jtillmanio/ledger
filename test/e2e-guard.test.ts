import { beforeAll, describe, expect, it } from "vitest";
import { execFile, spawnSync } from "node:child_process";
import { existsSync, mkdirSync, mkdtempSync, readFileSync, readdirSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { promisify } from "node:util";
import { checkTestUrl } from "../scripts/lib/testdb.mjs";
import {
  AREAS, CRITICAL_TAG, DEV_CACHE, E2E_BEHAVIOUR, E2E_CORE, E2E_FEEL, E2E_FLOOR, E2E_HARDCOVER_TOKEN, E2E_PASSCODE, E2E_PORT, E2E_PROJECTS, FEEL_TAG, FLOOR_TAG, MOTION_TAG, TOUCH_TAG,
  areaFilter, areaPlan, areaProblems, e2eProjects, parseAreas, planE2e, specArea,
} from "../scripts/lib/e2e.mjs";
import { planTestRun } from "../scripts/lib/test-files.mjs";
import { ciJob } from "./ci-yml";

// The browser suite (task 0.11) drives a real `next dev` and signs in, so the
// rule from R3-02 holds here too: TEST_DATABASE_URL and nothing else, refusing
// before a browser or a server starts. Nothing here touches a database or
// launches Chromium; the wrapper is run with a stub in place of Playwright.

const TEST = "postgresql://t:t@test-host.example/reading_test";
const LIVE = "postgresql://l:l@live-host.example/reading";
const root = resolve(__dirname, "..");
const wrapper = join(root, "scripts", "e2e.mjs");

describe("planE2e: the test database, or a refusal with testdb.mjs's own message", () => {
  it("refuses when TEST_DATABASE_URL is unset, with testdb.mjs's message", () => {
    const plan = planE2e({ DATABASE_URL: LIVE });
    expect(plan.error).toBe(checkTestUrl(undefined, LIVE));
    expect(plan.error).toMatch(/TEST_DATABASE_URL is not set/);
  });

  it("refuses when TEST_DATABASE_URL names the same host and database as DATABASE_URL", () => {
    const plan = planE2e({ TEST_DATABASE_URL: LIVE, DATABASE_URL: LIVE });
    expect(plan.error).toBe(checkTestUrl(LIVE, LIVE));
    expect(plan.error).toMatch(/same database as DATABASE_URL/);
  });

  it("points the server at the test database with a fixed passcode, never the owner's", () => {
    const plan = planE2e({ TEST_DATABASE_URL: TEST, DATABASE_URL: LIVE, APP_PASSCODE: "owners-real-one" });
    expect(plan.error).toBeUndefined();
    expect(plan.serverEnv).toMatchObject({
      DATABASE_URL: TEST,
      APP_PASSCODE: E2E_PASSCODE,
      SESSION_SECRET: expect.any(String),
      OWNER_ID: "e2e-user",
      HARDCOVER_API_TOKEN: E2E_HARDCOVER_TOKEN,
    });
    expect(E2E_PASSCODE).not.toBe("owners-real-one");
    expect(plan.baseUrl).toBe(`http://localhost:${E2E_PORT}`);
  });

  it("runs next dev by default, next start when E2E_SERVER is start, and refuses anything else", () => {
    const env = { TEST_DATABASE_URL: TEST, DATABASE_URL: LIVE };
    expect(planE2e(env).serverCommand).toBe(`npx next dev --port ${E2E_PORT}`);
    expect(planE2e({ ...env, E2E_SERVER: "start" }).serverCommand).toBe(`npx next start --port ${E2E_PORT}`);
    const bad = planE2e({ ...env, E2E_SERVER: "prod" });
    expect(bad.serverCommand).toBeUndefined();
    expect(bad.error).toMatch(/E2E_SERVER is "prod": use dev or start/);
  });

  it("clears next dev's cache before a dev run, and nothing before next start", () => {
    const env = { TEST_DATABASE_URL: TEST, DATABASE_URL: LIVE };
    expect(DEV_CACHE).toBe(".next/dev");
    expect(planE2e(env).clear).toBe(DEV_CACHE);
    expect(planE2e({ ...env, E2E_SERVER: "start" }).clear).toBeNull();
  });

  it("checks the core projects by default, every project when E2E_SCOPE is full, and refuses anything else", () => {
    const env = { TEST_DATABASE_URL: TEST, DATABASE_URL: LIVE };
    expect(planE2e(env).scope).toBe("core");
    expect(planE2e({ ...env, E2E_SCOPE: "full" }).scope).toBe("full");
    const bad = planE2e({ ...env, E2E_SCOPE: "all" });
    expect(bad.scope).toBeUndefined();
    expect(bad.error).toMatch(/E2E_SCOPE is "all": use core or full/);
  });

  it("runs every area when E2E_AREAS is unset or empty, the areas it lists otherwise, and refuses a name that is not one (0.15)", () => {
    const env = { TEST_DATABASE_URL: TEST, DATABASE_URL: LIVE };
    expect(AREAS).toEqual(["books", "comics", "watch", "music", "games", "shared"]);
    expect(planE2e(env).areas).toBeNull();
    expect(planE2e({ ...env, E2E_AREAS: "" }).areas).toBeNull();
    expect(planE2e({ ...env, E2E_AREAS: "comics" }).areas).toEqual(["comics"]);
    expect(parseAreas(" comics, shared ,comics")).toEqual({ areas: ["comics", "shared"] });
    const bad = planE2e({ ...env, E2E_AREAS: "comics,podcasts" });
    expect(bad.areas).toBeUndefined();
    expect(bad.error).toMatch(/E2E_AREAS is "comics,podcasts": podcasts is not an area/);
  });
});

// Roadmap 0.15: every spec belongs to one area, and a small @critical set runs
// whatever the areas, at the core projects.
describe("areas: every spec has exactly one, read from its own text", () => {
  const specFiles = readdirSync(join(root, "test", "e2e")).filter((f) => f.endsWith(".spec.ts"));
  const specs = specFiles.map((file) => ({ file, text: readFileSync(join(root, "test", "e2e", file), "utf8") }));

  it("a spec file with no area, two areas or an unknown one fails, naming the file; every real spec has one", () => {
    const fixtures = [
      { file: "no-area.spec.ts", text: "// A spec that forgot.\nimport { test } from \"@playwright/test\";\n" },
      { file: "two-areas.spec.ts", text: "// @area: books, comics\n" },
      { file: "two-lines.spec.ts", text: "// @area: books\n// What it checks.\n// @area: shared\n" },
      { file: "odd-area.spec.ts", text: "// @area: podcasts\n" },
      { file: "empty-area.spec.ts", text: "// @area:\n" },
      { file: "fine.spec.ts", text: "// @area: watch\n// What it checks.\n" },
    ];
    const problems = areaProblems(fixtures);
    expect(problems).toHaveLength(5);
    expect(problems[0]).toMatch(/^no-area\.spec\.ts: no area/);
    expect(problems[1]).toMatch(/^two-areas\.spec\.ts: 2 areas \(books, comics\)/);
    expect(problems[2]).toMatch(/^two-lines\.spec\.ts: 2 areas \(books, shared\)/);
    expect(problems[3]).toMatch(/^odd-area\.spec\.ts: "podcasts" is not an area/);
    expect(problems[4]).toMatch(/^empty-area\.spec\.ts: no area/);
    expect(specArea(fixtures[5].text)).toEqual({ area: "watch" });

    expect(specs.length).toBeGreaterThan(40);
    expect(areaProblems(specs)).toEqual([]);
  });

  it("an area plan selects its areas' files and the other files with a @critical test; unset, it plans nothing", () => {
    const fixtures = [
      { file: "a.spec.ts", text: "// @area: comics\n" },
      { file: "b.spec.ts", text: `// @area: books\ntest("x", { tag: ["@at-w390-light", "${CRITICAL_TAG}"] }, f);\n` },
      { file: "c.spec.ts", text: "// @area: books\n" },
      { file: "d.spec.ts", text: "// no area: runs, so a slip never drops a spec\n" },
    ];
    expect(areaPlan(fixtures, null)).toBeNull();
    expect(areaPlan(fixtures, ["comics"])).toEqual({ selected: ["a.spec.ts", "d.spec.ts"], critical: ["b.spec.ts"] });
    expect(areaPlan(fixtures, ["books"])).toEqual({ selected: ["b.spec.ts", "c.spec.ts", "d.spec.ts"], critical: [] });
  });

  it("a core project adds the critical files, keeping only their @critical tests; any other project runs the selected files alone", () => {
    const plan = { selected: ["a.spec.ts"], critical: ["b.spec.ts"] };
    expect(areaFilter("w390-light", null)).toBeNull();
    expect(areaFilter("w360-light", plan)).toEqual({ files: ["a.spec.ts"] });
    expect(areaFilter("w390-dark", plan)!.files).toEqual(["a.spec.ts", "b.spec.ts"]);
    const invert = areaFilter("w390-light", plan)!.grepInvert!;
    // Playwright's grep title: the project, the file, the titles, the tags.
    expect(invert.test("w390-light b.spec.ts the sheet opens @at-w390-light")).toBe(true);
    expect(invert.test("w390-light b.spec.ts the sheet opens @at-w390-light @critical")).toBe(false);
    expect(invert.test("w390-light b.spec.ts the sheet opens @critical-ish")).toBe(true);
    expect(invert.test("w390-light a.spec.ts the sheet opens")).toBe(false);
    expect(invert.test("w390-light ab.spec.ts the sheet opens")).toBe(false);
    expect(invert.test("w390-light x/b.spec.ts the sheet opens")).toBe(true);
    expect(areaFilter("w390-light", { selected: ["a.spec.ts"], critical: [] })).toEqual({ files: ["a.spec.ts"] });
  });
});

// What Playwright itself plans: `playwright test --list` loads the config and
// every spec and reports each (test, project) pair, with no server, browser or
// database. Each run is a few seconds, so the four start together.
type Planned = { project: string; file: string; titles: string[]; tags: string[] };
type Suite = { title: string; file: string; specs?: { title: string; tags: string[]; tests: { projectName: string }[] }[]; suites?: Suite[] };
const playwrightCli = join(root, "node_modules", "@playwright", "test", "cli.js");

async function playwrightList(env: Record<string, string>): Promise<Planned[]> {
  const base = Object.fromEntries(Object.entries(process.env).filter(([k]) => !k.startsWith("E2E_") && k !== "CI")) as Record<string, string>;
  const { stdout } = await promisify(execFile)(process.execPath, [playwrightCli, "test", "--list", "--reporter=json"], {
    cwd: root,
    encoding: "utf8",
    env: { NODE_ENV: "test", ...base, TEST_DATABASE_URL: TEST, DATABASE_URL: LIVE, ...env },
    maxBuffer: 256 * 1024 * 1024,
  });
  const report = JSON.parse(stdout) as { suites: Suite[]; errors: unknown[] };
  expect(report.errors).toEqual([]);
  const out: Planned[] = [];
  const walk = (s: Suite, titles: string[]) => {
    for (const spec of s.specs ?? []) {
      for (const t of spec.tests) out.push({ project: t.projectName, file: s.file, titles: [...titles, spec.title], tags: spec.tags.map((g) => `@${g.replace(/^@/, "")}`) });
    }
    for (const c of s.suites ?? []) walk(c, [...titles, c.title]);
  };
  for (const s of report.suites) walk(s, []);
  return out.filter((p) => p.project !== "setup");
}

describe("the planned list: what Playwright schedules, by area (0.15)", () => {
  const lists: Record<string, Planned[]> = {};
  const specFiles = readdirSync(join(root, "test", "e2e")).filter((f) => f.endsWith(".spec.ts"));
  // The area each spec's header names, read here without the code under test.
  const areaOf = Object.fromEntries(specFiles.map((f) => [f, /^\/\/ @area: (\w+)$/m.exec(readFileSync(join(root, "test", "e2e", f), "utf8"))?.[1]]));
  const pair = (p: Planned) => `${p.project} | ${p.file} | ${p.titles.join(" › ")}`;
  const isCritical = (p: Planned) => p.tags.includes(CRITICAL_TAG);

  beforeAll(async () => {
    const runs: Record<string, Record<string, string>> = { core: { E2E_SCOPE: "core" }, full: { E2E_SCOPE: "full" }, coreComics: { E2E_SCOPE: "core", E2E_AREAS: "comics" }, fullComics: { E2E_SCOPE: "full", E2E_AREAS: "comics" } };
    for (const n of [1, 2, 3]) runs[`shard${n}Comics`] = { E2E_SCOPE: "full", E2E_AREAS: "comics", E2E_SHARD: `${n}/3` };
    const done = await Promise.all(Object.entries(runs).map(async ([k, env]) => [k, await playwrightList(env)] as const));
    for (const [k, v] of done) lists[k] = v;
  }, 120_000);

  it("with no areas, Playwright plans exactly what the project rules alone plan, core and full (AC-5)", () => {
    // Before 0.15 every project ran every spec file with e2eProjects' grep: the same rule, applied here by
    // hand to every test the full run knows, on Playwright's grep title (project, file, titles, tags).
    const tests = new Map(lists.full.map((p) => [`${p.file} | ${p.titles.join(" › ")}`, p]));
    for (const scope of ["core", "full"] as const) {
      const expected = [...tests.values()].flatMap((t) =>
        e2eProjects(scope)
          .filter((proj) => proj.grep.some((g) => g.test([proj.name, t.file, ...t.titles, ...t.tags].join(" "))))
          .map((proj) => pair({ ...t, project: proj.name })));
      expect(lists[scope].map(pair).sort(), scope).toEqual(expected.sort());
    }
    expect(lists.core.length).toBeGreaterThan(1000);
  });

  it("with E2E_AREAS=comics Playwright plans every comics spec and every file with a @critical test, and no other books spec (AC-3)", () => {
    const comics = specFiles.filter((f) => areaOf[f] === "comics");
    expect(comics.length).toBeGreaterThan(0);
    const criticalFiles = [...new Set(lists.full.filter(isCritical).map((p) => p.file))];
    for (const scope of ["core", "full"] as const) {
      const run = lists[`${scope}Comics`];
      const files = [...new Set(run.map((p) => p.file))].sort();
      expect(files, scope).toEqual([...new Set([...comics, ...criticalFiles])].sort());
      // Each comics spec runs whole, exactly as it does with every area.
      const ofComics = (l: Planned[]) => l.filter((p) => comics.includes(p.file)).map(pair).sort();
      expect(ofComics(run), scope).toEqual(ofComics(lists[scope]));
      // From any other area, only @critical tests, and only at the core projects.
      const others = run.filter((p) => !comics.includes(p.file));
      expect(others.length, scope).toBeGreaterThan(0);
      expect(others.filter((p) => !isCritical(p)).map(pair), scope).toEqual([]);
      expect(others.filter((p) => !E2E_CORE.includes(p.project)).map(pair), scope).toEqual([]);
      expect(run.some((p) => areaOf[p.file] === "books"), scope).toBe(true);
    }
  });

  it("CI's shards split only what the areas plan: three shards of the comics run hold it exactly, each pair once (D-167)", () => {
    const sharded = [1, 2, 3].flatMap((n) => lists[`shard${n}Comics`].map(pair));
    expect(sharded.length).toBe(new Set(sharded).size);
    expect(sharded.sort()).toEqual(lists.fullComics.map(pair).sort());
    for (const n of [1, 2, 3]) expect(lists[`shard${n}Comics`].length, `shard ${n}`).toBeGreaterThan(0);
  });

  it("a @critical test is planned at the core projects only, at both scopes, with areas or without; with comics, each at the same core projects as with all areas (AC-3)", () => {
    for (const [k, l] of Object.entries(lists)) {
      expect(l.filter(isCritical).filter((p) => !E2E_CORE.includes(p.project)).map(pair), k).toEqual([]);
    }
    const critical = (l: Planned[]) => l.filter(isCritical).map(pair).sort();
    expect(critical(lists.core).length).toBeGreaterThan(0);
    expect(critical(lists.full)).toEqual(critical(lists.core));
    expect(critical(lists.coreComics)).toEqual(critical(lists.core));
    expect(critical(lists.fullComics)).toEqual(critical(lists.core));
  });

  it("the critical set covers sign-in, both dashboards, the add flow, a status write and its Undo, navigation between media and an error state, within 5 minutes of recorded core time (AC-4)", () => {
    const covers: [string, string, RegExp][] = [
      ["sign-in (the gate; auth.setup.ts signs in before every run)", "routes.spec.ts", /^a garbage session goes to \/login/],
      ["the books and comics dashboards loading", "routes.spec.ts", /^each route answers with its own screen$/],
      ["the add flow", "book-search.spec.ts", /^adding one creates one books row/],
      ["a status write and its Undo", "dnf-reason.spec.ts", /^the toast's Undo after a reason leaves the book reading/],
      // The phone's media are in the Switch medium sheet since 6.25 (D-178).
      ["navigation between media", "shell.spec.ts", /^the Switch medium sheet's Watch row goes there$/],
      ["an error state", "dnf-reason.spec.ts", /^a reason that didn't save says so with Retry/],
    ];
    const critical = lists.core.filter(isCritical);
    for (const [what, file, title] of covers) {
      expect(critical.some((p) => p.file === file && title.test(p.titles.at(-1)!)), what).toBe(true);
    }
    // shard-times.json records a spec file per project, not a test: a file's whole core time is the upper bound.
    const times = JSON.parse(readFileSync(join(root, "test", "e2e", "shard-times.json"), "utf8")) as Record<string, number>;
    const files = new Set(critical.map((p) => p.file));
    const ms = Object.entries(times)
      .filter(([k]) => E2E_CORE.includes(k.split("|")[0]) && files.has(k.split("|")[1]))
      .reduce((sum, [, v]) => sum + v, 0);
    expect(ms).toBeGreaterThan(0);
    expect(ms).toBeLessThanOrEqual(5 * 60_000);
  });
});

describe("e2eProjects: which project runs which test", () => {
  // Playwright's own rule (createProjectSuite): a test runs in a project when
  // one of the project's grep patterns matches its title path plus its tags.
  const runsIn = (scope: "core" | "full", title: string) =>
    e2eProjects(scope).filter((p) => p.grep.some((g) => g.test(title))).map((p) => p.name);
  const specs = readdirSync(join(root, "test", "e2e")).filter((f) => f.endsWith(".spec.ts"));
  const spec = (f: string) => readFileSync(join(root, "test", "e2e", f), "utf8");

  it("full is the six widths light and dark, then reduced motion and touch; core is six of them", () => {
    expect(e2eProjects("full").map((p) => p.name)).toEqual([
      "w360-light", "w360-dark", "w390-light", "w390-dark", "w412-light", "w412-dark", "w768-light", "w768-dark",
      "w1024-light", "w1024-dark", "w1280-light", "w1280-dark", "w390-reduced-motion", "w390-touch",
    ]);
    expect(e2eProjects("core").map((p) => p.name)).toEqual(E2E_CORE);
    expect(E2E_CORE).toEqual(["w390-light", "w390-dark", "w768-light", "w1280-light", "w390-reduced-motion", "w390-touch"]);
  });

  it("an untagged test checks behaviour: the phone, the tablet, the desktop, reduced motion and touch, light only (D-161)", () => {
    const title = "w390-light queue.spec.ts the dashboard shelf renders the queue";
    expect(E2E_BEHAVIOUR).toEqual(["w390-light", "w768-light", "w1280-light", "w390-reduced-motion", "w390-touch"]);
    expect(runsIn("full", title)).toEqual(E2E_BEHAVIOUR);
    expect(runsIn("core", title)).toEqual(E2E_BEHAVIOUR);
  });

  it("a test tagged @floor runs at every layout, light; never 412, reduced motion, touch or a dark project (D-161, D-167)", () => {
    expect(FLOOR_TAG).toBe("@floor");
    expect(runsIn("full", "the sheet meets the floor @floor")).toEqual(E2E_FLOOR);
    expect(E2E_FLOOR).toEqual(["w360-light", "w390-light", "w768-light", "w1024-light", "w1280-light"]);
    expect(runsIn("core", "the sheet meets the floor @floor")).toEqual(["w390-light", "w768-light", "w1280-light"]);
    // A describe's tag counts the same as the test's own.
    expect(runsIn("full", "the plan picker @floor › meets the floor")).toEqual(E2E_FLOOR);
    // Only the tag itself: a longer word that starts with it is not @floor.
    expect(runsIn("full", "x @floor-ish")).toEqual(E2E_BEHAVIOUR);
  });

  it("a test tagged @feel runs where @floor does, and at 412 (design §10, D-40, D-161)", () => {
    expect(FEEL_TAG).toBe("@feel");
    expect(E2E_FEEL).toEqual(["w360-light", "w390-light", "w412-light", "w768-light", "w1024-light", "w1280-light"]);
    expect(runsIn("full", "the dashboard in each state @feel")).toEqual(E2E_FEEL);
    expect(runsIn("full", "both @floor @feel")).toEqual(E2E_FEEL);
  });

  it("@motion adds reduced motion to a @floor or @feel test that reads the project's own motion setting (D-167)", () => {
    expect(MOTION_TAG).toBe("@motion");
    // In the project order, as e2eProjects lists them.
    const order = E2E_PROJECTS.map((p) => p.name);
    const withMotion = (names: string[]) => [...names, "w390-reduced-motion"].sort((a, b) => order.indexOf(a) - order.indexOf(b));
    expect(runsIn("full", "x @floor @motion")).toEqual(withMotion(E2E_FLOOR));
    expect(runsIn("full", "x @feel @motion")).toEqual(withMotion(E2E_FEEL));
    expect(runsIn("core", "x @floor @motion")).toEqual(["w390-light", "w768-light", "w1280-light", "w390-reduced-motion"]);
    // An untagged test already runs there: the tag adds nothing. Only the tag itself counts.
    expect(runsIn("full", "x @motion")).toEqual(E2E_BEHAVIOUR);
    expect(runsIn("full", "x @floor @motion-ish")).toEqual(E2E_FLOOR);
    // An @at- tag still wins.
    expect(runsIn("full", "x @floor @motion @at-w1024-light")).toEqual(["w1024-light"]);
  });

  it("@touch does the same for w390-touch: a @floor or @feel test that needs the coarse pointer (D-167)", () => {
    expect(TOUCH_TAG).toBe("@touch");
    const order = E2E_PROJECTS.map((p) => p.name);
    const sorted = (names: string[]) => names.sort((a, b) => order.indexOf(a) - order.indexOf(b));
    expect(runsIn("full", "x @floor @touch")).toEqual(sorted([...E2E_FLOOR, "w390-touch"]));
    expect(runsIn("full", "x @feel @touch")).toEqual(sorted([...E2E_FEEL, "w390-touch"]));
    expect(runsIn("full", "x @floor @motion @touch")).toEqual(sorted([...E2E_FLOOR, "w390-reduced-motion", "w390-touch"]));
    expect(runsIn("full", "x @touch")).toEqual(E2E_BEHAVIOUR);
    expect(runsIn("full", "x @floor @touch-ish")).toEqual(E2E_FLOOR);
    expect(runsIn("full", "x @floor @touch @at-w1024-light")).toEqual(["w1024-light"]);
  });

  it("a dark project runs only the tests tagged for it: the floor checks dark in place", () => {
    const dark = E2E_PROJECTS.map((p) => p.name).filter((n) => n.endsWith("-dark"));
    for (const title of ["x", "x @floor", "x @feel"]) expect(runsIn("full", title).filter((n) => dark.includes(n))).toEqual([]);
    expect(runsIn("full", "x @at-w1024-dark")).toEqual(["w1024-dark"]);
  });

  it("a test tagged @at-<project> runs there and nowhere else, and not at all when the scope leaves it out", () => {
    expect(runsIn("full", "drags the handle @at-w1280-light")).toEqual(["w1280-light"]);
    expect(runsIn("full", "the shimmer @at-w390-light @at-w390-reduced-motion runs normally")).toEqual(["w390-light", "w390-reduced-motion"]);
    expect(runsIn("full", "at 1024 › moves four covers @at-w1024-light")).toEqual(["w1024-light"]);
    expect(runsIn("core", "at 1024 › moves four covers @at-w1024-light")).toEqual([]);
    // A project name that starts another's is not that project.
    expect(runsIn("full", "x @at-w390-reduced-motion")).toEqual(["w390-reduced-motion"]);
  });

  it("an @at- tag wins over @floor and @feel, even at a width they leave out", () => {
    expect(runsIn("full", "x @floor @at-w412-light")).toEqual(["w412-light"]);
    expect(runsIn("full", "x @at-w390-light @feel")).toEqual(["w390-light"]);
    expect(runsIn("core", "x @floor @at-w1024-light")).toEqual([]);
  });

  it("every tag in the specs is @floor, @feel, @motion, @touch, @critical or names a project, and the specs use @floor, @feel and @motion", () => {
    const names = new Set(E2E_PROJECTS.map((p) => p.name));
    const tags = [
      ...specs.flatMap((f) =>
        [...spec(f).matchAll(/\{ tag: (\[[^\]]*\]|"[^"]*") \}/g)].flatMap((m) =>
          [...m[1].matchAll(/"([^"]+)"/g)].map((t) => ({ f, tag: t[1] })))),
      // helpers.ts holds the shared FLOOR, FEEL and *_MOTION details the specs import.
      ...[...readFileSync(join(root, "test", "e2e", "helpers.ts"), "utf8").matchAll(/\{ tag: (\[[^\]]*\]|"[^"]*") \}/g)].flatMap((m) =>
        [...m[1].matchAll(/"([^"]+)"/g)].map((t) => ({ f: "helpers.ts", tag: t[1] }))),
    ];
    for (const { f, tag } of tags) {
      expect(tag === FLOOR_TAG || tag === FEEL_TAG || tag === MOTION_TAG || tag === TOUCH_TAG || tag === CRITICAL_TAG || (tag.startsWith("@at-") && names.has(tag.slice(4))), `${f}: ${tag}`).toBe(true);
    }
    const used = specs.map(spec).join("\n");
    expect(used).toMatch(/[(,] ?FLOOR[,)]/);
    expect(used).toMatch(/[(,] ?FEEL[,)]/);
    expect(used).toMatch(/[(,] ?(FLOOR|FEEL)_MOTION[,)]/);
  });

  it("a @floor or @feel test that reads the project's own reduced motion says so with @motion (D-167)", () => {
    // Reduced motion no longer runs @floor or @feel: without the tag such a test would lose its reduced branch.
    const reads = /matchMedia\("\(prefers-reduced-motion: reduce\)"\)\.matches|await reduced\(page\)/;
    const offenders: string[] = [];
    for (const f of specs) {
      const lines = spec(f).split("\n");
      lines.forEach((line, i) => {
        if (!reads.test(line)) return;
        let j = i;
        while (j > 0 && !/^\s*(test|test\.describe)\(/.test(lines[j])) j--;
        if (/[(,] ?(FLOOR|FEEL)[,)]/.test(lines[j])) offenders.push(`${f}:${i + 1}`);
      });
    }
    expect(offenders).toEqual([]);
  });

  it("a @floor or @feel test that needs the touch pointer says so with @touch (D-167)", () => {
    // w390-touch no longer runs @floor or @feel: a test that reads hasTouch or the coarse pointer would lose it.
    const reads = /\bhasTouch\b|\bisMobile\b|\(pointer: ?coarse\)|\(hover: ?none\)/;
    const offenders: string[] = [];
    for (const f of specs) {
      const lines = spec(f).split("\n");
      lines.forEach((line, i) => {
        if (!reads.test(line)) return;
        let j = i;
        while (j > 0 && !/^\s*(test|test\.describe)\(/.test(lines[j])) j--;
        if (/[(,] ?(FLOOR|FEEL)[,)]/.test(lines[j])) offenders.push(`${f}:${i + 1}`);
      });
    }
    expect(offenders).toEqual([]);
  });

  it("every @at- tag in the specs names a project", () => {
    const names = new Set(E2E_PROJECTS.map((p) => p.name));
    const tags = specs.flatMap((f) => [...spec(f).matchAll(/"@at-([\w-]+)"/g)].map((m) => `${f}: ${m[1]}`));
    expect(tags.length).toBeGreaterThan(0);
    for (const t of tags) expect(names.has(t.split(": ")[1]), t).toBe(true);
  });

  it("no spec skips on the project's name at run time: it tags the test instead, so it is never scheduled", () => {
    for (const f of specs) {
      expect(spec(f), f).not.toMatch(/test\.skip\([^;]*project\.name/);
      expect(spec(f), f).not.toContain("runsOnce");
    }
  });
});

// Runs the wrapper from an empty folder, so no .env there can supply a
// TEST_DATABASE_URL the case means to leave out. The folder holds a stale
// next dev cache and a build, so a case can see what the wrapper cleared.
// Stubs stand in for Playwright and for `next` (--build); each appends to
// steps.txt, so a case can see what ran, in what order, with which database.
function runWrapper(env: Record<string, string>, args: string[] = [], buildExit = 0) {
  const dir = mkdtempSync(join(tmpdir(), "e2e-guard-"));
  mkdirSync(join(dir, DEV_CACHE, "cache"), { recursive: true });
  writeFileSync(join(dir, DEV_CACHE, "cache", "stale"), "");
  writeFileSync(join(dir, ".next", "BUILD_ID"), "build");
  const marker = join(dir, "launched.json");
  const steps = join(dir, "steps.txt");
  const stub = join(dir, "stub-playwright.mjs");
  writeFileSync(
    stub,
    `import { appendFileSync, writeFileSync } from "node:fs";
     appendFileSync(${JSON.stringify(steps)}, "playwright\\n");
     writeFileSync(${JSON.stringify(marker)}, JSON.stringify({ argv: process.argv.slice(2), db: process.env.DATABASE_URL ?? null, scope: process.env.E2E_SCOPE ?? null, server: process.env.E2E_SERVER ?? null }));`,
  );
  const nextStub = join(dir, "stub-next.mjs");
  writeFileSync(
    nextStub,
    `import { appendFileSync } from "node:fs";
     appendFileSync(${JSON.stringify(steps)}, "next " + process.argv.slice(2).join(" ") + " db=" + process.env.DATABASE_URL + "\\n");
     process.exit(${buildExit});`,
  );
  const r = spawnSync(process.execPath, [wrapper, ...args], {
    cwd: dir,
    encoding: "utf8",
    env: { NODE_ENV: "test", PATH: process.env.PATH ?? "", SystemRoot: process.env.SystemRoot ?? "", PLAYWRIGHT_CLI: stub, NEXT_CLI: nextStub, ...env },
  });
  const launched = existsSync(marker) ? JSON.parse(readFileSync(marker, "utf8")) : null;
  const devCacheLeft = existsSync(join(dir, DEV_CACHE));
  const buildLeft = existsSync(join(dir, ".next", "BUILD_ID"));
  const ran = existsSync(steps) ? readFileSync(steps, "utf8").trim().split("\n") : [];
  rmSync(dir, { recursive: true, force: true });
  return { status: r.status, stderr: r.stderr, launched, devCacheLeft, buildLeft, ran };
}

describe("node scripts/e2e.mjs", () => {
  it("exits 1 with testdb.mjs's message and launches nothing when TEST_DATABASE_URL is unset", () => {
    const r = runWrapper({ DATABASE_URL: LIVE });
    expect(r.status).toBe(1);
    expect(r.stderr).toContain(checkTestUrl(undefined, LIVE)!);
    expect(r.launched).toBeNull();
    expect(r.devCacheLeft).toBe(true);
  });

  it("exits 1 and launches nothing when TEST_DATABASE_URL is the same database as DATABASE_URL", () => {
    const r = runWrapper({ TEST_DATABASE_URL: LIVE, DATABASE_URL: LIVE });
    expect(r.status).toBe(1);
    expect(r.stderr).toContain(checkTestUrl(LIVE, LIVE)!);
    expect(r.launched).toBeNull();
  });

  it("deletes .next/dev before a dev run and keeps the build; leaves both alone for next start", () => {
    const dev = runWrapper({ TEST_DATABASE_URL: TEST, DATABASE_URL: LIVE });
    expect(dev.status).toBe(0);
    expect(dev.devCacheLeft).toBe(false);
    expect(dev.buildLeft).toBe(true);
    const start = runWrapper({ TEST_DATABASE_URL: TEST, DATABASE_URL: LIVE, E2E_SERVER: "start" });
    expect(start.status).toBe(0);
    expect(start.devCacheLeft).toBe(true);
    expect(start.buildLeft).toBe(true);
  });

  it("hands Playwright its arguments when the test database is safe, and DATABASE_URL stays the owner's", () => {
    const r = runWrapper({ TEST_DATABASE_URL: TEST, DATABASE_URL: LIVE }, ["--project=w360-light"]);
    expect(r.status).toBe(0);
    expect(r.launched.argv).toEqual(["test", "--project=w360-light"]);
    // The server's env is set in playwright.config.ts; the Playwright process
    // keeps DATABASE_URL as it was, so testdb.mjs can still tell the two apart.
    expect(r.launched.db).toBe(LIVE);
  });

  it("takes --full for itself: Playwright gets E2E_SCOPE=full and never sees the flag", () => {
    const r = runWrapper({ TEST_DATABASE_URL: TEST, DATABASE_URL: LIVE }, ["--full", "--shard=1/4"]);
    expect(r.status).toBe(0);
    expect(r.launched.argv).toEqual(["test", "--shard=1/4"]);
    expect(r.launched.scope).toBe("full");
    expect(runWrapper({ TEST_DATABASE_URL: TEST, DATABASE_URL: LIVE }).launched.scope).toBeNull();
  });

  it("takes --build for itself: builds on the test database first, then serves that build with next start (D-97)", () => {
    const r = runWrapper({ TEST_DATABASE_URL: TEST, DATABASE_URL: LIVE }, ["--build", "--project=w390-light"]);
    expect(r.status).toBe(0);
    expect(r.ran).toEqual([`next build db=${TEST}`, "playwright"]);
    expect(r.launched.argv).toEqual(["test", "--project=w390-light"]);
    expect(r.launched.server).toBe("start");
    expect(r.launched.db).toBe(LIVE);
    // next start serves the build: the dev cache is not the wrapper's to clear.
    expect(r.devCacheLeft).toBe(true);
    // Without --build nothing is built, and the server is whatever E2E_SERVER says.
    const plain = runWrapper({ TEST_DATABASE_URL: TEST, DATABASE_URL: LIVE });
    expect(plain.ran).toEqual(["playwright"]);
    expect(plain.launched.server).toBeNull();
  });

  it("stops when --build's build fails, and never builds against an unsafe database", () => {
    const failed = runWrapper({ TEST_DATABASE_URL: TEST, DATABASE_URL: LIVE }, ["--build"], 3);
    expect(failed.status).toBe(3);
    expect(failed.stderr).toContain("next build failed");
    expect(failed.ran).toEqual([`next build db=${TEST}`]);
    expect(failed.launched).toBeNull();
    const unsafe = runWrapper({ TEST_DATABASE_URL: LIVE, DATABASE_URL: LIVE }, ["--build"]);
    expect(unsafe.status).toBe(1);
    expect(unsafe.ran).toEqual([]);
  });

  it("test:e2e:full is the wrapper with --full, and CI's shards run the scope CI picks", () => {
    const pkg = JSON.parse(readFileSync(join(root, "package.json"), "utf8"));
    expect(pkg.scripts["test:e2e:full"]).toBe("node scripts/e2e.mjs --full");
    expect(ciJob("e2e")).toContain("E2E_SCOPE: ${{ needs.scope.outputs.e2e_scope }}");
  });
});

describe("wiring: test:all runs it, the docs name it, its output is ignored", () => {
  const read = (p: string) => readFileSync(join(root, p), "utf8");
  const pkg = JSON.parse(read("package.json"));

  it("test:all is test:no-e2e, then the suite on a fresh build; test:e2e is the wrapper (D-97)", () => {
    expect(pkg.scripts["test:e2e"]).toBe("node scripts/e2e.mjs");
    expect(pkg.scripts["test:e2e:build"]).toBe("node scripts/e2e.mjs --build");
    expect(pkg.scripts["test:all"]).toBe("npm run test:no-e2e && npm run test:e2e:build");
    expect(pkg.scripts["test:no-e2e"]).not.toContain("e2e.mjs");
    expect(pkg.scripts["test:no-e2e"]).not.toContain("test:e2e");
  });

  // D-141: the whole browser suite runs only in CI, every project, and Claude fixes what fails there.
  it("verify.full is typecheck, lint and test:no-e2e: no local browser suite and no local build (D-141)", () => {
    const kit = JSON.parse(read(".claude/kit.json"));
    expect(kit.verify.full).toEqual(["npx tsc --noEmit", "npm run lint", "npm run test:no-e2e"]);
    expect(kit.verify.full.join(" ")).not.toMatch(/test:all|test:e2e|e2e\.mjs|npm run build/);
  });

  it("CI's browser run is the gate: e2e:full from the first push, and rounds to fix what it finds (D-141)", () => {
    const kit = JSON.parse(read(".claude/kit.json"));
    expect(kit.workflow.maxCiFixRounds).toBe(4);
    const gate = kit.workflow.readyGates.find((g: { name?: string }) => g.name === "Full browser suite on the branch");
    expect(gate.check).toContain("from its first push");
    expect(gate.check).toContain("D-141");
    const implement = read(".claude/project/implement-task.md");
    expect(implement).toContain("Watch CI from the first push, and fix what fails");
    expect(implement).toContain("gh run view <id> --log-failed");
  });

  it("/verify runs test:no-e2e and the touched specs, never test:all (D-141)", () => {
    const skill = read(".claude/skills/verify/SKILL.md");
    const block = skill.slice(skill.indexOf("```bash"), skill.indexOf("```", skill.indexOf("```bash") + 3));
    expect(block).toContain("npm run test:no-e2e");
    expect(block).not.toContain("test:all");
    expect(skill).toContain("node scripts/test-files.mjs <specs>");
  });

  it("CLAUDE.md, git.md and COMMANDS.md name npm run test:e2e", () => {
    for (const f of ["CLAUDE.md", ".claude/rules/git.md", "docs/COMMANDS.md"]) {
      expect(read(f), f).toContain("npm run test:e2e");
    }
  });

  it("CI's e2e job builds, installs the browser, then runs its shard against next start", () => {
    const e2e = ciJob("e2e");
    const build = e2e.indexOf("npm run build");
    const install = e2e.indexOf("npx playwright install chromium");
    const run = e2e.indexOf("npm run test:e2e -- --reporter=list,blob");
    expect(build).toBeGreaterThan(-1);
    expect(install).toBeGreaterThan(build);
    expect(run).toBeGreaterThan(install);
    expect(e2e).toContain("E2E_SERVER: start");
    expect(e2e).toContain("fail-fast: false");
  });

  it("git ignores the screenshots, the report and the saved sign-in", () => {
    for (const p of ["test-results/screens/w360-light/probe.png", "playwright-report/index.html", "test/e2e/.auth/state.json"]) {
      const r = spawnSync("git", ["check-ignore", "-q", p], { cwd: root });
      expect(r.status, p).toBe(0);
    }
  });

  it("the test-auditor can run an e2e spec through the wrapper, after a reset, in one project", () => {
    expect(planTestRun(["test/e2e/spine.spec.ts", "test/e2e/harness.spec.ts"])).toEqual({
      commands: ["npm run test:db:reset", "node scripts/e2e.mjs test/e2e/spine.spec.ts test/e2e/harness.spec.ts --project=w390-light"],
      unknown: [],
    });
    const kit = JSON.parse(read(".claude/kit.json"));
    expect(kit.testAudit.testPathPatterns).toContain("test/e2e/*.spec.ts");
  });
});
