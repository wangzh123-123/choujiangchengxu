export function winnerScreenPrizeId(opts: {
  currentPrizeId: string | null;
  lastWinnerPrizeId: string | null;
  currentPrizeComplete: boolean;
}): string | null {
  if (opts.currentPrizeComplete) {
    return opts.currentPrizeId;
  }
  return opts.lastWinnerPrizeId ?? opts.currentPrizeId;
}
