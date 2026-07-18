import { describe, expect, it } from "vitest";
import { publicViewPath, imageUrl } from "./client";

describe("api client helpers", () => {
  it("builds public view url", () => {
    expect(publicViewPath()).toBe("/api/public/view");
  });

  it("prefixes uploads path", () => {
    expect(imageUrl("a.png")).toBe("/uploads/a.png");
  });
});
