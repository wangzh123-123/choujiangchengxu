import { Router } from "express";
import { requireAdmin } from "../auth/adminAuth.js";
import type { AppStores } from "../store/appStores.js";

export function winnersRouter(stores: AppStores): Router {
  const router = Router();

  router.get("/api/winners", async (_req, res) => {
    res.json(await stores.winners.read());
  });

  router.delete("/api/winners", requireAdmin, async (_req, res) => {
    await stores.winners.write([]);
    const session = await stores.session.read();
    session.lastWinnerParticipantId = null;
    session.lastWinnerPrizeId = null;
    session.drawPhase = "idle";
    await stores.session.write(session);
    res.status(204).end();
  });

  return router;
}
