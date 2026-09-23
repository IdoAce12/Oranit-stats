import { computePlayerMatchStats, computeTeamTotals } from "./playerStats";
import { playerKeyOf } from "./playerKey";
import { Match, MatchEvent, MatchType, Player, SquadPlayer, Substitution } from "./types";
import { buildXlsx, downloadXlsx, XlsxCell } from "./xlsxWorkbook";
import { roundMetric } from "./advancedMetrics";

const MATCH_TYPE_EN: Record<MatchType, string> = {
  league: "League",
  cup: "Cup",
  friendly: "Friendly",
};

export interface TableauSeasonInput {
  matches: Match[];
  events: MatchEvent[];
  players: Player[];
  squad: SquadPlayer[];
  substitutions: Substitution[];
}

export interface TableauMatchRow {
  match_id: string;
  match_date: string;
  opponent: string;
  match_type: string;
  match_type_code: string;
  team_name: string;
  status: string;
  goals_scored: number;
  goals_conceded: number | null;
  assists: number;
  key_passes: number;
  recoveries: number;
  turnovers: number;
  shots_total: number;
  shots_in_box: number;
  shots_out_box: number;
  aerial_duels_won: number;
  aerial_duels_lost: number;
  ground_duels_won: number;
  ground_duels_lost: number;
  duels_won: number;
  duels_lost: number;
  duel_win_rate: number | null;
  corners_for: number;
  corners_against: number;
  impact_score: number;
  events_total: number;
}

export interface TableauPlayerMatchRow {
  match_id: string;
  match_date: string;
  opponent: string;
  match_type: string;
  player_key: string;
  player_name: string;
  squad_number: number | null;
  position: string;
  minutes: number;
  starter: number;
  goals: number;
  assists: number;
  key_passes: number;
  recoveries: number;
  turnovers: number;
  ground_duels_won: number;
  ground_duels_lost: number;
  aerial_duels_won: number;
  aerial_duels_lost: number;
  match_rating: number;
}

export interface TableauPlayerSeasonRow {
  player_key: string;
  player_name: string;
  squad_number: number | null;
  position: string;
  matches_played: number;
  minutes: number;
  goals: number;
  assists: number;
  key_passes: number;
  recoveries: number;
  turnovers: number;
  ground_duels_won: number;
  ground_duels_lost: number;
  aerial_duels_won: number;
  aerial_duels_lost: number;
  avg_rating: number;
  total_rating: number;
  ground_duel_win_rate: number | null;
  aerial_duel_win_rate: number | null;
}

export interface TableauSeasonTables {
  matches: TableauMatchRow[];
  playerSeason: TableauPlayerSeasonRow[];
  playerMatch: TableauPlayerMatchRow[];
}

function rate(won: number, lost: number): number | null {
  const total = won + lost;
  if (total === 0) return null;
  return roundMetric(won / total);
}

function matchTypeEn(type: MatchType | undefined): string {
  return MATCH_TYPE_EN[type ?? "league"];
}

function positionOf(player: Player, squadById: Map<string, SquadPlayer>): string {
  if (player.squad_player_id) {
    const s = squadById.get(player.squad_player_id);
    if (s?.position?.trim()) return s.position.trim();
  }
  return player.position?.trim() || "";
}

function displayName(player: Player, squadById: Map<string, SquadPlayer>): string {
  if (player.squad_player_id) {
    const s = squadById.get(player.squad_player_id);
    if (s?.name) return s.name;
  }
  return player.name;
}

function shirtOf(player: Player, squadById: Map<string, SquadPlayer>): number {
  if (player.squad_player_id) {
    const s = squadById.get(player.squad_player_id);
    if (s) return s.shirt_number;
  }
  return player.shirt_number;
}

