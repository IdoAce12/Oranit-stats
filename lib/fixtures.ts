import { Match } from "./types";

/** שעת שריקה — kickoff_at, או 20:00 בתאריך המשחק. */
export function matchKickoff(match: Match): Date {
  if (match.kickoff_at) {
    const d = new Date(match.kickoff_at);
    if (!Number.isNaN(d.getTime())) return d;
  }
  return new Date(`${match.match_date}T20:00:00`);
}

export function toKickoffIso(date: string, time: string): string {
  const [h, m] = time.split(":").map((n) => parseInt(n, 10));
  const d = new Date(`${date}T00:00:00`);
  d.setHours(Number.isFinite(h) ? h : 20, Number.isFinite(m) ? m : 0, 0, 0);
  return d.toISOString();
}

/** שעת שריקה לפי שעון ישראל (כולל שעון קיץ), לשימוש בסנכרון מההתאחדות. */
export function toIsraelKickoffIso(date: string, time: string, timeZone = "Asia/Jerusalem"): string {
  const padded = time.length === 4 ? `0${time}` : time;
  const wanted = `${date}T${padded}:00`;
  const utcGuess = Date.parse(`${wanted}Z`);
  if (!Number.isFinite(utcGuess)) return new Date(wanted).toISOString();

  const formatter = new Intl.DateTimeFormat("en-US", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hourCycle: "h23",
  });

  const shownUtc = (ms: number) => {
    const parts = formatter.formatToParts(new Date(ms));
    const get = (type: Intl.DateTimeFormatPartTypes) => parts.find((p) => p.type === type)?.value ?? "00";
    return Date.parse(`${get("year")}-${get("month")}-${get("day")}T${get("hour")}:${get("minute")}:${get("second")}Z`);
  };

  let ms = utcGuess;
  for (let i = 0; i < 3; i++) {
    const delta = Date.parse(`${wanted}Z`) - shownUtc(ms);
    if (delta === 0) break;
    ms += delta;
  }
  return new Date(ms).toISOString();
}

export function nextScheduledMatch(matches: Match[]): Match | null {
  const list = matches
    .filter((m) => m.status === "scheduled")
    .sort((a, b) => matchKickoff(a).getTime() - matchKickoff(b).getTime());
  return list[0] ?? null;
}

export function splitMatches(matches: Match[]) {
  const scheduled = matches
    .filter((m) => m.status === "scheduled")
    .sort((a, b) => matchKickoff(a).getTime() - matchKickoff(b).getTime());
  const live = matches.filter((m) => m.status === "live");
  const finished = matches
    .filter((m) => m.status === "finished")
    .sort((a, b) => (b.match_date || "").localeCompare(a.match_date || ""));
  return { scheduled, live, finished };
}
