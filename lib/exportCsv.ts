import { ACTION_LABELS, MatchEvent, Player, SHOT_LABELS, ZONE_LABELS } from "./types";

function csvEscape(value: string | number | null): string {
  const s = value === null || value === undefined ? "" : String(value);
  if (s.includes(",") || s.includes('"') || s.includes("\n")) {
    return '"' + s.replace(/"/g, '""') + '"';
  }
  return s;
}

export function eventsToCsv(events: MatchEvent[], players: Player[]): string {
  const byId = new Map(players.map((p) => [p.id, p]));
  const header = [
    "minute",
    "half",
    "shirt_number",
    "player_name",
    "action",
    "zone",
    "shot_location",
    "timestamp",
  ];

  const lines = [header.join(",")];

  for (const ev of events) {
    const player = ev.player_id ? byId.get(ev.player_id) : null;
    const row = [
      ev.match_minute,
      ev.half,
      player?.shirt_number ?? "",
      player?.name ?? "",
      ACTION_LABELS[ev.action_type],
      ev.zone ? ZONE_LABELS[ev.zone] : "",
      ev.shot_location ? SHOT_LABELS[ev.shot_location] : "",
      ev.created_at,
    ];
    lines.push(row.map(csvEscape).join(","));
  }

  return lines.join("\n");
}

export function downloadCsv(filename: string, csv: string) {
  // BOM כדי שעברית תיפתח נכון באקסל
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
