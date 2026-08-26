export type WinnerHistoryRow = { prizeName: string; winnerName: string };

export function winnersForPrize(
  winners: Array<{ prizeId: string; participantId: string }>,
  prizeId: string | null,
  participants: Array<{ id: string; name: string }>,
): Array<{ id: string; name: string }> {
  if (!prizeId) {
    return [];
  }
  return winners
    .filter((w) => w.prizeId === prizeId)
    .map((w) => {
      const p = participants.find((x) => x.id === w.participantId);
      return p ?? { id: w.participantId, name: w.participantId };
    });
}

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
