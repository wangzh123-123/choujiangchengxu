import { describe, expect, it } from "vitest";
import { displayWinnerPrizeId, winnersForPrizeWithCommit } from "./committedDraw";

describe("displayWinnerPrizeId", () => {
  it("prefers committed prize id", () => {
    expect(
      displayWinnerPrizeId({ prizeId: "p1", participantId: "u1", name: "甲" }, "p2"),
    ).toBe("p1");
  });

  it("falls back when nothing committed", () => {
    expect(displayWinnerPrizeId(null, "p2")).toBe("p2");
  });
});

describe("winnersForPrizeWithCommit", () => {
  it("appends committed winner when public list omitted them", () => {
    expect(
      winnersForPrizeWithCommit(
        [{ prizeId: "p1", participantId: "u2" }],
        "p1",
        [{ id: "u2", name: "李四" }],
        { prizeId: "p1", participantId: "u1", name: "张三" },
      ).map((p) => p.name),
    ).toEqual(["李四", "张三"]);
  });

  it("does not duplicate an already listed committed winner", () => {
    expect(
      winnersForPrizeWithCommit(
        [{ prizeId: "p1", participantId: "u1" }],
        "p1",
        [{ id: "u1", name: "甲" }],
        { prizeId: "p1", participantId: "u1", name: "甲" },
      ),
    ).toEqual([{ id: "u1", name: "甲" }]);
  });
});
