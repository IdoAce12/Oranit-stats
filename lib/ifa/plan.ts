import { israelToday, toIsraelKickoffIso } from "../fixtures";
import { Match } from "../types";
import { IFA_OUR_NAME } from "./config";
import { ifaMatchKey, namesMatch, type IfaFixture, type IfaStandingRow } from "./parse";

export interface IfaMatchInsert {
  opponent: string;
  match_date: string;
  our_team_name: string;
  match_type: "league";
  status: "scheduled";
  kickoff_at: string | null;
  ifa_key: string;
  notes: string;
}

export interface IfaMatchUpdate {
  id: string;
  opponent: string;
  match_date: string;
  kickoff_at: string | null;
  ifa_key: string | null;
  notes?: string;
}

export interface IfaSyncPlan {
  inserts: IfaMatchInsert[];
  updates: IfaMatchUpdate[];
  deletes: string[];
  skipped: number;
}

/** דחייה / שעה שפורסמה — לא סיבוב שני מול אותה יריבה בעוד חודשיים. */
export const IFA_RESCHEDULE_DAYS = 21;

export function daysBetweenIso(a: string, b: string): number {
  const ms = Math.abs(Date.parse(`${a}T12:00:00`) - Date.parse(`${b}T12:00:00`));
  if (!Number.isFinite(ms)) return Number.POSITIVE_INFINITY;
  return Math.round(ms / 86_400_000);
}

function betterIfaFixture(a: IfaFixture, b: IfaFixture): IfaFixture {
  const aTime = Boolean(a.time);
  const bTime = Boolean(b.time);
  if (aTime !== bTime) return aTime ? a : b;
  const aId = Boolean(a.gameId);
  const bId = Boolean(b.gameId);
  if (aId !== bId) return aId ? a : b;
  return a.date >= b.date ? a : b;
}

/**
 * כשההתאחדות מפרסמת שעה, נשארת לפעמים גם השורה הישנה בלי שעה.
 * משאירים את המשחק עם השעה (או התאריך המעודכן), ואת הסיבוב השני מול אותה יריבה.
 */
export function collapseIfaFixtures(fixtures: IfaFixture[]): IfaFixture[] {
  const played = fixtures.filter((f) => Boolean(f.score?.trim()));
  const unplayed = fixtures.filter((f) => !f.score?.trim());
  const used = new Set<number>();
  const kept: IfaFixture[] = [];
  for (let i = 0; i < unplayed.length; i++) {
    if (used.has(i)) continue;
    const cluster = [unplayed[i]];
    used.add(i);
    for (let j = i + 1; j < unplayed.length; j++) {
      if (used.has(j)) continue;
      if (!namesMatch(unplayed[i].opponent, unplayed[j].opponent)) continue;
      if (daysBetweenIso(unplayed[i].date, unplayed[j].date) > IFA_RESCHEDULE_DAYS) continue;
      cluster.push(unplayed[j]);
      used.add(j);
    }
    kept.push(cluster.reduce(betterIfaFixture));
  }
  return [...kept, ...played];
}

export function ifaVenueNote(fixture: IfaFixture): string {
  const side = fixture.home ? "בית" : "חוץ";
  return fixture.venue ? `${side} · ${fixture.venue}` : side;
}

export function kickoffFromIfa(fixture: IfaFixture): string | null {
  return fixture.time ? toIsraelKickoffIso(fixture.date, fixture.time) : null;
}

function isManualFriendly(match: Match): boolean {
  return (match.match_type ?? "league") === "friendly" && !match.ifa_key;
}

function canOverwriteNotes(notes: string | undefined): boolean {
  const n = (notes ?? "").trim();
  return n === "" || n.startsWith("בית") || n.startsWith("חוץ");
}

export function findExistingIfaMatch(existing: Match[], fixture: IfaFixture): Match | null {
  const key = ifaMatchKey(fixture.date, fixture.opponent);
  const byKey = existing.find((m) => m.ifa_key === key);
  if (byKey) return byKey;

  const byDateOpp = existing.find(
    (m) =>
      !isManualFriendly(m) &&
      m.match_date === fixture.date &&
      namesMatch(m.opponent, fixture.opponent)
  );
  if (byDateOpp) return byDateOpp;

  const scheduledSameOpp = existing.filter(
    (m) =>
      m.status === "scheduled" &&
      !isManualFriendly(m) &&
      namesMatch(m.opponent, fixture.opponent)
  );
  if (scheduledSameOpp.length === 1) return scheduledSameOpp[0];
  if (scheduledSameOpp.length > 1) {
    const nearby = scheduledSameOpp.filter(
      (m) => daysBetweenIso(m.match_date, fixture.date) <= IFA_RESCHEDULE_DAYS
    );
    const pool = nearby.length ? nearby : scheduledSameOpp;
    const placeholder = pool.find((m) => !m.kickoff_at);
    if (placeholder) return placeholder;
    return [...pool].sort(
      (a, b) => daysBetweenIso(a.match_date, fixture.date) - daysBetweenIso(b.match_date, fixture.date)
    )[0];
  }
  return null;
}

