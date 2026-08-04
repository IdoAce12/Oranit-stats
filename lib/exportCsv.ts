import { ACTION_LABELS, MatchEvent, Player, SHOT_LABELS, ZONE_LABELS } from "./types";
import { computePlayerMatchStats, computeTeamTotals, PlayerMatchStats } from "./playerStats";

function csvEscape(value: string | number | null | undefined): string {
  const s = value === null || value === undefined ? "" : String(value);
  if (s.includes(",") || s.includes('"') || s.includes("\n")) {
    return '"' + s.replace(/"/g, '""') + '"';
  }
  return s;
}

/** ייצוא מקיף: טבלת שחקנים + סיכום קבוצתי + לוג אירועים מלא */
export function matchReportToCsv(
  events: MatchEvent[],
  players: Player[],
  meta?: { opponent?: string; matchDate?: string }
): string {
  const stats = computePlayerMatchStats(events, players);
  const team = computeTeamTotals(events);
  const lines: string[] = [];

  if (meta?.opponent || meta?.matchDate) {
    lines.push(["משחק מול", meta.opponent ?? "", "תאריך", meta.matchDate ?? ""].map(csvEscape).join(","));
    lines.push("");
  }

  lines.push("טבלת נתונים לפי שחקן");
  lines.push(
    [
      "מס׳",
      "שם",
      "שערים",
      "בישולים",
      "איבודים הגנה",
      "איבודים אמצע",
      "איבודים התקפה",
      "איבודים סה״כ",
      "חילוצים הגנה",
      "חילוצים אמצע",
      "חילוצים התקפה",
      "חילוצים סה״כ",
      "מסירות מפתח הגנה",
      "מסירות מפתח אמצע",
      "מסירות מפתח התקפה",
      "מסירות מפתח סה״כ",
      "איומים ברחבה",
      "איומים מחוץ לרחבה",
      "איומים סה״כ",
      "סה״כ פעולות",
      "ציון השפעה",
    ].join(",")
  );

  for (const row of stats) {
    lines.push(playerStatsRow(row).map(csvEscape).join(","));
  }

  const totals = sumStats(stats);
  lines.push(
    [
      "",
      "סה״כ",
      totals.goals,
      totals.assists,
      totals.losses.def,
      totals.losses.mid,
      totals.losses.att,
      totals.lossesTotal,
      totals.tackles.def,
      totals.tackles.mid,
      totals.tackles.att,
      totals.tacklesTotal,
      totals.keyPasses.def,
      totals.keyPasses.mid,
      totals.keyPasses.att,
      totals.keyPassesTotal,
      totals.shotsInBox,
      totals.shotsOutBox,
      totals.shotsTotal,
      totals.actionsTotal,
      "",
    ]
      .map(csvEscape)
      .join(",")
  );

  lines.push("");
  lines.push("סיכום קבוצתי");
  lines.push(["שערים", "בישולים", "קרנות לזכותנו", "קרנות לחובתנו", "סה״כ אירועים"].join(","));
  lines.push(
    [team.goals, team.assists, team.cornersFor, team.cornersAgainst, team.eventsTotal]
      .map(csvEscape)
      .join(",")
  );

  lines.push("");
  lines.push("לוג אירועים מלא");
  lines.push(
    ["דקה", "מחצית", "מס׳", "שם", "פעולה", "אזור", "מיקום בעיטה", "זמן רישום"].join(",")
  );

  const byId = new Map(players.map((p) => [p.id, p]));
  const sorted = [...events].sort(
    (a, b) => a.half - b.half || a.match_minute - b.match_minute || a.created_at.localeCompare(b.created_at)
  );
  for (const ev of sorted) {
    const player = ev.player_id ? byId.get(ev.player_id) : null;
    lines.push(
      [
        ev.match_minute,
        ev.half,
        player?.shirt_number ?? "",
        player?.name ?? "",
        ACTION_LABELS[ev.action_type],
        ev.zone ? ZONE_LABELS[ev.zone] : "",
        ev.shot_location ? SHOT_LABELS[ev.shot_location] : "",
        ev.created_at,
      ]
        .map(csvEscape)
        .join(",")
    );
  }

  return lines.join("\n");
}

function playerStatsRow(row: PlayerMatchStats): (string | number | null)[] {
  return [
    row.shirtNumber,
    row.name,
    row.goals,
    row.assists,
    row.losses.def,
    row.losses.mid,
    row.losses.att,
    row.lossesTotal,
    row.tackles.def,
    row.tackles.mid,
    row.tackles.att,
    row.tacklesTotal,
    row.keyPasses.def,
    row.keyPasses.mid,
    row.keyPasses.att,
    row.keyPassesTotal,
    row.shotsInBox,
    row.shotsOutBox,
    row.shotsTotal,
    row.actionsTotal,
    Number(row.score.toFixed(1)),
  ];
}

function sumStats(rows: PlayerMatchStats[]): PlayerMatchStats {
  const base = emptyTotals();
  for (const r of rows) {
    base.goals += r.goals;
    base.assists += r.assists;
    base.losses.def += r.losses.def;
    base.losses.mid += r.losses.mid;
    base.losses.att += r.losses.att;
    base.lossesTotal += r.lossesTotal;
    base.tackles.def += r.tackles.def;
    base.tackles.mid += r.tackles.mid;
    base.tackles.att += r.tackles.att;
    base.tacklesTotal += r.tacklesTotal;
    base.keyPasses.def += r.keyPasses.def;
    base.keyPasses.mid += r.keyPasses.mid;
    base.keyPasses.att += r.keyPasses.att;
    base.keyPassesTotal += r.keyPassesTotal;
    base.shotsInBox += r.shotsInBox;
    base.shotsOutBox += r.shotsOutBox;
    base.shotsTotal += r.shotsTotal;
    base.actionsTotal += r.actionsTotal;
  }
  return base;
}

function emptyTotals(): PlayerMatchStats {
  return {
    playerId: null,
    shirtNumber: null,
    name: "סה״כ",
    label: "סה״כ",
    goals: 0,
    assists: 0,
    losses: { def: 0, mid: 0, att: 0 },
    lossesTotal: 0,
    tackles: { def: 0, mid: 0, att: 0 },
    tacklesTotal: 0,
    keyPasses: { def: 0, mid: 0, att: 0 },
    keyPassesTotal: 0,
    shotsInBox: 0,
    shotsOutBox: 0,
    shotsTotal: 0,
    actionsTotal: 0,
    score: 0,
  };
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
