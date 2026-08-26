import { render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { SetupPrizesPage } from "./SetupPrizesPage";

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("SetupPrizesPage", () => {
  it("shows unavailable copy when setup API is 404", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => ({
        ok: false,
        status: 404,
        json: async () => ({ message: "仅本地配奖可用" }),
      })),
    );
    render(<SetupPrizesPage />);
    expect(await screen.findByText("仅本地配奖可用")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "保存" })).toBeNull();
  });

  it("loads prizes and saves", async () => {
    const fetchMock = vi.fn(async (input: RequestInfo, init?: RequestInit) => {
      const url = String(input);
      if (url === "/api/setup/prizes" && (!init || init.method === undefined || init.method === "GET")) {
        return {
          ok: true,
          status: 200,
          json: async () => [{ id: "p1", name: "一等奖", imagePath: "a.png", order: 0, quantity: 1 }],
        };
      }
      if (url === "/api/setup/prizes" && init?.method === "PUT") {
        return { ok: true, status: 200, json: async () => [] };
      }
      return { ok: false, status: 500, json: async () => ({}) };
    });
    vi.stubGlobal("fetch", fetchMock);
    render(<SetupPrizesPage />);
    expect(await screen.findByDisplayValue("一等奖")).toBeInTheDocument();
    screen.getByRole("button", { name: "保存" }).click();
    await waitFor(() => {
      expect(screen.getByText("已写入仓库文件，未提交。大屏刷新即可看到")).toBeInTheDocument();
    });
    expect(fetchMock).toHaveBeenCalledWith(
      "/api/setup/prizes",
      expect.objectContaining({ method: "PUT" }),
    );
  });
});
