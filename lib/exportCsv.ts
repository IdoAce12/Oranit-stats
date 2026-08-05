import { ACTION_LABELS, MatchEvent, Player, SHOT_LABELS, ZONE_LABELS } from "./types";
import { computePlayerMatchStats, computeTeamTotals, PlayerMatchStats } from "./playerStats";

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

/** ייצוא קריא: טבלה נפרדת לכל סוג נתון + סיכום + לוג */
export function matchReportToCsv(
  events: MatchEvent[],
  players: Player[],
  meta?: { opponent?: string; matchDate?: string }
): string {
  const stats = computePlayerMatchStats(events, players);
  const team = computeTeamTotals(events);
  const lines: string[] = [];

  if (meta?.opponent || meta?.matchDate) {
    lines.push(joinRow(["משחק מול", meta.opponent ?? "", "תאריך", meta.matchDate ?? ""]));
    lines.push("");
  }

  // ---- שערים ----
  lines.push("=== טבלת שערים ===");
  lines.push(joinRow(["מס׳", "שם", "שערים"]));
  for (const row of [...stats].sort((a, b) => b.goals - a.goals || (a.shirtNumber ?? 999) - (b.shirtNumber ?? 999))) {
    if (row.goals === 0 && row.playerId === null) continue;
    lines.push(joinRow([...playerRef(row), row.goals]));
  }
  lines.push(joinRow(["", "סה״כ", team.goals]));
  lines.push("");

  // ---- בישולים ----
  lines.push("=== טבלת בישולים ===");
  lines.push(joinRow(["מס׳", "שם", "בישולים"]));
  for (const row of [...stats].sort((a, b) => b.assists - a.assists || (a.shirtNumber ?? 999) - (b.shirtNumber ?? 999))) {
    if (row.assists === 0 && row.playerId === null) continue;
    lines.push(joinRow([...playerRef(row), row.assists]));
  }
  lines.push(joinRow(["", "סה״כ", team.assists]));
  lines.push("");

  // ---- איבודים ----
  lines.push("=== טבלת איבודי כדור ===");
  lines.push(joinRow(["מס׳", "שם", "הגנה", "אמצע", "התקפה", "סה״כ"]));
  for (const row of [...stats].sort((a, b) => b.lossesTotal - a.lossesTotal || (a.shirtNumber ?? 999) - (b.shirtNumber ?? 999))) {
    lines.push(
      joinRow([
        ...playerRef(row),
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
      team.losses.def,
      team.losses.mid,
      team.losses.att,
      team.losses.def + team.losses.mid + team.losses.att,
    ])
  );
  lines.push("");

  // ---- חילוצים ----
  lines.push("=== טבלת חילוצים ===");
  lines.push(joinRow(["מס׳", "שם", "הגנה", "אמצע", "התקפה", "סה״כ"]));
  for (const row of [...stats].sort((a, b) => b.tacklesTotal - a.tacklesTotal || (a.shirtNumber ?? 999) - (b.shirtNumber ?? 999))) {
    lines.push(
      joinRow([
        ...playerRef(row),
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
      team.tackles.def,
      team.tackles.mid,
      team.tackles.att,
      team.tackles.def + team.tackles.mid + team.tackles.att,
    ])
  );
  lines.push("");

  // ---- מסירות מפתח ----
  lines.push("=== טבלת מסירות מפתח ===");
  lines.push(joinRow(["מס׳", "שם", "הגנה", "אמצע", "התקפה", "סה״כ"]));
  for (const row of [...stats].sort((a, b) => b.keyPassesTotal - a.keyPassesTotal || (a.shirtNumber ?? 999) - (b.shirtNumber ?? 999))) {
    lines.push(
      joinRow([
        ...playerRef(row),
        row.keyPasses.def,
        row.keyPasses.mid,
        row.keyPasses.att,
        row.keyPassesTotal,
      ])
    );
  }
  lines.push(joinRow(["", "סה״כ", "", "", "", team.keyPasses]));
  lines.push("");

  // ---- איומים ----
  lines.push("=== טבלת איומים לשער ===");
  lines.push(joinRow(["מס׳", "שם", "מתוך הרחבה", "מחוץ לרחבה", "סה״כ"]));
  for (const row of [...stats].sort((a, b) => b.shotsTotal - a.shotsTotal || (a.shirtNumber ?? 999) - (b.shirtNumber ?? 999))) {
    lines.push(
      joinRow([...playerRef(row), row.shotsInBox, row.shotsOutBox, row.shotsTotal])
    );
  }
  lines.push(joinRow(["", "סה״כ", team.shotsInBox, team.shotsOutBox, team.shotsInBox + team.shotsOutBox]));
  lines.push("");

  // ---- סיכום קבוצתי ----
  lines.push("=== סיכום קבוצתי ===");
  lines.push(joinRow(["שערים", "בישולים", "קרנות לזכותנו", "קרנות לחובתנו", "סה״כ אירועים"]));
  lines.push(
    joinRow([team.goals, team.assists, team.cornersFor, team.cornersAgainst, team.eventsTotal])
  );
  lines.push("");

  // ---- לוג ----
  lines.push("=== לוג אירועים מלא ===");
  lines.push(joinRow(["דקה", "מחצית", "מס׳", "שם", "פעולה", "אזור", "מיקום בעיטה", "זמן רישום"]));

  const byId = new Map(players.map((p) => [p.id, p]));
  const sorted = [...events].sort(
    (a, b) => a.half - b.half || a.match_minute - b.match_minute || a.created_at.localeCompare(b.created_at)
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