/** בונה שלושה טבלאות שטוחות מוכנות ל-Tableau מנתוני העונה. */
export function buildTableauSeasonTables(input: TableauSeasonInput): TableauSeasonTables {
  const squadById = new Map(input.squad.map((s) => [s.id, s]));
  const eventsByMatch = new Map<string, MatchEvent[]>();
  for (const e of input.events) {
    const list = eventsByMatch.get(e.match_id) ?? [];
    list.push(e);
    eventsByMatch.set(e.match_id, list);
  }
  const playersByMatch = new Map<string, Player[]>();
  for (const p of input.players) {
    const list = playersByMatch.get(p.match_id) ?? [];
    list.push(p);
    playersByMatch.set(p.match_id, list);
  }
  const subsByMatch = new Map<string, Substitution[]>();
  for (const s of input.substitutions) {
    const list = subsByMatch.get(s.match_id) ?? [];
    list.push(s);
    subsByMatch.set(s.match_id, list);
  }

  const sortedMatches = [...input.matches].sort((a, b) =>
    (a.match_date || "").localeCompare(b.match_date || "")
  );

  const matches: TableauMatchRow[] = [];
  const playerMatch: TableauPlayerMatchRow[] = [];

  for (const match of sortedMatches) {
    const matchEvents = eventsByMatch.get(match.id) ?? [];
    const matchPlayers = playersByMatch.get(match.id) ?? [];
    const matchSubs = subsByMatch.get(match.id) ?? [];
    const team = computeTeamTotals(matchEvents);
    const recoveries = team.tackles.def + team.tackles.mid + team.tackles.att;
    const turnovers = team.losses.def + team.losses.mid + team.losses.att;
    const duelsWon = team.aerialWon + team.groundWon;
    const duelsLost = team.aerialLost + team.groundLost;
    const impactScore = matchEvents.reduce((s, e) => {
      if (e.action_type === "goal") return s + 2;
      if (e.action_type === "assist") return s + 2;
      return s;
    }, 0);

    matches.push({
      match_id: match.id,
      match_date: match.match_date || "",
      opponent: match.opponent,
      match_type: matchTypeEn(match.match_type),
      match_type_code: match.match_type ?? "league",
      team_name: match.our_team_name || "Hapoel Oranit",
      status: match.status === "finished" ? "Finished" : "Live",
      goals_scored: team.goals,
      goals_conceded: null,
      assists: team.assists,
      key_passes: team.keyPasses,
      recoveries,
      turnovers,
      shots_total: team.shotsInBox + team.shotsOutBox,
      shots_in_box: team.shotsInBox,
      shots_out_box: team.shotsOutBox,
      aerial_duels_won: team.aerialWon,
      aerial_duels_lost: team.aerialLost,
      ground_duels_won: team.groundWon,
      ground_duels_lost: team.groundLost,
      duels_won: duelsWon,
      duels_lost: duelsLost,
      duel_win_rate: rate(duelsWon, duelsLost),
      corners_for: team.cornersFor,
      corners_against: team.cornersAgainst,
      impact_score: impactScore,
      events_total: team.eventsTotal,
    });

    const stats = computePlayerMatchStats(matchEvents, matchPlayers, {
      substitutions: matchSubs,
      match,
    });
    const playersById = new Map(matchPlayers.map((p) => [p.id, p]));

    for (const row of stats) {
      if (!row.playerId) continue;
      if (row.minutesPlayed <= 0 && row.actionsTotal === 0) continue;
      const player = playersById.get(row.playerId);
      if (!player) continue;
      playerMatch.push({
        match_id: match.id,
        match_date: match.match_date || "",
        opponent: match.opponent,
        match_type: matchTypeEn(match.match_type),
        player_key: playerKeyOf(player, input.squad),
        player_name: displayName(player, squadById),
        squad_number: shirtOf(player, squadById),
        position: positionOf(player, squadById),
        minutes: row.minutesPlayed,
        starter: row.isStarter ? 1 : 0,
        goals: row.goals,
        assists: row.assists,
        key_passes: row.keyPassesTotal,
        recoveries: row.tacklesTotal,
        turnovers: row.lossesTotal,
        ground_duels_won: row.groundWon,
        ground_duels_lost: row.groundLost,
        aerial_duels_won: row.aerialWon,
        aerial_duels_lost: row.aerialLost,
        match_rating: roundMetric(row.score, 1),
      });
    }
  }

  const acc = new Map<
    string,
    TableauPlayerSeasonRow & { ratingSum: number }
  >();
  for (const row of playerMatch) {
    let entry = acc.get(row.player_key);
    if (!entry) {
      entry = {
        player_key: row.player_key,
        player_name: row.player_name,
        squad_number: row.squad_number,
        position: row.position,
        matches_played: 0,
        minutes: 0,
        goals: 0,
        assists: 0,
        key_passes: 0,
        recoveries: 0,
        turnovers: 0,
        ground_duels_won: 0,
        ground_duels_lost: 0,
        aerial_duels_won: 0,
        aerial_duels_lost: 0,
        avg_rating: 0,
        total_rating: 0,
        ground_duel_win_rate: null,
        aerial_duel_win_rate: null,
        ratingSum: 0,
      };
      acc.set(row.player_key, entry);
    }
    if (!entry.position && row.position) entry.position = row.position;
    entry.matches_played += 1;
    entry.minutes += row.minutes;
    entry.goals += row.goals;
    entry.assists += row.assists;
    entry.key_passes += row.key_passes;
    entry.recoveries += row.recoveries;
    entry.turnovers += row.turnovers;
    entry.ground_duels_won += row.ground_duels_won;
    entry.ground_duels_lost += row.ground_duels_lost;
    entry.aerial_duels_won += row.aerial_duels_won;
    entry.aerial_duels_lost += row.aerial_duels_lost;
    entry.total_rating += row.match_rating;
    entry.ratingSum += row.match_rating;
  }

  const playerSeason = Array.from(acc.values())
    .map(({ ratingSum, ...row }) => ({
      ...row,
      total_rating: roundMetric(row.total_rating, 1),
      avg_rating:
        row.matches_played > 0 ? roundMetric(ratingSum / row.matches_played, 1) : 0,
      ground_duel_win_rate: rate(row.ground_duels_won, row.ground_duels_lost),
      aerial_duel_win_rate: rate(row.aerial_duels_won, row.aerial_duels_lost),
    }))
    .sort(
      (a, b) =>
        b.avg_rating - a.avg_rating ||
        (a.squad_number ?? 999) - (b.squad_number ?? 999)
    );

  return { matches, playerSeason, playerMatch };
}

