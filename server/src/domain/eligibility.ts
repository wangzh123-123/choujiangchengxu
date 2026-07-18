import type { Participant, WinnerRecord } from "../types.js";

export function listEligible(
  participants: Participant[],
  winners: WinnerRecord[],
): Participant[] {
  const won = new Set(winners.map((w) => w.participantId));
  return participants.filter((p) => !won.has(p.id));
}
