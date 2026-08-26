import express, { type Express } from "express";
import cors from "cors";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { maybeApplyPrizeSeed } from "./domain/prizeCatalog.js";
import { createStores, type AppStores } from "./store/appStores.js";
import { resolveCatalogDir, resolveDataDir } from "./store/paths.js";
import { adminRouter } from "./routes/admin.js";
import { prizesRouter } from "./routes/prizes.js";
import { setupPrizesRouter, setupPrizeImageHandler } from "./routes/setupPrizes.js";
import { participantsRouter } from "./routes/participants.js";
import { presetsRouter } from "./routes/presets.js";
import { drawRouter } from "./routes/draw.js";
import { winnersRouter } from "./routes/winners.js";
import { sessionRouter } from "./routes/session.js";

export type CreateAppOptions = {
  stores?: AppStores;
  dataDir?: string;
  catalogDir?: string;
  clientDist?: string;
};

export function createApp(options: CreateAppOptions = {}): Express {
  const stores = options.stores ?? createStores(options.dataDir);
  const catalogDir = options.catalogDir ?? resolveCatalogDir();
  const app = express();
  app.use(cors({ origin: true, credentials: true }));
  app.post(
    "/api/setup/prizes/image",
    express.raw({ type: () => true, limit: "8mb" }),
    setupPrizeImageHandler(catalogDir),
  );
  app.use(express.json({ limit: "2mb" }));
  app.use("/uploads", express.static(stores.paths.uploads));

  app.get("/api/health", (_req, res) => {
    res.status(200).json({ ok: true });
  });

  app.use(adminRouter());
  app.use(prizesRouter(stores));
  app.use(setupPrizesRouter(stores, catalogDir));
  app.use(participantsRouter(stores));
  app.use(presetsRouter(stores));
  app.use(drawRouter(stores));
  app.use(winnersRouter(stores));
  app.use(sessionRouter(stores));

  if (options.clientDist) {
    const dist = path.resolve(options.clientDist);
    app.use(express.static(dist));
    app.get("*", (req, res, next) => {
      if (req.method !== "GET" && req.method !== "HEAD") {
        return next();
      }
      if (req.path.startsWith("/api") || req.path.startsWith("/uploads")) {
        return next();
      }
      res.sendFile(path.join(dist, "index.html"));
    });
  }

  return app;
}

function isDirectRun(): boolean {
  const entry = process.argv[1];
  if (!entry) {
    return false;
  }
  return path.resolve(entry) === path.resolve(fileURLToPath(import.meta.url));
}

async function main(): Promise<void> {
  const here = path.dirname(fileURLToPath(import.meta.url));
  const isProd = process.env.NODE_ENV === "production";
  const port = Number(process.env.PORT ?? 3001);
  const host = isProd ? (process.env.HOST ?? "0.0.0.0") : (process.env.HOST ?? "127.0.0.1");
  const clientDist = isProd ? path.resolve(here, "../../client/dist") : undefined;
  await maybeApplyPrizeSeed(resolveCatalogDir(), resolveDataDir());
  createApp({ clientDist }).listen(port, host, () => {
    console.log(`lottery-server listening on http://${host}:${port}`);
  });
}

if (isDirectRun()) {
  void main();
}
