import { Router } from "express";
import { requireAdmin } from "../auth/adminAuth.js";
import { listEligible } from "../domain/eligibility.js";
import type { AppStores } from "../store/appStores.js";

export function presetsRouter(stores: AppStores): Router {
  const router = Router();

  router.get("/api/presets", requireAdmin, async (_req, res) => {
    res.json(await stores.presets.read());
  });

  router.put("/api/presets/:prizeId", requireAdmin, async (req, res) => {
    const prizeId = req.params.prizeId;
    const participantId =
      typeof req.body?.participantId === "string" ? req.body.participantId : "";
    if (!prizeId || !participantId) {
      res.status(400).json({ message: "prizeId 与 participantId 必填" });
      return;
    }
    const prizes = await stores.prizes.read();
    if (!prizes.some((p) => p.id === prizeId)) {
      res.status(404).json({ message: "奖品不存在" });
      return;
    }
    const participants = await stores.participants.read();
    if (!participants.some((p) => p.id === participantId)) {
      res.status(404).json({ message: "用户不存在" });
      return;
    }
    const winners = await stores.winners.read();
    if (winners.some((w) => w.participantId === participantId)) {
      res.status(400).json({ message: "该用户已中奖，不能再被内定" });
      return;
    }
    const presets = await stores.presets.read();
    presets[prizeId] = participantId;
    await stores.presets.write(presets);
    res.json({ prizeId, participantId });
  });

  router.delete("/api/presets/:prizeId", requireAdmin, async (req, res) => {
    const prizeId = req.params.prizeId;
    const presets = await stores.presets.read();
    delete presets[prizeId];
    await stores.presets.write(presets);
    res.status(204).end();
  });

  router.get("/api/eligible", async (_req, res) => {
    const participants = await stores.participants.read();
    const winners = await stores.winners.read();
    res.json(listEligible(participants, winners));
  });

  return router;
}
