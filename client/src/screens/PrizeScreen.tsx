import type { Prize } from "../api/types";
import { imageUrl } from "../api/client";

type Props = {
  prize: Prize | null;
};

export function PrizeScreen({ prize }: Props) {
  if (!prize) {
    return (
      <section className="screen prize-screen">
        <h1>请选择当前奖品</h1>
      </section>
    );
  }
  return (
    <section className="screen prize-screen">
      <p className="eyebrow">本轮奖品</p>
      <h1>{prize.name}</h1>
      <div className="prize-image-wrap">
        <img src={imageUrl(prize.imagePath)} alt={prize.name} />
      </div>
    </section>
  );
}
