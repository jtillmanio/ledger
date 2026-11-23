import { spawnSync } from "node:child_process";
import { describe, expect, it } from "vitest";
import { mkdtempSync, readdirSync, readFileSync, rmSync, statSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, posix } from "node:path";
import {
  FULL_E2E_LABEL,
  MEDIUM_COMPONENTS,
  areasForRun,
  coveredAreas,
  describeAreas,
  e2eLabel,
  e2eScope,
  greenFullRunToReuse,
  isDocsOnly,
  needsBrowserAndBuild,
  prAreas,
  ranEveryProject,
  routeArea,
} from "../scripts/lib/ci-scope.mjs";
import { AREAS, E2E_CORE, areaFilter, areaPlan, e2eProjects, specArea } from "../scripts/lib/e2e.mjs";
import { checkScript, ci, ciJob, ciJobs } from "./ci-yml";

// The real spec files, as the scope job reads them.
const SPECS = readdirSync("test/e2e")
  .filter((f) => f.endsWith(".spec.ts"))
  .map((file) => ({ file, text: readFileSync(`test/e2e/${file}`, "utf8") }));
const areaOfSpec = (file: string) => {
  const r = specArea(SPECS.find((s) => s.file === file)!.text);
  return "area" in r ? r.area : null;
};

describe("needsBrowserAndBuild (scripts/ci-scope.mjs)", () => {
  it("skips the slow steps for backups, docs, Claude config and root markdown", () => {
    expect(needsBrowserAndBuild(["backups/reading-2026-09-29.sql.gz"])).toBe(false);
    expect(needsBrowserAndBuild(["docs/05-roadmap.md", "docs/tasks/TASK-001.md", "CLAUDE.md"])).toBe(false);
    expect(needsBrowserAndBuild([".claude/rules/git.md", ".claude/scripts/build-index.ps1"])).toBe(false);
  });

  it("runs them for app code, migrations, views and dependencies", () => {
    expect(needsBrowserAndBuild(["docs/05-roadmap.md", "src/app/comics/(dash)/page.tsx"])).toBe(true);
    expect(needsBrowserAndBuild(["drizzle/0005_a.sql"])).toBe(true);
    expect(needsBrowserAndBuild(["etl/views.sql"])).toBe(true);
    expect(needsBrowserAndBuild(["package-lock.json"])).toBe(true);
  });

  it("runs them for a changed workflow, which has to exercise itself", () => {
    expect(needsBrowserAndBuild([".github/workflows/ci.yml"])).toBe(true);
    expect(needsBrowserAndBuild(["docs/START-HERE.md", ".github/actions/start-postgres/action.yml"])).toBe(true);
  });

  it("runs them for design/, which the browser suite reads, markdown included", () => {
    expect(needsBrowserAndBuild(["design/mockups-index.md"])).toBe(true);
    expect(needsBrowserAndBuild(["design/mockups.html"])).toBe(true);
  });

  it("runs them for markdown that is not at the root or under docs/", () => {
    expect(needsBrowserAndBuild(["src/content/notes.md"])).toBe(true);
  });

  it("runs them when nothing changed, because there is nothing to compare", () => {
    expect(needsBrowserAndBuild([])).toBe(true);
  });
});

describe("isDocsOnly: the line the CI scope and verify:docs share (D-145)", () => {
  it("holds for docs, Claude config, backups and root markdown, and for nothing", () => {
    expect(isDocsOnly(["docs/tasks/TASK-073-x.md", ".claude/kit.json", "CLAUDE.md", "backups/a.sql.gz"])).toBe(true);
    expect(isDocsOnly([])).toBe(true);
  });

  it("fails on anything the app, the build or the browser suite reads", () => {
    expect(isDocsOnly(["docs/STATUS.md", "design/mockups-index.md"])).toBe(false);
    expect(isDocsOnly([".github/workflows/ci.yml"])).toBe(false);
    expect(isDocsOnly(["scripts/ci-scope.mjs"])).toBe(false);
  });
});

