import { Router } from "express";
import { requireAdmin } from "../auth/adminAuth.js";
import type { AppStores } from "../store/appStores.js";
import type { Participant } from "../types.js";

export function participantsRouter(stores: AppStores): Router {
  const router = Router();

  router.get("/api/participants", async (_req, res) => {
    res.json(await stores.participants.read());
  });

  router.post("/api/participants", async (req, res) => {
    const id = typeof req.body?.id === "string" ? req.body.id.trim() : "";
    const name = typeof req.body?.name === "string" ? req.body.name.trim() : "";
    if (!id || !name) {
      res.status(400).json({ message: "id 与 name 均不能为空" });
      return;
    }
    const list = await stores.participants.read();
    if (list.some((p) => p.name === name)) {
      res.status(409).json({ message: "名称重复，请重新输入" });
      return;
    }
    if (list.some((p) => p.id === id)) {
      res.status(409).json({ message: "id 已存在" });
      return;
    }
    const next: Participant = { id, name };
    list.push(next);
    await stores.participants.write(list);
    res.status(201).json(next);
  });

  router.delete("/api/participants", requireAdmin, async (_req, res) => {
    await stores.participants.write([]);
    // Presets reference participants; clear them together.
    await stores.presets.write({});
    res.status(204).end();
  });

  return router;
}
