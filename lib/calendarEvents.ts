import { matchKickoff, israelToday, toIsraelKickoffIso } from "./fixtures";
import { activeDismissedSet, collapseIfaFixtures, daysBetweenIso, IFA_RESCHEDULE_DAYS, ifaVenueNote, kickoffFromIfa } from "./ifa/plan";
import { ifaMatchKey, namesMatch, type IfaFixture } from "./ifa/parse";
import type { Training } from "./trainings";
import { MATCH_TYPE_LABELS, Match, MatchStatus, MatchType } from "./types";

export type CalendarEventKind = "match" | "training";

export type CalendarEvent = {
  key: string;
  kind: CalendarEventKind;
  date: string;
  opponent: string;
  home: boolean | null;
  time: string | null;
  kickoffAt: string | null;
  matchType: MatchType;
  status: MatchStatus;
  matchId: string | null;
  trainingId: string | null;
  venue: string;
  notes: string;
  score: string | null;
};

function timeFromKickoff(iso: string | null | undefined): string | null {
  if (!iso) return null;
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return null;
  return d.toLocaleTimeString("he-IL", { hour: "2-digit", minute: "2-digit", hourCycle: "h23" });
}

function fixtureForMatch(match: Match, fixtures: IfaFixture[]): IfaFixture | null {
  const key = match.ifa_key?.trim();
  if (key) {
    const byKey = fixtures.find((f) => ifaMatchKey(f.date, f.opponent) === key);
    if (byKey) return byKey;
  }
  return (
    fixtures.find((f) => f.date === match.match_date && namesMatch(match.opponent, f.opponent)) ??
    null
  );
}

function fromMatch(match: Match, fixture: IfaFixture | null): CalendarEvent {
  const kickoffAt = match.kickoff_at ?? (fixture ? kickoffFromIfa(fixture) : null);
  const home = fixture ? fixture.home : null;
  const venue = fixture?.venue ?? "";
  const notes = match.notes?.trim() || (fixture ? ifaVenueNote(fixture) : "");
  return {
    key: match.id,
    date: match.match_date,
    opponent: match.opponent,
    home,
    time: timeFromKickoff(kickoffAt) ?? fixture?.time ?? null,
    kickoffAt,
    matchType: match.match_type ?? "league",
    status: match.status,
    matchId: match.id,
    venue,
    notes,
    score: fixture?.score ?? null,
    kind: "match",
    trainingId: null,
  };
}

function fromFixture(fixture: IfaFixture): CalendarEvent {
  const kickoffAt = kickoffFromIfa(fixture);
  return {
    key: `ifa:${fixture.date}|${fixture.opponent}`,
    date: fixture.date,
    opponent: fixture.opponent,
    home: fixture.home,
    time: fixture.time,
    kickoffAt,
    matchType: "league",
    status: fixture.score ? "finished" : "scheduled",
    matchId: null,
    venue: fixture.venue,
    notes: ifaVenueNote(fixture),
    score: fixture.score,
    kind: "match",
    trainingId: null,
  };
}

function fromTraining(training: Training): CalendarEvent {
  const kickoffAt = training.time ? toIsraelKickoffIso(training.date, training.time) : null;
  return {
    key: `training:${training.id}`,
    kind: "training",
    date: training.date,
    opponent: "אימון",
    home: true,
    time: training.time,
    kickoffAt,
    matchType: "friendly",
    status: "scheduled",
    matchId: null,
    trainingId: training.id,
    venue: training.venue,
    notes: training.venue,
    score: null,
  };
}

function betterScheduledEvent(a: CalendarEvent, b: CalendarEvent): CalendarEvent {
  const aTime = Boolean(a.time);
  const bTime = Boolean(b.time);
  if (aTime !== bTime) return aTime ? a : b;
  if (a.date !== b.date) return a.date >= b.date ? a : b;
  if (Boolean(a.matchId) !== Boolean(b.matchId)) return a.matchId ? a : b;
  return a;
}

function collapseScheduledDuplicates(events: CalendarEvent[]): CalendarEvent[] {
  const others = events.filter((e) => e.kind !== "match" || e.status !== "scheduled");
  const scheduled = events.filter((e) => e.kind === "match" && e.status === "scheduled");
  const used = new Set<number>();
  const kept: CalendarEvent[] = [];
  for (let i = 0; i < scheduled.length; i++) {
    if (used.has(i)) continue;
    const cluster = [scheduled[i]];
    used.add(i);
    for (let j = i + 1; j < scheduled.length; j++) {
      if (used.has(j)) continue;
      if (!namesMatch(scheduled[i].opponent, scheduled[j].opponent)) continue;
      if (daysBetweenIso(scheduled[i].date, scheduled[j].date) > IFA_RESCHEDULE_DAYS) continue;
      cluster.push(scheduled[j]);
      used.add(j);
    }
    kept.push(cluster.reduce(betterScheduledEvent));
  }
  return [...others, ...kept];
}

