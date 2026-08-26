import { useEffect, useRef, type ComponentProps } from "react";
import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { DrawResult, Prize, PublicView } from "../api/types";
import {
  fetchPrizes,
  fetchPublicView,
  patchSession,
  setCurrentPrize,
  startDraw,
} from "../api/client";
import { PublicStage } from "./PublicStage";

vi.mock("../api/client", () => ({
  fetchPublicView: vi.fn(),
  fetchPrizes: vi.fn(),
  patchSession: vi.fn(),
  setCurrentPrize: vi.fn(),
  startDraw: vi.fn(),
  imageUrl: (path: string) => path,
}));

vi.mock("./DrawScreen", () => ({
  DrawScreen: function MockDrawScreen({
    settleName,
    onSettled,
  }: ComponentProps<typeof import("./DrawScreen").DrawScreen>) {
    const fired = useRef(false);
    useEffect(() => {
      if (settleName && !fired.current) {
        fired.current = true;
        onSettled?.();
      }
      if (!settleName) {
        fired.current = false;
      }
    }, [settleName, onSettled]);
    return <div data-testid="draw-screen">{settleName ?? "rolling"}</div>;
  },
}));

const prize: Prize = {
  id: "p1",
  name: "三等奖",
  imagePath: "x.png",
  order: 0,
  quantity: 3,
};

function makeView(overrides: Partial<PublicView> = {}): PublicView {
  return {
    session: {
      currentPrizeId: "p1",
      publicScreen: "prize",
      controlBarVisible: true,
      drawPhase: "idle",
      lastWinnerParticipantId: null,
      lastWinnerPrizeId: null,
    },
    currentPrize: prize,
    participants: [
      { id: "u1", name: "甲" },
      { id: "u2", name: "乙" },
      { id: "u3", name: "丙" },
    ],
    eligible: [
      { id: "u1", name: "甲" },
      { id: "u2", name: "乙" },
      { id: "u3", name: "丙" },
    ],
    lastWinner: null,
    lastPrize: null,
    winners: [],
    canDraw: true,
    ...overrides,
  };
}

const incompleteDraw: DrawResult = {
  prizeId: "p1",
  prizeName: "三等奖",
  participantId: "u1",
  name: "甲",
  drawnCount: 1,
  quantity: 3,
  prizeComplete: false,
};

const completeDraw: DrawResult = {
  ...incompleteDraw,
  drawnCount: 3,
  prizeComplete: true,
};

async function flush() {
  await act(async () => {
    await Promise.resolve();
    await Promise.resolve();
  });
}

async function renderStage(view: PublicView = makeView()) {
  vi.mocked(fetchPublicView).mockResolvedValue(view);
  vi.mocked(fetchPrizes).mockResolvedValue([prize]);
  vi.mocked(patchSession).mockResolvedValue(view.session);
  vi.mocked(setCurrentPrize).mockResolvedValue(view.session);
  vi.mocked(startDraw).mockResolvedValue(incompleteDraw);
  render(<PublicStage />);
  await flush();
  expect(screen.getByRole("button", { name: "开始抽奖" })).toBeInTheDocument();
}

function patchedScreens(): Array<string | undefined> {
  return vi.mocked(patchSession).mock.calls.map((call) => call[0]?.publicScreen);
}

describe("PublicStage draw start/stop", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.mocked(fetchPublicView).mockReset();
    vi.mocked(fetchPrizes).mockReset();
    vi.mocked(patchSession).mockReset();
    vi.mocked(setCurrentPrize).mockReset();
    vi.mocked(startDraw).mockReset();
  });

  afterEach(() => {
    cleanup();
    vi.useRealTimers();
  });

  it("starts rolling without calling startDraw; stop draws; incomplete hold stays on draw", async () => {
    await renderStage();

    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "开始抽奖" }));
      await Promise.resolve();
      await Promise.resolve();
    });

    expect(startDraw).not.toHaveBeenCalled();
    expect(patchSession).toHaveBeenCalledWith({ publicScreen: "draw", drawPhase: "rolling" });
    expect(screen.getByRole("button", { name: "停" })).toBeInTheDocument();

    vi.mocked(startDraw).mockResolvedValue(incompleteDraw);

    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "停" }));
      await Promise.resolve();
      await Promise.resolve();
    });

    expect(startDraw).toHaveBeenCalledTimes(1);

    await act(async () => {
      vi.advanceTimersByTime(3000);
      await Promise.resolve();
    });

    expect(patchedScreens()).not.toContain("winner");
  });

  it("goes to winner after hold when prizeComplete is true", async () => {
    await renderStage();

    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "开始抽奖" }));
      await Promise.resolve();
      await Promise.resolve();
    });

    vi.mocked(startDraw).mockResolvedValue(completeDraw);

    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "停" }));
      await Promise.resolve();
      await Promise.resolve();
    });

    expect(startDraw).toHaveBeenCalledTimes(1);

    await act(async () => {
      vi.advanceTimersByTime(3000);
      await Promise.resolve();
    });

    expect(patchSession).toHaveBeenCalledWith({ publicScreen: "winner" });
  });

  it("shows 没有可抽奖用户 when canDraw is false and does not patch to draw", async () => {
    await renderStage(makeView({ canDraw: false }));

    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "开始抽奖" }));
      await Promise.resolve();
    });

    expect(screen.getByText("没有可抽奖用户")).toBeInTheDocument();
    expect(startDraw).not.toHaveBeenCalled();
    expect(patchedScreens()).not.toContain("draw");
  });
});
