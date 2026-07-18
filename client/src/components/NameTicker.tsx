import { useEffect, useMemo, useState } from "react";
import { buildCycle, pickSettleIndex } from "./tickerMath";

type Props = {
  names: string[];
  rolling: boolean;
  settleName: string | null;
  onSettled?: () => void;
};

export function NameTicker({ names, rolling, settleName, onSettled }: Props) {
  const cycle = useMemo(() => buildCycle(names), [names]);
  const [offset, setOffset] = useState(0);
  const [settled, setSettled] = useState(false);

  useEffect(() => {
    if (!rolling || cycle.length === 0) {
      return;
    }
    setSettled(false);
    let currentSpeed = 16;
    const accel = window.setTimeout(() => {
      currentSpeed = 5;
    }, 800);
    const settleTimer = window.setTimeout(() => {
      if (settleName) {
        const idx = pickSettleIndex(cycle, settleName);
        setOffset(idx);
        setSettled(true);
        onSettled?.();
      }
    }, 2600);
    const tick = window.setInterval(() => {
      setOffset((v) => (v + 1) % cycle.length);
    }, currentSpeed * 10);
    const speedSync = window.setInterval(() => {
      window.clearInterval(tick);
    }, 850);
    return () => {
      window.clearTimeout(accel);
      window.clearTimeout(settleTimer);
      window.clearInterval(tick);
      window.clearInterval(speedSync);
    };
  }, [rolling, cycle, settleName, onSettled]);

  if (cycle.length === 0) {
    return <div className="ticker empty">暂无参与用户</div>;
  }

  const current = cycle[offset % cycle.length] ?? "";
  const prev = cycle[(offset - 1 + cycle.length) % cycle.length] ?? "";
  const next = cycle[(offset + 1) % cycle.length] ?? "";

  return (
    <div className={`ticker ${rolling && !settled ? "rolling" : ""} ${settled ? "settled" : ""}`}>
      <div className="ticker-item dim">{prev}</div>
      <div className="ticker-item focus">{current}</div>
      <div className="ticker-item dim">{next}</div>
    </div>
  );
}
