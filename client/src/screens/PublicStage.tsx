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
import { buildWinnerHistory } from "./winnerHistory";
import { shouldIgnoreScreenNav } from "./screenNav";

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
    const drawn = view.winners.some((w) => w.prizeId === prizeId);
    await setCurrentPrize(prizeId);
    await patchSession({ publicScreen: drawn ? "winner" : "prize" });
    setFadeKey((k) => k + 1);
    await refresh();
  }

  async function onDraw() {
    if (!view || rollingRef.current) {
      return;
    }
    skipRevealRef.current = false;
    clearHold();
    setError(null);
    if (view.winners.some((w) => w.prizeId === view.session.currentPrizeId)) {
      setError("该奖品已开奖");
      return;
    }
    const snapshot = view.participants.map((p) => p.name);
    if (snapshot.length === 0) {
      setError("没有可抽奖用户");
      return;
    }
    try {
      rollingRef.current = true;
      setRolling(true);
      setSettleName(null);
      setTickerNames(snapshot);
      await patchSession({ publicScreen: "draw", drawPhase: "rolling" });
      setFadeKey((k) => k + 1);
      await refresh();

      const result: DrawResult = await startDraw();
      setTickerNames((names) =>
        names.includes(result.name) ? names : [...names, result.name],
      );
      setSettleName(result.name);
      await refresh();
    } catch (err) {
      rollingRef.current = false;
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
      void goScreen("winner", true);
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

  // When showing winner for the selected prize, resolve that prize's winner (not only last draw).
  const selectedWinnerRecord = view.winners.find(
    (w) => w.prizeId === view.session.currentPrizeId,
  );
  const displayPrize =
    selectedWinnerRecord && view.currentPrize?.id === selectedWinnerRecord.prizeId
      ? view.currentPrize
      : selectedWinnerRecord
        ? view.currentPrize
        : view.lastPrize;
  const displayWinner = selectedWinnerRecord
    ? view.participants.find((p) => p.id === selectedWinnerRecord.participantId) ?? null
    : view.lastWinner;

  return (
    <div className="stage">
      <div key={fadeKey} className="stage-frame fade">
        {screen === "prize" ? <PrizeScreen prize={view.currentPrize} /> : null}
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
            winner={displayWinner}
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
        drawing={rolling || holding}
        waitingForStop={false}
        onToggleVisible={() => {
          void patchSession({ controlBarVisible: !view.session.controlBarVisible }).then(refresh);
        }}
        onScreen={(s) => {
          void goScreen(s);
        }}
        onPrize={(id) => {
          void onSelectPrize(id);
        }}
        onDraw={() => void onDraw()}
        onStop={() => undefined}
      />
    </div>
  );
}
