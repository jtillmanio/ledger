// The books page used to render series.slice(0, 40) of 181 with no count and no
// way to the rest (R2 L-7).
import { describe, expect, it } from "vitest";
import { SERIES_SHOWN, seriesAllHref, seriesView } from "../src/lib/series-list";

const many = Array.from({ length: 181 }, (_, i) => i);

describe("books page series list", () => {
  it("cuts a long list but reports the true total", () => {
    const v = seriesView(many);
    expect(v.shown).toHaveLength(SERIES_SHOWN);
    expect(v.total).toBe(181);
    expect(v.cut).toBe(true);
  });

  it("shows every series with ?series=all", () => {
    const v = seriesView(many, "all");
    expect(v.shown).toHaveLength(181);
    expect(v.cut).toBe(false);
  });

  it("does not claim a cut when the list fits", () => {
    expect(seriesView(many.slice(0, 12)).cut).toBe(false);
  });

  it("keeps the book filters on the show-all link", () => {
    expect(seriesAllHref({ status: "read", q: "stormlight", genre: undefined }))
      .toBe("/books/list?status=read&q=stormlight&series=all");
  });
});