function sheetFromRecords<T extends object>(
  name: string,
  headers: (keyof T & string)[],
  rows: T[]
) {
  return {
    name,
    rows: [
      headers,
      ...rows.map((row) => headers.map((h) => row[h] as XlsxCell)),
    ],
  };
}

const MATCH_HEADERS: (keyof TableauMatchRow)[] = [
  "match_id",
  "match_date",
  "opponent",
  "match_type",
  "match_type_code",
  "team_name",
  "status",
  "goals_scored",
  "goals_conceded",
  "assists",
  "key_passes",
  "recoveries",
  "turnovers",
  "shots_total",
  "shots_in_box",
  "shots_out_box",
  "aerial_duels_won",
  "aerial_duels_lost",
  "ground_duels_won",
  "ground_duels_lost",
  "duels_won",
  "duels_lost",
  "duel_win_rate",
  "corners_for",
  "corners_against",
  "impact_score",
  "events_total",
];

const PLAYER_SEASON_HEADERS: (keyof TableauPlayerSeasonRow)[] = [
  "player_key",
  "player_name",
  "squad_number",
  "position",
  "matches_played",
  "minutes",
  "goals",
  "assists",
  "key_passes",
  "recoveries",
  "turnovers",
  "ground_duels_won",
  "ground_duels_lost",
  "aerial_duels_won",
  "aerial_duels_lost",
  "avg_rating",
  "total_rating",
  "ground_duel_win_rate",
  "aerial_duel_win_rate",
];

const PLAYER_MATCH_HEADERS: (keyof TableauPlayerMatchRow)[] = [
  "match_id",
  "match_date",
  "opponent",
  "match_type",
  "player_key",
  "player_name",
  "squad_number",
  "position",
  "minutes",
  "starter",
  "goals",
  "assists",
  "key_passes",
  "recoveries",
  "turnovers",
  "ground_duels_won",
  "ground_duels_lost",
  "aerial_duels_won",
  "aerial_duels_lost",
  "match_rating",
];

const DICTIONARY_ROWS: XlsxCell[][] = [
  ["sheet", "column", "type", "description"],
  ["משחקים", "match_id", "string", "Join key to player-match grain"],
  ["משחקים", "match_date", "date (ISO yyyy-mm-dd)", "Match date"],
  ["משחקים", "opponent", "string", "Opponent name"],
  ["משחקים", "match_type", "string", "League / Cup / Friendly"],
  ["משחקים", "goals_scored", "number", "Goals scored by Hapoel Oranit"],
  [
    "משחקים",
    "goals_conceded",
    "number (nullable)",
    "Not tracked in live tagging yet — leave blank or fill in Tableau",
  ],
  ["משחקים", "recoveries", "number", "Tackles / ball recoveries"],
  ["משחקים", "turnovers", "number", "Ball losses (all zones)"],
  ["משחקים", "duel_win_rate", "number 0–1 or null", "Won / (won + lost); null if no duels"],
  ["סיכום עונתי לשחקן", "player_key", "string", "Stable player id across matches"],
  ["סיכום עונתי לשחקן", "avg_rating", "number", "Average Impact score per match played"],
  ["סיכום עונתי לשחקן", "total_rating", "number", "Sum of match Impact scores"],
  ["סיכום עונתי לשחקן", "recoveries", "number", "Season tackles"],
  ["סיכום עונתי לשחקן", "turnovers", "number", "Season ball losses"],
  [
    "פירוט משחק-שחקן",
    "match_rating",
    "number",
    "Impact score for this player in this match",
  ],
  ["פירוט משחק-שחקן", "starter", "number 0/1", "1 if started, 0 if came off the bench"],
  [
    "פירוט משחק-שחקן",
    "player_key + match_id",
    "keys",
    "Relate this sheet to משחקים (match_id) and סיכום עונתי לשחקן (player_key)",
  ],
];

export function buildTableauWorkbookBytes(tables: TableauSeasonTables): Uint8Array {
  return buildXlsx([
    sheetFromRecords("משחקים", MATCH_HEADERS, tables.matches),
    sheetFromRecords("סיכום עונתי לשחקן", PLAYER_SEASON_HEADERS, tables.playerSeason),
    sheetFromRecords("פירוט משחק-שחקן", PLAYER_MATCH_HEADERS, tables.playerMatch),
    { name: "Dictionary", rows: DICTIONARY_ROWS },
  ]);
}

export function downloadTableauSeasonWorkbook(input: TableauSeasonInput) {
  const tables = buildTableauSeasonTables(input);
  const bytes = buildTableauWorkbookBytes(tables);
  const stamp = new Date().toISOString().slice(0, 10);
  downloadXlsx(`Hapoel_Oranit_Season_Tableau_${stamp}.xlsx`, bytes);
}
