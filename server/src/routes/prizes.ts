import { Router } from "express";
import type { AppStores } from "../store/appStores.js";
import type { Prize } from "../types.js";
import { requireAdmin } from "../auth/adminAuth.js";

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
    typeof o.order === "number"
  );
}

export function prizesRouter(stores: AppStores): Router {
  const router = Router();

  router.get("/api/prizes", async (_req, res) => {
    res.json(await stores.prizes.read());
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
    await stores.prizes.write(body);
    res.json(body);
  });

  return router;
}
