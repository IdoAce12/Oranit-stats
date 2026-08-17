/**
 * מפעלי אובייקטים לבדיקות בלבד — לא בשימוש בקוד האפליקציה.
 * מאפשרים לבנות אירועים/שחקנים/משחקים עם ברירות מחדל הגיוניות.
 */
import type {
  ActionType,
  Half,
  Match,
  MatchEvent,
  Player,
  ShotLocation,
  SquadPlayer,
  Substitution,
  Zone,
} from "./types";

let seq = 0;
const nextId = (prefix: string) => `${prefix}-${(seq += 1)}`;

export function makeEvent(overrides: Partial<MatchEvent> = {}): MatchEvent {
  return {
    id: overrides.id ?? nextId("ev"),
    match_id: overrides.match_id ?? "m1",
    player_id: overrides.player_id ?? null,
    action_type: overrides.action_type ?? "goal",
    zone: overrides.zone ?? null,
    shot_location: overrides.shot_location ?? null,
    half: overrides.half ?? 1,
    match_minute: overrides.match_minute ?? 10,
    created_at: overrides.created_at ?? "2026-01-01T00:00:00.000Z",
  };
}

export function makePlayer(overrides: Partial<Player> = {}): Player {
  return {
    id: overrides.id ?? nextId("p"),
    match_id: overrides.match_id ?? "m1",
    squad_player_id: overrides.squad_player_id ?? null,
    shirt_number: overrides.shirt_number ?? 7,
    name: overrides.name ?? "שחקן",
    position: overrides.position ?? null,
    is_starter: overrides.is_starter ?? true,
    on_pitch: overrides.on_pitch ?? true,
    lineup_slot: overrides.lineup_slot ?? null,
  };
}

export function makeSquadPlayer(overrides: Partial<SquadPlayer> = {}): SquadPlayer {
  return {
    id: overrides.id ?? nextId("sq"),
    shirt_number: overrides.shirt_number ?? 7,
    name: overrides.name ?? "שחקן סגל",
    position: overrides.position ?? null,
    active: overrides.active ?? true,
    created_at: overrides.created_at ?? "2026-01-01T00:00:00.000Z",
  };
}

export function makeMatch(overrides: Partial<Match> = {}): Match {
  return {
    id: overrides.id ?? nextId("m"),
    opponent: overrides.opponent ?? "יריבה",
    match_date: overrides.match_date ?? "2026-01-01",
    our_team_name: overrides.our_team_name ?? "הפועל אורנית",
    status: overrides.status ?? "finished",
    ended_at: overrides.ended_at ?? null,
    created_at: overrides.created_at ?? "2026-01-01T00:00:00.000Z",
    notes: overrides.notes,
    final_half: overrides.final_half ?? null,
    final_minute: overrides.final_minute ?? null,
  };
}

export function makeSub(overrides: Partial<Substitution> = {}): Substitution {
  return {
    id: overrides.id ?? nextId("sub"),
    match_id: overrides.match_id ?? "m1",
    player_out_id: overrides.player_out_id ?? "p-out",
    player_in_id: overrides.player_in_id ?? "p-in",
    half: overrides.half ?? 2,
    match_minute: overrides.match_minute ?? 60,
    created_at: overrides.created_at ?? "2026-01-01T00:00:00.000Z",
  };
}

/** קיצור ליצירת אירוע פעולה עם שחקן ואזור */
export function action(
  player_id: string,
  action_type: ActionType,
  extra: { zone?: Zone; shot_location?: ShotLocation; half?: Half; match_minute?: number; match_id?: string } = {}
): MatchEvent {
  return makeEvent({ player_id, action_type, ...extra });
}
