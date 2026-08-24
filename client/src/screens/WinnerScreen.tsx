import type { Participant, Prize } from "../api/types";
import { imageUrl } from "../api/client";
import type { WinnerHistoryRow } from "./winnerHistory";

type Props = {
  prize: Prize | null;
  winner: Participant | null;
  history: WinnerHistoryRow[];
};

export function WinnerScreen({ prize, winner, history }: Props) {
  return (
    <section className="screen winner-screen">
      <p className="eyebrow">中奖公示</p>
      <h1 className="winner-name highlight">{winner?.name ?? "—"}</h1>
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
