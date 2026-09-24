import { namesMatch, type IfaStandingRow } from "./ifa/parse";

const CLUB_PREFIX = /^(הפועל|מכבי|בית.?ר|ביתר|בני|עירוני|מועדון|ספורט)$/;

export const OUR_CREST_SRC = "/hapoel-oranit.png";

export function ifaCrestUrl(teamId: string | null | undefined): string | null {
  if (!teamId) return null;
  return `https://www.football.org.il/Export.ashx?type=10&id=${encodeURIComponent(teamId)}`;
}

export function teamIdForName(name: string, standings: IfaStandingRow[]): string | null {
  const hit = standings.find((r) => namesMatch(r.team, name));
  return hit?.teamId ?? null;
}

export function opponentInitials(name: string): string {
  const parts = name
    .replace(/[\"״']/g, "")
    .split(/\s+/)
    .map((p) => p.trim())
    .filter(Boolean);
  const rest = parts.filter((p) => !CLUB_PREFIX.test(p));
  const use = rest.length > 0 ? rest : parts;
  const text = use.join(" ");
  return (text.slice(0, 2) || "?").replace(/\s/g, "");
}

export function crestSrcForTeam(name: string, standings: IfaStandingRow[], ours = false): string | null {
  if (ours) return OUR_CREST_SRC;
  return ifaCrestUrl(teamIdForName(name, standings));
}
