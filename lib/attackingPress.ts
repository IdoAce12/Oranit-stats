import { isAttackingRole } from "./formation";
import {
  absMinute,
  computePitchStints,
  resolveFinalMinute,
  wasOnPitchAt,
} from "./playingMinutes";
import { playerKeyOf } from "./playerKey";
import { Match, MatchEvent, Player, SquadPlayer, Substitution } from "./types";

export interface AttackingPressRow {
  key: string;
  /** חילוצי קבוצה בשליש ההתקפי בזמן שהשחקן היה על המגרש בעמדת התקפה */
  press: number;
  /** חילוצים אישיים בשליש ההתקפי */
  attTackles: number;
  isAttacker: boolean;
}

/**
 * לחץ התקפי: לשחקן בקו ההתקפה, כמה חילוצי כדור קבוצתיים נרשמו בהתקפה
 * בזמן שהוא היה על המגרש — תרומה עקיפה למשחק הלחץ.
 */
export function computeAttackingPressByKey(
  events: MatchEvent[],
  players: Player[],
  substitutions: Substitution[],
  matches: Match[],
  squad: SquadPlayer[]
): Map<string, AttackingPressRow> {
  const squadById = new Map(squad.map((s) => [s.id, s]));
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
  const eventsByMatch = new Map<string, MatchEvent[]>();
  for (const e of events) {
    const list = eventsByMatch.get(e.match_id) ?? [];
    list.push(e);
    eventsByMatch.set(e.match_id, list);
  }

  const acc = new Map<string, AttackingPressRow>();
  const ensure = (key: string): AttackingPressRow => {
    let row = acc.get(key);
    if (!row) {
      row = { key, press: 0, attTackles: 0, isAttacker: false };
      acc.set(key, row);
    }
    return row;
  };

  for (const [matchId, matchPlayers] of playersByMatch) {
    const match = matchById.get(matchId) ?? null;
    const matchSubs = subsByMatch.get(matchId) ?? [];
    const matchEvents = eventsByMatch.get(matchId) ?? [];
    const eventsMax = Math.max(0, ...matchEvents.map((e) => e.match_minute));
    const finalMinute = resolveFinalMinute(match, matchSubs, eventsMax);
    const stints = computePitchStints(matchPlayers, matchSubs, finalMinute);

    const attTackles = matchEvents.filter((e) => e.action_type === "tackle" && e.zone === "att");

    for (const p of matchPlayers) {
      const key = playerKeyOf(p, squad);
      const squadPos = p.squad_player_id ? squadById.get(p.squad_player_id)?.position : null;
      const attacking = isAttackingRole(p, squadPos);
      const row = ensure(key);
      const pStints = stints.get(p.id) ?? [];

      for (const ev of attTackles) {
        const minute = absMinute(ev.half, ev.match_minute);
        if (!wasOnPitchAt(pStints, minute, finalMinute)) continue;
        if (ev.player_id === p.id) row.attTackles += 1;
        if (attacking) {
          row.isAttacker = true;
          row.press += 1;
        }
      }

      if (attacking) row.isAttacker = true;
    }
  }

  return acc;
}
