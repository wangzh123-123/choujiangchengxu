import { randomUUID } from "node:crypto";
import { Router } from "express";
import { requireAdmin } from "../auth/adminAuth.js";
import { writeParticipantsXml } from "../domain/participantXml.js";
import { clearParticipantFromPresets, normalizePresetSlots } from "../domain/presetSlots.js";
import { prizeQuantity } from "../domain/prizeQuantity.js";
import type { AppStores } from "../store/appStores.js";
import type { Participant, PresetMap } from "../types.js";

async function persistParticipants(stores: AppStores, list: Participant[]): Promise<void> {
  await stores.participants.write(list);
  await writeParticipantsXml(
    stores.paths.participantsXml,
    list.map((row) => row.name),
  );
}

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
    await persistParticipants(stores, list);
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
    await persistParticipants(stores, list);
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
    const next = list.filter((p) => p.id !== id);
    await persistParticipants(stores, next);
    const prizes = await stores.prizes.read();
    const raw = (await stores.presets.read()) as Record<string, unknown>;
    const normalized: PresetMap = {};
    for (const [prizeId, value] of Object.entries(raw)) {
      const prize = prizes.find((p) => p.id === prizeId);
      const quantity = prize
        ? prizeQuantity(prize)
        : Array.isArray(value)
          ? value.length
          : 1;
      normalized[prizeId] = normalizePresetSlots(value, quantity);
    }
    await stores.presets.write(clearParticipantFromPresets(normalized, id));
    res.status(204).end();
  });

  router.delete("/api/participants", requireAdmin, async (_req, res) => {
    await persistParticipants(stores, []);
    await stores.presets.write({});
    res.status(204).end();
  });

  return router;
}
