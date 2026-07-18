import path from "node:path";
import { fileURLToPath } from "node:url";

const here = path.dirname(fileURLToPath(import.meta.url));

/** Project data directory: <repo>/data */
export const dataDir = path.resolve(here, "../../../data");

export const paths = {
  prizes: path.join(dataDir, "prizes.json"),
  participants: path.join(dataDir, "participants.json"),
  presets: path.join(dataDir, "presets.json"),
  winners: path.join(dataDir, "winners.json"),
  session: path.join(dataDir, "session.json"),
  config: path.join(dataDir, "config.json"),
  uploads: path.join(dataDir, "uploads"),
} as const;
