import { Router } from "express";
import { requireAdmin } from "../auth/adminAuth.js";
import { listEligible } from "../domain/eligibility.js";
import {
  normalizePresetSlots,
  uniqueNonEmptyIds,
} from "../domain/presetSlots.js";
import { prizeQuantity } from "../domain/prizeQuantity.js";
import type { AppStores } from "../store/appStores.js";
import type { PresetMap } from "../types.js";

export function presetsRouter(stores: AppStores): Router {
  const router = Router();

  router.get("/api/presets", requireAdmin, async (_req, res) => {
    const prizes = await stores.prizes.read();
    const raw = (await stores.presets.read()) as Record<string, unknown>;
    const out: PresetMap = {};
    for (const [prizeId, value] of Object.entries(raw)) {
      const prize = prizes.find((p) => p.id === prizeId);
      const quantity = prize
        ? prizeQuantity(prize)
        : Array.isArray(value)
          ? value.length
          : 1;
      out[prizeId] = normalizePresetSlots(value, quantity);
    }
    res.json(out);
  });

  router.put("/api/presets/:prizeId", requireAdmin, async (req, res) => {
    const prizeId = req.params.prizeId;
    const prizes = await stores.prizes.read();
    const prize = prizes.find((p) => p.id === prizeId);
    if (!prize) {
      res.status(404).json({ message: "奖品不存在" });
      return;
    }
    const quantity = prizeQuantity(prize);
    if (!Array.isArray(req.body?.slots) || req.body.slots.length !== quantity) {
      res.status(400).json({ message: "内定槽数量必须与奖品数量一致" });
      return;
    }
    const slots = normalizePresetSlots(req.body.slots, quantity);
    if (!uniqueNonEmptyIds(slots)) {
      res.status(400).json({ message: "同一奖品不能重复内定同一人" });
      return;
    }
    const participants = await stores.participants.read();
    for (const id of slots) {
      if (id && !participants.some((p) => p.id === id)) {
        res.status(404).json({ message: "用户不存在" });
        return;
      }
    }
    const presets = await stores.presets.read();
    const next = { ...presets, [prizeId]: slots };
    if (slots.every((s) => s === null)) {
      delete next[prizeId];
    }
    await stores.presets.write(next);
    res.json({ prizeId, slots });
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
