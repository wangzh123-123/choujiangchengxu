import type { Participant, Prize } from "../api/types";
import { imageUrl } from "../api/client";

type Props = {
  prize: Prize | null;
  winner: Participant | null;
};

export function WinnerScreen({ prize, winner }: Props) {
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
    </section>
  );
}
