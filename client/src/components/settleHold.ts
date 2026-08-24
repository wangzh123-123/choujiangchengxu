export const SETTLE_HOLD_MS = 3000;

export function startSettleHold(goWinner: () => void, ms: number = SETTLE_HOLD_MS): () => void {
  const id = window.setTimeout(goWinner, ms);
  return () => {
    window.clearTimeout(id);
  };
}
