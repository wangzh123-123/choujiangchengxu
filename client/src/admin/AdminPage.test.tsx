import { render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { AdminPage } from "./AdminPage";

afterEach(() => {
  vi.unstubAllGlobals();
  localStorage.clear();
});

describe("AdminPage", () => {
  it("does not offer prize editing when logged in", async () => {
    localStorage.setItem("lottery_admin_token", "t");
    vi.stubGlobal(
      "fetch",
      vi.fn(async (input: RequestInfo) => {
        const url = String(input);
        if (url === "/api/prizes") {
          return {
            ok: true,
            json: async () => [{ id: "p1", name: "一等奖", imagePath: "x", order: 0, quantity: 1 }],
          };
        }
        if (url === "/api/participants") {
          return { ok: true, json: async () => [] };
        }
        if (url === "/api/presets") {
          return { ok: true, json: async () => ({}) };
        }
        if (url === "/api/public/view") {
          return { ok: true, json: async () => ({ winners: [] }) };
        }
        return { ok: false, status: 404, json: async () => ({}) };
      }),
    );
    render(<AdminPage />);
    await waitFor(() => {
      expect(screen.getByText("内定中奖人")).toBeInTheDocument();
    });
    expect(screen.queryByText("奖品配置")).toBeNull();
    expect(screen.queryByText("保存奖品")).toBeNull();
    expect(screen.queryByRole("button", { name: "添加奖品" })).toBeNull();
  });
});
