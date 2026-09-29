// Runs once before any test file. Fails the whole run, loudly, unless there is a
// safe TEST_DATABASE_URL (R3-02): a suite that can truncate must never guess.
import { loadDotEnv, requireTestUrl } from "../scripts/lib/testdb.mjs";

export default function setup() {
  loadDotEnv();
  requireTestUrl();
}
