import { useCallback, useEffect, useRef, useState } from "react";
import {
  fetchPrizes,
  fetchPublicView,
  patchSession,
  setCurrentPrize,
  startDraw,
} from "../api/client";
import type { DrawResult, Prize, PublicScreen, PublicView } from "../api/types";
import { HostControlBar } from "../components/HostControlBar";
import { startSettleHold } from "../components/settleHold";
import { DrawScreen } from "./DrawScreen";
import { EnrollScreen } from "./EnrollScreen";
import { PrizeScreen } from "./PrizeScreen";
import { WinnerScreen } from "./WinnerScreen";
import { afterHoldAction, isComplete, startRollError } from "./drawFlow";
import { buildWinnerHistory, winnersForPrize } from "./winnerHistory";
import { shouldIgnoreScreenNav } from "./screenNav";
import { winnerScreenPrizeId } from "./winnerDisplay";

export function PublicStage() {
  const [view, setView] = useState<PublicView | null>(null);
  const [prizes, setPrizes] = useState<Prize[]>([]);
  const [rolling, setRolling] = useState(false);
  const [settleName, setSettleName] = useState<string | null>(null);
  const [tickerNames, setTickerNames] = useState<string[]>([]);
  const [fadeKey, setFadeKey] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [holding, setHolding] = useState(false);
  const rollingRef = useRef(false);
  const holdingRef = useRef(false);
  const skipRevealRef = useRef(false);
  const prizeCompleteRef = useRef(false);
  const settleNameRef = useRef<string | null>(null);
  const stoppingRef = useRef(false);
  const cancelHoldRef = useRef<(() => void) | null>(null);

  function clearHold() {
    cancelHoldRef.current?.();
    cancelHoldRef.current = null;
    holdingRef.current = false;
    setHolding(false);
  }

  const refresh = useCallback(async () => {
    const [v, p] = await Promise.all([fetchPublicView(), fetchPrizes()]);
    if (rollingRef.current) {
      setView({
        ...v,
        session: { ...v.session, publicScreen: "draw" },
      });
    } else {
      setView(v);
    }
    setPrizes(p);
  }, []);

  useEffect(() => {
    void refresh().catch((err: unknown) => {
      setError(err instanceof Error ? err.message : "加载失败");
    });
    const timer = window.setInterval(() => {
      void refresh().catch(() => undefined);
    }, 3000);
    return () => {
      window.clearInterval(timer);
      clearHold();
    };
  }, [refresh]);

  async function goScreen(screen: PublicScreen, fromAutoReveal = false) {
    if (!view) {
      return;
    }
    const visualScreen = rolling || holding ? "draw" : view.session.publicScreen;
    if (!fromAutoReveal && shouldIgnoreScreenNav(screen, visualScreen)) {
      return;
    }
    if (!fromAutoReveal) {
      skipRevealRef.current = true;
      rollingRef.current = false;
      setRolling(false);
      clearHold();
    }
    await patchSession({ publicScreen: screen });
    setFadeKey((k) => k + 1);
    await refresh();
  }

  async function onSelectPrize(prizeId: string) {
    if (rollingRef.current || holdingRef.current || !view) {
      return;
    }
    const selected = prizes.find((p) => p.id === prizeId);
    const drawnCount = view.winners.filter((w) => w.prizeId === prizeId).length;
    const complete = isComplete(drawnCount, selected?.quantity ?? 1);
    await setCurrentPrize(prizeId);
    await patchSession({ publicScreen: complete ? "winner" : "prize" });
    setFadeKey((k) => k + 1);
    await refresh();
  }

  async function onStartRoll() {
    if (!view || rollingRef.current || holdingRef.current) {
      return;
    }
    if (view.session.publicScreen !== "draw") {
      return;
    }
    skipRevealRef.current = false;
    stoppingRef.current = false;
    clearHold();
    setError(null);
    const prizeId = view.session.currentPrizeId;
    const drawnCount = view.winners.filter((w) => w.prizeId === prizeId).length;
    const err = startRollError({
      currentPrizeId: prizeId,
      prizeComplete: isComplete(drawnCount, view.currentPrize?.quantity ?? 1),
      canDraw: view.canDraw,
    });
    if (err) {
      setError(err);
      return;
    }
    const snapshot = view.eligible.map((p) => p.name);
    try {
      rollingRef.current = true;
      settleNameRef.current = null;
      prizeCompleteRef.current = false;
      setRolling(true);
      setSettleName(null);
      setTickerNames(snapshot);
      await patchSession({ publicScreen: "draw", drawPhase: "rolling" });
      setFadeKey((k) => k + 1);
      await refresh();
    } catch (err) {
      rollingRef.current = false;
      settleNameRef.current = null;
      setRolling(false);
      setSettleName(null);
      const raw = err instanceof Error ? err.message : "开奖失败";
      if (!/内定/.test(raw)) {
        setError(raw);
      }
      await refresh();
    }
  }

  async function onStop() {
    if (!rollingRef.current || settleNameRef.current !== null || stoppingRef.current) {
      return;
    }
    stoppingRef.current = true;
    try {
      const result: DrawResult = await startDraw();
      setTickerNames((names) =>
        names.includes(result.name) ? names : [...names, result.name],
      );
      prizeCompleteRef.current = result.prizeComplete;
      settleNameRef.current = result.name;
      setSettleName(result.name);
      await refresh();
    } catch (err) {
      stoppingRef.current = false;
      rollingRef.current = false;
      settleNameRef.current = null;
      setRolling(false);
      setSettleName(null);
      const raw = err instanceof Error ? err.message : "开奖失败";
      if (!/内定/.test(raw)) {
        setError(raw);
      }
      await refresh();
    }
  }

  function onRollingSettled() {
    if (skipRevealRef.current) {
      return;
    }
    rollingRef.current = false;
    setRolling(false);
    holdingRef.current = true;
    setHolding(true);
    cancelHoldRef.current?.();
    cancelHoldRef.current = startSettleHold(() => {
      holdingRef.current = false;
      setHolding(false);
      cancelHoldRef.current = null;
      if (afterHoldAction(prizeCompleteRef.current) === "winner") {
        void goScreen("winner", true);
      }
    });
  }

  if (!view) {
    return <div className="loading">{error ?? "加载中…"}</div>;
  }

  const screen = rolling || holding ? "draw" : view.session.publicScreen;
  const namesForTicker =
    rolling || tickerNames.length > 0 ? tickerNames : view.eligible.map((p) => p.name);

  const prizeOptions = prizes.map((p) => ({
    id: p.id,
    name: p.name,
    drawnCount: view.winners.filter((w) => w.prizeId === p.id).length,
    quantity: p.quantity ?? 1,
  }));

  const currentDrawnCount = view.currentPrize
    ? view.winners.filter((w) => w.prizeId === view.currentPrize?.id).length
    : 0;
  const winnerPrizeId = winnerScreenPrizeId({
    currentPrizeId: view.session.currentPrizeId,
    lastWinnerPrizeId: view.session.lastWinnerPrizeId,
    currentPrizeComplete: isComplete(
      currentDrawnCount,
      view.currentPrize?.quantity ?? 1,
    ),
  });
  const displayPrize =
    prizes.find((p) => p.id === winnerPrizeId) ??
    (view.currentPrize?.id === winnerPrizeId ? view.currentPrize : null) ??
    (view.lastPrize?.id === winnerPrizeId ? view.lastPrize : null);

  return (
    <div className="stage">
      <div key={fadeKey} className="stage-frame fade">
        {screen === "prize" ? (
          <PrizeScreen
            prize={view.currentPrize}
            drawnCount={
              view.currentPrize
                ? view.winners.filter((w) => w.prizeId === view.currentPrize?.id).length
                : 0
            }
          />
        ) : null}
        {screen === "enroll" ? (
          <EnrollScreen
            participants={view.participants}
            winnerIds={new Set(view.winners.map((w) => w.participantId))}
            onChanged={() => void refresh()}
          />
        ) : null}
        {screen === "draw" ? (
          <DrawScreen
            prize={view.currentPrize}
            names={namesForTicker}
            rolling={rolling}
            settleName={settleName}
            onSettled={() => {
              void onRollingSettled();
            }}
          />
        ) : null}
        {screen === "winner" ? (
          <WinnerScreen
            prize={displayPrize}
            winners={winnersForPrize(
              view.winners,
              winnerPrizeId,
              view.participants,
            )}
            history={buildWinnerHistory(view.winners, prizes, view.participants)}
          />
        ) : null}
      </div>
      {error ? <div className="toast error">{error}</div> : null}
      <HostControlBar
        visible={view.session.controlBarVisible}
        screen={screen}
        prizes={prizeOptions}
        currentPrizeId={view.session.currentPrizeId}
        drawing={holding || (rolling && settleName !== null)}
        waitingForStop={rolling && settleName === null}
        onToggleVisible={() => {
          void patchSession({ controlBarVisible: !view.session.controlBarVisible }).then(refresh);
        }}
        onScreen={(s) => {
          void goScreen(s);
        }}
        onPrize={(id) => {
          void onSelectPrize(id);
        }}
        onDraw={() => void onStartRoll()}
        onStop={() => void onStop()}
      />
    </div>
  );
}
