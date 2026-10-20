// Task 1.8a (AC-1, AC-2, AC-3): scripts/check-tokens.mjs passes on the shipped
// files and fails, naming the check, when a value breaks a floor. Each case
// copies globals.css (and the mockup where noted) to a temp dir, breaks one
// thing, and runs the script against the copy with --globals / --mockups.
import { spawnSync } from "node:child_process";
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterAll, describe, expect, it } from "vitest";

const globals = readFileSync("src/app/globals.css", "utf8");
const mockups = readFileSync("design/mockups.html", "utf8");
const dir = mkdtempSync(join(tmpdir(), "check-tokens-"));
afterAll(() => rmSync(dir, { recursive: true, force: true }));

let n = 0;
function run(g: string, m: string = mockups) {
  const id = n++;
  const gp = join(dir, `globals-${id}.css`);
  const mp = join(dir, `mockups-${id}.html`);
  writeFileSync(gp, g);
  writeFileSync(mp, m);
  const r = spawnSync(process.execPath, ["scripts/check-tokens.mjs", "--globals", gp, "--mockups", mp], {
    encoding: "utf8",
  });
  return { status: r.status, out: (r.stdout ?? "") + (r.stderr ?? "") };
}

// Replace every occurrence (the dark values live in two blocks), and prove it changed something.
function swap(text: string, from: string, to: string): string {
  expect(text).toContain(from);
  return text.split(from).join(to);
}

describe("npm run test:tokens", () => {
  it("passes on the shipped globals.css and mockups.html", () => {
    const r = run(globals);
    expect(r.out).toContain("test:tokens");
    expect(r.status).toBe(0);
  });

  it("fails on elevation when dark --sunk is put back to #232935", () => {
    const r = run(swap(globals, "--sunk:#05060e", "--sunk:#232935"));
    expect(r.status).toBe(1);
    expect(r.out).toMatch(/elevation: dark/);
  });

  it("fails on outline contrast when light --faint-deco is #98a1b0", () => {
    const r = run(swap(globals, "--faint-deco:#878b9c", "--faint-deco:#98a1b0"));
    expect(r.status).toBe(1);
    expect(r.out).toMatch(/outline: light --faint-deco/);
  });

  it("fails on the 11px floor when globals.css gains a font-size:10px rule", () => {
    const r = run(globals + "\n.x{font-size:10px}\n");
    expect(r.status).toBe(1);
    expect(r.out).toMatch(/11px: globals\.css .*\.x/);
  });

  it("fails the 11px floor on a font shorthand, a rem size and an unresolvable em size", () => {
    expect(run(globals + "\n.a{font:600 10px/12px var(--sans)}\n").out).toMatch(/11px: globals\.css .*\.a/);
    expect(run(globals + "\n.b{font-size:.5625rem}\n").out).toMatch(/11px: globals\.css .*\.b/);
    expect(run(globals + "\n.c{font-size:.8em}\n").out).toMatch(/11px: globals\.css .*\.c.*unresolvable/);
  });

  it("applies the 11px floor to the mockup's <style> block", () => {
    const r = run(globals, mockups.replace("</style>", ".zz{font-size:.625rem}\n</style>"));
    expect(r.status).toBe(1);
    expect(r.out).toMatch(/11px: mockups\.html .*\.zz/);
  });

  it("accepts 11px and larger, and var(--fs-*) sizes", () => {
    const r = run(globals + "\n.ok1{font-size:11px}.ok2{font-size:.6875rem}.ok3{font:500 var(--fs-title) var(--display)}\n");
    expect(r.out).not.toMatch(/11px:/);
  });

  it("fails on text when light --muted drops under 4.5:1 on --sunk", () => {
    // #7a7e90 is about 3.6:1 on #e6e9f3.
    const r = run(swap(globals, "--muted:#5e6275; --faint:#5e6275", "--muted:#7a7e90; --faint:#5e6275"));
    expect(r.status).toBe(1);
    expect(r.out).toMatch(/text: light --muted #\w+ on --sunk/);
  });

  it("fails on a paired fill when light --ready-soft is darkened", () => {
    const r = run(swap(globals, "--ready-soft:#daf7e3", "--ready-soft:#7fd6a0"));
    expect(r.status).toBe(1);
    expect(r.out).toMatch(/fill: light --ready on --ready-soft/);
  });

  it("fails on glass when the worst case drops --brand under 4.5:1", () => {
    // Light glass over #000: a lighter --glass-bg alpha moves the composite darker.
    const r = run(swap(globals, "--glass-bg:rgba(255,255,255,0.9)", "--glass-bg:rgba(255,255,255,0.5)"));
    expect(r.status).toBe(1);
    expect(r.out).toMatch(/glass: light --\S+ #\w+ on glass/);
  });

  it("fails when a rule puts --ready text on glass", () => {
    const r = run(globals + "\n.gl{background:var(--glass-bg)}\n.gl .t{color:var(--ready)}\n");
    expect(r.status).toBe(1);
    expect(r.out).toMatch(/glass: .*--ready/);
  });
});
