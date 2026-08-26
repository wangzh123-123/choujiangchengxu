import { Router } from "express";
import type { AppStores } from "../store/appStores.js";
import type { PresetMap, Prize } from "../types.js";
import { requireAdmin } from "../auth/adminAuth.js";
import { drawnCountForPrize, normalizePrize } from "../domain/prizeQuantity.js";
import { normalizePresetSlots, resizePresetSlots } from "../domain/presetSlots.js";

function isValidPrize(p: unknown): p is Prize {
  if (!p || typeof p !== "object") return false;
  const o = p as Prize;
  return (
    typeof o.id === "string" &&
    o.id.length > 0 &&
    typeof o.name === "string" &&
    o.name.trim().length > 0 &&
    typeof o.imagePath === "string" &&
    o.imagePath.length > 0 &&
    typeof o.order === "number" &&
    typeof o.quantity === "number" &&
    Number.isInteger(o.quantity) &&
    o.quantity >= 1
  );
}

export function prizesRouter(stores: AppStores): Router {
  const router = Router();

  router.get("/api/prizes", async (_req, res) => {
    res.json((await stores.prizes.read()).map((p) => normalizePrize(p)));
  });

  router.put("/api/prizes", requireAdmin, async (req, res) => {
    const body = req.body;
    if (!Array.isArray(body)) {
      res.status(400).json({ message: "奖品列表必须是数组" });
      return;
    }
    for (const item of body) {
      if (!isValidPrize(item)) {
        res.status(400).json({ message: "奖品缺少 name 或 imagePath" });
        return;
      }
    }
    const winners = await stores.winners.read();
    for (const prize of body) {
      const drawn = drawnCountForPrize(winners, prize.id);
      if (drawn > prize.quantity) {
        res.status(400).json({
          message: `该奖品已抽出 ${drawn} 人，数量不能小于 ${drawn}`,
        });
        return;
      }
    }
    await stores.prizes.write(body);
    const raw = (await stores.presets.read()) as Record<string, unknown>;
    const next: PresetMap = {};
    for (const prize of body) {
      if (!Object.prototype.hasOwnProperty.call(raw, prize.id)) {
        continue;
      }
      const resized = resizePresetSlots(
        normalizePresetSlots(raw[prize.id], prize.quantity),
        prize.quantity,
      );
      if (resized.some((s) => s !== null)) {
        next[prize.id] = resized;
      }
    }
    await stores.presets.write(next);
    res.json(body);
  });

  return router;
}
