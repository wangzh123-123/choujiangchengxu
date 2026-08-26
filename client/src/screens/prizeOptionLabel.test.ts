import { describe, expect, it } from "vitest";
import { prizeOptionLabel } from "./prizeOptionLabel";

describe("prizeOptionLabel", () => {
  it("uses name only for incomplete quantity 1", () => {
    expect(prizeOptionLabel({ name: "一等奖", drawnCount: 0, quantity: 1 })).toBe("一等奖");
  });

  it("marks complete quantity 1 as 已抽", () => {
    expect(prizeOptionLabel({ name: "一等奖", drawnCount: 1, quantity: 1 })).toBe("一等奖（已抽）");
  });

  it("shows a/b progress for incomplete quantity greater than 1", () => {
    expect(prizeOptionLabel({ name: "三等奖", drawnCount: 0, quantity: 3 })).toBe("三等奖（已抽 0/3）");
    expect(prizeOptionLabel({ name: "三等奖", drawnCount: 1, quantity: 3 })).toBe("三等奖（已抽 1/3）");
  });

  it("marks complete quantity greater than 1 as 已抽", () => {
    expect(prizeOptionLabel({ name: "三等奖", drawnCount: 3, quantity: 3 })).toBe("三等奖（已抽）");
  });
});
