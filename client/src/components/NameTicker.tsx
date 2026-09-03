import { useEffect, useMemo, useRef, useState } from "react";
import { buildCycle, pickSettleIndex } from "./tickerMath";

type Props = {
  names: string[];
  rolling: boolean;
  settleName: string | null;
  onSettled?: () => void;
};

export const ROLL_MS = 40;
export const TICK_MS = 40;

export function NameTicker({ names, rolling, settleName, onSettled }: Props) {
  const cycle = useMemo(() => buildCycle(names), [names]);
  const [offset, setOffset] = useState(0);
  const [settled, setSettled] = useState(false);
  const onSettledRef = useRef(onSettled);
  onSettledRef.current = onSettled;
  const settledOnceRef = useRef(false);

  useEffect(() => {
    if (!rolling || cycle.length === 0) {
      return;
    }
    settledOnceRef.current = false;
    setSettled(false);

    const tick = window.setInterval(() => {
      setOffset((v) => (v + 1) % cycle.length);
    }, TICK_MS);

    return () => {
      window.clearInterval(tick);
    };
  }, [rolling, cycle]);

  useEffect(() => {
    if (!rolling || !settleName || cycle.length === 0 || settledOnceRef.current) {
      return;
    }
    const settleTimer = window.setTimeout(() => {
      if (settledOnceRef.current) {
        return;
      }
      settledOnceRef.current = true;
      const idx = pickSettleIndex(cycle, settleName);
      setOffset(idx);
      setSettled(true);
      onSettledRef.current?.();
    }, ROLL_MS);
    return () => {
      window.clearTimeout(settleTimer);
    };
  }, [rolling, settleName, cycle]);

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
