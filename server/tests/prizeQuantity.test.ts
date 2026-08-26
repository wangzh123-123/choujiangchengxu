import { describe, expect, it } from "vitest";
import {
  drawnCountForPrize,
  isPrizeComplete,
  normalizePrize,
  prizeQuantity,
} from "../src/domain/prizeQuantity.js";

describe("prizeQuantity", () => {
  it("defaults missing or invalid to 1", () => {
    expect(prizeQuantity({})).toBe(1);
    expect(prizeQuantity({ quantity: 0 })).toBe(1);
    expect(prizeQuantity({ quantity: 1.5 })).toBe(1);
    expect(prizeQuantity({ quantity: 3 })).toBe(3);
  });
});

describe("normalizePrize", () => {
  it("writes quantity 1 when absent", () => {
    const p = normalizePrize({ id: "p1", name: "A", imagePath: "x", order: 0 });
    expect(p.quantity).toBe(1);
  });
});

describe("drawnCountForPrize / isPrizeComplete", () => {
  const winners = [
    { prizeId: "p1" },
    { prizeId: "p1" },
    { prizeId: "p2" },
  ];
  it("counts per prize and compares to quantity", () => {
    expect(drawnCountForPrize(winners, "p1")).toBe(2);
    expect(isPrizeComplete(winners, "p1", 3)).toBe(false);
    expect(isPrizeComplete(winners, "p1", 2)).toBe(true);
    expect(isPrizeComplete(winners, "p3", 1)).toBe(false);
  });
});
