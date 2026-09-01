import type { ComponentProps } from "react";
import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { HostControlBar } from "./HostControlBar";

const noop = () => undefined;

function barProps(patch: Partial<ComponentProps<typeof HostControlBar>> = {}): ComponentProps<typeof HostControlBar> {
  return {
    visible: true,
    screen: "enroll",
    prizes: [],
    currentPrizeId: null,
    drawing: false,
    waitingForStop: false,
    onToggleVisible: noop,
    onScreen: noop,
    onPrize: noop,
    onDraw: noop,
    onStop: noop,
    ...patch,
  };
}

describe("HostControlBar", () => {
  it("orders screens enroll then prize then draw then winner", () => {
    render(<HostControlBar {...barProps()} />);
    const labels = screen.getAllByRole("button").map((b) => b.textContent);
    const slice = ["参与", "奖品", "抽奖", "中奖"];
    const idxs = slice.map((label) => labels.indexOf(label));
    expect(idxs.every((i) => i >= 0)).toBe(true);
    expect([...idxs].sort((a, b) => a - b)).toEqual(idxs);
  });

  it("shows 停 when waitingForStop and click calls onStop not onDraw", () => {
    const onStop = vi.fn();
    const onDraw = vi.fn();
    render(
      <HostControlBar
        {...barProps({
          screen: "draw",
          prizes: [{ id: "p1", name: "一等奖", drawnCount: 0, quantity: 1 }],
          currentPrizeId: "p1",
          waitingForStop: true,
          onDraw,
          onStop,
        })}
      />,
    );
    fireEvent.click(screen.getByRole("button", { name: "停" }));
    expect(onStop).toHaveBeenCalledTimes(1);
    expect(onDraw).not.toHaveBeenCalled();
  });

  it("renders prize option labels with quantity progress", () => {
    render(
      <HostControlBar
        {...barProps({
          prizes: [
            { id: "p1", name: "一等奖", drawnCount: 0, quantity: 1 },
            { id: "p3", name: "三等奖", drawnCount: 1, quantity: 3 },
            { id: "p2", name: "二等奖", drawnCount: 1, quantity: 1 },
          ],
        })}
      />,
    );
    expect(screen.getByRole("option", { name: "一等奖" })).toBeInTheDocument();
    expect(screen.getByRole("option", { name: "三等奖（已抽 1/3）" })).toBeInTheDocument();
    expect(screen.getByRole("option", { name: "二等奖（已抽）" })).toBeInTheDocument();
  });

  it("disables 停 while drawing (decelerate or hold)", () => {
    render(
      <HostControlBar
        {...barProps({
          screen: "draw",
          prizes: [{ id: "p1", name: "一等奖", drawnCount: 0, quantity: 1 }],
          currentPrizeId: "p1",
          drawing: true,
          waitingForStop: true,
        })}
      />,
    );
    expect(screen.getByRole("button", { name: "抽奖中…" })).toBeDisabled();
  });

  it("disables 开始抽奖 on enroll prize and winner even if the prize is incomplete", () => {
    const prizes = [{ id: "p1", name: "一等奖", drawnCount: 0, quantity: 3 }];
    for (const publicScreen of ["enroll", "prize", "winner"] as const) {
      const { unmount } = render(
        <HostControlBar
          {...barProps({
            screen: publicScreen,
            prizes,
            currentPrizeId: "p1",
          })}
        />,
      );
      expect(screen.getByRole("button", { name: "开始抽奖" })).toBeDisabled();
      unmount();
    }
  });

  it("enables 开始抽奖 only on the draw screen when the prize is incomplete", () => {
    render(
      <HostControlBar
        {...barProps({
          screen: "draw",
          prizes: [{ id: "p1", name: "一等奖", drawnCount: 1, quantity: 3 }],
          currentPrizeId: "p1",
        })}
      />,
    );
    expect(screen.getByRole("button", { name: "开始抽奖" })).toBeEnabled();
  });

  it("disables 已抽取 when the current prize is complete", () => {
    render(
      <HostControlBar
        {...barProps({
          screen: "draw",
          prizes: [{ id: "p1", name: "一等奖", drawnCount: 1, quantity: 1 }],
          currentPrizeId: "p1",
        })}
      />,
    );
    expect(screen.getByRole("button", { name: "已抽取" })).toBeDisabled();
  });
});
