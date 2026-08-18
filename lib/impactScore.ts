import { ActionType, Match, MatchEvent, Player, SquadPlayer, Substitution, Zone } from "./types";
import { roundMetric, xaForEvent, xgForEvent } from "./advancedMetrics";
import { computePlayingMinutes, resolveFinalMinute } from "./playingMinutes";

// =============================================================
// משקולות ה-Impact Score - כאן מכיילים אחרי כמה משחקים.
// שנה מספרים בלבד; שאר הקוד יתעדכן אוטומטית.
// =============================================================
export const IMPACT_WEIGHTS = {
  key_pass: 2, // מסירת מפתח
  tackle: {
    def: 0.5, // חילוץ בשליש הגנתי (הצלה) - תוספת כדי לא להעניש בלמים
    mid: 1.5, // חילוץ בשליש מרכזי
    att: 1.5, // חילוץ בשליש התקפי (שווה כמעט כמו בישול)
  } as Record<Zone, number>,
  shot: {
    in_box: 1, // איום מתוך הרחבה
    out_box: 0, // בעיטה מרחוק - ניטרלי
  },
  ball_loss: {
    def: -2, // איבוד בשליש הגנתי - קריטי
    mid: 0,
    att: 0,
  } as Record<Zone, number>,
  goal: 3, // שער
  assist: 2, // בישול
  // קרנות הן אירוע קבוצתי ללא שחקן - לא משפיעות על ציון שחקן
  corner_for: 0,
  corner_against: 0,
};

export function scoreForEvent(event: MatchEvent): number {
  switch (event.action_type) {
    case "key_pass":
      return IMPACT_WEIGHTS.key_pass;
    case "tackle":
      return event.zone ? IMPACT_WEIGHTS.tackle[event.zone] : IMPACT_WEIGHTS.tackle.mid;
    case "shot":
      return event.shot_location === "in_box"
        ? IMPACT_WEIGHTS.shot.in_box
        : IMPACT_WEIGHTS.shot.out_box;
    case "ball_loss":
      return event.zone ? IMPACT_WEIGHTS.ball_loss[event.zone] : 0;
    case "goal":
      return IMPACT_WEIGHTS.goal;
    case "assist":
      return IMPACT_WEIGHTS.assist;
    case "corner_for":
    case "corner_against":
      return 0;
    default:
      return 0;
  }
}

export interface PlayerImpact {
  player: Player | null;
  playerId: string | null;
  label: string;
  score: number;
  counts: Record<ActionType, number>;
  keyPasses: number;
  goals: number;
  assists: number;
  tacklesByZone: Record<Zone, number>;
  lossesByZone: Record<Zone, number>;
  shotsInBox: number;
  shotsOutBox: number;
}

function emptyCounts(): Record<ActionType, number> {
  return {
    key_pass: 0,
    tackle: 0,
    ball_loss: 0,
    shot: 0,
    goal: 0,
    assist: 0,
    corner_for: 0,
    corner_against: 0,
  };
}

function emptyZones(): Record<Zone, number> {
  return { def: 0, mid: 0, att: 0 };
}

export function computeImpact(events: MatchEvent[], players: Player[]): PlayerImpact[] {
  const byId = new Map<string, Player>();
  players.forEach((p) => byId.set(p.id, p));

  const map = new Map<string, PlayerImpact>();

  const ensure = (playerId: string | null): PlayerImpact => {
    const key = playerId ?? "__none__";
    let entry = map.get(key);
    if (!entry) {
      const player = playerId ? byId.get(playerId) ?? null : null;
      entry = {
        player,
        playerId,
        label: player ? `#${player.shirt_number} ${player.name}` : "ללא שחקן",
        score: 0,
        counts: emptyCounts(),
        keyPasses: 0,
        goals: 0,
        assists: 0,
        tacklesByZone: emptyZones(),
        lossesByZone: emptyZones(),
        shotsInBox: 0,
        shotsOutBox: 0,
      };
      map.set(key, entry);
    }
    return entry;
  };

  for (const ev of events) {
    const entry = ensure(ev.player_id);
    entry.score += scoreForEvent(ev);
    entry.counts[ev.action_type] += 1;

    if (ev.action_type === "key_pass") entry.keyPasses += 1;
    if (ev.action_type === "goal") entry.goals += 1;
    if (ev.action_type === "assist") entry.assists += 1;
    if (ev.action_type === "tackle" && ev.zone) entry.tacklesByZone[ev.zone] += 1;
    if (ev.action_type === "ball_loss" && ev.zone) entry.lossesByZone[ev.zone] += 1;
    if (ev.action_type === "shot") {
      if (ev.shot_location === "in_box") entry.shotsInBox += 1;
      else entry.shotsOutBox += 1;
    }
  }

  return Array.from(map.values()).sort((a, b) => b.score - a.score);
}

