import { ActionType, MatchEvent, Player, SquadPlayer, Zone } from "./types";

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
  tacklesByZone: Record<Zone, number>;
  lossesByZone: Record<Zone, number>;
  shotsInBox: number;
  shotsOutBox: number;
}

function emptyCounts(): Record<ActionType, number> {
  return { key_pass: 0, tackle: 0, ball_loss: 0, shot: 0, corner_for: 0, corner_against: 0 };
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
  score: number;
  matchesPlayed: number;
  keyPasses: number;
  tackles: number;
  defLosses: number;
  shotsInBox: number;
  perMatch: number;
}

export function computeSeasonImpact(
  events: MatchEvent[],
  players: Player[],
  squad: SquadPlayer[]
): SeasonImpact[] {
  const squadById = new Map(squad.map((s) => [s.id, s]));

  // מיפוי player_id (per-match) -> מפתח צבירה + תווית
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
        score: 0,
        matchesPlayed: 0,
        keyPasses: 0,
        tackles: 0,
        defLosses: 0,
        shotsInBox: 0,
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
    if (ev.action_type === "tackle") entry.tackles += 1;
    if (ev.action_type === "ball_loss" && ev.zone === "def") entry.defLosses += 1;
    if (ev.action_type === "shot" && ev.shot_location === "in_box") entry.shotsInBox += 1;
  }

  for (const [key, matches] of matchesByKey) {
    const entry = acc.get(key);
    if (entry) {
      entry.matchesPlayed = matches.size;
      entry.perMatch = matches.size > 0 ? entry.score / matches.size : 0;
    }
  }

  return Array.from(acc.values()).sort((a, b) => b.score - a.score);
}
