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
