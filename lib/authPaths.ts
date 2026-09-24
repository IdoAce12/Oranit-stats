export function isPublicPath(pathname: string): boolean {
  if (pathname === "/login") return true;
  if (pathname.startsWith("/api/login")) return true;
  return false;
}

export function isTabPath(pathname: string): boolean {
  if (pathname === "/") return true;
  if (pathname === "/calendar") return true;
  if (pathname === "/table") return true;
  if (pathname === "/squad") return true;
  if (pathname === "/season") return true;
  if (pathname.startsWith("/season/player/")) return true;
  return false;
}

export function isCoachOnlyPath(pathname: string): boolean {
  if (pathname.startsWith("/setup")) return true;
  if (pathname.startsWith("/live")) return true;
  if (pathname.startsWith("/squad")) return true;
  if (pathname === "/season" || pathname.startsWith("/season/compare")) return true;
  return false;
}

export function playerProfilePath(squadPlayerId: string | null): string | null {
  if (!squadPlayerId) return null;
  return `/season/player/${encodeURIComponent(`sq:${squadPlayerId}`)}`;
}

export function playerOwnsProfilePath(pathname: string, squadPlayerId: string | null): boolean {
  if (!pathname.startsWith("/season/player/")) return true;
  if (!squadPlayerId) return false;
  const raw = decodeURIComponent(pathname.slice("/season/player/".length).split("/")[0] ?? "");
  return raw === `sq:${squadPlayerId}` || raw === squadPlayerId;
}
