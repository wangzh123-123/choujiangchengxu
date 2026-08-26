export function prizeQuantity(prize: { quantity?: unknown }): number {
  const q = prize.quantity;
  if (typeof q === "number" && Number.isInteger(q) && q >= 1) {
    return q;
  }
  return 1;
}

export function normalizePrize<T extends { quantity?: unknown }>(prize: T): T & { quantity: number } {
  return { ...prize, quantity: prizeQuantity(prize) };
}

export function drawnCountForPrize(winners: Array<{ prizeId: string }>, prizeId: string): number {
  return winners.filter((w) => w.prizeId === prizeId).length;
}

export function isPrizeComplete(
  winners: Array<{ prizeId: string }>,
  prizeId: string,
  quantity: number,
): boolean {
  return drawnCountForPrize(winners, prizeId) >= quantity;
}
