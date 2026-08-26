import { describe, expect, it } from "vitest";
import { buildWinnerHistory, winnersForPrize } from "./winnerHistory";

describe("buildWinnerHistory", () => {
  it("lists all winners in draw order including current", () => {
    const rows = buildWinnerHistory(
      [
        { prizeId: "p1", participantId: "u1", at: "t1" },
        { prizeId: "p2", participantId: "u2", at: "t2" },
      ],
      [
        { id: "p1", name: "三等奖" },
        { id: "p2", name: "二等奖" },
      ],
      [
        { id: "u1", name: "甲" },
        { id: "u2", name: "乙" },
      ],
    );
    expect(rows).toEqual([
      { prizeName: "三等奖", winnerName: "甲" },
      { prizeName: "二等奖", winnerName: "乙" },
    ]);
  });
});

describe("winnersForPrize", () => {
  it("returns winners of one prize in draw order", () => {
    expect(
      winnersForPrize(
        [
          { prizeId: "p1", participantId: "u1" },
          { prizeId: "p2", participantId: "u2" },
          { prizeId: "p1", participantId: "u3" },
        ],
        "p1",
        [
          { id: "u1", name: "甲" },
          { id: "u3", name: "丙" },
        ],
      ).map((p) => p.name),
    ).toEqual(["甲", "丙"]);
  });
});

