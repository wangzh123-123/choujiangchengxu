import type { Participant, Prize } from "../api/types";
import { imageUrl } from "../api/client";
import type { WinnerHistoryRow } from "./winnerHistory";

type Props = {
  prize: Prize | null;
  winners: Participant[];
  history: WinnerHistoryRow[];
};

export function WinnerScreen({ prize, winners, history }: Props) {
  return (
    <section className="screen winner-screen">
      <p className="eyebrow">中奖公示</p>
      {winners.length <= 1 ? (
        <h1 className="winner-name highlight">{winners[0]?.name ?? "—"}</h1>
      ) : (
        <ul className="winner-names">
          {winners.map((w) => (
            <li key={w.id} className="winner-name highlight">{w.name}</li>
          ))}
        </ul>
      )}
      <p className="sub">获得 {prize?.name ?? "奖品"}</p>
      {prize ? (
        <div className="prize-image-wrap">
          <img src={imageUrl(prize.imagePath)} alt={prize.name} />
        </div>
      ) : null}
      {history.length > 0 ? (
        <ul className="winner-history">
          {history.map((row, index) => (
            <li key={`${row.prizeName}-${row.winnerName}-${index}`}>
              {row.prizeName} — {row.winnerName}
            </li>
          ))}
        </ul>
      ) : null}
    </section>
  );
}
