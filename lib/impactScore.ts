import { ActionType, MatchEvent, Player, Zone } from "./types";

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
  corner: 0,
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
    case "corner":
      return IMPACT_WEIGHTS.corner;
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
  return { key_pass: 0, tackle: 0, ball_loss: 0, shot: 0, corner: 0 };
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
