import dns from "node:dns";
import { createMatch, deleteMatch, getIfaCache, listDismissedIfaKeys, listMatches, saveIfaCache, updateMatch } from "../db";
import { israelToday } from "../fixtures";
import { IFA_GAMES_URL, IFA_STALE_MS, IFA_TEAM_URL, ifaLiveScrapeEnabled } from "./config";
import { fetchIfaHtml } from "./fetchHtml";
import { parseIfaGames, parseIfaStandings, type IfaFixture, type IfaStandingRow } from "./parse";
import {
  activeDismissedSet,
  collapseIfaFixtures,
  errorMessage,
  isIfaCacheFresh,
  isMissingIfaSchema,
  planFixtureSync,
  type IfaSyncPlan,
  type IfaSyncResult,
} from "./plan";

try {
  dns.setDefaultResultOrder("ipv4first");
} catch {
  /* ignore */
}

async function applyPlan(plan: IfaSyncPlan, dismissedKeys: Iterable<string> = []): Promise<void> {
  const dismissed = activeDismissedSet(dismissedKeys, israelToday());
  for (const row of plan.updates) {
    try {
      await updateMatch(row.id, {
        opponent: row.opponent,
        match_date: row.match_date,
        kickoff_at: row.kickoff_at,
        ifa_key: row.ifa_key,
        notes: row.notes,
      });
    } catch (e) {
      const msg = errorMessage(e);
      if (/0 rows|not found|could not find|No rows/i.test(msg)) continue;
      throw e;
    }
  }
  for (const row of plan.inserts) {
    if (dismissed.has(row.ifa_key)) continue;
    try {
      await createMatch(row);
    } catch (e) {
      const msg = errorMessage(e);
      if (/duplicate|unique|ifa_key/i.test(msg)) continue;
      throw e;
    }
  }
  for (const id of plan.deletes) {
    try {
      await deleteMatch(id, { dismiss: false });
    } catch (e) {
      const msg = errorMessage(e);
      if (/0 rows|not found|could not find|No rows/i.test(msg)) continue;
      throw e;
    }
  }
}

function fromCache(
  cache: { standings: IfaStandingRow[]; fixtures: IfaFixture[]; fetched_at: string } | null,
  extra: Partial<IfaSyncResult> = {}
): IfaSyncResult {
  return {
    standings: cache?.standings ?? [],
    fixtures: collapseIfaFixtures(cache?.fixtures ?? []),
    fetchedAt: cache?.fetched_at ?? null,
    inserted: 0,
    updated: 0,
    skipped: 0,
    deleted: 0,
    refreshed: false,
    dismissedKeys: [],
    ...extra,
  };
}

