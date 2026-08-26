import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { Router, type Request, type RequestHandler, type Response } from "express";
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

function isImageUpload(contentType: string | undefined, filename: string, body: Buffer): boolean {
  if (!body || body.length === 0) return false;
  const type = (contentType ?? "").toLowerCase();
  if (type.startsWith("image/")) return true;
  return /\.(png|jpe?g|gif|webp|svg)$/i.test(filename);
}

function safeFilename(raw: string): string {
  const base = path.basename(raw).replace(/[^a-zA-Z0-9._-]/g, "_");
  return base.length > 0 ? base : "upload.bin";
}

export function setupPrizeImageHandler(catalogDir: string): RequestHandler {
  const catalog = getCatalogPaths(catalogDir);
  return async (req, res) => {
    if (!isPrizeSetupEnabled()) {
      res.status(404).json({ message: SETUP_UNAVAILABLE });
      return;
    }
    const body = Buffer.isBuffer(req.body) ? req.body : Buffer.from(req.body ?? []);
    const filenameHeader = req.header("x-filename") ?? "upload.png";
    const filename = safeFilename(filenameHeader);
    if (!isImageUpload(req.header("content-type"), filename, body)) {
      res.status(400).json({ message: "请上传图片" });
      return;
    }
    await mkdir(catalog.uploads, { recursive: true });
    const stored = `${Date.now()}-${filename}`;
    await writeFile(path.join(catalog.uploads, stored), body);
    res.json({ imagePath: stored });
  };
}
