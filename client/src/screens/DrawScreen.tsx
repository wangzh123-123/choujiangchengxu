import type { Prize } from "../api/types";
import { NameTicker } from "../components/NameTicker";
import { imageUrl } from "../api/client";

type Props = {
  prize: Prize | null;
  names: string[];
  rolling: boolean;
  stopping: boolean;
  onSettled?: (index: number) => void;
};

export function DrawScreen({ prize, names, rolling, stopping, onSettled }: Props) {
  return (
    <section className="screen draw-screen">
      <p className="eyebrow">抽奖进行中</p>
      <h1>{prize?.name ?? "当前奖品"}</h1>
      {prize ? (
        <div className="prize-image-wrap compact">
          <img src={imageUrl(prize.imagePath)} alt={prize.name} />
        </div>
      ) : null}
      <NameTicker
        names={names}
        rolling={rolling}
        stopping={stopping}
        onSettled={onSettled}
      />
    </section>
  );
}
