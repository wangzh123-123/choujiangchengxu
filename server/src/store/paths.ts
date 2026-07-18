import path from "node:path";
import { fileURLToPath } from "node:url";

const here = path.dirname(fileURLToPath(import.meta.url));

/** Project data directory: env override or <repo>/data */
export function resolveDataDir(): string {
  if (process.env.LOTTERY_DATA_DIR) {
    return path.resolve(process.env.LOTTERY_DATA_DIR);
  }
  return path.resolve(here, "../../../data");
}

export function getPaths(dataDir = resolveDataDir()) {
  return {
    dataDir,
    prizes: path.join(dataDir, "prizes.json"),
    participants: path.join(dataDir, "participants.json"),
    presets: path.join(dataDir, "presets.json"),
    winners: path.join(dataDir, "winners.json"),
    session: path.join(dataDir, "session.json"),
    config: path.join(dataDir, "config.json"),
    uploads: path.join(dataDir, "uploads"),
  } as const;
}

export const paths = getPaths();
