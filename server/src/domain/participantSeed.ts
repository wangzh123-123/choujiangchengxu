import { randomUUID } from "node:crypto";
import { readFile } from "node:fs/promises";
import { createStores } from "../store/appStores.js";
import { getPaths } from "../store/paths.js";
import { parseParticipantsXml, writeParticipantsXml } from "./participantXml.js";

export function shouldApplyParticipantSeed(env: NodeJS.ProcessEnv = process.env): boolean {
  return env.LOTTERY_SKIP_PARTICIPANT_SEED !== "1";
}

export async function applyParticipantSeed(dataDir: string): Promise<void> {
  const p = getPaths(dataDir);
  const stores = createStores(dataDir);
  let xmlRaw: string | null = null;
  try {
    xmlRaw = await readFile(p.participantsXml, "utf8");
  } catch (err) {
    const code = (err as NodeJS.ErrnoException).code;
    if (code !== "ENOENT") {
      throw err;
    }
  }
  if (xmlRaw === null) {
    const current = await stores.participants.read();
    const names = current.map((row) => row.name.trim()).filter((name) => name.length > 0);
    await writeParticipantsXml(p.participantsXml, names);
    xmlRaw = await readFile(p.participantsXml, "utf8");
  }
  const names = parseParticipantsXml(xmlRaw);
  const next = names.map((name) => ({ id: randomUUID(), name }));
  await stores.participants.write(next);
  await stores.winners.write([]);
  await stores.presets.write({});
  const session = await stores.session.read();
  session.drawPhase = "idle";
  session.lastWinnerParticipantId = null;
  session.lastWinnerPrizeId = null;
  session.publicScreen = "enroll";
  await stores.session.write(session);
}

export async function maybeApplyParticipantSeed(dataDir: string): Promise<void> {
  if (!shouldApplyParticipantSeed()) {
    return;
  }
  await applyParticipantSeed(dataDir);
}
