import { describe, expect, it } from "vitest";
import { nextIncompletePrizeId } from "../src/domain/nextPrize.js";

const prizes = [
  { id: "p2", name: "二", imagePath: "b.png", order: 1, quantity: 1 },
  { id: "p1", name: "一", imagePath: "a.png", order: 0, quantity: 1 },
  { id: "p3", name: "三", imagePath: "c.png", order: 2, quantity: 2 },
];

describe("nextIncompletePrizeId", () => {
  it("returns the next prize by order", () => {
    expect(nextIncompletePrizeId(prizes, [{ prizeId: "p1" }], "p1")).toBe("p2");
  });

  it("skips already complete prizes", () => {
    expect(
      nextIncompletePrizeId(prizes, [{ prizeId: "p1" }, { prizeId: "p2" }], "p1"),
    ).toBe("p3");
  });

  it("returns null at the end of the list", () => {
    expect(
      nextIncompletePrizeId(
        prizes,
        [{ prizeId: "p1" }, { prizeId: "p2" }, { prizeId: "p3" }, { prizeId: "p3" }],
        "p3",
      ),
    ).toBeNull();
  });

  it("returns null when current prize is missing", () => {
    expect(nextIncompletePrizeId(prizes, [], "missing")).toBeNull();
  });

  it("treats missing quantity as 1", () => {
    const noQty = [
      { id: "a", name: "A", imagePath: "a.png", order: 0 },
      { id: "b", name: "B", imagePath: "b.png", order: 1 },
    ];
    expect(nextIncompletePrizeId(noQty, [{ prizeId: "a" }], "a")).toBe("b");
  });
});
