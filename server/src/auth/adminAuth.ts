import { randomBytes } from "node:crypto";
import type { NextFunction, Request, Response } from "express";
import { JsonStore } from "../store/jsonStore.js";
import { getPaths } from "../store/paths.js";
import type { AppConfig } from "../types.js";

const sessions = new Set<string>();

export function createToken(): string {
  return randomBytes(24).toString("hex");
}

export async function verifyPassphrase(passphrase: string): Promise<boolean> {
  const store = new JsonStore<AppConfig>(getPaths().config, { adminPassphrase: "admin123" });
  const cfg = await store.read();
  return passphrase === cfg.adminPassphrase;
}

export function grantSession(token: string): void {
  sessions.add(token);
}

export function revokeSession(token: string): void {
  sessions.delete(token);
}

export function clearSessionsForTests(): void {
  sessions.clear();
}

function readToken(req: Request): string | null {
  const header = req.header("authorization");
  if (header && header.toLowerCase().startsWith("bearer ")) {
    return header.slice(7).trim();
  }
  const cookie = req.header("cookie") ?? "";
  const match = /(?:^|;\s*)lottery_admin=([^;]+)/.exec(cookie);
  return match?.[1] ?? null;
}

export function requireAdmin(req: Request, res: Response, next: NextFunction): void {
  const token = readToken(req);
  if (!token || !sessions.has(token)) {
    res.status(401).json({ message: "需要管理员口令登录" });
    return;
  }
  next();
}
