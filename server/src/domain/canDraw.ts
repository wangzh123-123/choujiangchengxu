import { drawnCountForPrize, prizeQuantity } from "./prizeQuantity.js";
import { presetSlotAt } from "./presetSlots.js";

export function computeCanDraw(input: {
  prize: { id: string; quantity?: unknown } | null;
  winners: Array<{ prizeId: string }>;
  eligibleCount: number;
  slots: Array<string | null>;
}): boolean {
  if (!input.prize) {
    return false;
  }
  const quantity = prizeQuantity(input.prize);
  const drawn = drawnCountForPrize(input.winners, input.prize.id);
  if (drawn >= quantity) {
    return false;
  }
  const slot = presetSlotAt(input.slots, drawn);
  if (slot) {
    return true;
  }
  return input.eligibleCount > 0;
}
