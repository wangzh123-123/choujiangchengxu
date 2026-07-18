export type ResolveWinnerInput = {
  presetId: string | null;
  eligibleIds: string[];
  random: () => number;
};

export function resolveWinner(input: ResolveWinnerInput): string {
  const { presetId, eligibleIds, random } = input;
  if (eligibleIds.length === 0) {
    throw new Error("EMPTY_ELIGIBLE");
  }
  if (presetId) {
    if (!eligibleIds.includes(presetId)) {
      throw new Error("PRESET_NOT_ELIGIBLE");
    }
    return presetId;
  }
  const idx = Math.floor(random() * eligibleIds.length);
  const id = eligibleIds[idx];
  if (!id) {
    throw new Error("EMPTY_ELIGIBLE");
  }
  return id;
}
