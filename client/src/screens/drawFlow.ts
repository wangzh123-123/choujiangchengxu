import type { PublicScreen } from "../api/types";

export function canStartRollFromScreen(opts: {
  screen: PublicScreen;
  currentPrizeId: string | null;
  winnerPrizeId: string | null;
  prizeComplete: boolean;
}): boolean {
  if (!opts.currentPrizeId || opts.prizeComplete) {
    return false;
  }
  if (opts.screen === "enroll") {
    return false;
  }
  if (opts.screen === "prize" || opts.screen === "draw") {
    return true;
  }
  if (opts.screen === "winner") {
    return opts.winnerPrizeId === opts.currentPrizeId;
  }
  return false;
}

export function startRollError(opts: {
  currentPrizeId: string | null;
  prizeComplete: boolean;
  canDraw: boolean;
}): string | null {
  if (!opts.currentPrizeId) {
    return "未选择当前奖品，无法开奖";
  }
  if (opts.prizeComplete) {
    return "该奖品已抽完";
  }
  if (!opts.canDraw) {
    return "没有可抽奖用户";
  }
  return null;
}

export function afterHoldAction(prizeComplete: boolean): "winner" | "stay" {
  return prizeComplete ? "winner" : "stay";
}

export function isComplete(drawnCount: number, quantity: number): boolean {
  return drawnCount >= quantity;
}
