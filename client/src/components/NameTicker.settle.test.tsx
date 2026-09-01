import { act, cleanup, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { NameTicker, ROLL_MS } from "./NameTicker";

describe("NameTicker settle delay", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });
  afterEach(() => {
    cleanup();
    vi.useRealTimers();
  });

  it("does not settle before ROLL_MS and settles at ROLL_MS", () => {
    const onSettled = vi.fn();
    render(
      <NameTicker
        names={["甲", "乙", "丙"]}
        rolling
        settleName="乙"
        onSettled={onSettled}
      />,
    );

    expect(onSettled).not.toHaveBeenCalled();
    expect(document.querySelector(".ticker")).not.toHaveClass("settled");

    act(() => {
      vi.advanceTimersByTime(ROLL_MS - 1);
    });
    expect(onSettled).not.toHaveBeenCalled();
    expect(document.querySelector(".ticker")).not.toHaveClass("settled");

    act(() => {
      vi.advanceTimersByTime(1);
    });
    expect(onSettled).toHaveBeenCalledTimes(1);
    expect(document.querySelector(".ticker")).toHaveClass("settled");
    expect(screen.getByText("乙")).toHaveClass("focus");
  });
});
