import { toIsraelKickoffIso } from "../fixtures";
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
  ifa_key: string;
  notes?: string;
}

export interface IfaSyncPlan {
  inserts: IfaMatchInsert[];
  updates: IfaMatchUpdate[];
  skipped: number;
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
  return null;
}

/** רק משחקים בלי תוצאה נכנסים ללוח. לייב/הושלם לא נדרסים. ידידות לא נמחקות. */
export function planFixtureSync(
  existing: Match[],
  fixtures: IfaFixture[],
  dismissedKeys: Iterable<string> = []
): IfaSyncPlan {
  const inserts: IfaMatchInsert[] = [];
  const updates: IfaMatchUpdate[] = [];
  let skipped = 0;
  const claimed = new Set<string>();
  const dismissed = new Set(dismissedKeys);

  for (const fixture of fixtures) {
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
      if (claimed.has(found.id) || found.status === "live" || found.status === "finished") {
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

  return { inserts, updates, skipped };
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
  refreshed: boolean;
  dismissedKeys: string[];
  error?: string;
}
