import { Router } from "express";
import { listEligible } from "../domain/eligibility.js";
import type { AppStores } from "../store/appStores.js";
import type { PublicScreen, SessionState } from "../types.js";

const screens: PublicScreen[] = ["prize", "enroll", "draw", "winner"];

export function sessionRouter(stores: AppStores): Router {
  const router = Router();

  router.get("/api/session", async (_req, res) => {
    res.json(await stores.session.read());
  });

  router.put("/api/session/current-prize", async (req, res) => {
    const prizeId = typeof req.body?.prizeId === "string" ? req.body.prizeId : "";
    const prizes = await stores.prizes.read();
    if (!prizes.some((p) => p.id === prizeId)) {
      res.status(400).json({ message: "奖品不存在" });
      return;
    }
    const session = await stores.session.read();
    session.currentPrizeId = prizeId;
    await stores.session.write(session);
    res.json(session);
  });

  router.patch("/api/session", async (req, res) => {
    const session = await stores.session.read();
    const body = req.body as Partial<SessionState>;
    if (body.publicScreen !== undefined) {
      if (!screens.includes(body.publicScreen)) {
        res.status(400).json({ message: "无效屏幕" });
        return;
      }
      session.publicScreen = body.publicScreen;
    }
    if (typeof body.controlBarVisible === "boolean") {
      session.controlBarVisible = body.controlBarVisible;
    }
    if (body.drawPhase !== undefined) {
      session.drawPhase = body.drawPhase;
    }
    await stores.session.write(session);
    res.json(session);
  });

  router.get("/api/public/view", async (_req, res) => {
    const session = await stores.session.read();
    const prizes = await stores.prizes.read();
    const participants = await stores.participants.read();
    const winners = await stores.winners.read();
    const currentPrize = prizes.find((p) => p.id === session.currentPrizeId) ?? null;
    const lastWinner =
      session.lastWinnerParticipantId == null
        ? null
        : participants.find((p) => p.id === session.lastWinnerParticipantId) ?? null;
    const lastPrize =
      session.lastWinnerPrizeId == null
        ? null
        : prizes.find((p) => p.id === session.lastWinnerPrizeId) ?? null;
    res.json({
      session,
      currentPrize,
      participants,
      eligible: listEligible(participants, winners),
      lastWinner,
      lastPrize,
      winners,
    });
  });

  return router;
}
