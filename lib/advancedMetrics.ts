import { MatchEvent } from "./types";

export const RADAR_AXES = [
  { key: "attack", label: "התקפה" },
  { key: "creation", label: "יצירה" },
  { key: "defense", label: "הגנה" },
  { key: "control", label: "שליטה" },
  { key: "finishing", label: "סיום" },
  { key: "impact", label: "השפעה" },
] as const;

export type RadarAxisKey = (typeof RADAR_AXES)[number]["key"];

export interface RadarScores {
  attack: number;
  creation: number;
  defense: number;
  control: number;
  finishing: number;
  impact: number;
}

export interface RadarSource {
  goals: number;
  assists: number;
  keyPasses: number;
  tackles: number;
  lossesTotal: number;
  shotsInBox: number;
  score: number;
  matchesPlayed: number;
}

export function rawRadarFromSeason(row: RadarSource): RadarScores {
  const matches = Math.max(1, row.matchesPlayed);
  return {
    attack: row.goals * 3 + row.shotsInBox + row.keyPasses,
    creation: row.assists * 2 + row.keyPasses,
    defense: row.tackles,
    control: Math.max(0, matches * 3 - row.lossesTotal),
    finishing: row.goals + row.shotsInBox,
    impact: Math.max(0, row.score),
  };
}

function maxAxis(pool: RadarScores[], key: RadarAxisKey): number {
  return Math.max(1, ...pool.map((r) => r[key]));
}

export interface RadarDatum {
  axis: string;
  a: number;
  b?: number;
  c?: number;
  d?: number;
  e?: number;
}

export const RADAR_SERIES_KEYS = ["a", "b", "c", "d", "e"] as const;
export type RadarSeriesKey = (typeof RADAR_SERIES_KEYS)[number];

/** 0–100 מול הקבוצה — פרופיל אחד או כמה שחקנים */
export function buildCompareRadar(sources: RadarSource[], pool: RadarSource[]): RadarDatum[] {
  const rawPool = pool.map(rawRadarFromSeason);
  const raws = sources.map(rawRadarFromSeason);
  return RADAR_AXES.map((ax) => {
    const cap = maxAxis(rawPool, ax.key);
    const point: RadarDatum = { axis: ax.label, a: 0 };
    raws.forEach((raw, i) => {
      const key = RADAR_SERIES_KEYS[i];
      if (!key) return;
      point[key] = Math.round((raw[ax.key] / cap) * 100);
    });
    return point;
  });
}

/** 0–100 מול הקבוצה — פרופיל אחד או השוואת שני שחקנים */
export function buildRadarData(a: RadarSource, pool: RadarSource[], b?: RadarSource | null): RadarDatum[] {
  return buildCompareRadar(b ? [a, b] : [a], pool);
}

export interface TeamMatchTrend {
  matchId: string;
  opponent: string;
  matchDate: string;
  label: string;
  goals: number;
  assists: number;
  keyPasses: number;
  tackles: number;
  losses: number;
  score: number;
  /** מספר מצטבר של משחקים ששוחקו עד לנקודה זו */
  matchesPlayed: number;
}

export function computeTeamSeasonTrend(
  events: MatchEvent[],
  matches: { id: string; opponent: string; match_date: string }[]
): TeamMatchTrend[] {
  const byMatch = new Map<string, TeamMatchTrend>();
  for (const m of matches) {
    byMatch.set(m.id, {
      matchId: m.id,
      opponent: m.opponent,
      matchDate: m.match_date,
      label: m.opponent,
      goals: 0,
      assists: 0,
      keyPasses: 0,
      tackles: 0,
      losses: 0,
      score: 0,
      matchesPlayed: 0,
    });
  }
  for (const ev of events) {
    const row = byMatch.get(ev.match_id);
    if (!row) continue;
    if (ev.action_type === "goal") row.goals += 1;
    if (ev.action_type === "assist") row.assists += 1;
    if (ev.action_type === "key_pass") row.keyPasses += 1;
    if (ev.action_type === "tackle") row.tackles += 1;
    if (ev.action_type === "ball_loss") row.losses += 1;
    if (ev.action_type === "goal") row.score += 2;
    if (ev.action_type === "assist") row.score += 2;
  }
  const sorted = Array.from(byMatch.values())
    .filter((r) => r.matchDate)
    .sort((a, b) => a.matchDate.localeCompare(b.matchDate));
  sorted.forEach((r, i) => {
    r.matchesPlayed = i + 1;
  });
  return sorted;
}

export function roundMetric(n: number, digits = 2): number {
  const f = 10 ** digits;
  return Math.round(n * f) / f;
}
