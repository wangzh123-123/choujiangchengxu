import { describe, expect, it } from "vitest";
import { computeCanDraw } from "../src/domain/canDraw.js";

const prize = { id: "p1", quantity: 2 };

describe("computeCanDraw", () => {
  it("is false without a prize or when complete", () => {
    expect(computeCanDraw({ prize: null, winners: [], eligibleCount: 1, slots: [null, null] })).toBe(false);
    expect(
      computeCanDraw({
        prize,
        winners: [{ prizeId: "p1" }, { prizeId: "p1" }],
        eligibleCount: 3,
        slots: [null, null],
      }),
    ).toBe(false);
  });

  it("is true when the current slot is preset even if eligible is empty", () => {
    expect(
      computeCanDraw({
        prize,
        winners: [{ prizeId: "p1" }],
        eligibleCount: 0,
        slots: [null, "u9"],
      }),
    ).toBe(true);
  });

  it("is true when eligible remains and the slot is empty", () => {
    expect(
      computeCanDraw({
        prize,
        winners: [],
        eligibleCount: 2,
        slots: [null, null],
      }),
    ).toBe(true);
  });

  it("is false when eligible is empty and the current slot is empty", () => {
    expect(
      computeCanDraw({
        prize,
        winners: [],
        eligibleCount: 0,
        slots: [null, "u9"],
      }),
    ).toBe(false);
  });
});
