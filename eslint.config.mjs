import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

// eslint-config-next 16 ships flat configs, so they are spread directly; the
// FlatCompat wrapper 15 needed fails on them.
export default defineConfig([
  ...nextVitals,
  ...nextTs,
  // design/ holds reference specs, not app code; support.js there is the
  // generated Claude Design runtime and is kept exactly as delivered (D-31).
  // scripts/perf has its own dependencies (task 0.10), installed only by the
  // Lighthouse workflow. .claude/ holds the kit, and task worktrees under
  // .claude/worktrees/ are whole copies of the repo.
  globalIgnores([".next/**", "node_modules/**", "scripts/perf/node_modules/**","drizzle/**", "seed/**", "design/**", "next-env.d.ts", ".claude/**"]),
]);