export async function runIfaSync(
  opts: { force?: boolean; gamesHtml?: string; teamHtml?: string } = {}
): Promise<IfaSyncResult> {
  const suppliedHtml = Boolean(opts.gamesHtml?.trim() || opts.teamHtml?.trim());
  const force = Boolean(opts.force || suppliedHtml);
  let cache: Awaited<ReturnType<typeof getIfaCache>> = null;
  let schemaMissing = false;
  try {
    cache = await getIfaCache();
  } catch (e) {
    const msg = errorMessage(e);
    if (isMissingIfaSchema(msg)) schemaMissing = true;
    else {
      console.error("ifa cache", e);
      schemaMissing = true;
    }
  }

  let dismissedKeys: string[] = [];
  if (!schemaMissing) {
    try {
      dismissedKeys = await listDismissedIfaKeys();
    } catch {
      dismissedKeys = [];
    }
  }

  const today = israelToday();
  const activeDismissed = [...activeDismissedSet(dismissedKeys, today)];
  const migrationError = "חסר חיבור להתאחדות — הרץ את db/migration_v12.sql ב-Supabase SQL Editor";
  const waitingError = "הטבלה תתעדכן אוטומטית מההתאחדות";

  const skipLive =
    !suppliedHtml &&
    (!ifaLiveScrapeEnabled() || (!opts.force && isIfaCacheFresh(cache?.fetched_at, Date.now(), IFA_STALE_MS)));

  if (skipLive) {
    if (!schemaMissing && cache?.fixtures?.length) {
      try {
        const existing = await listMatches();
        const plan = planFixtureSync(existing, cache.fixtures, dismissedKeys, today);
        await applyPlan(plan, dismissedKeys);
        const blocked = new Set(activeDismissed);
        return fromCache(cache, {
          dismissedKeys: activeDismissed,
          inserted: plan.inserts.filter((row) => !blocked.has(row.ifa_key)).length,
          updated: plan.updates.length,
          skipped: plan.skipped,
          deleted: plan.deletes.length,
          error: schemaMissing ? migrationError : undefined,
        });
      } catch (e) {
        console.error("ifa cache apply", e);
        return fromCache(cache, { dismissedKeys: activeDismissed });
      }
    }
    return fromCache(cache, {
      dismissedKeys: activeDismissed,
      error: schemaMissing ? migrationError : cache ? undefined : waitingError,
    });
  }

  try {
    const gamesHtml = opts.gamesHtml?.trim() ? opts.gamesHtml : await fetchIfaHtml(IFA_GAMES_URL);
    const teamHtml = opts.teamHtml?.trim() ? opts.teamHtml : await fetchIfaHtml(IFA_TEAM_URL);
    const fixtures = collapseIfaFixtures(parseIfaGames(gamesHtml));
    const standings = parseIfaStandings(teamHtml);
    if (fixtures.length === 0 && standings.length === 0) {
      return fromCache(cache, {
        dismissedKeys: activeDismissed,
        error: schemaMissing ? migrationError : "לא הצלחנו לקרוא את אתר ההתאחדות",
      });
    }

    if (!schemaMissing) {
      const existing = await listMatches();
      try {
        dismissedKeys = await listDismissedIfaKeys();
      } catch {
        /* keep previous */
      }
      const active = [...activeDismissedSet(dismissedKeys, today)];
      const plan = planFixtureSync(existing, fixtures, dismissedKeys, today);
      try {
        await applyPlan(plan, dismissedKeys);
        const fetchedAt = new Date().toISOString();
        await saveIfaCache({ standings, fixtures, fetched_at: fetchedAt });
        const blocked = new Set(active);
        return {
          standings,
          fixtures,
          fetchedAt,
          inserted: plan.inserts.filter((row) => !blocked.has(row.ifa_key)).length,
          updated: plan.updates.length,
          skipped: plan.skipped,
          deleted: plan.deletes.length,
          refreshed: true,
          dismissedKeys: active,
        };
      } catch (e) {
        const msg = errorMessage(e);
        if (isMissingIfaSchema(msg)) {
          return fromCache(cache, { standings, fixtures, dismissedKeys: active, error: migrationError });
        }
        throw e;
      }
    }

    return fromCache(cache, { standings, fixtures, dismissedKeys: activeDismissed, error: migrationError });
  } catch (e) {
    const msg = errorMessage(e);
    console.error("ifa fetch", e);
    if (!schemaMissing && cache?.fixtures?.length) {
      try {
        const existing = await listMatches();
        const plan = planFixtureSync(existing, cache.fixtures, dismissedKeys, today);
        await applyPlan(plan, dismissedKeys);
        const blocked = new Set(activeDismissed);
        return fromCache(cache, {
          dismissedKeys: activeDismissed,
          inserted: plan.inserts.filter((row) => !blocked.has(row.ifa_key)).length,
          updated: plan.updates.length,
          skipped: plan.skipped,
          deleted: plan.deletes.length,
          error: schemaMissing ? migrationError : undefined,
        });
      } catch (applyErr) {
        console.error("ifa cache apply after fetch fail", applyErr);
      }
    }
    if (cache) {
      return fromCache(cache, {
        dismissedKeys: activeDismissed,
        error: schemaMissing ? migrationError : undefined,
      });
    }
    return fromCache(null, {
      dismissedKeys: activeDismissed,
      error: schemaMissing ? migrationError : msg,
    });
  }
}
