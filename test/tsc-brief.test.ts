import { describe, expect, it } from "vitest";
import { briefTsc, splitErrors } from "../scripts/lib/tsc-brief.mjs";

const error = (n: number) => `src/a.ts(${n},1): error TS2322: Type 'string' is not assignable to type 'number'.`;

describe("briefTsc (post-edit typecheck output)", () => {
  it("keeps an elaborated error together with its indented lines", () => {
    const out = [error(1), "  Types of property 'x' are incompatible.", "    Type 'a' is not 'b'.", error(2)].join("\r\n");
    expect(splitErrors(out)).toHaveLength(2);
    expect(splitErrors(out)[0]).toHaveLength(3);
  });

  it("prints every error when there are few", () => {
    const out = [error(1), error(2)].join("\n");
    expect(briefTsc(out)).toBe(out);
  });

  it("shows the first ten errors and counts the rest", () => {
    const out = Array.from({ length: 25 }, (_, i) => error(i + 1)).join("\n");
    const brief = briefTsc(out).split("\n");
    expect(brief).toHaveLength(11);
    expect(brief[9]).toBe(error(10));
    expect(brief[10]).toBe("... and 15 more (25 in all). Run npx tsc --noEmit for the full list.");
  });

  it("cuts a long elaboration after three lines", () => {
    const out = [error(1), "  one", "  two", "  three", "  four"].join("\n");
    expect(briefTsc(out)).toBe([error(1), "  one", "  two", "    ..."].join("\n"));
  });
});
