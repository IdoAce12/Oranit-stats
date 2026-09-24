import { createHmac, timingSafeEqual } from "node:crypto";
import type { AppSession } from "./types";

export const SESSION_COOKIE = "scout_session";
export const SESSION_DAYS = 30;

export interface SignedSession extends AppSession {
  exp: number;
}

function secret(): string {
  return process.env.AUTH_SECRET || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "dev-scout-secret";
}

export function signSession(user: AppSession, now = Date.now()): string {
  const payload: SignedSession = {
    ...user,
    exp: now + SESSION_DAYS * 24 * 60 * 60 * 1000,
  };
  const body = Buffer.from(JSON.stringify(payload), "utf8").toString("base64url");
  const sig = createHmac("sha256", secret()).update(body).digest("base64url");
  return `${body}.${sig}`;
}

export function verifySession(token: string | undefined | null, now = Date.now()): AppSession | null {
  if (!token) return null;
  const dot = token.lastIndexOf(".");
  if (dot <= 0) return null;
  const body = token.slice(0, dot);
  const sig = token.slice(dot + 1);
  const expected = createHmac("sha256", secret()).update(body).digest("base64url");
  const a = Buffer.from(sig);
  const b = Buffer.from(expected);
  if (a.length !== b.length || !timingSafeEqual(a, b)) return null;
  try {
    const payload = JSON.parse(Buffer.from(body, "base64url").toString("utf8")) as SignedSession;
    if (!payload?.id || !payload.username || (payload.role !== "coach" && payload.role !== "player")) {
      return null;
    }
    if (typeof payload.exp !== "number" || payload.exp < now) return null;
    const playerName =
      typeof payload.playerName === "string" && payload.playerName.trim()
        ? payload.playerName.trim()
        : null;
    return {
      id: payload.id,
      username: payload.username,
      role: payload.role,
      squadPlayerId: payload.squadPlayerId ?? null,
      playerName,
    };
  } catch {
    return null;
  }
}
