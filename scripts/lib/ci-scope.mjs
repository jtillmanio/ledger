// Which CI steps a pull request's changed files need, as a pure function.
// scripts/ci-scope.mjs feeds it the real diff; test/ci-scope.test.ts feeds it fixtures.
import { AREAS, specArea } from "./e2e.mjs";

/**
 * Paths no browser test and no `next build` reads: the nightly backup, docs,
 * Claude config and root-level markdown. design/ is not here (the e2e suite
 * reads design/mockups.html and design/mockups-index.md), nor is .github/
 * (a changed workflow has to be exercised by the workflow it changed).
 * This is narrower than scripts/lib/release.mjs's NO_BUILD on purpose: that
 * list answers "does Vercel deploy it", this one "can the slow steps catch it".
 */
const NO_BROWSER_OR_BUILD = [/^backups\//, /^docs\//, /^\.claude\//, /^[^/]+\.md$/i];

/**
 * True when every path is one the browser suite and the build never read
 * (an empty list is trivially docs-only; callers decide what nothing means).
 * scripts/verify-docs.mjs uses the same line for the local check (D-145).
 */
export function isDocsOnly(files) {
  return files.every((f) => NO_BROWSER_OR_BUILD.some((re) => re.test(f)));
}

/**
 * True when the browser suite and `npm run build` should run. An empty list
 * runs them: with nothing to compare, the safe answer is the full gate.
 */
export function needsBrowserAndBuild(files) {
  return files.length === 0 || !isDocsOnly(files);
}

/**
 * A browser-suite shard that checked every project, as ci.yml names it:
 * `e2e full n/m` for every area, `e2e full <area>+<area> n/m` for some (0.15).
 */
const FULL_SHARD = /^e2e full(?: ([a-z]+(?:\+[a-z]+)*))? \d+\/\d+$/;

/**
 * What a CI run's browser suite covered and passed at the full scope:
 * "every" (every area), the areas it ran (an area run, 0.15), or null when no
 * full-scope shard ran or one of them did not pass. A draft's core run
 * (`e2e core …`) and a run that skipped the suite (its shard keeps the
 * unexpanded `${{ … }}` name) cover nothing.
 */
export function coveredAreas(jobs) {
  const shards = jobs.filter((j) => FULL_SHARD.test(j.name));
  if (shards.length === 0 || !shards.every((j) => j.conclusion === "success")) return null;
  const labels = new Set(shards.map((j) => FULL_SHARD.exec(j.name)[1] ?? ""));
  if (labels.has("")) return "every";
  return [...new Set([...labels].flatMap((l) => l.split("+")))].sort();
}

/** True when a CI run's browser suite passed every project of every area. */
export function ranEveryProject(jobs) {
  return coveredAreas(jobs) === "every";
}

/**
 * The earlier run on this PR that lets a push skip the browser suite and the
 * build (D-145), or null. `runs` are the PR branch's successful CI runs,
 * newest first ({ id, head_sha }). The newest one whose head is still in the
 * history being tested and that passed at the full scope is the candidate; it
 * is reused only when it covered every area the PR needs now (`needed`, null
 * for every area: an area run is never a full pass, D-173) and every path that
 * differs between its head and the tree under test now is docs-only. That tree
 * is the PR merged into today's base, so code that reached the base since that
 * run also forces the full gate. If the newest such run is not reusable, no
 * older one is: its diff is wider still.
 *   jobsOf(id)        the run's jobs ({ name, conclusion })
 *   isAncestor(sha)   the commit is in the history under test
 *   changedSince(sha) paths that differ from the commit, or null if unknown
 */
export function greenFullRunToReuse(runs, { jobsOf, isAncestor, changedSince }, needed = null) {
  for (const run of runs) {
    if (!isAncestor(run.head_sha)) continue;
    const covered = coveredAreas(jobsOf(run.id));
    if (covered === null) continue;
    if (covered !== "every" && (needed === null || !needed.every((a) => covered.includes(a)))) return null;
    const files = changedSince(run.head_sha);
    return files !== null && isDocsOnly(files) ? { run, files } : null;
  }
  return null;
}

// Roadmap 0.15 (D-173): which areas of the browser suite a PR's changed paths
// can break. A medium's routes, components and specs select that medium;
// anything shared or unmapped selects every area. The map fails toward all,
// never toward none. Every PR runs the critical set at the core projects as
// well (areaPlan and areaFilter in e2e.mjs).

/**
 * A medium's routes, first match wins. Not `api/books/` or `api/shelves/`:
 * Add books, Paste and New shelf, which shared specs check, call them, so
 * they stay unmapped and select every area.
 */
const MEDIUM_ROUTES = [
  [/^src\/app\/comics\//, "comics", "a comics route"],
  [/^src\/app\/api\/(?:runs|queue|metron)\//, "comics", "a comics API route"],
  [/^src\/app\/(?:books|book|parked|settings\/calibre)\//, "books", "a books route"],
  [/^src\/app\/@modal\/\(\.\)book\//, "books", "a books route"],
  [/^src\/app\/@modal\/\(\.\)comics\//, "comics", "a comics route"],
  [/^src\/app\/api\/(?:calibre|follows|listen-queue|parked|plan)\//, "books", "a books API route"],
  [/^src\/app\/watch\//, "watch", "a watch route"],
];

/**
 * The components only one medium's routes import (test/ci-scope.test.ts walks
 * the imports and fails when another route reaches one). Every other
 * component is shared, and so is a new one until it is named here. Add books
 * (AddBooks, AddBooksButton, ByHand, PasteBooks, BookSearch), NewShelf and
 * StartBook are only the books routes' too, but shared specs check them.
 */
export const MEDIUM_COMPONENTS = {
  comics: ["AddIssues", "InsertPreview", "IssueDetail", "IssueRecord", "IssueRow", "IssueSearch", "NextStrip", "QueueBadge", "QueueButton", "QueueList", "QueueShelf", "RunChip"],
  books: [
    "BetweenBooks", "BlockPopover", "BookDetail", "BookListSearch", "BookNote", "BookSheetActions", "BookShelves", "BookSort",
    "CalibreSyncLine", "ComingOutLine", "FinishBook", "GotIt", "GroupingBooks", "InlineText", "ListenNext", "OnDeckRow",
    "ParkedDone", "ParkedReviewLine", "ParkedRow", "PlaceThem", "PlanQuarter", "PlanQuarterRows", "PlanRail", "PlanSheet",
    "PlanShelf", "QuarterStrip", "QueueListen", "RailDrag", "RailStackSheet", "ReadAgain", "RebalanceSheet", "ReleaseDate",
    "SeriesBooks", "SeriesList", "SheetLinks", "ShelfBooks", "ShelfList", "TopBooks", "YearDecision",
  ],
};

/** Shared paths, named so the scope job can say which one chose every area. */
const SHARED = [
  [/^src\/db\//, "src/db/"],
  [/^src\/lib\//, "src/lib/"],
  [/^etl\/views\.sql$/, "etl/views.sql"],
  [/^src\/components\//, "a shared component"],
  [/^src\/app\/globals\.css$/, "globals.css"],
  [/^src\/proxy\.ts$/, "src/proxy.ts"],
  [/^package(?:-lock)?\.json$/, "package.json or the lockfile"],
  [/^next\.config\.[cm]?[jt]s$/, "the Next config"],
  [/^playwright\.config\.ts$/, "the Playwright config"],
  [/^test\/e2e\/helpers\.ts$/, "test/e2e/helpers.ts"],
  [/^\.github\//, ".github/"],
];

/** Paths no browser test reads: the docs-only ones, and the unit tests vitest and Python run. */
const NO_AREA = [[/^test\/[^/]+\.test\.tsx?$/, "a unit test"], [/^etl\/test_[^/]+\.py$/, "an ETL test"]];

/** `{ area, rule }` for a medium's route or component, or null. */
export function routeArea(path) {
  for (const [re, area, rule] of MEDIUM_ROUTES) if (re.test(path)) return { area, rule };
  const m = /^src\/components\/([^/]+)\.tsx$/.exec(path);
  for (const [area, names] of Object.entries(MEDIUM_COMPONENTS)) {
    if (m && names.includes(m[1])) return { area, rule: `a ${area} component` };
  }
  return null;
}

/** What one path selects: `{ area, rule }` (one area), `{ area: null, rule }` (every area), or `{ none, rule }`. */
function pathAreas(path, specAreas) {
  if (isDocsOnly([path])) return { none: true, rule: "docs" };
  for (const [re, rule] of NO_AREA) if (re.test(path)) return { none: true, rule };
  const spec = /^test\/e2e\/([^/]+\.spec\.ts)$/.exec(path);
  if (spec) {
    const area = specAreas.get(spec[1]);
    return area ? { area, rule: `a ${area} spec` } : { area: null, rule: "a spec no longer in the tree, or with no area" };
  }
  const medium = routeArea(path);
  if (medium) return medium;
  for (const [re, rule] of SHARED) if (re.test(path)) return { area: null, rule };
  return { area: null, rule: "unmapped" };
}

/**
 * For each repo path (without its extension) a spec file imports, the areas of
 * the specs that import it: a medium's screen a shared spec renders itself
 * (skeletons.spec.ts and the loading screens) selects shared too.
 */
function importedBy(specs, specAreas) {
  const byPath = new Map();
  for (const { file, text } of specs) {
    const area = specAreas.get(file);
    if (!area) continue;
    for (const m of text.matchAll(/from\s+["'](\.{1,2}\/[^"']+)["']/g)) {
      const parts = ["test", "e2e"];
      for (const seg of m[1].split("/")) {
        if (seg === "..") parts.pop();
        else if (seg !== ".") parts.push(seg);
      }
      const target = parts.join("/").replace(/\.(?:[cm]?[jt]sx?)$/, "");
      byPath.set(target, [...(byPath.get(target) ?? []), { area, spec: file }]);
    }
  }
  return byPath;
}

/**
 * The areas a PR's changed `files` select, from the specs in the tree
 * (`specs`, `{ file, text }` as test/e2e holds them): `areas`, in AREAS order,
 * or null for every area, and `why`, one `{ area, path, rule }` per choice
 * (area null: every area; path null: no single path).
 */
export function prAreas(files, specs) {
  const specAreas = new Map();
  for (const { file, text } of specs) {
    const r = specArea(text);
    if ("area" in r) specAreas.set(file, r.area);
  }
  const imports = importedBy(specs, specAreas);
  const why = [];
  for (const path of files) {
    const r = pathAreas(path, specAreas);
    if (r.none) continue;
    why.push({ area: r.area, path, rule: r.rule });
    if (r.area === null) continue;
    const bare = path.replace(/\.(?:[cm]?[jt]sx?)$/, "");
    for (const key of new Set([bare, bare.replace(/\/index$/, "")])) {
      for (const { area, spec } of imports.get(key) ?? []) {
        if (area !== r.area && !why.some((w) => w.area === area && w.path === path)) why.push({ area, path, rule: `imported by ${spec}` });
      }
    }
  }
  const every = why.filter((w) => w.area === null);
  if (every.length > 0) return { areas: null, why: every };
  if (why.length === 0) return { areas: null, why: [{ area: null, path: null, rule: "no changed file selects an area" }] };
  const chosen = new Set(why.map((w) => w.area));
  return { areas: AREAS.filter((a) => chosen.has(a)), why };
}

/**
 * The areas a CI run's browser suite checks: a PR's paths' (prAreas), or
 * every area for anything that is not a pull request (a push to main, the
 * nightly run), a PR labelled e2e:full, and a PR whose diff could not be read
 * (`files` null).
 */
export function areasForRun(eventName, payload, files, specs) {
  const every = (rule) => ({ areas: null, why: [{ area: null, path: null, rule }] });
  if (eventName !== "pull_request") return every(`not a pull request (${eventName ?? "unknown event"}): a push to main or the nightly run`);
  if ((payload?.pull_request?.labels ?? []).some((l) => l.name === FULL_E2E_LABEL)) return every(`labelled ${FULL_E2E_LABEL}`);
  if (files === null) return every("the diff could not be read");
  return prAreas(files, specs);
}

/** The shard name's middle: the scope, then the areas when not every one (`full`, `full books+comics`). */
export function e2eLabel(scope, areas) {
  return areas === null ? scope : `${scope} ${areas.join("+")}`;
}

/** The scope job's account of its choice, as markdown lines: the areas, then up to five paths each and the rule. */
export function describeAreas({ areas, why }) {
  const head = areas === null
    ? "Browser suite areas: **every area**."
    : `Browser suite areas: **${areas.join("**, **")}**, and the critical set at the core projects.`;
  const lines = [head];
  for (const area of areas === null ? [null] : areas) {
    const mine = why.filter((w) => w.area === area);
    const shown = mine.slice(0, 5).map((w) => (w.path ? `${w.path} (${w.rule})` : w.rule));
    if (mine.length > 5) shown.push(`and ${mine.length - 5} more`);
    lines.push(`- ${area ?? "every area"}: ${shown.join("; ")}`);
  }
  return lines;
}

// The label that asks a draft PR for the full browser suite (D-80).
export const FULL_E2E_LABEL = "e2e:full";

/**
 * How much of the browser suite a CI run checks (D-80), from the event that
 * started it ($GITHUB_EVENT_NAME and the payload at $GITHUB_EVENT_PATH):
 * `core` for a draft PR, `full` for a PR marked ready, one labelled e2e:full,
 * and anything that is not a PR (a push to main, which Release checks).
 */
export function e2eScope(eventName, payload) {
  if (eventName !== "pull_request") return "full";
  const pr = payload?.pull_request;
  if (!pr || !pr.draft) return "full";
  return (pr.labels ?? []).some((l) => l.name === FULL_E2E_LABEL) ? "full" : "core";
}
