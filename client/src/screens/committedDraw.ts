import { winnersForPrize } from "./winnerHistory";

export type CommittedDraw = {
  prizeId: string;
  participantId: string;
  name: string;
};

export function displayWinnerPrizeId(
  committed: CommittedDraw | null,
  fallbackPrizeId: string | null,
): string | null {
  return committed?.prizeId ?? fallbackPrizeId;
}

export function winnersForPrizeWithCommit(
  winners: Array<{ prizeId: string; participantId: string }>,
  prizeId: string | null,
  participants: Array<{ id: string; name: string }>,
  committed: CommittedDraw | null,
): Array<{ id: string; name: string }> {
  const list = winnersForPrize(winners, prizeId, participants);
  if (!committed || committed.prizeId !== prizeId) {
    return list;
  }
  if (list.some((w) => w.id === committed.participantId)) {
    return list;
  }
  return [...list, { id: committed.participantId, name: committed.name }];
}