/** מחיקה ידנית נשמרת רק אחרי שתאריך המשחק כבר עבר. עד אז הוא חוזר כמשחק הבא. */
export function isActiveDismissedKey(key: string, today: string): boolean {
  const date = key.split("|")[0] ?? "";
  return /^\d{4}-\d{2}-\d{2}$/.test(date) && date < today;
}

export function activeDismissedSet(keys: Iterable<string>, today = israelToday()): Set<string> {
  return new Set([...keys].filter((k) => isActiveDismissedKey(k, today)));
}

/** רק משחקים בלי תוצאה נכנסים ללוח. לייב/הושלם לא נדרסים. ידידות לא נמחקות. */
export function planFixtureSync(
  existing: Match[],
  fixtures: IfaFixture[],
  dismissedKeys: Iterable<string> = [],
  today = israelToday()
): IfaSyncPlan {
  const inserts: IfaMatchInsert[] = [];
  const updates: IfaMatchUpdate[] = [];
  const deletes: string[] = [];
  let skipped = 0;
  const claimed = new Set<string>();
  const dismissed = activeDismissedSet(dismissedKeys, today);
  const official = collapseIfaFixtures(fixtures);

  for (const fixture of official) {
    if (fixture.score) {
      skipped += 1;
      continue;
    }
    const key = ifaMatchKey(fixture.date, fixture.opponent);
    if (dismissed.has(key)) {
      skipped += 1;
      continue;
    }
    const found = findExistingIfaMatch(existing, fixture);
    if (found) {
      if (found.status === "finished") {
        if (found.ifa_key === key) {
          updates.push({
            id: found.id,
            opponent: found.opponent,
            match_date: found.match_date,
            kickoff_at: found.kickoff_at ?? null,
            ifa_key: null,
          });
        }
        inserts.push({
          opponent: fixture.opponent,
          match_date: fixture.date,
          our_team_name: IFA_OUR_NAME,
          match_type: "league",
          status: "scheduled",
          kickoff_at: kickoffFromIfa(fixture),
          ifa_key: key,
          notes: ifaVenueNote(fixture),
        });
        continue;
      }
      if (claimed.has(found.id) || found.status === "live") {
        skipped += 1;
        continue;
      }
      claimed.add(found.id);
      const kickoff_at = kickoffFromIfa(fixture);
      const notes = canOverwriteNotes(found.notes) ? ifaVenueNote(fixture) : undefined;
      const same =
        found.ifa_key === key &&
        found.match_date === fixture.date &&
        found.opponent === fixture.opponent &&
        (found.kickoff_at ?? null) === kickoff_at &&
        (notes === undefined || found.notes === notes);
      if (same) {
        skipped += 1;
        continue;
      }
      updates.push({
        id: found.id,
        opponent: fixture.opponent,
        match_date: fixture.date,
        kickoff_at,
        ifa_key: key,
        notes,
      });
      continue;
    }

    inserts.push({
      opponent: fixture.opponent,
      match_date: fixture.date,
      our_team_name: IFA_OUR_NAME,
      match_type: "league",
      status: "scheduled",
      kickoff_at: kickoffFromIfa(fixture),
      ifa_key: key,
      notes: ifaVenueNote(fixture),
    });
  }

  const liveKeys = new Set(
    official.filter((f) => !f.score?.trim()).map((f) => ifaMatchKey(f.date, f.opponent))
  );
  if (liveKeys.size > 0) {
    for (const match of existing) {
      if (match.status !== "scheduled" || isManualFriendly(match)) continue;
      if (claimed.has(match.id)) continue;
      const key = match.ifa_key?.trim() || ifaMatchKey(match.match_date, match.opponent);
      if (liveKeys.has(key)) continue;
      const nearbyOfficial = official.some(
        (f) =>
          !f.score?.trim() &&
          namesMatch(match.opponent, f.opponent) &&
          daysBetweenIso(match.match_date, f.date) <= IFA_RESCHEDULE_DAYS
      );
      if (nearbyOfficial) deletes.push(match.id);
    }
  }

  return { inserts, updates, deletes, skipped };
}

export function isIfaCacheFresh(fetchedAt: string | null | undefined, now = Date.now(), staleMs = 0): boolean {
  if (!fetchedAt) return false;
  const t = new Date(fetchedAt).getTime();
  if (!Number.isFinite(t)) return false;
  return now - t < staleMs;
}

export function errorMessage(e: unknown): string {
  if (e instanceof Error) return e.message;
  if (typeof e === "string") return e;
  if (e && typeof e === "object" && "message" in e) return String((e as { message: unknown }).message);
  return "שגיאה";
}

export function isMissingIfaSchema(message: string): boolean {
  return /ifa_cache|ifa_key|schema cache|does not exist|could not find the table/i.test(message);
}

export interface IfaSyncResult {
  standings: IfaStandingRow[];
  fixtures: IfaFixture[];
  fetchedAt: string | null;
  inserted: number;
  updated: number;
  skipped: number;
  deleted: number;
  refreshed: boolean;
  dismissedKeys: string[];
  error?: string;
}
