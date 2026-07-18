export function buildCycle(names: string[]): string[] {
  return [...names];
}

export function pickSettleIndex(names: string[], winnerName: string): number {
  const idx = names.indexOf(winnerName);
  return idx >= 0 ? idx : 0;
}
