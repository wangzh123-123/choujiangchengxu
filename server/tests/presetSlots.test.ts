import { describe, expect, it } from "vitest";
import {
  clearParticipantFromPresets,
  normalizePresetSlots,
  presetSlotAt,
  resizePresetSlots,
  uniqueNonEmptyIds,
} from "../src/domain/presetSlots.js";

describe("normalizePresetSlots", () => {
  it("pads a legacy string into slot 0", () => {
    expect(normalizePresetSlots("u1", 3)).toEqual(["u1", null, null]);
  });

  it("pads and trims arrays; treats empty string as null", () => {
    expect(normalizePresetSlots(["a", ""], 3)).toEqual(["a", null, null]);
    expect(normalizePresetSlots(["a", "b", "c", "d"], 2)).toEqual(["a", "b"]);
    expect(normalizePresetSlots(undefined, 2)).toEqual([null, null]);
  });
});

describe("resizePresetSlots", () => {
  it("grows with nulls and shrinks from the end", () => {
    expect(resizePresetSlots(["a"], 3)).toEqual(["a", null, null]);
    expect(resizePresetSlots(["a", "b", "c"], 1)).toEqual(["a"]);
  });
});

describe("presetSlotAt / uniqueNonEmptyIds", () => {
  it("reads a slot and rejects duplicate ids", () => {
    expect(presetSlotAt(["a", null], 0)).toBe("a");
    expect(presetSlotAt(["a", null], 1)).toBeNull();
    expect(uniqueNonEmptyIds(["a", "b", null])).toBe(true);
    expect(uniqueNonEmptyIds(["a", "a"])).toBe(false);
  });
});

describe("clearParticipantFromPresets", () => {
  it("nulls matching slots and drops all-null prizes", () => {
    const next = clearParticipantFromPresets(
      { p1: ["u1", null], p2: ["u2", "u1"] },
      "u1",
    );
    expect(next).toEqual({ p2: ["u2", null] });
  });
});
