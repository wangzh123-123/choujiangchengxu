import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { SETTLE_HOLD_MS, startSettleHold } from "./settleHold";

describe("startSettleHold", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  it("calls goWinner after 3000ms", () => {
    const goWinner = vi.fn();
    startSettleHold(goWinner);
    expect(SETTLE_HOLD_MS).toBe(3000);
    vi.advanceTimersByTime(2999);
    expect(goWinner).not.toHaveBeenCalled();
    vi.advanceTimersByTime(1);
    expect(goWinner).toHaveBeenCalledTimes(1);
  });

  it("cancel prevents goWinner", () => {
    const goWinner = vi.fn();
    const cancel = startSettleHold(goWinner);
    cancel();
    vi.advanceTimersByTime(5000);
    expect(goWinner).not.toHaveBeenCalled();
  });
});
