// The one place that decides which database a test may touch (R3-02, D-R3-2).
//
// Tests TRUNCATE. The live ledger is a Neon database whose URL sits in the same
// .env, so the rule is structural: tests read TEST_DATABASE_URL and nothing
// else, and refuse when it is unset or points at the same host and database as
// DATABASE_URL. Nothing here ever falls back to DATABASE_URL.

/** "host/dbname" of a postgres URL, lower-cased; null when it does not parse. */
export function dbIdentity(url) {
  try {
    const u = new URL(url);
    return `${u.hostname}:${u.port || "5432"}${u.pathname}`.toLowerCase();
  } catch {
    return null;
  }
}

/** Returns an error message, or null when `testUrl` is safe to write to. */
export function checkTestUrl(testUrl, liveUrl) {
  if (!testUrl) {
    return "TEST_DATABASE_URL is not set. Tests never fall back to DATABASE_URL; see START-HERE 'Test database'.";
  }
  const t = dbIdentity(testUrl);
  if (!t) return "TEST_DATABASE_URL is not a valid postgres URL.";
  if (liveUrl && dbIdentity(liveUrl) === t) {
    return "TEST_DATABASE_URL points at the same database as DATABASE_URL. Refusing: tests truncate.";
  }
  return null;
}

/** Throws unless TEST_DATABASE_URL is safe; returns it otherwise. */
export function requireTestUrl(env = process.env) {
  const problem = checkTestUrl(env.TEST_DATABASE_URL, env.DATABASE_URL);
  if (problem) throw new Error(problem);
  return env.TEST_DATABASE_URL;
}

/** Load .env into process.env without overriding what is already set. */
export function loadDotEnv(file = ".env") {
  try {
    process.loadEnvFile(file);
  } catch (e) {
    if (e && e.code !== "ENOENT") throw e;
  }
}
