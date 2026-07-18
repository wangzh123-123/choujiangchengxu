import express, { type Express } from "express";
import cors from "cors";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { createStores, type AppStores } from "./store/appStores.js";
import { adminRouter } from "./routes/admin.js";
import { prizesRouter } from "./routes/prizes.js";
import { participantsRouter } from "./routes/participants.js";
import { presetsRouter } from "./routes/presets.js";
import { drawRouter } from "./routes/draw.js";
import { sessionRouter } from "./routes/session.js";

export type CreateAppOptions = {
  stores?: AppStores;
  dataDir?: string;
};

export function createApp(options: CreateAppOptions = {}): Express {
  const stores = options.stores ?? createStores(options.dataDir);
  const app = express();
  app.use(cors({ origin: true, credentials: true }));
  app.use(express.json({ limit: "2mb" }));
  app.use("/uploads", express.static(stores.paths.uploads));

  app.get("/api/health", (_req, res) => {
    res.status(200).json({ ok: true });
  });

  app.use(adminRouter());
  app.use(prizesRouter(stores));
  app.use(participantsRouter(stores));
  app.use(presetsRouter(stores));
  app.use(drawRouter(stores));
  app.use(sessionRouter(stores));

  return app;
}

function isDirectRun(): boolean {
  const entry = process.argv[1];
  if (!entry) {
    return false;
  }
  return path.resolve(entry) === path.resolve(fileURLToPath(import.meta.url));
}

if (isDirectRun()) {
  const port = Number(process.env.PORT ?? 3001);
  const host = process.env.HOST ?? "127.0.0.1";
  createApp().listen(port, host, () => {
    console.log(`lottery-server listening on http://${host}:${port}`);
  });
}
