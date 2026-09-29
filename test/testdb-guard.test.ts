import { describe, expect, it } from "vitest";
import { checkTestUrl, dbIdentity } from "../scripts/lib/testdb.mjs";

const live = "postgresql://u:p@ep-live-pooler.us-east-2.aws.neon.tech/reading?sslmode=require";

describe("test database guard (R3-02)", () => {
  it("refuses when TEST_DATABASE_URL is unset", () => {
    expect(checkTestUrl(undefined, live)).toMatch(/not set/);
    expect(checkTestUrl("", live)).toMatch(/not set/);
  });

  it("refuses the live database, however the URL is spelled", () => {
    expect(checkTestUrl(live, live)).toMatch(/same database/);
    expect(checkTestUrl("postgresql://other:x@EP-LIVE-POOLER.us-east-2.aws.neon.tech:5432/reading", live))
      .toMatch(/same database/);
  });

  it("accepts a different host, or a different database on the same host", () => {
    expect(checkTestUrl("postgresql://postgres@localhost:5432/ledger_test", live)).toBeNull();
    expect(checkTestUrl("postgresql://u:p@ep-live-pooler.us-east-2.aws.neon.tech/reading_test", live)).toBeNull();
  });

  it("rejects a value that is not a URL", () => {
    expect(dbIdentity("not a url")).toBeNull();
    expect(checkTestUrl("not a url", live)).toMatch(/not a valid/);
  });
});
