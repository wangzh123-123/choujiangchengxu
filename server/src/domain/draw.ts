export type ResolveWinnerInput = {
  presetId: string | null;
  eligibleIds: string[];
  random: () => number;
};

/** Preset always wins when present (highest priority). Otherwise uniform random among eligible. */
export function resolveWinner(input: ResolveWinnerInput): string {
  const { presetId, eligibleIds, random } = input;
  if (presetId) {
    return presetId;
  }
  if (eligibleIds.length === 0) {
    throw new Error("EMPTY_ELIGIBLE");
  }
  const idx = Math.floor(random() * eligibleIds.length);
  const id = eligibleIds[idx];
  if (!id) {
    throw new Error("EMPTY_ELIGIBLE");
  }
  return id;
}