// =============================================================
// צבירה עונתית: מאחד אירועים מכל המשחקים לפי שחקן בסגל
// =============================================================
export interface SeasonImpact {
  key: string;
  label: string;
  shirtNumber: number | null;
  squadPlayerId: string | null;
  score: number;
  matchesPlayed: number;
  keyPasses: number;
  goals: number;
  assists: number;
  tackles: number;
  lossesTotal: number;
  defLosses: number;
  midLosses: number;
  attLosses: number;
  shotsInBox: number;
  shotsOutBox: number;
  xg: number;
  xa: number;
  perMatch: number;
}

export function computeSeasonImpact(
  events: MatchEvent[],
  players: Player[],
  squad: SquadPlayer[]
): SeasonImpact[] {
  const squadById = new Map(squad.map((s) => [s.id, s]));

  const keyOf = (p: Player) =>
    p.squad_player_id ? `sq:${p.squad_player_id}` : `nm:${p.name}`;

  const labelOf = (p: Player) => {
    if (p.squad_player_id) {
      const s = squadById.get(p.squad_player_id);
      if (s) return { label: `#${s.shirt_number} ${s.name}`, num: s.shirt_number };
    }
    return { label: `#${p.shirt_number} ${p.name}`, num: p.shirt_number };
  };

  const playerToKey = new Map<string, string>();
  const acc = new Map<string, SeasonImpact>();
  const matchesByKey = new Map<string, Set<string>>();

  for (const p of players) {
    const key = keyOf(p);
    playerToKey.set(p.id, key);
    if (!acc.has(key)) {
      const { label, num } = labelOf(p);
      acc.set(key, {
        key,
        label,
        shirtNumber: num,
        squadPlayerId: p.squad_player_id,
        score: 0,
        matchesPlayed: 0,
        keyPasses: 0,
        goals: 0,
        assists: 0,
        tackles: 0,
        lossesTotal: 0,
        defLosses: 0,
        midLosses: 0,
        attLosses: 0,
        shotsInBox: 0,
        shotsOutBox: 0,
        xg: 0,
        xa: 0,
        perMatch: 0,
      });
    }
    if (!matchesByKey.has(key)) matchesByKey.set(key, new Set());
    matchesByKey.get(key)!.add(p.match_id);
  }

  for (const ev of events) {
    if (!ev.player_id) continue;
    const key = playerToKey.get(ev.player_id);
    if (!key) continue;
    const entry = acc.get(key);
    if (!entry) continue;
    entry.score += scoreForEvent(ev);
    if (ev.action_type === "key_pass") entry.keyPasses += 1;
    if (ev.action_type === "goal") entry.goals += 1;
    if (ev.action_type === "assist") entry.assists += 1;
    if (ev.action_type === "tackle") entry.tackles += 1;
    if (ev.action_type === "ball_loss") {
      entry.lossesTotal += 1;
      if (ev.zone === "def") entry.defLosses += 1;
      if (ev.zone === "mid") entry.midLosses += 1;
      if (ev.zone === "att") entry.attLosses += 1;
    }
    if (ev.action_type === "shot") {
      if (ev.shot_location === "in_box") entry.shotsInBox += 1;
      else entry.shotsOutBox += 1;
    }
    entry.xg += xgForEvent(ev);
    entry.xa += xaForEvent(ev);
  }

  for (const [key, matches] of matchesByKey) {
    const entry = acc.get(key);
    if (entry) {
      entry.matchesPlayed = matches.size;
      entry.perMatch = matches.size > 0 ? entry.score / matches.size : 0;
      entry.xg = roundMetric(entry.xg);
      entry.xa = roundMetric(entry.xa);
    }
  }

  return Array.from(acc.values()).sort((a, b) => b.score - a.score);
}

/**
 * סך דקות המשחק לכל שחקן עונתי (לפי מפתח סגל), מסוכם מכל המשחקים.
 * מחשב דקות לכל משחק בנפרד עם ההרכב, החילופים וזמן הסיום של אותו משחק.
 */
