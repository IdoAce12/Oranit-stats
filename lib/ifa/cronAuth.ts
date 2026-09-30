import { timingSafeEqual } from "node:crypto";

export function cronSecret(): string {
  return (process.env.IFA_CRON_SECRET ?? "").trim();
}

export function bearerToken(header: string | null): string {
  if (!header) return "";
  const match = /^Bearer\s+(.+)$/i.exec(header.trim());
  return match?.[1]?.trim() ?? "";
}

export function cronAuthorized(authorizationHeader: string | null, secret = cronSecret()): boolean {
  if (!secret) return false;
  const token = bearerToken(authorizationHeader);
  const a = Buffer.from(token);
  const b = Buffer.from(secret);
  if (a.length === 0 || a.length !== b.length) return false;
  return timingSafeEqual(a, b);
}
