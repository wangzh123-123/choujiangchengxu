import type { PublicScreen } from "../api/types";

type PrizeOption = { id: string; name: string };

type Props = {
  visible: boolean;
  screen: PublicScreen;
  prizes: PrizeOption[];
  currentPrizeId: string | null;
  drawing: boolean;
  onToggleVisible: () => void;
  onScreen: (screen: PublicScreen) => void;
  onPrize: (prizeId: string) => void;
  onDraw: () => void;
};

const order: PublicScreen[] = ["prize", "enroll", "draw", "winner"];
const labels: Record<PublicScreen, string> = {
  prize: "奖品",
  enroll: "参与",
  draw: "抽奖",
  winner: "中奖",
};

export function HostControlBar({
  visible,
  screen,
  prizes,
  currentPrizeId,
  drawing,
  onToggleVisible,
  onScreen,
  onPrize,
  onDraw,
}: Props) {
  if (!visible) {
    return (
      <button className="host-reveal" type="button" onClick={onToggleVisible}>
        显示控制条
      </button>
    );
  }

  const idx = order.indexOf(screen);

  return (
    <div className="host-bar">
      <button type="button" onClick={() => onScreen(order[Math.max(0, idx - 1)]!)}>
        上一屏
      </button>
      <button type="button" onClick={() => onScreen(order[Math.min(order.length - 1, idx + 1)]!)}>
        下一屏
      </button>
      {order.map((s) => (
        <button
          key={s}
          type="button"
          className={s === screen ? "active" : ""}
          onClick={() => onScreen(s)}
        >
          {labels[s]}
        </button>
      ))}
      <select
        value={currentPrizeId ?? ""}
        onChange={(e) => {
          if (e.target.value) onPrize(e.target.value);
        }}
      >
        <option value="">选择奖品</option>
        {prizes.map((p) => (
          <option key={p.id} value={p.id}>
            {p.name}
          </option>
        ))}
      </select>
      <button type="button" className="primary" disabled={drawing} onClick={onDraw}>
        {drawing ? "抽奖中…" : "开始抽奖"}
      </button>
      <button type="button" onClick={onToggleVisible}>
        隐藏
      </button>
    </div>
  );
}
