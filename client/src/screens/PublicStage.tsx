import { useCallback, useEffect, useRef, useState } from "react";
import {
  fetchPrizes,
  fetchPublicView,
  patchSession,
  setCurrentPrize,
  startDraw,
} from "../api/client";
import type { Participant, Prize, PublicScreen, PublicView } from "../api/types";
import { HostControlBar } from "../components/HostControlBar";
import { startSettleHold } from "../components/settleHold";
import { DrawScreen } from "./DrawScreen";
import { EnrollScreen } from "./EnrollScreen";
import { PrizeScreen } from "./PrizeScreen";
import { WinnerScreen } from "./WinnerScreen";
import { afterHoldAction, canStartRollFromScreen, isComplete, startRollError } from "./drawFlow";
import { buildWinnerHistory } from "./winnerHistory";
import { shouldIgnoreScreenNav } from "./screenNav";
import { winnerScreenPrizeId } from "./winnerDisplay";
import { type CommittedDraw, displayWinnerPrizeId, winnersForPrizeWithCommit } from "./committedDraw";

export function PublicStage() {
  const [view, setView] = useState<PublicView | null>(null);
  const [prizes, setPrizes] = useState<Prize[]>([]);
  const [rolling, setRolling] = useState(false);
  const [settleName, setSettleName] = useState<string | null>(null);
  const [tickerNames, setTickerNames] = useState<string[]>([]);
  const [fadeKey, setFadeKey] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [holding, setHolding] = useState(false);
  const [stopping, setStopping] = useState(false);
  const [committedDraw, setCommittedDraw] = useState<CommittedDraw | null>(null);
  const rollingRef = useRef(false);
  const holdingRef = useRef(false);
  const skipRevealRef = useRef(false);
  const prizeCompleteRef = useRef(false);
  const settleNameRef = useRef<string | null>(null);
  const stoppingRef = useRef(false);
  const snapshotRef = useRef<Participant[]>([]);
  const cancelHoldRef = useRef<(() => void) | null>(null);
  const displayPrizeIdRef = useRef<string | null>(null);

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
      stoppingRef.current = false;
      setStopping(false);
      clearHold();
      displayPrizeIdRef.current = null;
    }
    await patchSession({ publicScreen: screen });
    setFadeKey((k) => k + 1);
    await refresh();
  }

  async function onSelectPrize(prizeId: string) {
    if (rollingRef.current || holdingRef.current || !view) {
      return;
    }
    setCommittedDraw(null);
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
    const prizeId = view.session.currentPrizeId;
    const drawnCount = view.winners.filter((w) => w.prizeId === prizeId).length;
    const prizeComplete = isComplete(drawnCount, view.currentPrize?.quantity ?? 1);
    const startWinnerPrizeId = winnerScreenPrizeId({
      currentPrizeId: prizeId,
      lastWinnerPrizeId: view.session.lastWinnerPrizeId,
      currentPrizeComplete: prizeComplete,
    });
    if (
      !canStartRollFromScreen({
        screen: view.session.publicScreen,
        currentPrizeId: prizeId,
        winnerPrizeId: startWinnerPrizeId,
        prizeComplete,
      })
    ) {
      return;
    }
    skipRevealRef.current = false;
    clearHold();
    setError(null);
    const err = startRollError({
      currentPrizeId: prizeId,
      prizeComplete,
      canDraw: view.canDraw,
    });
    if (err) {
      setError(err);
      return;
    }
    if (view.eligible.length === 0) {
      setError("没有可抽奖用户");
      return;
    }
    setCommittedDraw(null);
    snapshotRef.current = view.eligible.slice();
    stoppingRef.current = false;
    setStopping(false);
    displayPrizeIdRef.current = prizeId;
    try {
      rollingRef.current = true;
      settleNameRef.current = null;
      prizeCompleteRef.current = false;
      setRolling(true);
      setSettleName(null);
      setTickerNames(snapshotRef.current.map((p) => p.name));
      await patchSession({ publicScreen: "draw", drawPhase: "rolling" });
      setFadeKey((k) => k + 1);
      await refresh();
    } catch (err) {
      rollingRef.current = false;
      settleNameRef.current = null;
      setRolling(false);
      setSettleName(null);
      displayPrizeIdRef.current = null;
      const raw = err instanceof Error ? err.message : "开奖失败";
      if (!/内定/.test(raw)) {
        setError(raw);
      }
      await refresh();
    }
  }

  function onStop() {
    if (!rollingRef.current || stoppingRef.current || settleNameRef.current !== null) {
      return;
    }
    stoppingRef.current = true;
    setStopping(true);
  }

  async function onTickerSettled(index: number) {
    if (skipRevealRef.current) {
      return;
    }
    const snap = snapshotRef.current;
    const person = snap.length > 0 ? snap[index % snap.length] : undefined;
    if (!person) {
      stoppingRef.current = false;
      setStopping(false);
      setError("没有可抽奖用户");
      return;
    }
    try {
      const result = await startDraw(person.id);
      setCommittedDraw({
        prizeId: result.prizeId,
        participantId: result.participantId,
        name: result.name,
      });
      prizeCompleteRef.current = result.prizeComplete;
      settleNameRef.current = result.name;
      setSettleName(result.name);
      await refresh();
      rollingRef.current = false;
      setRolling(false);
      holdingRef.current = true;
      setHolding(true);
      cancelHoldRef.current?.();
      cancelHoldRef.current = startSettleHold(() => {
        cancelHoldRef.current = null;
        if (afterHoldAction(prizeCompleteRef.current) === "winner") {
          void (async () => {
            await goScreen("winner", true);
            displayPrizeIdRef.current = null;
            holdingRef.current = false;
            setHolding(false);
          })();
          return;
        }
        displayPrizeIdRef.current = null;
        holdingRef.current = false;
        setHolding(false);
      });
    } catch (err) {
      stoppingRef.current = false;
      setStopping(false);
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

  if (!view) {
    return <div className="loading">{error ?? "加载中…"}</div>;
  }

  const screen = rolling || holding ? "draw" : view.session.publicScreen;
  const freezePrize = rolling || holding;
  const visiblePrizeId =
    freezePrize && displayPrizeIdRef.current
      ? displayPrizeIdRef.current
      : view.session.currentPrizeId;
  const drawPrize =
    prizes.find((p) => p.id === visiblePrizeId) ??
    (view.currentPrize?.id === visiblePrizeId ? view.currentPrize : null) ??
    (view.lastPrize?.id === visiblePrizeId ? view.lastPrize : null) ??
    view.currentPrize;
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
  const fallbackPrizeId = winnerScreenPrizeId({
    currentPrizeId: view.session.currentPrizeId,
    lastWinnerPrizeId: view.session.lastWinnerPrizeId,
    currentPrizeComplete: isComplete(
      currentDrawnCount,
      view.currentPrize?.quantity ?? 1,
    ),
  });
  const winnerPrizeId = displayWinnerPrizeId(committedDraw, fallbackPrizeId);
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
            prize={drawPrize}
            names={namesForTicker}
            rolling={rolling}
            stopping={stopping}
            onSettled={onTickerSettled}
          />
        ) : null}
        {screen === "winner" ? (
          <WinnerScreen
            prize={displayPrize}
            winners={winnersForPrizeWithCommit(
              view.winners,
              winnerPrizeId,
              view.participants,
              committedDraw,
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
        currentPrizeId={visiblePrizeId}
        winnerPrizeId={winnerPrizeId}
        drawing={holding || (rolling && stopping)}
        waitingForStop={rolling && !stopping}
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
