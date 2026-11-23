// What the browser suite (task 0.11, D-72) runs against: `next dev` on the TEST
// database, signed in with a passcode of its own. Decided here so the wrapper
// (scripts/e2e.mjs) and playwright.config.ts agree, and so it can be tested
// without a browser. Like every test, it reads TEST_DATABASE_URL and nothing
// else, and never falls back to DATABASE_URL (testdb.mjs).
import { checkTestUrl } from "./testdb.mjs";
import { parseShard } from "./e2e-shards.mjs";

// The default port. Not 3000, which is the owner's `npm run dev`. A worktree
// gets its own from scripts/worktree-slot.mjs (E2E_PORT in .env.worktree,
// 3200 and up, past every ui-verifier port, 3100 + a task number mod 100), so
// two sessions' suites never fight over one server.
export const E2E_PORT = 3199;

/** The suite's port: E2E_PORT when set, else the default; an error for anything else. */
export function e2ePort(env) {
  if (env.E2E_PORT === undefined || env.E2E_PORT === "") return { port: E2E_PORT };
  const port = Number(env.E2E_PORT);
  if (!Number.isInteger(port) || port < 1024 || port > 65535) {
    return { error: `E2E_PORT is "${env.E2E_PORT}": use a whole number from 1024 to 65535.` };
  }
  return { port };
}
// Fixed and public: the suite's server, never the owner's APP_PASSCODE.
export const E2E_PASSCODE = "e2e-passcode";
export const E2E_USER = "e2e-user";
// Not a token: Hardcover refuses it, so a search the cache can't answer shows the error state.
export const E2E_HARDCOVER_TOKEN = "e2e-not-a-hardcover-token";
// `next dev`'s output and Turbopack cache, relative to where the server runs.
// A stale one makes the sign-in page reload in a Fast Refresh loop until the
// setup project times out (TASK-015; again on 2026-10-27), so a dev run starts
// without it. `next start` serves the `next build` output in .next and never
// reads this folder.
export const DEV_CACHE = ".next/dev";

// The projects a screen is checked in: the six `ui.viewports` in
// .claude/kit.json, light and dark (D-33), then the reduced-motion and touch
// checks (the feel pass, D-40).
const WIDTHS = [[360, 780], [390, 844], [412, 915], [768, 1024], [1024, 768], [1280, 800]];
export const E2E_PROJECTS = [
  ...WIDTHS.flatMap(([width, height]) =>
    ["light", "dark"].map((colorScheme) => ({ name: `w${width}-${colorScheme}`, use: { viewport: { width, height }, colorScheme } })),
  ),
  { name: "w390-reduced-motion", use: { viewport: { width: 390, height: 844 }, reducedMotion: "reduce" } },
  { name: "w390-touch", use: { viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true } },
];

// The core scope: a phone in both themes, the tablet, the desktop, reduced
// motion and touch. What a local run (and /verify) checks; CI's full run is the gate.
export const E2E_CORE = ["w390-light", "w390-dark", "w768-light", "w1280-light", "w390-reduced-motion", "w390-touch"];

// Each test runs where what it checks can change (D-161, amending D-143). A
// project varies one thing: the width, the theme, the motion or the pointer.
//
// An untagged test checks what a screen does (a write, a request, the URL,
// focus and the keys, its copy, a toast and its Undo). The theme changes none
// of that, and 360 and 412 are 390's layout (no breakpoint between 360 and
// 768), so it runs on the phone, the tablet and the desktop, with reduced
// motion and with touch.
export const E2E_BEHAVIOUR = ["w390-light", "w768-light", "w1280-light", "w390-reduced-motion", "w390-touch"];

// `@floor`: the test checks how the screen fits or looks (the UX floor: axe,
// contrast, sizes and positions, sideways scroll, markup a layout could change).
// It runs at every layout, light: 360 (the tightest phone), 390, 768, 1024 (a
// layout of its own, D-33) and 1280. It needs no dark project: `contrastFailures`
// and `screenshot` check the page in both themes, switching the colour scheme in
// place. Not with reduced motion or touch (D-167): reduced motion changes motion
// and no layout or colour, and both share w390-light's viewport. A floor or feel
// test that reads the project's own motion setting or pointer says so with
// `@motion` or `@touch`.
export const FLOOR_TAG = "@floor";
export const E2E_FLOOR = ["w360-light", "w390-light", "w768-light", "w1024-light", "w1280-light"];

// `@motion`: the test also runs at w390-reduced-motion, where an untagged one
// does already. For a `@floor` or `@feel` test whose assertions read the
// project's `prefers-reduced-motion` (so the reduced branch runs only there).
// An `@at-` tag still wins.
export const MOTION_TAG = "@motion";
export const MOTION_PROJECT = "w390-reduced-motion";
// `@touch`: the same for w390-touch, for a `@floor` or `@feel` test that needs
// the coarse pointer (controls a hover hides at rest are drawn there).
export const TOUCH_TAG = "@touch";
export const TOUCH_PROJECT = "w390-touch";

