import { useEffect, useMemo, useRef, useState } from "react";
import { buildCycle } from "./tickerMath";

type Props = {
  names: string[];
  rolling: boolean;
  stopping: boolean;
  onSettled?: (index: number) => void;
};

export const ROLL_MS = 40;
export const TICK_MS = 15;

export function NameTicker({ names, rolling, stopping, onSettled }: Props) {
  const cycle = useMemo(() => buildCycle(names), [names]);
  const [offset, setOffset] = useState(0);
  const [settled, setSettled] = useState(false);
  const onSettledRef = useRef(onSettled);
  onSettledRef.current = onSettled;
  const settledOnceRef = useRef(false);
  const offsetRef = useRef(0);
  const tickRef = useRef<number | null>(null);
  offsetRef.current = offset;

  useEffect(() => {
    if (!rolling && !stopping) {
      settledOnceRef.current = false;
      setSettled(false);
    }
  }, [rolling, stopping]);

  useEffect(() => {
    if (!rolling || cycle.length === 0) {
      return;
    }
    settledOnceRef.current = false;
    setSettled(false);
    const tick = window.setInterval(() => {
      setOffset((v) => {
        const next = (v + 1) % cycle.length;
        offsetRef.current = next;
        return next;
      });
    }, TICK_MS);
    tickRef.current = tick;
    return () => {
      window.clearInterval(tick);
      tickRef.current = null;
    };
  }, [rolling, cycle]);

  useEffect(() => {
    if (!rolling || !stopping || cycle.length === 0 || settledOnceRef.current) {
      return;
    }
    const settleTimer = window.setTimeout(() => {
      if (settledOnceRef.current) {
        return;
      }
      settledOnceRef.current = true;
      if (tickRef.current != null) {
        window.clearInterval(tickRef.current);
        tickRef.current = null;
      }
      const idx = offsetRef.current % cycle.length;
      setOffset(idx);
      setSettled(true);
      onSettledRef.current?.(idx);
    }, ROLL_MS);
    return () => {
      window.clearTimeout(settleTimer);
    };
  }, [rolling, stopping, cycle]);

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
