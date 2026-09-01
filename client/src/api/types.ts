export type PublicScreen = "prize" | "enroll" | "draw" | "winner";

export type Prize = {
  id: string;
  name: string;
  imagePath: string;
  order: number;
  quantity: number;
};

export type Participant = {
  id: string;
  name: string;
};

export type SessionState = {
  currentPrizeId: string | null;
  publicScreen: PublicScreen;
  controlBarVisible: boolean;
  drawPhase: "idle" | "rolling" | "revealed";
  lastWinnerParticipantId: string | null;
  lastWinnerPrizeId: string | null;
};

export type PublicView = {
  session: SessionState;
  currentPrize: Prize | null;
  participants: Participant[];
  eligible: Participant[];
  lastWinner: Participant | null;
  lastPrize: Prize | null;
  winners: Array<{ prizeId: string; participantId: string; at: string }>;
  canDraw: boolean;
};

export type DrawResult = {
  prizeId: string;
  prizeName: string;
  participantId: string;
  name: string;
  drawnCount: number;
  quantity: number;
  prizeComplete: boolean;
  currentPrizeId: string | null;
};