// `@feel`: a feel-pass surface screenshotted in its states, which design §10
// asks for at every width, 412 too (D-40): `@floor`'s projects and w412-light.
export const FEEL_TAG = "@feel";
export const E2E_FEEL = ["w360-light", "w390-light", "w412-light", "w768-light", "w1024-light", "w1280-light"];

// Every spec belongs to one area (roadmap 0.15, task 0.15): the part of the
// app it checks. A medium's area is its own screens; `shared` is the shell,
// the thumb bar, the status control, Add books, settings, the sheets and every
// other control more than one medium uses. Watch, music and games have no
// specs yet: their areas are where 8.8, 9.3 and 10.1 land.
export const AREAS = ["books", "comics", "watch", "music", "games", "shared"];

// A spec says its area in one line of its own text, `// @area: comics`, so
// this file, playwright.config.ts and the CI scope read it without loading
// the spec, and no file moves (shard-times.json keys stay as they are).
const AREA_LINE = /^\/\/ @area:(.*)$/gm;

/** `{ area }` from a spec's text, or `{ error }`: no area line, more than one area, or one not in AREAS. */
export function specArea(text) {
  const names = [...text.matchAll(AREA_LINE)].flatMap((m) => m[1].split(/[\s,]+/).filter(Boolean));
  if (names.length === 0) return { error: `no area: add a line "// @area: <area>", one of ${AREAS.join(", ")}` };
  if (names.length > 1) return { error: `${names.length} areas (${names.join(", ")}): a spec belongs to exactly one` };
  if (!AREAS.includes(names[0])) return { error: `"${names[0]}" is not an area: use one of ${AREAS.join(", ")}` };
  return { area: names[0] };
}

/** One message per spec file whose area is missing, doubled or unknown, each naming the file. */
export function areaProblems(specs) {
  return specs.flatMap(({ file, text }) => {
    const r = specArea(text);
    return "error" in r ? [`${file}: ${r.error}`] : [];
  });
}

// `@critical`: the small set that runs whatever the areas, at the core
// projects: sign-in, each medium's dashboard loading, the add flow, a status
// write and its Undo, the navigation between media, an error state. A
// critical test carries no `@floor` or `@feel` and any `@at-` tag on it names
// a core project, so its own tags (D-161) never send it past E2E_CORE.
export const CRITICAL_TAG = "@critical";

/** Whether a spec's text tags any test (or describe) `@critical`. */
export function hasCritical(text) {
  return text.includes(`"${CRITICAL_TAG}"`);
}

/**
 * E2E_AREAS: `{ areas: null }` when unset or empty (every area, as before
 * 0.15), `{ areas }` for a comma-separated list of AREAS, `{ error }` for a
 * name that is not one.
 */
export function parseAreas(value) {
  if (value === undefined || value.trim() === "") return { areas: null };
  const areas = [...new Set(value.split(",").map((a) => a.trim()).filter(Boolean))];
  const bad = areas.filter((a) => !AREAS.includes(a));
  if (bad.length > 0) return { error: `E2E_AREAS is "${value}": ${bad.join(", ")} is not an area; use a comma-separated list of ${AREAS.join(", ")}.` };
  return { areas };
}

/**
 * Which spec files an areas setting plans: `selected`, the files of those
 * areas, and `critical`, the other files that hold a `@critical` test. A spec
 * with no area, or a bad one, counts as selected: the plan fails toward
 * running a spec, never toward dropping it (e2e-guard fails it anyway).
 * null when `areas` is null: no filter.
 */
export function areaPlan(specs, areas) {
  if (areas === null) return null;
  const selected = [];
  const critical = [];
  for (const { file, text } of specs) {
    const r = specArea(text);
    if ("error" in r || areas.includes(r.area)) selected.push(file);
    else if (hasCritical(text)) critical.push(file);
  }
  return { selected: selected.sort(), critical: critical.sort() };
}

const escapeRegExp = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

/**
 * What one project runs under an area plan: `files`, its spec files, and for
 * a core project with critical-only files a `grepInvert` that drops every test
 * of those files but the `@critical` ones. Every project runs the selected
 * files; only a core project adds the critical ones. null for no plan: the
 * project runs every spec file, as before 0.15.
 *
 * The grepInvert reads Playwright's grep title, `<project> <file> <describe…>
 * <title> <tags…>` (createProjectSuite filters before the project joins the
 * root, so nothing comes before the project's name), where <file> is the
 * spec's path under test/e2e.
 */
export function areaFilter(project, plan) {
  if (plan === null) return null;
  if (!E2E_CORE.includes(project) || plan.critical.length === 0) return { files: plan.selected };
  return {
    files: [...plan.selected, ...plan.critical].sort(),
    grepInvert: new RegExp(`^(?!.*${CRITICAL_TAG}(?![\\w-]))\\S+ (?:[^ ]*[\\\\/])?(?:${plan.critical.map(escapeRegExp).join("|")}) `),
  };
}

