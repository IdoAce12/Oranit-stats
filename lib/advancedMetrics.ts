import { MatchEvent, ShotLocation } from "./types";

/** מודל xG פשוט לפי מה שנרשם בלייב: ברחבה / מחוץ לרחבה */
export const XG_BY_LOCATION: Record<ShotLocation, number> = {
  in_box: 0.25,
  out_box: 0.07,
};

/** xA לכל מסירת מפתח — קירוב עד שיהיו נתוני מסירה מדויקים יותר */
export const XA_PER_KEY_PASS = 0.12;

export function xgForEvent(ev: MatchEvent): number {
  if (ev.action_type !== "shot") return 0;
  return ev.shot_location === "in_box" ? XG_BY_LOCATION.in_box : XG_BY_LOCATION.out_box;
}

export function xaForEvent(ev: MatchEvent): number {
  if (ev.action_type !== "key_pass") return 0;
  return XA_PER_KEY_PASS;
}

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
  xg: number;
  xa: number;
  score: number;
  matchesPlayed: number;
}

export function rawRadarFromSeason(row: RadarSource): RadarScores {
  const matches = Math.max(1, row.matchesPlayed);
  return {
    attack: row.goals * 3 + row.shotsInBox + row.keyPasses,
    creation: row.assists * 2 + row.keyPasses + row.xa * 2,
    defense: row.tackles,
    control: Math.max(0, matches * 3 - row.lossesTotal),
    finishing: row.xg * 4 + row.goals,
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
}

/** 0–100 מול הקבוצה — פרופיל אחד או השוואה */
export function buildRadarData(a: RadarSource, pool: RadarSource[], b?: RadarSource | null): RadarDatum[] {
  const rawPool = pool.map(rawRadarFromSeason);
  const ra = rawRadarFromSeason(a);
  const rb = b ? rawRadarFromSeason(b) : null;
  return RADAR_AXES.map((ax) => {
    const cap = maxAxis(rawPool, ax.key);
    const point: RadarDatum = {
      axis: ax.label,
      a: Math.round((ra[ax.key] / cap) * 100),
    };
    if (rb) point.b = Math.round((rb[ax.key] / cap) * 100);
    return point;
  });
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
  xg: number;
  xa: number;
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
      xg: 0,
      xa: 0,
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
    row.xg += xgForEvent(ev);
    row.xa += xaForEvent(ev);
    row.score += ev.action_type === "goal" ? 3 : ev.action_type === "assist" ? 2 : 0;
  }
  const sorted = Array.from(byMatch.values())
    .filter((r) => r.matchDate)
    .sort((a, b) => a.matchDate.localeCompare(b.matchDate));
  sorted.forEach((r, i) => {
    r.matchesPlayed = i + 1;
    r.xg = roundMetric(r.xg);
    r.xa = roundMetric(r.xa);
  });
  return sorted;
}

export function roundMetric(n: number, digits = 2): number {
  const f = 10 ** digits;
  return Math.round(n * f) / f;
}
