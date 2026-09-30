import { israelToday, nextScheduledMatch } from "./fixtures";
import { IFA_OUR_NAME } from "./ifa/config";
import { ifaMatchKey, namesMatch, type IfaFixture } from "./ifa/parse";
import { collapseIfaFixtures, daysBetweenIso, IFA_RESCHEDULE_DAYS, ifaVenueNote, kickoffFromIfa } from "./ifa/plan";
import { Match } from "./types";

export const IFA_PENDING_PREFIX = "ifa:";

export function isPendingIfaMatch(match: Match): boolean {
  return match.id.startsWith(IFA_PENDING_PREFIX);
}

/** המשחק הרשמי הבא מאתר ההתאחדות — בלי תוצאה, מהתאריך של היום והלאה. */
export function nextOfficialFixture(fixtures: IfaFixture[], today = israelToday()): IfaFixture | null {
  const upcoming = collapseIfaFixtures(fixtures)
    .filter((f) => !f.score?.trim() && f.date >= today)
    .sort(
      (a, b) => a.date.localeCompare(b.date) || (a.time ?? "99:99").localeCompare(b.time ?? "99:99")
    );
  return upcoming[0] ?? null;
}

export function pendingMatchFromFixture(fixture: IfaFixture): Match {
  return {
    id: `${IFA_PENDING_PREFIX}${ifaMatchKey(fixture.date, fixture.opponent)}`,
    opponent: fixture.opponent,
    match_date: fixture.date,
    our_team_name: IFA_OUR_NAME,
    status: "scheduled",
    match_type: "league",
    kickoff_at: kickoffFromIfa(fixture),
    ifa_key: ifaMatchKey(fixture.date, fixture.opponent),
    ended_at: null,
    created_at: "",
    notes: ifaVenueNote(fixture),
  };
}

function usableMatchForFixture(matches: Match[], fixture: IfaFixture): Match | null {
  const key = ifaMatchKey(fixture.date, fixture.opponent);
  const candidates = matches.filter((m) => {
    if (m.status === "finished") return false;
    if (m.ifa_key === key) return true;
    if (m.match_date === fixture.date && namesMatch(m.opponent, fixture.opponent)) return true;
    return (
      m.status === "scheduled" &&
      namesMatch(m.opponent, fixture.opponent) &&
      daysBetweenIso(m.match_date, fixture.date) <= IFA_RESCHEDULE_DAYS
    );
  });
  return candidates.find((m) => m.status === "live") ?? candidates.find((m) => m.status === "scheduled") ?? null;
}

/** לייב בכרטיס הבית רק אם זה המשחק הרשמי הבא — לא טוברוק שרץ בטעות. */
export function homeLiveMatch(
  matches: Match[],
  fixtures: IfaFixture[],
  today = israelToday()
): Match | null {
  const official = nextOfficialFixture(fixtures, today);
  if (official) {
    const found = usableMatchForFixture(matches, official);
    return found?.status === "live" ? found : null;
  }
  return matches.find((m) => m.status === "live") ?? null;
}

/** כרטיס המשחק הבא לפי לוח ההתאחדות, גם אם במסד נשארה רק טוברוק. */
export function homeNextMatch(
  matches: Match[],
  fixtures: IfaFixture[],
  today = israelToday()
): Match | null {
  const official = nextOfficialFixture(fixtures, today);
  if (official) {
    const found = usableMatchForFixture(matches, official);
    if (found?.status === "live") return null;
    if (found && found.match_date === official.date) return found;
    return pendingMatchFromFixture(official);
  }
  return nextScheduledMatch(matches, today);
}
