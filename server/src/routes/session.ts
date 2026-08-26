import { Router } from "express";
import { computeCanDraw } from "../domain/canDraw.js";
import { listEligible } from "../domain/eligibility.js";
import { normalizePresetSlots } from "../domain/presetSlots.js";
import { normalizePrize, prizeQuantity } from "../domain/prizeQuantity.js";
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
    const currentRaw = prizes.find((p) => p.id === session.currentPrizeId) ?? null;
    const currentPrize = currentRaw ? normalizePrize(currentRaw) : null;
    const lastWinner =
      session.lastWinnerParticipantId == null
        ? null
        : participants.find((p) => p.id === session.lastWinnerParticipantId) ?? null;
    const lastPrizeRaw =
      session.lastWinnerPrizeId == null
        ? null
        : prizes.find((p) => p.id === session.lastWinnerPrizeId) ?? null;
    const lastPrize = lastPrizeRaw ? normalizePrize(lastPrizeRaw) : null;
    const presets = await stores.presets.read();
    const slots = currentPrize
      ? normalizePresetSlots(presets[currentPrize.id], prizeQuantity(currentPrize))
      : [];
    const eligible = listEligible(participants, winners);
    const canDraw = computeCanDraw({
      prize: currentPrize,
      winners,
      eligibleCount: eligible.length,
      slots,
    });
    res.json({
      session,
      currentPrize,
      participants,
      eligible,
      lastWinner,
      lastPrize,
      winners,
      canDraw,
    });
  });

  return router;
}
