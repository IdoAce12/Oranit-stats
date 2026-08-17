import { Match, MatchEvent, Player, Substitution, Zone } from "./types";
import { scoreForEvent } from "./impactScore";
import { xaForEvent, xgForEvent } from "./advancedMetrics";
import { computePlayingMinutes, resolveFinalMinute } from "./playingMinutes";

function emptyZones(): Record<Zone, number> {
  return { def: 0, mid: 0, att: 0 };
}

export interface PlayerMatchStats {
  playerId: string | null;
  shirtNumber: number | null;
  name: string;
  label: string;
  goals: number;
  assists: number;
  losses: Record<Zone, number>;
  lossesTotal: number;
  tackles: Record<Zone, number>;
  tacklesTotal: number;
  keyPasses: Record<Zone, number>;
  keyPassesTotal: number;
  shotsInBox: number;
  shotsOutBox: number;
  shotsTotal: number;
  xg: number;
  xa: number;
  actionsTotal: number;
  score: number;
  minutesPlayed: number;
  minutesLabel: string;
  isStarter: boolean;
}

function emptyRow(player: Player | null, playerId: string | null): PlayerMatchStats {
  const shirtNumber = player?.shirt_number ?? null;
  const name = player?.name ?? "ללא שחקן";
  return {
    playerId,
    shirtNumber,
    name,
    label: player ? `#${player.shirt_number} ${player.name}` : "ללא שחקן",
    goals: 0,
    assists: 0,
    losses: emptyZones(),
    lossesTotal: 0,
    tackles: emptyZones(),
    tacklesTotal: 0,
    keyPasses: emptyZones(),
    keyPassesTotal: 0,
    shotsInBox: 0,
    shotsOutBox: 0,
    shotsTotal: 0,
    xg: 0,
    xa: 0,
    actionsTotal: 0,
    score: 0,
    minutesPlayed: 0,
    minutesLabel: "",
    isStarter: player?.is_starter === true,
  };
}

/** טבלת נתונים מקיפה לכל שחקן בהרכב + שחקנים שאירועים שויכו אליהם */
export function computePlayerMatchStats(
  events: MatchEvent[],
  players: Player[],
  options?: {
    substitutions?: Substitution[];
    match?: Match | null;
    liveFinalMinute?: number;
  }
): PlayerMatchStats[] {
  const byId = new Map(players.map((p) => [p.id, p]));
  const map = new Map<string, PlayerMatchStats>();

  for (const p of players) {
    map.set(p.id, emptyRow(p, p.id));
  }

  for (const ev of events) {
    if (ev.action_type === "corner_for" || ev.action_type === "corner_against") continue;

    const key = ev.player_id ?? "__none__";
    if (!map.has(key)) {
      const player = ev.player_id ? byId.get(ev.player_id) ?? null : null;
      map.set(key, emptyRow(player, ev.player_id));
    }
    const row = map.get(key)!;
    row.actionsTotal += 1;
    row.score += scoreForEvent(ev);

    if (ev.action_type === "goal") {
      row.goals += 1;
    } else if (ev.action_type === "assist") {
      row.assists += 1;
    } else if (ev.action_type === "ball_loss") {
      if (ev.zone) row.losses[ev.zone] += 1;
      row.lossesTotal += 1;
    } else if (ev.action_type === "tackle") {
      if (ev.zone) row.tackles[ev.zone] += 1;
      row.tacklesTotal += 1;
    } else if (ev.action_type === "key_pass") {
      if (ev.zone) row.keyPasses[ev.zone] += 1;
      row.keyPassesTotal += 1;
    } else if (ev.action_type === "shot") {
      if (ev.shot_location === "in_box") row.shotsInBox += 1;
      else row.shotsOutBox += 1;
      row.shotsTotal += 1;
    }
    row.xg += xgForEvent(ev);
    row.xa += xaForEvent(ev);
  }

  const subs = options?.substitutions ?? [];
  const eventsMax = Math.max(0, ...events.map((e) => e.match_minute));
  const finalMinute =
    options?.liveFinalMinute ??
    resolveFinalMinute(options?.match ?? null, subs, eventsMax);
  const minutesMap = computePlayingMinutes(players, subs, finalMinute);

  for (const [id, mins] of minutesMap) {
    const row = map.get(id);
    if (!row) continue;
    row.minutesPlayed = mins.minutesPlayed;
    row.minutesLabel = mins.label;
    row.isStarter = mins.started;
  }

  return Array.from(map.values()).sort((a, b) => {
    if (b.minutesPlayed !== a.minutesPlayed) return b.minutesPlayed - a.minutesPlayed;
    if (b.goals !== a.goals) return b.goals - a.goals;
    if (b.assists !== a.assists) return b.assists - a.assists;
    const an = a.shirtNumber ?? 999;
    const bn = b.shirtNumber ?? 999;
    if (an !== bn) return an - bn;
    return a.name.localeCompare(b.name, "he");
  });
}

export interface TeamMatchTotals {
  goals: number;
  assists: number;
  cornersFor: number;
  cornersAgainst: number;
  losses: Record<Zone, number>;
  tackles: Record<Zone, number>;
  keyPasses: number;
  shotsInBox: number;
  shotsOutBox: number;
  xg: number;
  xa: number;
  eventsTotal: number;
}

export function computeTeamTotals(events: MatchEvent[]): TeamMatchTotals {
  const losses = emptyZones();
  const tackles = emptyZones();
  let goals = 0;
  let assists = 0;
  let cornersFor = 0;
  let cornersAgainst = 0;
  let keyPasses = 0;
  let shotsInBox = 0;
  let shotsOutBox = 0;
  let xg = 0;
  let xa = 0;

  for (const e of events) {
    if (e.action_type === "goal") goals += 1;
    if (e.action_type === "assist") assists += 1;
    if (e.action_type === "ball_loss" && e.zone) losses[e.zone] += 1;
    if (e.action_type === "tackle" && e.zone) tackles[e.zone] += 1;
    if (e.action_type === "key_pass") keyPasses += 1;
    if (e.action_type === "shot") {
      if (e.shot_location === "in_box") shotsInBox += 1;
      else shotsOutBox += 1;
    }
    if (e.action_type === "corner_for") cornersFor += 1;
    if (e.action_type === "corner_against") cornersAgainst += 1;
    xg += xgForEvent(e);
    xa += xaForEvent(e);
  }

  return {
    goals,
    assists,
    cornersFor,
    cornersAgainst,
    losses,
    tackles,
    keyPasses,
    shotsInBox,
    shotsOutBox,
    xg,
    xa,
    eventsTotal: events.length,
  };
}
