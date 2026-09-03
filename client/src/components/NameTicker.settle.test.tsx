import { act, cleanup, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { NameTicker, ROLL_MS, TICK_MS } from "./NameTicker";

describe("NameTicker settle delay", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });
  afterEach(() => {
    cleanup();
    vi.useRealTimers();
  });

  it("does not settle before ROLL_MS and freezes the current offset at ROLL_MS", () => {
    const onSettled = vi.fn();
    render(
      <NameTicker names={["甲", "乙", "丙"]} rolling stopping onSettled={onSettled} />,
    );

    expect(onSettled).not.toHaveBeenCalled();
    expect(document.querySelector(".ticker")).not.toHaveClass("settled");

    act(() => {
      vi.advanceTimersByTime(ROLL_MS - 1);
    });
    expect(onSettled).not.toHaveBeenCalled();

    act(() => {
      vi.advanceTimersByTime(1);
    });
    expect(onSettled).toHaveBeenCalledTimes(1);
    expect(onSettled).toHaveBeenCalledWith(1);
    expect(document.querySelector(".ticker")).toHaveClass("settled");
    expect(screen.getByText("乙")).toHaveClass("focus");

    act(() => {
      vi.advanceTimersByTime(TICK_MS);
    });
    expect(onSettled).toHaveBeenCalledTimes(1);
    expect(screen.getByText("乙")).toHaveClass("focus");
  });

  it("drops settled when rolling and stopping both become false after settle", () => {
    const { rerender } = render(
      <NameTicker names={["甲", "乙", "丙"]} rolling stopping />,
    );

    act(() => {
      vi.advanceTimersByTime(ROLL_MS);
    });
    expect(document.querySelector(".ticker")).toHaveClass("settled");

    rerender(<NameTicker names={["甲", "乙", "丙"]} rolling={false} stopping />);
    expect(document.querySelector(".ticker")).toHaveClass("settled");

    rerender(<NameTicker names={["甲", "乙", "丙"]} rolling={false} stopping={false} />);
    expect(document.querySelector(".ticker")).not.toHaveClass("settled");
  });
});