function mergeMatchEvent(a: CalendarEvent, b: CalendarEvent): CalendarEvent {
  const rank = (e: CalendarEvent) =>
    (e.matchId ? 4 : 0) + (e.status === "finished" ? 2 : 0) + (e.score ? 1 : 0);
  const primary = rank(a) >= rank(b) ? a : b;
  const other = primary === a ? b : a;
  return {
    ...primary,
    score: primary.score || other.score,
    home: primary.home ?? other.home,
    venue: primary.venue || other.venue,
    time: primary.time || other.time,
    kickoffAt: primary.kickoffAt || other.kickoffAt,
    notes: primary.notes || other.notes,
  };
}

function pickSameDayMatch(cluster: CalendarEvent[]): CalendarEvent {
  const hasScore = cluster.some((e) => Boolean(e.score?.trim()));
  const scheduled = cluster.filter((e) => e.status === "scheduled");
  const finished = cluster.filter((e) => e.status === "finished" || e.status === "live");
  if (!hasScore && finished.length > 0 && scheduled.length > 0) {
    return scheduled.reduce(betterScheduledEvent);
  }
  return cluster.reduce(mergeMatchEvent);
}

/** כרטיס אחד ליום ליריבה — מונע כפילות מסד + התאחדות בכל הסטטוסים. */
function collapseSameDayMatches(events: CalendarEvent[]): CalendarEvent[] {
  const others = events.filter((e) => e.kind !== "match");
  const matches = events.filter((e) => e.kind === "match");
  const used = new Set<number>();
  const kept: CalendarEvent[] = [];
  for (let i = 0; i < matches.length; i++) {
    if (used.has(i)) continue;
    const cluster = [matches[i]];
    used.add(i);
    for (let j = i + 1; j < matches.length; j++) {
      if (used.has(j)) continue;
      if (matches[i].date !== matches[j].date) continue;
      if (!sameFixture(matches[i], matches[j])) continue;
      cluster.push(matches[j]);
      used.add(j);
    }
    kept.push(pickSameDayMatch(cluster));
  }
  return [...others, ...kept];
}

function sameFixture(a: CalendarEvent, b: CalendarEvent): boolean {
  if (a.date !== b.date) return false;
  if (a.matchId && b.matchId && a.matchId === b.matchId) return true;
  if (namesMatch(a.opponent, b.opponent)) return true;
  return false;
}

/** יום עם משחק אחד במסד וכרטיס התאחדות יתום — כרטיס אחד, גם אם השמות לא זהים. */
function collapseOrphanIfaSameDay(events: CalendarEvent[]): CalendarEvent[] {
  const others = events.filter((e) => e.kind !== "match");
  const matches = events.filter((e) => e.kind === "match");
  const byDate = new Map<string, CalendarEvent[]>();
  for (const event of matches) {
    const list = byDate.get(event.date) ?? [];
    list.push(event);
    byDate.set(event.date, list);
  }
  const kept: CalendarEvent[] = [];
  for (const list of byDate.values()) {
    const db = list.filter((e) => Boolean(e.matchId));
    const ifaOnly = list.filter((e) => !e.matchId);
    if (db.length === 1 && ifaOnly.length > 0) {
      kept.push(ifaOnly.reduce((acc, e) => mergeMatchEvent(acc, e), db[0]));
    } else {
      kept.push(...list);
    }
  }
  return [...others, ...kept];
}

/** מאחד משחקים מהמסד עם לוח ההתאחדות, בלי כפילויות. */
export function buildCalendarEvents(
  matches: Match[],
  fixtures: IfaFixture[],
  dismissedKeys: Iterable<string> = [],
  today = israelToday(),
  trainings: Training[] = []
): CalendarEvent[] {
  const claimed = new Set<string>();
  const dismissed = activeDismissedSet(dismissedKeys, today);
  const official = collapseIfaFixtures(fixtures);
  const events: CalendarEvent[] = [];

  for (const match of matches) {
    const fixture = fixtureForMatch(match, official);
    if (match.status === "finished" && fixture && !fixture.score?.trim()) {
      continue;
    }
    if (fixture) claimed.add(ifaMatchKey(fixture.date, fixture.opponent));
    events.push(fromMatch(match, fixture));
  }

  for (const fixture of official) {
    const key = ifaMatchKey(fixture.date, fixture.opponent);
    if (dismissed.has(key)) continue;
    if (claimed.has(key)) continue;
    events.push(fromFixture(fixture));
  }

  for (const training of trainings) {
    events.push(fromTraining(training));
  }

  return collapseOrphanIfaSameDay(
    collapseSameDayMatches(collapseScheduledDuplicates(events))
  ).sort((a, b) => {
    const ak = a.kickoffAt ?? `${a.date}T12:00:00`;
    const bk = b.kickoffAt ?? `${b.date}T12:00:00`;
    const byTime = ak.localeCompare(bk);
    if (byTime !== 0) return byTime;
    if (a.kind === "training" && b.kind !== "training") return 1;
    if (b.kind === "training" && a.kind !== "training") return -1;
    return 0;
  });
}

