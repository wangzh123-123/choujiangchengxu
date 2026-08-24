export type WinnerHistoryRow = { prizeName: string; winnerName: string };

export function buildWinnerHistory(
  winners: Array<{ prizeId: string; participantId: string }>,
  prizes: Array<{ id: string; name: string }>,
  participants: Array<{ id: string; name: string }>,
): WinnerHistoryRow[] {
  return winners.map((w) => ({
    prizeName: prizes.find((p) => p.id === w.prizeId)?.name ?? w.prizeId,
    winnerName: participants.find((p) => p.id === w.participantId)?.name ?? w.participantId,
  }));
}
