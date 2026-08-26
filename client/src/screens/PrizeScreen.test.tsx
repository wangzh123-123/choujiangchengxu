import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { PrizeScreen } from "./PrizeScreen";

describe("PrizeScreen", () => {
  it("renders prize name from view model", () => {
    render(
      <PrizeScreen
        prize={{ id: "1", name: "特等奖", imagePath: "x.png", order: 0, quantity: 1 }}
        drawnCount={0}
      />,
    );
    expect(screen.getByText("特等奖")).toBeInTheDocument();
  });

  it("shows remaining quantity progress", () => {
    render(
      <PrizeScreen
        prize={{ id: "1", name: "特等奖", imagePath: "x.png", order: 0, quantity: 3 }}
        drawnCount={1}
      />,
    );
    expect(screen.getByText("3 份 · 已抽 1/3")).toBeInTheDocument();
  });
});
