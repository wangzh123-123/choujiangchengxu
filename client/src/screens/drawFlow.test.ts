import { describe, expect, it } from "vitest";
import { afterHoldAction, isComplete, startRollError } from "./drawFlow";

describe("startRollError", () => {
  it("requires a current prize", () => {
    expect(startRollError({ currentPrizeId: null, prizeComplete: false, canDraw: true })).toBe(
      "未选择当前奖品，无法开奖",
    );
  });

  it("rejects a complete prize", () => {
    expect(startRollError({ currentPrizeId: "p1", prizeComplete: true, canDraw: false })).toBe(
      "该奖品已抽完",
    );
  });

  it("rejects when nobody can be drawn", () => {
    expect(startRollError({ currentPrizeId: "p1", prizeComplete: false, canDraw: false })).toBe(
      "没有可抽奖用户",
    );
  });

  it("allows a startable prize", () => {
    expect(startRollError({ currentPrizeId: "p1", prizeComplete: false, canDraw: true })).toBeNull();
  });
});

describe("afterHoldAction", () => {
  it("stays on draw when the prize is not complete", () => {
    expect(afterHoldAction(false)).toBe("stay");
  });

  it("goes to winner when the prize is complete", () => {
    expect(afterHoldAction(true)).toBe("winner");
  });
});

describe("isComplete", () => {
  it("is true when drawnCount reaches quantity", () => {
    expect(isComplete(0, 3)).toBe(false);
    expect(isComplete(2, 3)).toBe(false);
    expect(isComplete(3, 3)).toBe(true);
    expect(isComplete(1, 1)).toBe(true);
  });
});
