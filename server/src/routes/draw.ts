import { randomInt } from "node:crypto";
import { Router } from "express";
import { resolveWinner } from "../domain/draw.js";
import { listEligible } from "../domain/eligibility.js";
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
    if (winners.some((w) => w.prizeId === prizeId)) {
      res.status(400).json({ message: "该奖品已开奖" });
      return;
    }
    const participants = await stores.participants.read();
    const eligible = listEligible(participants, winners);
    if (eligible.length === 0) {
      res.status(400).json({ message: "没有可抽奖用户" });
      return;
    }
    const presets = await stores.presets.read();
    const presetId = presets[prizeId] ?? null;
    let winnerId: string;
    try {
      winnerId = resolveWinner({
        presetId,
        eligibleIds: eligible.map((e) => e.id),
        random: () => randomInt(0, 1_000_000) / 1_000_000,
      });
    } catch (err) {
      const code = err instanceof Error ? err.message : "DRAW_FAILED";
      res.status(400).json({ message: code === "PRESET_NOT_ELIGIBLE" ? "内定用户不可抽" : "开奖失败" });
      return;
    }
    const winner = eligible.find((e) => e.id === winnerId);
    if (!winner) {
      res.status(500).json({ message: "开奖结果异常" });
      return;
    }
    const record: WinnerRecord = {
      prizeId,
      participantId: winner.id,
      at: new Date().toISOString(),
    };
    winners.push(record);
    await stores.winners.write(winners);
    session.drawPhase = "revealed";
    session.publicScreen = "winner";
    session.lastWinnerParticipantId = winner.id;
    session.lastWinnerPrizeId = prizeId;
    await stores.session.write(session);
    res.json({
      prizeId,
      prizeName: prize.name,
      participantId: winner.id,
      name: winner.name,
    });
  });

  return router;
}
