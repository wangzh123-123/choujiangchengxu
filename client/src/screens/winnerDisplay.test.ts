import { describe, expect, it } from "vitest";
import { winnerScreenPrizeId } from "./winnerDisplay";

describe("winnerScreenPrizeId", () => {
  it("shows current prize when it is complete", () => {
    expect(
      winnerScreenPrizeId({
        currentPrizeId: "p1",
        lastWinnerPrizeId: "p1",
        currentPrizeComplete: true,
      }),
    ).toBe("p1");
  });

  it("shows last winner prize when current prize already advanced", () => {
    expect(
      winnerScreenPrizeId({
        currentPrizeId: "p2",
        lastWinnerPrizeId: "p1",
        currentPrizeComplete: false,
      }),
    ).toBe("p1");
  });

  it("shows current prize when last winner is missing", () => {
    expect(
      winnerScreenPrizeId({
        currentPrizeId: "p2",
        lastWinnerPrizeId: null,
        currentPrizeComplete: false,
      }),
    ).toBe("p2");
  });

  it("shows current complete prize even if last winner is a different prize", () => {
    expect(
      winnerScreenPrizeId({
        currentPrizeId: "p1",
        lastWinnerPrizeId: "p2",
        currentPrizeComplete: true,
      }),
    ).toBe("p1");
  });
});
