import { describe, expect, it } from "vitest";
import { ROLL_MS, TICK_MS } from "./NameTicker";
import { buildCycle } from "./tickerMath";

describe("NameTicker helpers", () => {
  it("includes all names in cycle list", () => {
    expect(buildCycle(["a", "b"])).toEqual(["a", "b"]);
  });
});

describe("NameTicker timing constants", () => {
  it("settles 40ms after stop and ticks every 40ms", () => {
    expect(ROLL_MS).toBe(40);
    expect(TICK_MS).toBe(40);
  });
});
