import { randomUUID } from "node:crypto";
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
    const name = typeof req.body?.name === "string" ? req.body.name.trim() : "";
    if (!name) {
      res.status(400).json({ message: "name 不能为空" });
      return;
    }
    const list = await stores.participants.read();
    if (list.some((p) => p.name === name)) {
      res.status(409).json({ message: "名称重复，请重新输入" });
      return;
    }
    const next: Participant = { id: randomUUID(), name };
    list.push(next);
    await stores.participants.write(list);
    res.status(201).json(next);
  });

  router.patch("/api/participants/:id", async (req, res) => {
    const id = req.params.id;
    const name = typeof req.body?.name === "string" ? req.body.name.trim() : "";
    if (!id) {
      res.status(400).json({ message: "id 不能为空" });
      return;
    }
    if (!name) {
      res.status(400).json({ message: "name 不能为空" });
      return;
    }
    const list = await stores.participants.read();
    const current = list.find((p) => p.id === id);
    if (!current) {
      res.status(404).json({ message: "用户不存在" });
      return;
    }
    if (current.name !== name && list.some((p) => p.name === name)) {
      res.status(409).json({ message: "名称重复，请重新输入" });
      return;
    }
    current.name = name;
    await stores.participants.write(list);
    res.json(current);
  });

  router.delete("/api/participants/:id", async (req, res) => {
    const id = req.params.id;
    if (!id) {
      res.status(400).json({ message: "id 不能为空" });
      return;
    }
    const list = await stores.participants.read();
    if (!list.some((p) => p.id === id)) {
      res.status(404).json({ message: "用户不存在" });
      return;
    }
    const winners = await stores.winners.read();
    if (winners.some((w) => w.participantId === id)) {
      res.status(409).json({ message: "已中奖用户不能删除" });
      return;
    }
    await stores.participants.write(list.filter((p) => p.id !== id));
    const presets = await stores.presets.read();
    const nextPresets: Record<string, string> = {};
    for (const [prizeId, participantId] of Object.entries(presets)) {
      if (participantId !== id) {
        nextPresets[prizeId] = participantId;
      }
    }
    await stores.presets.write(nextPresets);
    res.status(204).end();
  });

  router.delete("/api/participants", requireAdmin, async (_req, res) => {
    await stores.participants.write([]);
    await stores.presets.write({});
    res.status(204).end();
  });

  return router;
}
