import { Router, type Request, type Response } from "express";
import { JsonStore } from "../store/jsonStore.js";
import { getCatalogPaths } from "../store/paths.js";
import { applyPrizeSeed, SETUP_UNAVAILABLE } from "../domain/prizeCatalog.js";
import { isValidPrize } from "../domain/prizeValidate.js";
import type { AppStores } from "../store/appStores.js";
import type { Prize } from "../types.js";

export function isPrizeSetupEnabled(env: NodeJS.ProcessEnv = process.env): boolean {
  return env.LOTTERY_PRIZE_SETUP === "1";
}

function rejectIfDisabled(_req: Request, res: Response): boolean {
  if (isPrizeSetupEnabled()) return false;
  res.status(404).json({ message: SETUP_UNAVAILABLE });
  return true;
}

export function setupPrizesRouter(stores: AppStores, catalogDir: string): Router {
  const router = Router();
  const catalog = getCatalogPaths(catalogDir);
  const catalogStore = new JsonStore<Prize[]>(catalog.prizes, []);

  router.get("/api/setup/prizes", async (_req, res) => {
    if (rejectIfDisabled(_req, res)) return;
    res.json(await catalogStore.read());
  });

  router.put("/api/setup/prizes", async (req, res) => {
    if (rejectIfDisabled(req, res)) return;
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
    await catalogStore.write(body);
    await applyPrizeSeed(catalogDir, stores.paths.dataDir);
    res.json(body);
  });

  return router;
}