// D-145: a task's close-out and accept pushes only add docs after CI already
// passed every project, so they lean on that run instead of repeating it.
describe("greenFullRunToReuse: when a push can lean on an earlier full run", () => {
  const shards = (scope: string, conclusion = "success") =>
    [1, 2, 3].map((n) => ({ name: `e2e ${scope} ${n}/3`, conclusion }));
  const skipped = [{ name: "e2e ${{ needs.scope.outputs.e2e_scope }} ${{ matrix.shard }}/${{ strategy.job-total }}", conclusion: "skipped" }];
  const tests = { name: "tests", conclusion: "success" };

  // Newest first: a docs push that skipped e2e (3), the full run (2), the draft's core run (1).
  const runs = [
    { id: 3, head_sha: "ccc3333" },
    { id: 2, head_sha: "bbb2222" },
    { id: 1, head_sha: "aaa1111" },
  ];
  const jobs: Record<number, { name: string; conclusion: string }[]> = {
    3: [tests, ...skipped],
    2: [tests, ...shards("full")],
    1: [tests, ...shards("core")],
  };
  const world = (over: Partial<Parameters<typeof greenFullRunToReuse>[1]> = {}) => ({
    jobsOf: (id: number) => jobs[id],
    isAncestor: () => true,
    changedSince: (sha: string) => (sha === "bbb2222" ? ["docs/tasks/TASK-073-x.md", "docs/05-roadmap.md"] : ["src/app/page.tsx"]),
    ...over,
  });

  it("counts only full-scope shards that all passed", () => {
    expect(ranEveryProject([tests, ...shards("full")])).toBe(true);
    expect(ranEveryProject([tests, ...shards("core")])).toBe(false);
    expect(ranEveryProject([tests, ...skipped])).toBe(false);
    expect(ranEveryProject([tests])).toBe(false);
    expect(ranEveryProject([...shards("full"), { name: "e2e full 4/4", conclusion: "failure" }])).toBe(false);
  });

  it("reuses the newest run that passed every project, past docs-only runs that skipped the suite", () => {
    const r = greenFullRunToReuse(runs, world());
    expect(r?.run.id).toBe(2);
    expect(r?.files).toEqual(["docs/tasks/TASK-073-x.md", "docs/05-roadmap.md"]);
  });

  it("reuses it when nothing differs at all (the same tree passed)", () => {
    expect(greenFullRunToReuse(runs, world({ changedSince: () => [] }))?.run.id).toBe(2);
  });

  it("runs the full gate when code changed since that run, on the branch or on main", () => {
    expect(greenFullRunToReuse(runs, world({ changedSince: () => ["docs/STATUS.md", "src/db/queries.ts"] }))).toBeNull();
  });

  it("does not fall back to an older full run when the newest one cannot be reused", () => {
    const older = [...runs, { id: 0, head_sha: "0000000" }];
    jobs[0] = [tests, ...shards("full")];
    const changedSince = (sha: string) => (sha === "0000000" ? ["docs/a.md"] : ["src/app/page.tsx"]);
    expect(greenFullRunToReuse(older, world({ changedSince }))).toBeNull();
    delete jobs[0];
  });

  it("skips a run whose head left the history (a force-push) and uses an older one still in it", () => {
    const rewritten = [{ id: 9, head_sha: "9999999" }, ...runs];
    jobs[9] = [tests, ...shards("full")];
    const r = greenFullRunToReuse(rewritten, world({ isAncestor: (sha: string) => sha !== "9999999" }));
    expect(r?.run.id).toBe(2);
    delete jobs[9];
  });

  it("runs the full gate when no run passed every project, or the diff cannot be read", () => {
    expect(greenFullRunToReuse([runs[0], runs[2]], world())).toBeNull();
    expect(greenFullRunToReuse([], world())).toBeNull();
    expect(greenFullRunToReuse(runs, world({ changedSince: () => null }))).toBeNull();
  });

  it("ci.yml gives the scope job a token that can read the PR's earlier runs", () => {
    const scope = ciJob("scope");
    expect(scope).toMatch(/permissions:\n\s+contents: read\n\s+actions: read/);
    expect(scope).toContain("GH_TOKEN: ${{ github.token }}");
  });
});

