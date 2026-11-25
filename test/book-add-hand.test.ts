// Task 5.9b, 3 of 3 (TASK-142; F-38): a series page's gap row *Add* opens By hand with the series and its
// number filled. `handHref` writes the link; `handParam` is the page's reader, which treats the URL as untrusted
// (it may be shared or typed): a bad `n` leaves `#` empty, a missing or over-long series is no By hand start.
import { describe, expect, it } from "vitest";
import { handHref, handParam, MAX_POSITION } from "../src/lib/book-add";
import { MAX_FIELD } from "../src/lib/book-parse";

describe("handHref", () => {
  it("is Add books' own ?series= and ?n=, encoded", () => {
    expect(handHref("The Dark Tower", 6)).toBe("/books/add?series=The%20Dark%20Tower&n=6");
    expect(handHref("Mistborn & Co", 3)).toBe("/books/add?series=Mistborn%20%26%20Co&n=3");
  });

  it("round-trips through the reader, whatever the name holds", () => {
    for (const name of ["Mistborn & Co", "Ünïcode · Series #1", "50% off?", "a+b=c"]) {
      const url = new URL(handHref(name, 3), "http://x");
      expect(handParam(url.searchParams.get("series") ?? undefined, url.searchParams.get("n") ?? undefined))
        .toEqual({ series: name, position: "3" });
    }
  });
});

describe("handParam", () => {
  it("names the series and the number: By hand opens filled", () => {
    expect(handParam("The Dark Tower", "6")).toEqual({ series: "The Dark Tower", position: "6" });
  });

  it("no series means no By hand start, whatever `n` says (AC-4: with no new parameter Add books is as before)", () => {
    expect(handParam(undefined, undefined)).toBeNull();
    expect(handParam(undefined, "3")).toBeNull();
    expect(handParam("", "3")).toBeNull();
    expect(handParam("   ", "3")).toBeNull();
  });

  it("a series with no number leaves # empty", () => {
    expect(handParam("The Dark Tower", undefined)).toEqual({ series: "The Dark Tower", position: "" });
  });

  it("a number that isn't 0 to MAX_POSITION leaves # empty, and the series still opens By hand", () => {
    for (const n of ["abc", "-1", "1e3", "", " ", "3 4", String(MAX_POSITION + 1), "NaN", "Infinity", "0x10"]) {
      expect(handParam("S", n), n).toEqual({ series: "S", position: "" });
    }
    expect(handParam("S", ["1", "2"])).toEqual({ series: "S", position: "" });
  });

  it("0, a fraction and MAX_POSITION itself are numbers (the series page draws #0 and #2.5)", () => {
    expect(handParam("S", "0")).toEqual({ series: "S", position: "0" });
    expect(handParam("S", "2.5")).toEqual({ series: "S", position: "2.5" });
    expect(handParam("S", String(MAX_POSITION))).toEqual({ series: "S", position: String(MAX_POSITION) });
  });

  it("a repeated or over-long series is no By hand start; spaces collapse as the write's do", () => {
    expect(handParam(["a", "b"], "3")).toBeNull();
    expect(handParam("x".repeat(MAX_FIELD + 1), "3")).toBeNull();
    expect(handParam("  The   Dark  Tower ", "3")).toEqual({ series: "The Dark Tower", position: "3" });
  });
});