export function eventsOnDate(events: CalendarEvent[], iso: string): CalendarEvent[] {
  return events.filter((e) => e.date === iso);
}

export function eventsByDate(events: CalendarEvent[]): Map<string, CalendarEvent[]> {
  const map = new Map<string, CalendarEvent[]>();
  for (const e of events) {
    const list = map.get(e.date) ?? [];
    list.push(e);
    map.set(e.date, list);
  }
  return map;
}

/** תאריך לפתיחת הלוח: משחק רשמי הבא, אחרת היום — לא משחק מאוחר שנשאר במסד. */
export function nextCalendarDate(
  events: CalendarEvent[],
  today: string,
  officialDate?: string | null
): string | null {
  if (officialDate && officialDate >= today) return officialDate;
  const upcoming = events
    .filter((e) => e.status === "scheduled" && e.date >= today)
    .sort((a, b) => a.date.localeCompare(b.date) || (a.kickoffAt ?? "").localeCompare(b.kickoffAt ?? ""));
  if (upcoming[0]) return upcoming[0].date;
  return today;
}

export function typeLine(event: CalendarEvent): string {
  if (event.kind === "training") {
    return ["אימון", event.venue].filter(Boolean).join(" · ");
  }
  const type = MATCH_TYPE_LABELS[event.matchType];
  const side = event.home == null ? "" : event.home ? "בית" : "חוץ";
  return [type, side, event.venue].filter(Boolean).join(" · ");
}

export function whenLine(event: CalendarEvent): string {
  const day = new Date(`${event.date}T12:00:00`).toLocaleDateString("he-IL", {
    weekday: "long",
    day: "numeric",
    month: "short",
    year: "numeric",
  });
  if (event.time) return `${event.time}, ${day}`;
  return `${day} · שעה טרם נקבעה`;
}

function icsStamp(d: Date): string {
  return d.toISOString().replace(/[-:]/g, "").replace(/\.\d{3}Z$/, "Z");
}

/** קובץ יומן לטלפון — משחק אחד. */
export function calendarEventIcs(event: CalendarEvent): string {
  const summary = event.kind === "training" ? `אימון הפועל אורנית` : `הפועל אורנית נגד ${event.opponent}`;
  const desc = [typeLine(event), event.notes].filter(Boolean).join("\\n");
  const stamp = icsStamp(new Date());
  const uid = `${event.key.replace(/[^a-zA-Z0-9-]/g, "")}@oranit-stats`;
  if (event.kickoffAt) {
    const start = matchKickoff({
      kickoff_at: event.kickoffAt,
      match_date: event.date,
    } as Match);
    const end = new Date(start.getTime() + 2 * 60 * 60 * 1000);
    return [
      "BEGIN:VCALENDAR",
      "VERSION:2.0",
      "PRODID:-//Oranit Stats//Calendar//HE",
      "BEGIN:VEVENT",
      `UID:${uid}`,
      `DTSTAMP:${stamp}`,
      `DTSTART:${icsStamp(start)}`,
      `DTEND:${icsStamp(end)}`,
      `SUMMARY:${summary}`,
      `DESCRIPTION:${desc}`,
      event.venue ? `LOCATION:${event.venue}` : "",
      "END:VEVENT",
      "END:VCALENDAR",
    ]
      .filter(Boolean)
      .join("\r\n");
  }
  const day = event.date.replace(/-/g, "");
  return [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//Oranit Stats//Calendar//HE",
    "BEGIN:VEVENT",
    `UID:${uid}`,
    `DTSTAMP:${stamp}`,
    `DTSTART;VALUE=DATE:${day}`,
    `SUMMARY:${summary}`,
    `DESCRIPTION:${desc}`,
    "END:VEVENT",
    "END:VCALENDAR",
  ].join("\r\n");
}
