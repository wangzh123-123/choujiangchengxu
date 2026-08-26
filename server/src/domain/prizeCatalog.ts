import { copyFile, mkdir } from "node:fs/promises";
import path from "node:path";
import { JsonStore } from "../store/jsonStore.js";
import { createStores } from "../store/appStores.js";
import { getCatalogPaths } from "../store/paths.js";
import { normalizePrize } from "./prizeQuantity.js";
import type { Prize } from "../types.js";

export const SETUP_UNAVAILABLE = "仅本地配奖可用";

export function shouldApplyPrizeSeed(env: NodeJS.ProcessEnv = process.env): boolean {
  return env.LOTTERY_SKIP_PRIZE_SEED !== "1";
}

export async function applyPrizeSeed(catalogDir: string, dataDir: string): Promise<void> {
  const catalog = getCatalogPaths(catalogDir);
  const catalogStore = new JsonStore<Prize[]>(catalog.prizes, []);
  const prizes = (await catalogStore.read()).map((p) => normalizePrize(p));
  const stores = createStores(dataDir);
  await stores.prizes.write(prizes);
  await mkdir(stores.paths.uploads, { recursive: true });
  await mkdir(catalog.uploads, { recursive: true });
  for (const prize of prizes) {
    const name = path.basename(prize.imagePath);
    if (!name) continue;
    try {
      await copyFile(path.join(catalog.uploads, name), path.join(stores.paths.uploads, name));
    } catch (err) {
      if ((err as NodeJS.ErrnoException).code !== "ENOENT") throw err;
    }
  }
  const session = await stores.session.read();
  const ids = new Set(prizes.map((p) => p.id));
  if (session.currentPrizeId && ids.has(session.currentPrizeId)) {
    return;
  }
  if (prizes.length === 0) {
    session.currentPrizeId = null;
  } else {
    const sorted = [...prizes].sort((a, b) => a.order - b.order);
    session.currentPrizeId = sorted[0]?.id ?? null;
  }
  await stores.session.write(session);
}

export async function maybeApplyPrizeSeed(catalogDir: string, dataDir: string): Promise<void> {
  if (!shouldApplyPrizeSeed()) return;
  await applyPrizeSeed(catalogDir, dataDir);
}
