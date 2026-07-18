export type Prize = {
  id: string;
  name: string;
  imagePath: string;
  order: number;
};

export type Participant = {
  id: string;
  name: string;
};

export type PresetMap = Record<string, string>;

export type WinnerRecord = {
  prizeId: string;
  participantId: string;
  at: string;
};

export type PublicScreen = "prize" | "enroll" | "draw" | "winner";

export type DrawPhase = "idle" | "rolling" | "revealed";

export type SessionState = {
  currentPrizeId: string | null;
  publicScreen: PublicScreen;
  controlBarVisible: boolean;
  drawPhase: DrawPhase;
  lastWinnerParticipantId: string | null;
  lastWinnerPrizeId: string | null;
};

export type AppConfig = {
  adminPassphrase: string;
};
