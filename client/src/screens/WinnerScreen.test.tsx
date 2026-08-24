import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { WinnerScreen } from "./WinnerScreen";

describe("WinnerScreen", () => {
  it("shows current winner and history list", () => {
    render(
      <WinnerScreen
        prize={{ id: "p2", name: "二等奖", imagePath: "x.png", order: 1 }}
        winner={{ id: "u2", name: "乙" }}
        history={[
          { prizeName: "三等奖", winnerName: "甲" },
          { prizeName: "二等奖", winnerName: "乙" },
        ]}
      />,
    );
    expect(screen.getByText("乙")).toBeInTheDocument();
    expect(screen.getByText("三等奖 — 甲")).toBeInTheDocument();
    expect(screen.getByText("二等奖 — 乙")).toBeInTheDocument();
  });
});
