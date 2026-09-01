import { randomInt } from "node:crypto";
import { Router } from "express";
import { resolveWinner } from "../domain/draw.js";
import { listEligible } from "../domain/eligibility.js";
import { nextIncompletePrizeId } from "../domain/nextPrize.js";
import { normalizePresetSlots, presetSlotAt } from "../domain/presetSlots.js";
import { drawnCountForPrize, isPrizeComplete, prizeQuantity } from "../domain/prizeQuantity.js";
import type { AppStores } from "../store/appStores.js";
import type { WinnerRecord } from "../types.js";

export function drawRouter(stores: AppStores): Router {
  const router = Router();

  router.post("/api/draw", async (_req, res) => {
    const session = await stores.session.read();
    if (!session.currentPrizeId) {
      res.status(400).json({ message: "未选择当前奖品，无法开奖" });
      return;
    }
    const prizeId = session.currentPrizeId;
    const prizes = await stores.prizes.read();
    const prize = prizes.find((p) => p.id === prizeId);
    if (!prize) {
      res.status(400).json({ message: "当前奖品不存在" });
      return;
    }
    const winners = await stores.winners.read();
    const quantity = prizeQuantity(prize);
    const drawnCountBefore = drawnCountForPrize(winners, prizeId);
    if (isPrizeComplete(winners, prizeId, quantity)) {
      res.status(400).json({ message: "该奖品已抽完" });
      return;
    }
    const participants = await stores.participants.read();
    const presets = await stores.presets.read();
    const slots = normalizePresetSlots(presets[prizeId], quantity);
    const presetId = presetSlotAt(slots, drawnCountBefore);
    const eligible = listEligible(participants, winners);

    let winnerId: string;
    if (presetId) {
      // Preset has highest priority: ignore repeat-winner eligibility.
      winnerId = resolveWinner({
        presetId,
        eligibleIds: eligible.map((e) => e.id),
        random: () => 0,
      });
    } else {
      if (eligible.length === 0) {
        res.status(400).json({ message: "没有可抽奖用户" });
        return;
      }
      try {
        winnerId = resolveWinner({
          presetId: null,
          eligibleIds: eligible.map((e) => e.id),
          random: () => randomInt(0, 1_000_000) / 1_000_000,
        });
      } catch {
        res.status(400).json({ message: "开奖失败" });
        return;
      }
    }

    const winner = participants.find((e) => e.id === winnerId);
    if (!winner) {
      res.status(400).json({ message: "开奖失败" });
      return;
    }
    const record: WinnerRecord = {
      prizeId,
      participantId: winner.id,
      at: new Date().toISOString(),
    };
    winners.push(record);
    await stores.winners.write(winners);
    // Keep publicScreen on draw so the client can play the rolling animation first.
    const drawnCount = drawnCountBefore + 1;
    const prizeComplete = isPrizeComplete(winners, prizeId, quantity);
    session.drawPhase = "revealed";
    session.publicScreen = "draw";
    session.lastWinnerParticipantId = winner.id;
    session.lastWinnerPrizeId = prizeId;
    if (prizeComplete) {
      const nextId = nextIncompletePrizeId(prizes, winners, prizeId);
      if (nextId) {
        session.currentPrizeId = nextId;
      }
    }
    await stores.session.write(session);
    res.json({
      prizeId,
      prizeName: prize.name,
      participantId: winner.id,
      name: winner.name,
      drawnCount,
      quantity,
      prizeComplete,
      currentPrizeId: session.currentPrizeId,
    });
  });

  return router;
}