/**
 * The projects a scope runs, each with the grep that picks its tests. An
 * untagged test runs in E2E_BEHAVIOUR, one tagged `@floor` in E2E_FLOOR, one
 * tagged `@feel` in E2E_FEEL, each cut to the scope's projects. One tagged
 * `@at-<project>` runs only there (an `@at-` tag wins over the others), and
 * nowhere when the scope leaves that project out; a dark project runs only
 * those. Playwright filters on the title path plus every tag (a describe's
 * too) before it schedules anything, so a test filtered out never opens a page
 * or runs a hook.
 */
export function e2eProjects(scope) {
  const only = (tag) => new RegExp(`^(?!.*@at-).*${tag}(?![\\w-])`);
  const untagged = new RegExp(`^(?!.*@at-)(?!.*${FLOOR_TAG}(?![\\w-]))(?!.*${FEEL_TAG}(?![\\w-]))`);
  return E2E_PROJECTS.filter((p) => scope === "full" || E2E_CORE.includes(p.name)).map((p) => ({
    ...p,
    grep: [
      ...(E2E_BEHAVIOUR.includes(p.name) ? [untagged] : []),
      ...(E2E_FLOOR.includes(p.name) ? [only(FLOOR_TAG)] : []),
      ...(E2E_FEEL.includes(p.name) ? [only(FEEL_TAG)] : []),
      ...(p.name === MOTION_PROJECT ? [only(MOTION_TAG)] : []),
      ...(p.name === TOUCH_PROJECT ? [only(TOUCH_TAG)] : []),
      new RegExp(`@at-${p.name}(?![\\w-])`),
    ],
  }));
}

/**
 * `{ error }` when TEST_DATABASE_URL is unset or names the same database as
 * DATABASE_URL (testdb.mjs's own message), else the environment the dev server
 * runs in, the command that starts it and where it listens. The Playwright
 * process itself keeps DATABASE_URL as it was: testdb.mjs needs both to tell
 * them apart.
 *
 * E2E_SERVER picks the server: `dev` (the default, what a local run uses) or
 * `start`, the production server over an existing `next build`, which CI's
 * shards use so no route is compiled on its first request.
 *
 * E2E_SCOPE picks the projects: `core` (the default, E2E_CORE) or `full`,
 * every project, which CI runs.
 *
 * E2E_SHARD, n/N (CI's shards, D-167), makes playwright.config.ts run only the
 * spec files shard n of N holds, balanced by recorded time (e2e-shards.mjs); unset
 * runs them all. It stands in for Playwright's own `--shard`.
 *
 * E2E_PORT picks where the server listens (e2ePort): a worktree's comes from
 * .env.worktree, so two sessions' suites can run at once.
 *
 * E2E_AREAS picks the areas (parseAreas, roadmap 0.15): their spec files, plus
 * the `@critical` tests at the core projects (areaPlan, areaFilter). Unset,
 * every spec file runs, as before.
 *
 * clear is the folder the wrapper deletes before Playwright starts: DEV_CACHE
 * for a dev server, null for `next start`.
 */
export function planE2e(env) {
  const error = checkTestUrl(env.TEST_DATABASE_URL, env.DATABASE_URL);
  if (error) return { error };
  const mode = env.E2E_SERVER || "dev";
  if (mode !== "dev" && mode !== "start") return { error: `E2E_SERVER is "${mode}": use dev or start.` };
  const scope = env.E2E_SCOPE || "core";
  if (scope !== "core" && scope !== "full") return { error: `E2E_SCOPE is "${scope}": use core or full.` };
  const { port, error: portError } = e2ePort(env);
  if (portError) return { error: portError };
  const shard = parseShard(env.E2E_SHARD);
  if (shard && "error" in shard) return { error: shard.error };
  const { areas, error: areasError } = parseAreas(env.E2E_AREAS);
  if (areasError) return { error: areasError };
  return {
    scope,
    areas,
    clear: mode === "dev" ? DEV_CACHE : null,
    serverCommand: `npx next ${mode} --port ${port}`,
    serverEnv: {
      DATABASE_URL: env.TEST_DATABASE_URL,
      APP_PASSCODE: E2E_PASSCODE,
      SESSION_SECRET: "e2e-only-secret",
      OWNER_ID: E2E_USER,
      // Add books' Hardcover search runs its real cache path (task 1.4f): the
      // spec seeds hardcover_cache with recorded answers. A placeholder, so a
      // local run never reads the owner's real token out of .env.
      HARDCOVER_API_TOKEN: E2E_HARDCOVER_TOKEN,
    },
    baseUrl: `http://localhost:${port}`,
  };
}
