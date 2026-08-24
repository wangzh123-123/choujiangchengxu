import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { HostControlBar } from "./HostControlBar";

describe("HostControlBar", () => {
  it("orders screens enroll then prize then draw then winner", () => {
    render(
      <HostControlBar
        visible
        screen="enroll"
        prizes={[]}
        currentPrizeId={null}
        drawing={false}
        onToggleVisible={() => undefined}
        onScreen={() => undefined}
        onPrize={() => undefined}
        onDraw={() => undefined}
      />,
    );
    const labels = screen.getAllByRole("button").map((b) => b.textContent);
    const slice = ["参与", "奖品", "抽奖", "中奖"];
    const idxs = slice.map((label) => labels.indexOf(label));
    expect(idxs.every((i) => i >= 0)).toBe(true);
    expect([...idxs].sort((a, b) => a - b)).toEqual(idxs);
  });
});
