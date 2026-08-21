import { ACTION_LABELS, Match, MatchEvent, Player, SHOT_LABELS, Substitution, ZONE_LABELS } from "./types";
import { computePlayerMatchStats, computeTeamTotals, PlayerMatchStats } from "./playerStats";
import { buildMatchSummary } from "./matchSummary";
import { SeasonImpact } from "./impactScore";

export type StatsOptions = {
  substitutions?: Substitution[];
  match?: Match | null;
  liveFinalMinute?: number;
};

function csvEscape(value: string | number | null | undefined): string {
  const s = value === null || value === undefined ? "" : String(value);
  if (s.includes(",") || s.includes('"') || s.includes("\n")) {
    return '"' + s.replace(/"/g, '""') + '"';
  }
  return s;
}

function joinRow(cells: (string | number | null | undefined)[]) {
  return cells.map(csvEscape).join(",");
}

function playerRef(row: PlayerMatchStats): (string | number | null)[] {
  return [row.shirtNumber, row.name];
}

export type ExportTableId =
  | "minutes"
  | "goals"
  | "assists"
  | "losses"
  | "tackles"
  | "key_passes"
  | "shots"
  | "duels"
  | "coach"
  | "full"
  | "events"
  | "season";

function tableMinutes(stats: PlayerMatchStats[]): string[] {
  const lines = ["=== דקות משחק ===", joinRow(["מס׳", "שם", "דקות", "פותח", "פירוט"])];
  for (const row of [...stats].sort((a, b) => b.minutesPlayed - a.minutesPlayed)) {
    if (row.playerId === null) continue;
    lines.push(
      joinRow([
        ...playerRef(row),
        row.minutesPlayed,
        row.isStarter ? "כן" : "לא",
        row.minutesLabel,
      ])
    );
  }
  return lines;
}

function tableGoals(stats: PlayerMatchStats[], teamGoals: number): string[] {
  const lines = ["=== טבלת שערים ===", joinRow(["מס׳", "שם", "דקות", "שערים"])];
  for (const row of [...stats].sort((a, b) => b.goals - a.goals)) {
    if (row.playerId === null && row.goals === 0) continue;
    lines.push(joinRow([...playerRef(row), row.minutesPlayed, row.goals]));
  }
  lines.push(joinRow(["", "סה״כ", "", teamGoals]));
  return lines;
}

function tableAssists(stats: PlayerMatchStats[], teamAssists: number): string[] {
  const lines = ["=== טבלת בישולים ===", joinRow(["מס׳", "שם", "דקות", "בישולים"])];
  for (const row of [...stats].sort((a, b) => b.assists - a.assists)) {
    if (row.playerId === null && row.assists === 0) continue;
    lines.push(joinRow([...playerRef(row), row.minutesPlayed, row.assists]));
  }
  lines.push(joinRow(["", "סה״כ", "", teamAssists]));
  return lines;
}

function tableLosses(stats: PlayerMatchStats[], team: ReturnType<typeof computeTeamTotals>): string[] {
  const lines = [
    "=== טבלת איבודי כדור ===",
    joinRow(["מס׳", "שם", "דקות", "הגנה", "אמצע", "התקפה", "סה״כ"]),
  ];
  for (const row of [...stats].sort((a, b) => b.lossesTotal - a.lossesTotal)) {
    if (row.playerId === null) continue;
    lines.push(
      joinRow([
        ...playerRef(row),
        row.minutesPlayed,
        row.losses.def,
        row.losses.mid,
        row.losses.att,
        row.lossesTotal,
      ])
    );
  }
  lines.push(
    joinRow([
      "",
      "סה״כ",
      "",
      team.losses.def,
      team.losses.mid,
      team.losses.att,
      team.losses.def + team.losses.mid + team.losses.att,
    ])
  );
  return lines;
}

function tableTackles(stats: PlayerMatchStats[], team: ReturnType<typeof computeTeamTotals>): string[] {
  const lines = [
    "=== טבלת חילוצים ===",
    joinRow(["מס׳", "שם", "דקות", "הגנה", "אמצע", "התקפה", "סה״כ"]),
  ];
  for (const row of [...stats].sort((a, b) => b.tacklesTotal - a.tacklesTotal)) {
    if (row.playerId === null) continue;
    lines.push(
      joinRow([
        ...playerRef(row),
        row.minutesPlayed,
        row.tackles.def,
        row.tackles.mid,
        row.tackles.att,
        row.tacklesTotal,
      ])
    );
  }
  lines.push(
    joinRow([
      "",
      "סה״כ",
      "",
      team.tackles.def,
      team.tackles.mid,
      team.tackles.att,
      team.tackles.def + team.tackles.mid + team.tackles.att,
    ])
  );
  return lines;
}

function tableKeyPasses(stats: PlayerMatchStats[], teamKeyPasses: number): string[] {
  const lines = [
    "=== טבלת מסירות מפתח ===",
    joinRow(["מס׳", "שם", "דקות", "הגנה", "אמצע", "התקפה", "סה״כ"]),
  ];
  for (const row of [...stats].sort((a, b) => b.keyPassesTotal - a.keyPassesTotal)) {
    if (row.playerId === null) continue;
    lines.push(
      joinRow([
        ...playerRef(row),
        row.minutesPlayed,
        row.keyPasses.def,
        row.keyPasses.mid,
        row.keyPasses.att,
        row.keyPassesTotal,
      ])
    );
  }
  lines.push(joinRow(["", "סה״כ", "", "", "", "", teamKeyPasses]));
  return lines;
}

function tableShots(stats: PlayerMatchStats[], team: ReturnType<typeof computeTeamTotals>): string[] {
  const lines = [
    "=== טבלת איומים לשער ===",
    joinRow(["מס׳", "שם", "דקות", "מתוך הרחבה", "מחוץ לרחבה", "סה״כ"]),
  ];
  for (const row of [...stats].sort((a, b) => b.shotsTotal - a.shotsTotal)) {
    if (row.playerId === null) continue;
    lines.push(
      joinRow([...playerRef(row), row.minutesPlayed, row.shotsInBox, row.shotsOutBox, row.shotsTotal])
    );
  }
  lines.push(
    joinRow(["", "סה״כ", "", team.shotsInBox, team.shotsOutBox, team.shotsInBox + team.shotsOutBox])
  );
  return lines;
}

function tableDuels(stats: PlayerMatchStats[]): string[] {
  const lines = [
    "=== מאבקים ===",
    joinRow(["מס׳", "שם", "אוויר זכה", "אוויר הפסיד", "קרקע זכה", "קרקע הפסיד"]),
  ];
  for (const row of [...stats].sort(
    (a, b) =>
      b.aerialWon + b.aerialLost + b.groundWon + b.groundLost -
      (a.aerialWon + a.aerialLost + a.groundWon + a.groundLost)
  )) {
    if (row.playerId === null) continue;
    lines.push(
      joinRow([
        ...playerRef(row),
        row.aerialWon,
        row.aerialLost,
        row.groundWon,
        row.groundLost,
      ])
    );
  }
  return lines;
}

function tableEvents(events: MatchEvent[], players: Player[]): string[] {
  const lines = [
    "=== לוג אירועים מלא ===",
    joinRow(["דקה", "מחצית", "מס׳", "שם", "פעולה", "אזור", "מיקום בעיטה", "זמן רישום"]),
  ];
  const byId = new Map(players.map((p) => [p.id, p]));
  const sorted = [...events].sort(
    (a, b) =>
      a.half - b.half || a.match_minute - b.match_minute || a.created_at.localeCompare(b.created_at)
  );
  for (const ev of sorted) {
    const player = ev.player_id ? byId.get(ev.player_id) : null;
    lines.push(
      joinRow([
        ev.match_minute,
        ev.half,
        player?.shirt_number ?? "",
        player?.name ?? "",
        ACTION_LABELS[ev.action_type],
        ev.zone ? ZONE_LABELS[ev.zone] : "",
        ev.shot_location ? SHOT_LABELS[ev.shot_location] : "",
        ev.created_at,
      ])
    );
  }
  return lines;
}

/** גיליון קצר למאמן / וואטסאפ */
export function coachSheetCsv(
  events: MatchEvent[],
  players: Player[],
  meta?: { opponent?: string; matchDate?: string; notes?: string },
  opts?: StatsOptions
): string {
  const summary = buildMatchSummary(events, players);
  const stats = computePlayerMatchStats(events, players, opts).filter((p) => p.playerId !== null);
  const lines: string[] = [];
  lines.push(joinRow(["סיכום משחק", meta?.opponent ?? "", meta?.matchDate ?? ""]));
  lines.push(joinRow(["שערים שלנו", summary.ourGoals]));
  lines.push("");
  lines.push("תובנות");
  for (const i of summary.insights) lines.push(joinRow([i.text]));
  lines.push("");
  lines.push(
    joinRow([
      "מס׳",
      "שם",
      "דקות",
      "שערים",
      "בישולים",
      "איבודים כלליים",
      "חילוצים",
      "מס״מ",
      "אוויר זכה",
      "אוויר הפסיד",
      "קרקע זכה",
      "קרקע הפסיד",
    ])
  );
  for (const r of [...stats].sort(
    (a, b) => b.goals - a.goals || b.assists - a.assists || b.score - a.score
  )) {
    lines.push(
      joinRow([
        r.shirtNumber,
        r.name,
        r.minutesPlayed,
        r.goals,
        r.assists,
        r.lossesTotal,
        r.tacklesTotal,
        r.keyPassesTotal,
        r.aerialWon,
        r.aerialLost,
        r.groundWon,
        r.groundLost,
      ])
    );
  }
  if (meta?.notes) {
    lines.push("");
    lines.push(joinRow(["הערת משחק", meta.notes]));
  }
  return lines.join("\n");
}

export function exportTableCsv(
  tableId: ExportTableId,
  events: MatchEvent[],
  players: Player[],
  meta?: { opponent?: string; matchDate?: string; notes?: string },
  opts?: StatsOptions
): string {
  const stats = computePlayerMatchStats(events, players, opts);
  const team = computeTeamTotals(events);
  const header: string[] = [];
  if (meta?.opponent || meta?.matchDate) {
    header.push(joinRow(["משחק מול", meta.opponent ?? "", "תאריך", meta.matchDate ?? ""]));
    header.push("");
  }

  switch (tableId) {
    case "minutes":
      return [...header, ...tableMinutes(stats)].join("\n");
    case "goals":
      return [...header, ...tableGoals(stats, team.goals)].join("\n");
    case "assists":
      return [...header, ...tableAssists(stats, team.assists)].join("\n");
    case "losses":
      return [...header, ...tableLosses(stats, team)].join("\n");
    case "tackles":
      return [...header, ...tableTackles(stats, team)].join("\n");
    case "key_passes":
      return [...header, ...tableKeyPasses(stats, team.keyPasses)].join("\n");
    case "shots":
      return [...header, ...tableShots(stats, team)].join("\n");
    case "duels":
      return [...header, ...tableDuels(stats)].join("\n");
    case "events":
      return [...header, ...tableEvents(events, players)].join("\n");
    case "coach":
      return coachSheetCsv(events, players, meta, opts);
    case "full":
    default:
      return matchReportToCsv(events, players, meta, opts);
  }
}

export function matchReportToCsv(
  events: MatchEvent[],
  players: Player[],
  meta?: { opponent?: string; matchDate?: string; notes?: string },
  opts?: StatsOptions
): string {
  const stats = computePlayerMatchStats(events, players, opts);
  const team = computeTeamTotals(events);
  const lines: string[] = [];

  if (meta?.opponent || meta?.matchDate) {
    lines.push(joinRow(["משחק מול", meta.opponent ?? "", "תאריך", meta.matchDate ?? ""]));
    lines.push("");
  }

  lines.push(...tableMinutes(stats), "");
  lines.push(...tableGoals(stats, team.goals), "");
  lines.push(...tableAssists(stats, team.assists), "");
  lines.push(...tableLosses(stats, team), "");
  lines.push(...tableTackles(stats, team), "");
  lines.push(...tableKeyPasses(stats, team.keyPasses), "");
  lines.push(...tableShots(stats, team), "");
  lines.push(...tableDuels(stats), "");

  lines.push("=== סיכום קבוצתי ===");
  lines.push(joinRow(["שערים", "בישולים", "קרנות לזכותנו", "קרנות לחובתנו", "סה״כ אירועים"]));
  lines.push(
    joinRow([team.goals, team.assists, team.cornersFor, team.cornersAgainst, team.eventsTotal])
  );
  if (meta?.notes) {
    lines.push("");
    lines.push(joinRow(["הערת משחק", meta.notes]));
  }
  lines.push("");
  lines.push(...tableEvents(events, players));

  return lines.join("\n");
}

export function seasonTableCsv(rows: SeasonImpact[]): string {
  const lines = [
    "=== טבלה עונתית ===",
    joinRow([
      "מס׳",
      "שם",
      "משחקים",
      "שערים",
      "בישולים",
      "מס״מ",
      "חילוצים",
      "איבודים",
      "xG",
      "xA",
      "איומים ברחבה",
      "ציון",
      "ממוצע למשחק",
    ]),
  ];
  for (const r of rows) {
    const name = r.label.replace(/^#\d+\s*/, "");
    lines.push(
      joinRow([
        r.shirtNumber,
        name,
        r.matchesPlayed,
        r.goals,
        r.assists,
        r.keyPasses,
        r.tackles,
        r.lossesTotal,
        Number(r.xg.toFixed(2)),
        Number(r.xa.toFixed(2)),
        r.shotsInBox,
        Number(r.score.toFixed(1)),
        Number(r.perMatch.toFixed(1)),
      ])
    );
  }
  return lines.join("\n");
}

export function eventsToCsv(events: MatchEvent[], players: Player[]): string {
  return matchReportToCsv(events, players);
}

export function downloadCsv(filename: string, csv: string) {
  const blob = new Blob(["\uFEFF" + csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

export const EXPORT_TABLE_LABELS: Record<Exclude<ExportTableId, "full" | "season">, string> = {
  minutes: "דקות משחק",
  goals: "שערים",
  assists: "בישולים",
  losses: "איבודים",
  tackles: "חילוצים",
  key_passes: "מסירות מפתח",
  shots: "איומים",
  duels: "מאבקים",
  events: "לוג אירועים",
  coach: "סיכום משחק",
};
