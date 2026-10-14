// The post-edit typecheck (.claude/kit.json verify.fast): the whole project,
// like `npx tsc --noEmit`, with the same exit code, but only the first errors
// printed. Shortening is in scripts/lib/tsc-brief.mjs. /verify still runs the
// full typecheck.
import { spawnSync } from "node:child_process";
import { briefTsc } from "./lib/tsc-brief.mjs";

const r = spawnSync("npx tsc --noEmit --pretty false", { shell: true, encoding: "utf8" });
const output = (r.stdout ?? "") + (r.stderr ?? "");
if (r.status !== 0) {
  console.error(briefTsc(output));
  process.exit(r.status ?? 1);
}
