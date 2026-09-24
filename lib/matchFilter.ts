import { MATCH_TYPE_LABELS, Match, MatchType } from "./types";

/** ליגה וגביע — בלי אימונים / ידידות. */
export const OFFICIAL_MATCH_TYPES: MatchType[] = ["league", "cup"];

/** ריק = כל הסוגים. */
export function matchIdsForTypes(matches: Match[], types: MatchType[]): Set<string> | null {
  if (types.length === 0) return null;
  const allowed = new Set(types);
  return new Set(
    matches.filter((m) => allowed.has(m.match_type ?? "league")).map((m) => m.id)
  );
}

export function toggleMatchType(selected: MatchType[], type: MatchType): MatchType[] {
  return selected.includes(type) ? selected.filter((t) => t !== type) : [...selected, type];
}

export function formatMatchOption(match: Match): string {
  const date = match.match_date?.slice(0, 10) ?? "";
  const type = MATCH_TYPE_LABELS[match.match_type ?? "league"];
  return `${date} · ${match.opponent} · ${type}`;
}
