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
    prize,
    names,
    stopping,
    onSettled,
  }: ComponentProps<typeof import("./DrawScreen").DrawScreen>) {
    const fired = useRef(false);
    useEffect(() => {
      if (stopping && !fired.current) {
        fired.current = true;
        onSettled?.(0);
      }
      if (!stopping) {
        fired.current = false;
      }
    }, [stopping, onSettled]);
    return (
      <div data-testid="draw-screen">
        <span data-testid="draw-prize">{prize?.name ?? ""}</span>
        <span data-testid="draw-names">{(names ?? []).join(",")}</span>
        {stopping ? (names?.[0] ?? "rolling") : "rolling"}
      </div>
    );
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

function drawView(overrides: Partial<PublicView> = {}): PublicView {
  const base = makeView(overrides);
  return {
    ...base,
    session: {
      ...base.session,
      publicScreen: overrides.session?.publicScreen ?? "draw",
    },
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
  currentPrizeId: "p1",
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
    await renderStage(drawView());

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
    await renderStage(drawView());

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

  it("ignores extra stop clicks while startDraw is in flight", async () => {
    await renderStage(drawView());

    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "开始抽奖" }));
      await Promise.resolve();
      await Promise.resolve();
    });

    expect(screen.getByRole("button", { name: "停" })).toBeInTheDocument();

    let resolveDraw: (value: DrawResult) => void = () => undefined;
    const pending = new Promise<DrawResult>((resolve) => {
      resolveDraw = resolve;
    });
    vi.mocked(startDraw).mockReturnValue(pending);

    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "停" }));
      fireEvent.click(screen.getByRole("button", { name: "停" }));
      await Promise.resolve();
    });

    expect(startDraw).toHaveBeenCalledTimes(1);

    await act(async () => {
      resolveDraw(incompleteDraw);
      await Promise.resolve();
      await Promise.resolve();
    });

    expect(startDraw).toHaveBeenCalledTimes(1);
  });

  it("shows 没有可抽奖用户 when canDraw is false and does not patch to draw", async () => {
    await renderStage(drawView({ canDraw: false }));

    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "开始抽奖" }));
      await Promise.resolve();
    });

    expect(screen.getByText("没有可抽奖用户")).toBeInTheDocument();
    expect(startDraw).not.toHaveBeenCalled();
    expect(patchedScreens()).not.toContain("draw");
  });

  it("starts rolling from the prize screen without calling startDraw", async () => {
    await renderStage(makeView());

    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "开始抽奖" }));
      await Promise.resolve();
      await Promise.resolve();
    });

    expect(startDraw).not.toHaveBeenCalled();
    expect(patchSession).toHaveBeenCalledWith({ publicScreen: "draw", drawPhase: "rolling" });
    expect(screen.getByTestId("draw-screen")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "停" })).toBeInTheDocument();
  });

  it("starts rolling from winner when the displayed prize is still the current prize", async () => {
    await renderStage(
      makeView({
        session: {
          currentPrizeId: "p1",
          publicScreen: "winner",
          controlBarVisible: true,
          drawPhase: "idle",
          lastWinnerParticipantId: "u1",
          lastWinnerPrizeId: "p1",
        },
        lastWinner: { id: "u1", name: "甲" },
        lastPrize: prize,
        winners: [{ prizeId: "p1", participantId: "u1", at: "t" }],
        eligible: [
          { id: "u2", name: "乙" },
          { id: "u3", name: "丙" },
        ],
      }),
    );

    expect(screen.getByRole("button", { name: "开始抽奖" })).toBeEnabled();

    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "开始抽奖" }));
      await Promise.resolve();
      await Promise.resolve();
    });

    expect(startDraw).not.toHaveBeenCalled();
    expect(patchSession).toHaveBeenCalledWith({ publicScreen: "draw", drawPhase: "rolling" });
    expect(screen.getByTestId("draw-screen")).toBeInTheDocument();
  });

  it("does not start rolling from winner after the current prize auto-advanced", async () => {
    const nextPrize: Prize = {
      id: "p2",
      name: "二等奖",
      imagePath: "y.png",
      order: 1,
      quantity: 1,
    };
    const view = makeView({
      session: {
        currentPrizeId: "p2",
        publicScreen: "winner",
        controlBarVisible: true,
        drawPhase: "idle",
        lastWinnerParticipantId: "u1",
        lastWinnerPrizeId: "p1",
      },
      currentPrize: nextPrize,
      lastWinner: { id: "u1", name: "甲" },
      lastPrize: prize,
      winners: [{ prizeId: "p1", participantId: "u1", at: "t" }],
    });
    vi.mocked(fetchPublicView).mockResolvedValue(view);
    vi.mocked(fetchPrizes).mockResolvedValue([prize, nextPrize]);
    vi.mocked(patchSession).mockResolvedValue(view.session);
    vi.mocked(setCurrentPrize).mockResolvedValue(view.session);
    vi.mocked(startDraw).mockResolvedValue(incompleteDraw);
    render(<PublicStage />);
    await flush();

    expect(screen.getByRole("button", { name: "开始抽奖" })).toBeDisabled();

    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "开始抽奖" }));
      await Promise.resolve();
    });

    expect(startDraw).not.toHaveBeenCalled();
    expect(patchSession).not.toHaveBeenCalledWith({ publicScreen: "draw", drawPhase: "rolling" });
    expect(screen.queryByTestId("draw-screen")).not.toBeInTheDocument();
  });

  it("keeps dropdown and draw prize on the drawn prize during settle hold", async () => {
    const nextPrize: Prize = {
      id: "p2",
      name: "二等奖",
      imagePath: "y.png",
      order: 1,
      quantity: 1,
    };
    await renderStage(drawView());
    vi.mocked(fetchPrizes).mockResolvedValue([prize, nextPrize]);

    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "开始抽奖" }));
      await Promise.resolve();
      await Promise.resolve();
    });

    const afterDraw = drawView({
      session: {
        currentPrizeId: "p2",
        publicScreen: "draw",
        controlBarVisible: true,
        drawPhase: "revealed",
        lastWinnerParticipantId: "u1",
        lastWinnerPrizeId: "p1",
      },
      currentPrize: nextPrize,
      lastWinner: { id: "u1", name: "甲" },
      lastPrize: prize,
      winners: [{ prizeId: "p1", participantId: "u1", at: "t" }],
      canDraw: true,
    });

    vi.mocked(fetchPublicView).mockResolvedValue(afterDraw);
    vi.mocked(fetchPrizes).mockResolvedValue([prize, nextPrize]);
    vi.mocked(startDraw).mockResolvedValue({
      ...completeDraw,
      currentPrizeId: "p2",
    });

    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "停" }));
      await Promise.resolve();
      await Promise.resolve();
    });

    expect(screen.getByRole("combobox")).toHaveValue("p1");
    expect(screen.getByTestId("draw-prize").textContent).toBe("三等奖");
    expect(screen.getByTestId("draw-screen").textContent).toContain("甲");
  });

  it("keeps frozen prize until delayed winner navigation finishes", async () => {
    const nextPrize: Prize = {
      id: "p2",
      name: "二等奖",
      imagePath: "y.png",
      order: 1,
      quantity: 1,
    };
    await renderStage(drawView());
    vi.mocked(fetchPrizes).mockResolvedValue([prize, nextPrize]);

    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "开始抽奖" }));
      await Promise.resolve();
      await Promise.resolve();
    });

    const afterDraw = drawView({
      session: {
        currentPrizeId: "p2",
        publicScreen: "draw",
        controlBarVisible: true,
        drawPhase: "revealed",
        lastWinnerParticipantId: "u1",
        lastWinnerPrizeId: "p1",
      },
      currentPrize: nextPrize,
      lastWinner: { id: "u1", name: "甲" },
      lastPrize: prize,
      winners: [{ prizeId: "p1", participantId: "u1", at: "t" }],
      canDraw: true,
    });

    let resolveWinnerPatch: ((session: PublicView["session"]) => void) | null = null;
    const winnerPatchGate = new Promise<PublicView["session"]>((resolve) => {
      resolveWinnerPatch = resolve;
    });

    vi.mocked(patchSession).mockImplementation(async (patch) => {
      if (patch.publicScreen === "winner") {
        const next = {
          ...afterDraw,
          session: { ...afterDraw.session, ...patch },
        };
        vi.mocked(fetchPublicView).mockResolvedValue(next);
        vi.mocked(fetchPrizes).mockResolvedValue([prize, nextPrize]);
        return winnerPatchGate.then(() => next.session);
      }
      return { ...afterDraw.session, ...patch };
    });
    vi.mocked(fetchPublicView).mockResolvedValue(afterDraw);
    vi.mocked(fetchPrizes).mockResolvedValue([prize, nextPrize]);
    vi.mocked(startDraw).mockResolvedValue({
      ...completeDraw,
      currentPrizeId: "p2",
    });

    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "停" }));
      await Promise.resolve();
      await Promise.resolve();
    });

    await act(async () => {
      vi.advanceTimersByTime(3000);
      await Promise.resolve();
      await Promise.resolve();
    });

    expect(patchSession).toHaveBeenCalledWith({ publicScreen: "winner" });
    expect(screen.getByRole("combobox")).toHaveValue("p1");
    expect(screen.getByTestId("draw-prize").textContent).toBe("三等奖");
    expect(screen.getByTestId("draw-screen")).toBeInTheDocument();

    await act(async () => {
      resolveWinnerPatch?.(
        { ...afterDraw.session, publicScreen: "winner" },
      );
      await Promise.resolve();
      await Promise.resolve();
      await Promise.resolve();
    });

    expect(screen.getByText("获得 三等奖")).toBeInTheDocument();
    expect(screen.getByRole("combobox")).toHaveValue("p2");
  });

  it("shows the completed prize on winner while the dropdown is the next prize", async () => {
    const nextPrize: Prize = {
      id: "p2",
      name: "二等奖",
      imagePath: "y.png",
      order: 1,
      quantity: 1,
    };
    await renderStage(drawView());
    vi.mocked(fetchPrizes).mockResolvedValue([prize, nextPrize]);

    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "开始抽奖" }));
      await Promise.resolve();
      await Promise.resolve();
    });

    const afterDraw = drawView({
      session: {
        currentPrizeId: "p2",
        publicScreen: "draw",
        controlBarVisible: true,
        drawPhase: "revealed",
        lastWinnerParticipantId: "u1",
        lastWinnerPrizeId: "p1",
      },
      currentPrize: nextPrize,
      lastWinner: { id: "u1", name: "甲" },
      lastPrize: prize,
      winners: [{ prizeId: "p1", participantId: "u1", at: "t" }],
      canDraw: true,
    });

    vi.mocked(patchSession).mockImplementation(async (patch) => {
      const next = {
        ...afterDraw,
        session: { ...afterDraw.session, ...patch },
      };
      vi.mocked(fetchPublicView).mockResolvedValue(next);
      vi.mocked(fetchPrizes).mockResolvedValue([prize, nextPrize]);
      return next.session;
    });
    vi.mocked(fetchPublicView).mockResolvedValue(afterDraw);
    vi.mocked(startDraw).mockResolvedValue({
      ...completeDraw,
      currentPrizeId: "p2",
    });

    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "停" }));
      await Promise.resolve();
      await Promise.resolve();
    });

    await act(async () => {
      vi.advanceTimersByTime(3000);
      await Promise.resolve();
      await Promise.resolve();
    });

    expect(patchSession).toHaveBeenCalledWith({ publicScreen: "winner" });
    expect(screen.getByText("甲")).toBeInTheDocument();
    expect(screen.getByText("获得 三等奖")).toBeInTheDocument();
    expect(screen.getByRole("combobox")).toHaveValue("p2");
    expect(screen.getByRole("button", { name: "开始抽奖" })).toBeDisabled();
  });

  it("rolls only eligible names, not previous winners", async () => {
    await renderStage(
      drawView({
        winners: [{ prizeId: "p1", participantId: "u1", at: "t" }],
        eligible: [
          { id: "u2", name: "乙" },
          { id: "u3", name: "丙" },
        ],
      }),
    );

    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "开始抽奖" }));
      await Promise.resolve();
      await Promise.resolve();
    });

    expect(screen.getByTestId("draw-names").textContent).toBe("乙,丙");
    expect(screen.getByTestId("draw-names").textContent).not.toContain("甲");
  });
});