describe("ci.yml gates only the browser suite and the build", () => {
  it("decides the scope on pull requests only, against the branch the PR merges into", () => {
    const scope = ciJob("scope");
    expect(scope).toContain("node scripts/ci-scope.mjs");
    expect(scope).toMatch(/id: scope/);
    // origin/main for a PR into main; a PR into another branch diffs against that branch.
    expect(scope).toContain("github.event_name == 'pull_request' && format('--base origin/{0}', github.base_ref) || ''");
  });

  it("builds and runs the browser suite only in the e2e job, which waits on the scope", () => {
    const e2e = ciJob("e2e");
    expect(e2e).toContain("needs: scope");
    expect(e2e).toContain("if: needs.scope.outputs.full == 'true'");
    for (const s of ["npx playwright install chromium", "npm run test:e2e", "npm run build"]) {
      expect(e2e, s).toContain(s);
      for (const other of ciJobs().filter((j) => j !== "e2e")) expect(ciJob(other), `${other}: ${s}`).not.toContain(s);
    }
  });

  it("leaves the checks that guard docs and config ungated", () => {
    const tests = ciJob("tests");
    expect(tests).not.toMatch(/needs:|\n {4}if:|scope/);
    for (const s of ["build-index.ps1", "npx tsc --noEmit", "npm run lint", "npm run test:tokens", "npm run check:migrations", "npm run test:db:reset", "npm test", "npm run test:views", "unittest discover"]) {
      expect(tests, s).toContain(s);
    }
  });
});

// Release reads only the check run named `check` (scripts/release.mjs), so the
// job of that name has to answer for every job that does the work.
describe("ci.yml's check job is CI's verdict", () => {
  const verdict = (env: Record<string, string>) =>
    spawnSync("bash", ["-c", checkScript()], { env: { ...process.env, ...env }, encoding: "utf8" }).status;
  const green = { SCOPE: "success", FULL: "true", TESTS: "success", E2E: "success", BUDGET: "success" };

  it("runs whatever happened, after every job except the report", () => {
    const check = ciJob("check");
    expect(check).toContain("if: always()");
    const needs = check.match(/needs: \[([^\]]*)\]/)![1].split(",").map((s) => s.trim());
    expect(needs.sort()).toEqual(ciJobs().filter((j) => j !== "check" && j !== "e2e-report").sort());
  });

  it("passes when every job passed, or the browser suite was skipped on a docs-only change", () => {
    expect(verdict(green)).toBe(0);
    expect(verdict({ ...green, FULL: "false", E2E: "skipped", BUDGET: "skipped" })).toBe(0);
  });

  it("fails when the browser suite ran green but its time budget failed or never ran (D-161)", () => {
    expect(verdict({ ...green, BUDGET: "failure" })).toBe(1);
    expect(verdict({ ...green, BUDGET: "skipped" })).toBe(1);
    expect(verdict({ ...green, BUDGET: "cancelled" })).toBe(1);
  });

  it("fails when any job failed, was cancelled, or the browser suite was skipped when it should run", () => {
    expect(verdict({ ...green, TESTS: "failure" })).toBe(1);
    expect(verdict({ ...green, E2E: "failure" })).toBe(1);
    expect(verdict({ ...green, E2E: "cancelled" })).toBe(1);
    expect(verdict({ ...green, E2E: "skipped" })).toBe(1);
    expect(verdict({ ...green, SCOPE: "failure", FULL: "", E2E: "skipped" })).toBe(1);
  });
});

