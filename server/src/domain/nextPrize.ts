import { drawnCountForPrize, prizeQuantity } from "./prizeQuantity.js";

export function nextIncompletePrizeId(
  prizes: Array<{ id: string; order: number; quantity?: unknown }>,
  winners: Array<{ prizeId: string }>,
  currentPrizeId: string,
): string | null {
  const sorted = [...prizes].sort((a, b) => a.order - b.order);
  const idx = sorted.findIndex((p) => p.id === currentPrizeId);
  if (idx < 0) {
    return null;
  }
  for (let i = idx + 1; i < sorted.length; i += 1) {
    const prize = sorted[i];
    if (!prize) {
      continue;
    }
    if (drawnCountForPrize(winners, prize.id) < prizeQuantity(prize)) {
      return prize.id;
    }
  }
  return null;
}
