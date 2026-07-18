import { describe, expect, it } from "vitest";
import { buildCycle, pickSettleIndex } from "./tickerMath";

describe("NameTicker helpers", () => {
  it("includes all names in cycle list", () => {
    expect(buildCycle(["a", "b"])).toEqual(["a", "b"]);
  });

  it("finds settle index for winner", () => {
    expect(pickSettleIndex(["甲", "乙", "丙"], "乙")).toBe(1);
  });
});
