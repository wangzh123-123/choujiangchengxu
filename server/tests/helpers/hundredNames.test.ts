import { describe, expect, it } from "vitest";
import { hundredNames } from "./hundredNames.js";

describe("hundredNames", () => {
  it("returns 100 unique padded names", () => {
    const names = hundredNames();
    expect(names).toHaveLength(100);
    expect(names[0]).toBe("用户001");
    expect(names[9]).toBe("用户010");
    expect(names[99]).toBe("用户100");
    expect(new Set(names).size).toBe(100);
  });
});
