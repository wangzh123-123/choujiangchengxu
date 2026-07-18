import { describe, it, expect } from "vitest";
import { listEligible } from "../src/domain/eligibility.js";
import { resolveWinner } from "../src/domain/draw.js";

describe("eligibility", () => {
  it("excludes prior winners", () => {
    const eligible = listEligible(
      [
        { id: "u1", name: "甲" },
        { id: "u2", name: "乙" },
      ],
      [{ prizeId: "p0", participantId: "u1", at: "t" }],
    );
    expect(eligible.map((e) => e.id)).toEqual(["u2"]);
  });
});

describe("resolveWinner", () => {
  it("uses preset when present", () => {
    expect(
      resolveWinner({
        presetId: "u1",
        eligibleIds: ["u1", "u2"],
        random: () => 0.9,
      }),
    ).toBe("u1");
  });

  it("picks randomly without preset", () => {
    expect(
      resolveWinner({
        presetId: null,
        eligibleIds: ["u1", "u2"],
        random: () => 0.6,
      }),
    ).toBe("u2");
  });
});
