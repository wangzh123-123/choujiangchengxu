import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { PrizeScreen } from "./PrizeScreen";

describe("PrizeScreen", () => {
  it("renders prize name from view model", () => {
    render(
      <PrizeScreen prize={{ id: "1", name: "特等奖", imagePath: "x.png", order: 0 }} />,
    );
    expect(screen.getByText("特等奖")).toBeInTheDocument();
  });
});
