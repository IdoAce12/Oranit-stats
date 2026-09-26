import { matchKickoff, israelToday } from "./fixtures";
import { activeDismissedSet, findExistingIfaMatch, ifaVenueNote, kickoffFromIfa } from "./ifa/plan";
import { ifaMatchKey, namesMatch, type IfaFixture } from "./ifa/parse";
import { MATCH_TYPE_LABELS, Match, MatchStatus, MatchType } from "./types";

export type CalendarEvent = {
  key: string;
  date: string;
  opponent: string;
  home: boolean | null;
  time: string | null;
  kickoffAt: string | null;
  matchType: MatchType;
  status: MatchStatus;
  matchId: string | null;
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
  };
}

/** מאחד משחקים מהמסד עם לוח ההתאחדות, בלי כפילויות. */
export function buildCalendarEvents(
  matches: Match[],
  fixtures: IfaFixture[],
  dismissedKeys: Iterable<string> = [],
  today = israelToday()
): CalendarEvent[] {
  const claimed = new Set<string>();
  const dismissed = activeDismissedSet(dismissedKeys, today);
  const events: CalendarEvent[] = [];

  for (const match of matches) {
    const fixture = fixtureForMatch(match, fixtures);
    if (fixture) claimed.add(`${fixture.date}|${fixture.opponent}`);
    events.push(fromMatch(match, fixture));
  }

  for (const fixture of fixtures) {
    const key = ifaMatchKey(fixture.date, fixture.opponent);
    if (dismissed.has(key)) continue;
    if (claimed.has(`${fixture.date}|${fixture.opponent}`)) continue;
    if (findExistingIfaMatch(matches, fixture)) continue;
    events.push(fromFixture(fixture));
  }

  return events.sort((a, b) => {
    const ak = a.kickoffAt ?? `${a.date}T12:00:00`;
    const bk = b.kickoffAt ?? `${b.date}T12:00:00`;
    return ak.localeCompare(bk);
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

export function nextCalendarDate(events: CalendarEvent[], today: string): string | null {
  const upcoming = events
    .filter((e) => e.status === "live" || (e.status === "scheduled" && e.date >= today))
    .sort((a, b) => a.date.localeCompare(b.date) || (a.kickoffAt ?? "").localeCompare(b.kickoffAt ?? ""));
  if (upcoming[0]) return upcoming[0].date;
  const past = [...events].sort((a, b) => b.date.localeCompare(a.date));
  return past[0]?.date ?? null;
}

export function typeLine(event: CalendarEvent): string {
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
  const summary = `הפועל אורנית נגד ${event.opponent}`;
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
