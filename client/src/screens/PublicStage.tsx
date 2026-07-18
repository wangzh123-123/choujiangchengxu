import { useCallback, useEffect, useState } from "react";
import {
  fetchPrizes,
  fetchPublicView,
  patchSession,
  setCurrentPrize,
  startDraw,
} from "../api/client";
import type { DrawResult, PublicScreen, PublicView } from "../api/types";
import { HostControlBar } from "../components/HostControlBar";
import { DrawScreen } from "./DrawScreen";
import { EnrollScreen } from "./EnrollScreen";
import { PrizeScreen } from "./PrizeScreen";
import { WinnerScreen } from "./WinnerScreen";

export function PublicStage() {
  const [view, setView] = useState<PublicView | null>(null);
  const [prizes, setPrizes] = useState<Array<{ id: string; name: string }>>([]);
  const [rolling, setRolling] = useState(false);
  const [settleName, setSettleName] = useState<string | null>(null);
  const [fadeKey, setFadeKey] = useState(0);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    const [v, p] = await Promise.all([fetchPublicView(), fetchPrizes()]);
    setView(v);
    setPrizes(p.map((x) => ({ id: x.id, name: x.name })));
  }, []);

  useEffect(() => {
    void refresh().catch((err: unknown) => {
      setError(err instanceof Error ? err.message : "加载失败");
    });
    const timer = window.setInterval(() => {
      void refresh().catch(() => undefined);
    }, 3000);
    return () => window.clearInterval(timer);
  }, [refresh]);

  async function goScreen(screen: PublicScreen) {
    await patchSession({ publicScreen: screen });
    setFadeKey((k) => k + 1);
    await refresh();
  }

  async function onDraw() {
    setError(null);
    try {
      await patchSession({ publicScreen: "draw", drawPhase: "rolling" });
      setRolling(true);
      setSettleName(null);
      setFadeKey((k) => k + 1);
      const result: DrawResult = await startDraw();
      setSettleName(result.name);
      await refresh();
    } catch (err) {
      setRolling(false);
      setError(err instanceof Error ? err.message : "开奖失败");
      await refresh();
    }
  }

  if (!view) {
    return <div className="loading">{error ?? "加载中…"}</div>;
  }

  const screen = view.session.publicScreen;
  const names = view.eligible.map((p) => p.name);

  return (
    <div className="stage">
      <div key={fadeKey} className="stage-frame fade">
        {screen === "prize" ? <PrizeScreen prize={view.currentPrize} /> : null}
        {screen === "enroll" ? <EnrollScreen onAdded={() => void refresh()} /> : null}
        {screen === "draw" ? (
          <DrawScreen
            prize={view.currentPrize}
            names={names}
            rolling={rolling}
            settleName={settleName}
            onSettled={() => {
              setRolling(false);
              void goScreen("winner");
            }}
          />
        ) : null}
        {screen === "winner" ? (
          <WinnerScreen prize={view.lastPrize} winner={view.lastWinner} />
        ) : null}
      </div>
      {error ? <div className="toast error">{error}</div> : null}
      <HostControlBar
        visible={view.session.controlBarVisible}
        screen={screen}
        prizes={prizes}
        currentPrizeId={view.session.currentPrizeId}
        drawing={rolling}
        onToggleVisible={() => {
          void patchSession({ controlBarVisible: !view.session.controlBarVisible }).then(refresh);
        }}
        onScreen={(s) => void goScreen(s)}
        onPrize={(id) => {
          void setCurrentPrize(id).then(refresh);
        }}
        onDraw={() => void onDraw()}
      />
    </div>
  );
}
