import type { DrawResult, Participant, Prize, PublicScreen, PublicView, SessionState } from "./types";

export function publicViewPath(): string {
  return "/api/public/view";
}

async function parseJson<T>(res: Response): Promise<T> {
  const data = (await res.json()) as T & { message?: string };
  if (!res.ok) {
    throw new Error((data as { message?: string }).message ?? `HTTP ${res.status}`);
  }
  return data;
}

export async function fetchPublicView(): Promise<PublicView> {
  const res = await fetch(publicViewPath());
  return parseJson<PublicView>(res);
}

export async function patchSession(
  patch: Partial<Pick<SessionState, "publicScreen" | "controlBarVisible" | "drawPhase">>,
): Promise<SessionState> {
  const res = await fetch("/api/session", {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(patch),
  });
  return parseJson<SessionState>(res);
}

export async function setCurrentPrize(prizeId: string): Promise<SessionState> {
  const res = await fetch("/api/session/current-prize", {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ prizeId }),
  });
  return parseJson<SessionState>(res);
}

export async function addParticipant(name: string): Promise<Participant> {
  const res = await fetch("/api/participants", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ name }),
  });
  return parseJson<Participant>(res);
}

export async function patchParticipant(id: string, name: string): Promise<Participant> {
  const res = await fetch(`/api/participants/${id}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ name }),
  });
  return parseJson<Participant>(res);
}

export async function deleteParticipant(id: string): Promise<void> {
  const res = await fetch(`/api/participants/${id}`, { method: "DELETE" });
  if (res.status === 204) {
    return;
  }
  await parseJson(res);
}

export async function startDraw(): Promise<DrawResult> {
  const res = await fetch("/api/draw", { method: "POST" });
  return parseJson<DrawResult>(res);
}

export async function fetchPrizes(): Promise<Prize[]> {
  const res = await fetch("/api/prizes");
  return parseJson<Prize[]>(res);
}

export async function adminLogin(passphrase: string): Promise<{ token: string }> {
  const res = await fetch("/api/admin/login", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ passphrase }),
  });
  return parseJson(res);
}

export function imageUrl(imagePath: string): string {
  if (imagePath.startsWith("http") || imagePath.startsWith("/")) {
    return imagePath;
  }
  return `/uploads/${imagePath}`;
}

export type { PublicScreen };
