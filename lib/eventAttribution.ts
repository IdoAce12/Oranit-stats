import {
  absMinute,
  computePitchStints,
  resolveFinalMinute,
  wasOnPitchAt,
} from "./playingMinutes";
import { playerKeyOf } from "./playerKey";
import { Match, MatchEvent, Player, SquadPlayer, Substitution } from "./types";

function namesEqual(a: string, b: string): boolean {
  return a.trim() === b.trim();
}

export function samePerson(a: Player, b: Player, squad: SquadPlayer[] = []): boolean {
  if (a.id === b.id) return true;
  if (a.squad_player_id && a.squad_player_id === b.squad_player_id) return true;
  if (playerKeyOf(a, squad) === playerKeyOf(b, squad)) return true;
  if (a.shirt_number === b.shirt_number && namesEqual(a.name, b.name)) return true;
  return false;
}

function localPlayerId(
  eventPlayerId: string,
  matchId: string,
  roster: Player[],
  lookupById: Map<string, Player>,
  squad: SquadPlayer[]
): string {
  const matchRoster = roster.filter((p) => p.match_id === matchId);
  if (matchRoster.some((p) => p.id === eventPlayerId)) return eventPlayerId;

  const bySquad = matchRoster.find((p) => p.squad_player_id === eventPlayerId);
  if (bySquad) return bySquad.id;

  const source = lookupById.get(eventPlayerId);
  if (!source) return eventPlayerId;

  const byIdentity = matchRoster.find((p) => samePerson(p, source, squad));
  if (byIdentity) return byIdentity.id;

  const byName = matchRoster.filter((p) => namesEqual(p.name, source.name));
  if (byName.length === 1) return byName[0].id;

  return eventPlayerId;
}

function onPitchPlayerId(
  playerId: string,
  minute: number,
  subs: Substitution[],
  stints: Map<string, { enter: number; exit: number }[]>,
  finalMinute: number
): string {
  let pid = playerId;
  const seen = new Set<string>();
  while (pid && !seen.has(pid) && !wasOnPitchAt(stints.get(pid) ?? [], minute, finalMinute)) {
    seen.add(pid);
    const replacement = [...subs]
      .filter((s) => s.player_out_id === pid && absMinute(s.half, s.match_minute) <= minute)
      .sort(
        (a, b) =>
          absMinute(b.half, b.match_minute) - absMinute(a.half, a.match_minute) ||
          b.created_at.localeCompare(a.created_at)
      )[0];
    if (!replacement) break;
    pid = replacement.player_in_id;
  }
  return pid;
}

/** מייחס אירוע לשחקן שהיה על המגרש באותה דקה — כולל מחליף אחרי חילוף. */
export function attributeMatchEvents(
  events: MatchEvent[],
  roster: Player[],
  substitutions: Substitution[],
  matches: Match[],
  squad: SquadPlayer[],
  lookupPlayers: Player[] = roster
): MatchEvent[] {
  const lookupById = new Map(lookupPlayers.map((p) => [p.id, p]));
  const matchById = new Map(matches.map((m) => [m.id, m]));

  const playersByMatch = new Map<string, Player[]>();
  for (const p of roster) {
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

  const stintsByMatch = new Map<string, Map<string, { enter: number; exit: number }[]>>();
  const finalByMatch = new Map<string, number>();
  for (const [matchId, matchPlayers] of playersByMatch) {
    const matchSubs = subsByMatch.get(matchId) ?? [];
    const matchEvents = eventsByMatch.get(matchId) ?? [];
    const eventsMax = Math.max(0, ...matchEvents.map((e) => e.match_minute));
    const finalMinute = resolveFinalMinute(matchById.get(matchId) ?? null, matchSubs, eventsMax);
    finalByMatch.set(matchId, finalMinute);
    stintsByMatch.set(matchId, computePitchStints(matchPlayers, matchSubs, finalMinute));
  }

  return events.map((ev) => {
    if (!ev.player_id) return ev;
    const localId = localPlayerId(ev.player_id, ev.match_id, roster, lookupById, squad);
    const stints = stintsByMatch.get(ev.match_id);
    const matchSubs = subsByMatch.get(ev.match_id) ?? [];
    const finalMinute = finalByMatch.get(ev.match_id);
    if (!stints || finalMinute == null) {
      return localId === ev.player_id ? ev : { ...ev, player_id: localId };
    }
    const minute = absMinute(ev.half, ev.match_minute);
    const onPitchId = onPitchPlayerId(localId, minute, matchSubs, stints, finalMinute);
    if (onPitchId === ev.player_id) return ev;
    return { ...ev, player_id: onPitchId };
  });
}