export function computeSeasonMinutesByKey(
  players: Player[],
  substitutions: Substitution[],
  matches: Match[],
  events: MatchEvent[]
): Map<string, number> {
  const keyOf = (p: Player) =>
    p.squad_player_id ? `sq:${p.squad_player_id}` : `nm:${p.name}`;

  const matchById = new Map(matches.map((m) => [m.id, m]));

  const playersByMatch = new Map<string, Player[]>();
  for (const p of players) {
    const list = playersByMatch.get(p.match_id) ?? [];
    list.push(p);
    playersByMatch.set(p.match_id, list);
  }

  const subsByMatch = new Map<string, Substitution[]>();
  for (const s of substitutions) {
    const list = subsByMatch.get(s.match_id) ?? [];
    list.push(s);
    subsByMatch.set(s.match_id, list);
  }

  const eventsMaxByMatch = new Map<string, number>();
  for (const e of events) {
    const cur = eventsMaxByMatch.get(e.match_id) ?? 0;
    if (e.match_minute > cur) eventsMaxByMatch.set(e.match_id, e.match_minute);
  }

  const totals = new Map<string, number>();
  for (const [matchId, matchPlayers] of playersByMatch) {
    const matchSubs = subsByMatch.get(matchId) ?? [];
    const match = matchById.get(matchId) ?? null;
    const finalMinute = resolveFinalMinute(
      match,
      matchSubs,
      eventsMaxByMatch.get(matchId) ?? 0
    );
    const minutes = computePlayingMinutes(matchPlayers, matchSubs, finalMinute);
    const byId = new Map(matchPlayers.map((p) => [p.id, p]));
    for (const [pid, mm] of minutes) {
      const p = byId.get(pid);
      if (!p) continue;
      const key = keyOf(p);
      totals.set(key, (totals.get(key) ?? 0) + mm.minutesPlayed);
    }
  }
  return totals;
}

export interface PlayerMatchLine {
  matchId: string;
  opponent: string;
  matchDate: string;
  goals: number;
  assists: number;
  keyPasses: number;
  tackles: number;
  losses: number;
  defLosses: number;
  shotsInBox: number;
  xg: number;
  xa: number;
  score: number;
}

/** פירוט משחק-אחר-משחק לשחקן עונתי */
export function computePlayerSeasonMatches(
  playerKey: string,
  events: MatchEvent[],
  players: Player[],
  matches: { id: string; opponent: string; match_date: string }[]
): PlayerMatchLine[] {
  const matchMeta = new Map(matches.map((m) => [m.id, m]));
  const myPlayers = players.filter((p) => {
    const key = p.squad_player_id ? `sq:${p.squad_player_id}` : `nm:${p.name}`;
    return key === playerKey;
  });
  const playerIds = new Set(myPlayers.map((p) => p.id));
  const byMatch = new Map<string, PlayerMatchLine>();

  for (const p of myPlayers) {
    const m = matchMeta.get(p.match_id);
    if (!byMatch.has(p.match_id)) {
      byMatch.set(p.match_id, {
        matchId: p.match_id,
        opponent: m?.opponent ?? "?",
        matchDate: m?.match_date ?? "",
        goals: 0,
        assists: 0,
        keyPasses: 0,
        tackles: 0,
        losses: 0,
        defLosses: 0,
        shotsInBox: 0,
        xg: 0,
        xa: 0,
        score: 0,
      });
    }
  }

  for (const ev of events) {
    if (!ev.player_id || !playerIds.has(ev.player_id)) continue;
    const line = byMatch.get(ev.match_id);
    if (!line) continue;
    line.score += scoreForEvent(ev);
    if (ev.action_type === "goal") line.goals += 1;
    if (ev.action_type === "assist") line.assists += 1;
    if (ev.action_type === "key_pass") line.keyPasses += 1;
    if (ev.action_type === "tackle") line.tackles += 1;
    if (ev.action_type === "ball_loss") {
      line.losses += 1;
      if (ev.zone === "def") line.defLosses += 1;
    }
    if (ev.action_type === "shot" && ev.shot_location === "in_box") line.shotsInBox += 1;
    line.xg += xgForEvent(ev);
    line.xa += xaForEvent(ev);
  }

  return Array.from(byMatch.values())
    .map((l) => ({ ...l, xg: roundMetric(l.xg), xa: roundMetric(l.xa) }))
    .sort((a, b) => (b.matchDate || "").localeCompare(a.matchDate || ""));
}
