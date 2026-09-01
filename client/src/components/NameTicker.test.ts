import { describe, expect, it } from "vitest";
import { ROLL_MS, TICK_MS } from "./NameTicker";
import { buildCycle, pickSettleIndex } from "./tickerMath";

describe("NameTicker helpers", () => {
  it("includes all names in cycle list", () => {
    expect(buildCycle(["a", "b"])).toEqual(["a", "b"]);
  });

  it("finds settle index for winner", () => {
    expect(pickSettleIndex(["甲", "乙", "丙"], "乙")).toBe(1);
  });
});

describe("NameTicker timing constants", () => {
  it("settles 800ms after winner is known and ticks every 40ms", () => {
    expect(ROLL_MS).toBe(800);
    expect(TICK_MS).toBe(40);
  });
});