describe("e2eScope: how much of the browser suite a run checks (D-80)", () => {
  const pr = (draft: boolean, labels: string[] = []) => ({ pull_request: { draft, labels: labels.map((name) => ({ name })) } });

  it("checks the core projects on a draft PR", () => {
    expect(e2eScope("pull_request", pr(true))).toBe("core");
    expect(e2eScope("pull_request", pr(true, ["dependencies"]))).toBe("core");
  });

  it("checks every project on a draft labelled e2e:full, a PR marked ready, and a push to main", () => {
    expect(FULL_E2E_LABEL).toBe("e2e:full");
    expect(e2eScope("pull_request", pr(true, ["dependencies", "e2e:full"]))).toBe("full");
    expect(e2eScope("pull_request", pr(false))).toBe("full");
    expect(e2eScope("push", null)).toBe("full");
  });

  it("checks every project when it cannot read the event", () => {
    expect(e2eScope(undefined, null)).toBe("full");
    expect(e2eScope("pull_request", {})).toBe("full");
  });

  it("scripts/ci-scope.mjs writes the scope from the event payload to $GITHUB_OUTPUT", () => {
    const dir = mkdtempSync(join(tmpdir(), "ci-scope-"));
    try {
      const event = join(dir, "event.json");
      const out = join(dir, "output");
      writeFileSync(event, JSON.stringify(pr(true)));
      writeFileSync(out, "");
      const r = spawnSync(process.execPath, ["scripts/ci-scope.mjs"], {
        encoding: "utf8",
        env: { ...process.env, GITHUB_EVENT_NAME: "pull_request", GITHUB_EVENT_PATH: event, GITHUB_OUTPUT: out },
      });
      expect(r.status, r.stderr).toBe(0);
      // No --base: nothing to diff, so every area (areas is empty) and the label is the scope alone.
      expect(readFileSync(out, "utf8")).toBe("full=true\ne2e_scope=core\nareas=\ne2e_label=core\n");
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it("ci.yml reruns on the label, and the shards take the scope and the areas and show them in their name", () => {
    expect(ci).toMatch(/pull_request:\n(?: {4}#.*\n)* {4}types: \[opened, synchronize, reopened, labeled\]/);
    const scope = ciJob("scope");
    expect(scope).toContain("e2e_scope: ${{ steps.scope.outputs.e2e_scope }}");
    expect(scope).toContain("areas: ${{ steps.scope.outputs.areas }}");
    expect(scope).toContain("e2e_label: ${{ steps.scope.outputs.e2e_label }}");
    const e2e = ciJob("e2e");
    expect(e2e).toContain("E2E_SCOPE: ${{ needs.scope.outputs.e2e_scope }}");
    expect(e2e).toContain("E2E_AREAS: ${{ needs.scope.outputs.areas }}");
    expect(e2e).toContain("name: e2e ${{ needs.scope.outputs.e2e_label }} ${{ matrix.shard }}/${{ strategy.job-total }}");
  });

  it("the browser suite runs in ten shards, each named for its place among them (D-143, D-167)", () => {
    const e2e = ciJob("e2e");
    expect(e2e).toContain("shard: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10]");
    // The spec files a shard runs come from E2E_SHARD (test/e2e-shards.test.ts), not Playwright's --shard.
    expect(e2e).toContain("E2E_SHARD: ${{ matrix.shard }}/${{ strategy.job-total }}");
  });
});

// Roadmap 0.15 (task 0.15, D-173): a PR's browser suite runs the areas its
// changed paths can break, plus the critical set at the core projects.
describe("prAreas: the paths a PR changed select the areas its browser suite runs", () => {
  const areas = (files: string[]) => prAreas(files, SPECS).areas;

  it("a change only under one medium's routes, components and specs selects that medium", () => {
    expect(areas(["src/app/comics/(dash)/page.tsx", "src/components/IssueRow.tsx", "test/e2e/queue.spec.ts"])).toEqual(["comics"]);
    expect(areas(["src/app/api/runs/[runId]/route.ts", "src/app/api/queue/route.ts", "src/app/api/metron/search/route.ts"])).toEqual(["comics"]);
    expect(areas(["src/app/books/shelves/page.tsx", "src/components/ShelfList.tsx", "test/e2e/shelves.spec.ts"])).toEqual(["books"]);
    expect(areas(["src/app/book/[id]/page.tsx", "src/app/@modal/(.)book/[id]/page.tsx", "src/app/api/shelves/route.ts"])).toEqual(["books"]);
    expect(areas(["src/app/watch/page.tsx"])).toEqual(["watch"]);
  });

  it("changes under both comics and books select books and comics, and no other medium (AC-2)", () => {
    const both = areas(["src/app/comics/runs/page.tsx", "src/app/books/list/page.tsx"]);
    expect(both).toEqual(["books", "comics"]);
    for (const other of ["watch", "music", "games", "shared"]) expect(both).not.toContain(other);
  });

  it("one file under src/components/ that the map does not name selects every area (AC-2)", () => {
    expect(areas(["src/components/Sheet.tsx"])).toBeNull();
    expect(areas(["src/app/comics/runs/page.tsx", "src/components/NotYetWritten.tsx"])).toBeNull();
    expect(prAreas(["src/components/NotYetWritten.tsx"], SPECS).why).toEqual([
      { area: null, path: "src/components/NotYetWritten.tsx", rule: "a shared component" },
    ]);
  });

  it("anything shared selects every area, and says which shared root chose it", () => {
    const shared: [string, string][] = [
      ["src/db/queries.ts", "src/db/"],
      ["etl/views.sql", "etl/views.sql"],
      ["src/lib/plan-rail.ts", "src/lib/"],
      ["src/components/ThumbBar.tsx", "a shared component"],
      ["src/components/nav/Shell.tsx", "a shared component"],
      ["src/app/globals.css", "globals.css"],
      ["src/proxy.ts", "src/proxy.ts"],
      ["package.json", "package.json or the lockfile"],
      ["package-lock.json", "package.json or the lockfile"],
      ["playwright.config.ts", "the Playwright config"],
      ["next.config.ts", "the Next config"],
      ["test/e2e/helpers.ts", "test/e2e/helpers.ts"],
      [".github/workflows/ci.yml", ".github/"],
      [".github/actions/start-postgres/action.yml", ".github/"],
    ];
    for (const [path, rule] of shared) {
      const r = prAreas(["src/app/comics/runs/page.tsx", path], SPECS);
      expect(r.areas, path).toBeNull();
      expect(r.why, path).toEqual([{ area: null, path, rule }]);
    }
  });

  it("an unmapped path selects every area: the map fails toward all, never toward none", () => {
    for (const path of ["scripts/e2e.mjs", "drizzle/0042_new.sql", "design/mockups.html", "src/app/inbox/page.tsx", "src/app/settings/page.tsx", "src/app/layout.tsx", "test/db.ts", "test/e2e/shard-times.json"]) {
      const r = prAreas([path], SPECS);
      expect(r.areas, path).toBeNull();
      expect(r.why, path).toEqual([{ area: null, path, rule: "unmapped" }]);
    }
  });

  it("docs and unit tests select no area beside a medium's change", () => {
    expect(areas(["docs/tasks/TASK-135-x.md", ".claude/kit.json", "CLAUDE.md", "src/app/comics/runs/page.tsx"])).toEqual(["comics"]);
    expect(areas(["test/queue.test.ts", "test/series-list.test.tsx", "etl/test_extract.py", "src/app/comics/runs/page.tsx"])).toEqual(["comics"]);
  });

  it("a change where no path selects an area runs every area", () => {
    const r = prAreas(["test/queue.test.ts"], SPECS);
    expect(r.areas).toBeNull();
    expect(r.why).toEqual([{ area: null, path: null, rule: "no changed file selects an area" }]);
  });

  it("a spec selects its own area, a shared one only shared, and one no longer in the tree every area", () => {
    expect(areaOfSpec("status.spec.ts")).toBe("shared");
    expect(areas(["test/e2e/status.spec.ts"])).toEqual(["shared"]);
    expect(areas(["test/e2e/queue.spec.ts", "test/e2e/series.spec.ts"])).toEqual(["books", "comics"]);
    expect(areas(["test/e2e/removed-since.spec.ts"])).toBeNull();
  });

  it("a medium's file that a spec of another area imports selects that area too", () => {
    // status.spec.ts (shared) renders the books status loading screen itself,
    // and skeletons.spec.ts (shared) the plan rail.
    expect(SPECS.find((s) => s.file === "status.spec.ts")!.text).toContain('from "../../src/app/books/status/loading"');
    const r = prAreas(["src/app/books/status/loading.tsx"], SPECS);
    expect(r.areas).toEqual(["books", "shared"]);
    expect(r.why).toContainEqual({ area: "shared", path: "src/app/books/status/loading.tsx", rule: "imported by status.spec.ts" });
    expect(prAreas(["src/components/PlanRail.tsx"], SPECS).why).toEqual([
      { area: "books", path: "src/components/PlanRail.tsx", rule: "a books component" },
      { area: "shared", path: "src/components/PlanRail.tsx", rule: "imported by skeletons.spec.ts" },
    ]);
    // A spec of the same area adds nothing: shelves.spec.ts (books) imports the shelves loading screen.
    expect(prAreas(["src/app/books/shelves/loading.tsx"], SPECS).areas).toEqual(["books"]);
  });

  it("names every area it chose, with the paths and the rule that chose it", () => {
    const r = prAreas(["src/app/comics/runs/page.tsx", "src/components/IssueRow.tsx", "docs/a.md"], SPECS);
    expect(r.why).toEqual([
      { area: "comics", path: "src/app/comics/runs/page.tsx", rule: "a comics route" },
      { area: "comics", path: "src/components/IssueRow.tsx", rule: "a comics component" },
    ]);
    const text = describeAreas(r).join("\n");
    expect(text).toContain("**comics**");
    expect(text).toContain("the critical set at the core projects");
    expect(text).toContain("src/app/comics/runs/page.tsx (a comics route)");
    const all = describeAreas(prAreas(["src/db/queries.ts"], SPECS)).join("\n");
    expect(all).toContain("**every area**");
    expect(all).toContain("src/db/queries.ts (src/db/)");
  });
});

describe("areasForRun: what forces every area whatever the paths", () => {
  const pr = (labels: string[] = []) => ({ pull_request: { draft: false, labels: labels.map((name) => ({ name })) } });
  const comics = ["src/app/comics/runs/page.tsx"];

  it("a ready PR runs its paths' areas", () => {
    expect(areasForRun("pull_request", pr(), comics, SPECS).areas).toEqual(["comics"]);
  });

  it("a push to main, the nightly run and the e2e:full label select every area", () => {
    expect(areasForRun("push", null, comics, SPECS).areas).toBeNull();
    expect(areasForRun("schedule", null, comics, SPECS).areas).toBeNull();
    const labelled = areasForRun("pull_request", pr(["e2e:full"]), comics, SPECS);
    expect(labelled.areas).toBeNull();
    expect(labelled.why).toEqual([{ area: null, path: null, rule: "labelled e2e:full" }]);
  });

  it("a PR whose diff could not be read selects every area", () => {
    expect(areasForRun("pull_request", pr(), null, SPECS).areas).toBeNull();
  });

  it("the shard label is the scope, then the areas when not every one", () => {
    expect(e2eLabel("full", null)).toBe("full");
    expect(e2eLabel("full", ["books", "comics"])).toBe("full books+comics");
    expect(e2eLabel("core", ["comics"])).toBe("core comics");
  });
});

describe("a medium-only PR's plan, on the real spec files", () => {
  const critical = SPECS.filter((s) => s.text.includes('"@critical"')).map((s) => s.file);

  it("a comics-only change runs the comics specs and the critical set, and none of another medium's specs", () => {
    const { areas } = prAreas(["src/app/comics/(dash)/page.tsx"], SPECS);
    const plan = areaPlan(SPECS, areas)!;
    const comicsSpecs = SPECS.filter((s) => areaOfSpec(s.file) === "comics").map((s) => s.file);
    expect(comicsSpecs.length).toBeGreaterThan(0);
    expect(plan.selected).toEqual(comicsSpecs.sort());
    for (const p of e2eProjects("full")) {
      const f = areaFilter(p.name, plan)!;
      const others = f.files.filter((file) => !comicsSpecs.includes(file));
      if (E2E_CORE.includes(p.name)) {
        // The critical set's files, cut to their @critical tests: a books file's critical tests are no books spec (D-173).
        expect(others, p.name).toEqual(plan.critical);
        expect(f.grepInvert, p.name).toBeInstanceOf(RegExp);
        expect(f.grepInvert!.test(`${p.name} dnf-reason.spec.ts DNF a book`), p.name).toBe(true);
        expect(f.grepInvert!.test(`${p.name} dnf-reason.spec.ts DNF a book @critical`), p.name).toBe(false);
      } else {
        expect(others, p.name).toEqual([]);
      }
    }
  });

  it("the critical set runs at every core project, whichever medium a PR selects", () => {
    expect(critical.length).toBeGreaterThan(0);
    for (const medium of ["books", "comics", "watch"]) {
      const plan = areaPlan(SPECS, prAreas([medium === "books" ? "src/app/books/page.tsx" : `src/app/${medium}/page.tsx`], SPECS).areas)!;
      for (const core of E2E_CORE) {
        const files = areaFilter(core, plan)!.files;
        for (const c of critical) expect(files, `${medium} ${core} ${c}`).toContain(c);
      }
    }
  });

  it("every area is no filter: every project runs every spec file", () => {
    expect(areaPlan(SPECS, prAreas(["src/db/queries.ts"], SPECS).areas)).toBeNull();
  });
});

// The map names a component as a medium's only when nothing but that medium's
// routes import it, directly or through other components. A component that a
// shared screen starts using fails here, so it can't stay mapped to one medium.
describe("the components the map names as a medium's are only that medium's", () => {
  const walk = (d: string): string[] =>
    readdirSync(d).flatMap((f) => {
      const p = posix.join(d, f);
      return statSync(p).isDirectory() ? walk(p) : /\.(tsx?|mjs)$/.test(f) ? [p] : [];
    });
  const files = walk("src");
  const importsOf = new Map(
    files.map((f) => {
      const out: string[] = [];
      for (const m of readFileSync(f, "utf8").matchAll(/from\s+["']([^"']+)["']|import\(\s*["']([^"']+)["']\s*\)/g)) {
        const s = m[1] ?? m[2];
        const base = s.startsWith("@/") ? `src/${s.slice(2)}` : s.startsWith(".") ? posix.normalize(posix.join(dirname(f), s)) : null;
        const hit = base && [base, `${base}.ts`, `${base}.tsx`, `${base}/index.ts`, `${base}/index.tsx`].find((c) => files.includes(c));
        if (hit) out.push(hit);
      }
      return [f, out];
    }),
  );

  it("every route that reaches a named component belongs to its medium", () => {
    const named = Object.entries(MEDIUM_COMPONENTS).flatMap(([area, names]) => names.map((n) => [area, `src/components/${n}.tsx`]));
    expect(named.length).toBeGreaterThan(40);
    for (const [, file] of named) expect(files, file).toContain(file);
    const reachedBy = new Map<string, Set<string>>();
    for (const route of files.filter((f) => f.startsWith("src/app/"))) {
      const seen = new Set<string>();
      const stack = [route];
      while (stack.length > 0) {
        const f = stack.pop()!;
        if (seen.has(f)) continue;
        seen.add(f);
        stack.push(...(importsOf.get(f) ?? []));
      }
      for (const f of seen) reachedBy.set(f, (reachedBy.get(f) ?? new Set()).add(route));
    }
    for (const [area, file] of named) {
      for (const route of reachedBy.get(file) ?? []) expect(routeArea(route)?.area, `${file} is reached by ${route}`).toBe(area);
    }
  });

  it("names areas the suite has", () => {
    for (const area of Object.keys(MEDIUM_COMPONENTS)) expect(AREAS).toContain(area);
  });
});

// D-145 under 0.15: a docs-only push leans on an earlier run only when that run
// covered every area the PR needs now. An area run is never a full pass.
describe("coveredAreas: what an earlier run's shards covered (AC-4)", () => {
  const tests = { name: "tests", conclusion: "success" };
  const shards = (label: string, conclusion = "success") => [1, 2, 3].map((n) => ({ name: `e2e ${label} ${n}/3`, conclusion }));
  const runs = [{ id: 2, head_sha: "bbb2222" }];
  const docsSince = { isAncestor: () => true, changedSince: () => ["docs/tasks/TASK-135-x.md"] };

  it("reads every area, some areas, or no full pass from the shard names", () => {
    expect(coveredAreas([tests, ...shards("full")])).toBe("every");
    expect(coveredAreas([tests, ...shards("full comics")])).toEqual(["comics"]);
    expect(coveredAreas([tests, ...shards("full books+comics")])).toEqual(["books", "comics"]);
    expect(coveredAreas([tests, ...shards("core")])).toBeNull();
    expect(coveredAreas([tests, ...shards("core comics")])).toBeNull();
    expect(coveredAreas([tests, ...shards("full comics"), { name: "e2e full comics 4/4", conclusion: "failure" }])).toBeNull();
    expect(coveredAreas([tests])).toBeNull();
  });

  it("an area run does not count as having run every project", () => {
    expect(ranEveryProject([tests, ...shards("full comics")])).toBe(false);
    expect(ranEveryProject([tests, ...shards("full")])).toBe(true);
  });

  it("a docs-only push after a run that covered only some areas does not reuse it as a full pass", () => {
    const world = { ...docsSince, jobsOf: () => [tests, ...shards("full comics")] };
    expect(greenFullRunToReuse(runs, world, null)).toBeNull();
    expect(greenFullRunToReuse(runs, world)).toBeNull();
    expect(greenFullRunToReuse(runs, world, ["books", "comics"])).toBeNull();
  });

  it("it reuses an area run only for areas that run covered", () => {
    const world = { ...docsSince, jobsOf: () => [tests, ...shards("full books+comics")] };
    expect(greenFullRunToReuse(runs, world, ["comics"])?.run.id).toBe(2);
    expect(greenFullRunToReuse(runs, world, ["books", "comics"])?.run.id).toBe(2);
  });

  it("a run that covered every area is reused whatever areas the PR needs", () => {
    const world = { ...docsSince, jobsOf: () => [tests, ...shards("full")] };
    expect(greenFullRunToReuse(runs, world, ["comics"])?.run.id).toBe(2);
    expect(greenFullRunToReuse(runs, world, null)?.run.id).toBe(2);
  });
});

// The net under the map (0.15): every area, every project, nightly on main.
describe("ci.yml runs everything every night on main (AC-3)", () => {
  it("has a schedule trigger, which GitHub runs on the default branch", () => {
    expect(ci).toMatch(/\n {2}schedule:\n(?: {4}#.*\n)* {4}- cron: "0 8 \* \* \*"\n/);
  });

  it("a scheduled run gets no --base, so its scope is the full gate and every area", () => {
    expect(ciJob("scope")).toContain("github.event_name == 'pull_request' && format(");
    const dir = mkdtempSync(join(tmpdir(), "ci-scope-"));
    try {
      const out = join(dir, "output");
      const summary = join(dir, "summary");
      writeFileSync(out, "");
      writeFileSync(summary, "");
      const r = spawnSync(process.execPath, ["scripts/ci-scope.mjs"], {
        encoding: "utf8",
        env: { ...process.env, GITHUB_EVENT_NAME: "schedule", GITHUB_EVENT_PATH: "", GITHUB_OUTPUT: out, GITHUB_STEP_SUMMARY: summary },
      });
      expect(r.status, r.stderr).toBe(0);
      expect(readFileSync(out, "utf8")).toBe("full=true\ne2e_scope=full\nareas=\ne2e_label=full\n");
      expect(r.stdout).toContain("every area");
      expect(readFileSync(summary, "utf8")).toContain("**every area**");
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it("the nightly run has its own concurrency group, so it never queues behind or cancels main's push runs", () => {
    expect(ci).toContain("group: ci-${{ github.event_name == 'schedule' && 'nightly' || github.ref }}");
    expect(ci).toContain("cancel-in-progress: ${{ github.event_name == 'pull_request' }}");
  });
});
