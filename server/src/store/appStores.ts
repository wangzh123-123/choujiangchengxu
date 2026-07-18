import { JsonStore } from "./jsonStore.js";
import { getPaths } from "./paths.js";
import type {
  AppConfig,
  Participant,
  PresetMap,
  Prize,
  SessionState,
  WinnerRecord,
} from "../types.js";

const defaultSession: SessionState = {
  currentPrizeId: null,
  publicScreen: "prize",
  controlBarVisible: true,
  drawPhase: "idle",
  lastWinnerParticipantId: null,
  lastWinnerPrizeId: null,
};

export function createStores(dataDir?: string) {
  const p = getPaths(dataDir);
  return {
    paths: p,
    prizes: new JsonStore<Prize[]>(p.prizes, []),
    participants: new JsonStore<Participant[]>(p.participants, []),
    presets: new JsonStore<PresetMap>(p.presets, {}),
    winners: new JsonStore<WinnerRecord[]>(p.winners, []),
    session: new JsonStore<SessionState>(p.session, defaultSession),
    config: new JsonStore<AppConfig>(p.config, { adminPassphrase: "admin123" }),
  };
}

export type AppStores = ReturnType<typeof createStores>;
