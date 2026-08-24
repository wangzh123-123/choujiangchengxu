import { describe, expect, it } from "vitest";
import { shouldIgnoreScreenNav } from "./screenNav";

describe("shouldIgnoreScreenNav", () => {
  it("ignores when target equals visual screen", () => {
    expect(shouldIgnoreScreenNav("draw", "draw")).toBe(true);
    expect(shouldIgnoreScreenNav("prize", "prize")).toBe(true);
  });

  it("does not ignore when switching to another screen", () => {
    expect(shouldIgnoreScreenNav("winner", "draw")).toBe(false);
    expect(shouldIgnoreScreenNav("enroll", "draw")).toBe(false);
    expect(shouldIgnoreScreenNav("draw", "prize")).toBe(false);
  });
});
