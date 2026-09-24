import { createMatch, getIfaCache, listMatches, saveIfaCache, updateMatch } from "../db";
import { IFA_GAMES_URL, IFA_STALE_MS, IFA_TEAM_URL } from "./config";
import { parseIfaGames, parseIfaStandings, type IfaFixture, type IfaStandingRow } from "./parse";
import {
  errorMessage,
  isIfaCacheFresh,
  isMissingIfaSchema,
  planFixtureSync,
  type IfaSyncPlan,
  type IfaSyncResult,
} from "./plan";

function allowLocalTls(): void {
  if (typeof window === "undefined" && process.env.VERCEL !== "1") {
    process.env.NODE_TLS_REJECT_UNAUTHORIZED ??= "0";
  }
}

async function fetchIfaHtml(url: string): Promise<string> {
  allowLocalTls();
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), 15000);
  try {
    const res = await fetch(url, {
      signal: ctrl.signal,
      cache: "no-store",
      headers: {
        "User-Agent": "Mozilla/5.0 (compatible; OranitScout/1.0)",
        Accept: "text/html,application/xhtml+xml",
        "Accept-Language": "he,en;q=0.8",
      },
    });
    if (!res.ok) throw new Error(`האתר של ההתאחדות החזיר ${res.status}`);
    return await res.text();
  } finally {
    clearTimeout(timer);
  }
}

async function applyPlan(plan: IfaSyncPlan): Promise<void> {
  for (const row of plan.inserts) {
    try {
      await createMatch(row);
    } catch (e) {
      const msg = errorMessage(e);
      if (/duplicate|unique|ifa_key/i.test(msg)) continue;
      throw e;
    }
  }
  for (const row of plan.updates) {
    await updateMatch(row.id, {
      opponent: row.opponent,
      match_date: row.match_date,
      kickoff_at: row.kickoff_at,
      ifa_key: row.ifa_key,
      notes: row.notes,
    });
  }
}

function fromCache(
  cache: { standings: IfaStandingRow[]; fixtures: IfaFixture[]; fetched_at: string } | null,
  extra: Partial<IfaSyncResult> = {}
): IfaSyncResult {
  return {
    standings: cache?.standings ?? [],
    fixtures: cache?.fixtures ?? [],
    fetchedAt: cache?.fetched_at ?? null,
    inserted: 0,
    updated: 0,
    skipped: 0,
    refreshed: false,
    ...extra,
  };
}

export async function runIfaSync(opts: { force?: boolean } = {}): Promise<IfaSyncResult> {
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

  if (!schemaMissing && !opts.force && isIfaCacheFresh(cache?.fetched_at, Date.now(), IFA_STALE_MS)) {
    return fromCache(cache);
  }

  const migrationError = "חסר חיבור להתאחדות — הרץ את db/migration_v12.sql ב-Supabase SQL Editor";

  try {
    const [gamesHtml, teamHtml] = await Promise.all([
      fetchIfaHtml(IFA_GAMES_URL),
      fetchIfaHtml(IFA_TEAM_URL),
    ]);
    const fixtures = parseIfaGames(gamesHtml);
    const standings = parseIfaStandings(teamHtml);
    if (fixtures.length === 0 && standings.length === 0) {
      return fromCache(cache, { error: schemaMissing ? migrationError : "לא הצלחנו לקרוא את אתר ההתאחדות" });
    }

    if (!schemaMissing) {
      const existing = await listMatches();
      const plan = planFixtureSync(existing, fixtures);
      try {
        await applyPlan(plan);
        const fetchedAt = new Date().toISOString();
        await saveIfaCache({ standings, fixtures, fetched_at: fetchedAt });
        return {
          standings,
          fixtures,
          fetchedAt,
          inserted: plan.inserts.length,
          updated: plan.updates.length,
          skipped: plan.skipped,
          refreshed: true,
        };
      } catch (e) {
        const msg = errorMessage(e);
        if (isMissingIfaSchema(msg)) {
          return fromCache(cache, { standings, fixtures, error: migrationError });
        }
        throw e;
      }
    }

    return fromCache(cache, { standings, fixtures, error: migrationError });
  } catch (e) {
    const msg = errorMessage(e);
    console.error("ifa fetch", e);
    if (cache) return fromCache(cache, { error: schemaMissing ? migrationError : msg });
    return fromCache(null, { error: schemaMissing ? migrationError : msg });
  }
}
