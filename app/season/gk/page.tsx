"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { AppHeader } from "../../components/AppHeader";
import { PageSkeleton } from "../../components/Skeleton";
import { loadSeasonBundle } from "@/lib/db";
import { downloadCsv } from "@/lib/exportCsv";
import { isGkSeasonIdentity, pct } from "@/lib/gk";
import { computeSeasonImpact, computeSeasonMinutesByKey } from "@/lib/impactScore";
import { matchIdsForTypes, OFFICIAL_MATCH_TYPES } from "@/lib/matchFilter";
import { isSupabaseConfigured } from "@/lib/supabaseClient";
import { Match, MatchEvent, Player, SquadPlayer, Substitution } from "@/lib/types";
import { withTimeout } from "@/lib/withTimeout";

const LOAD_TIMEOUT_MS = 12000;

export default function GoalkeepersReportPage() {
  const [events, setEvents] = useState<MatchEvent[]>([]);
  const [players, setPlayers] = useState<Player[]>([]);
  const [squad, setSquad] = useState<SquadPlayer[]>([]);
  const [matches, setMatches] = useState<Match[]>([]);
  const [substitutions, setSubstitutions] = useState<Substitution[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!isSupabaseConfigured) {
      setLoading(false);
      setError("Supabase לא מחובר");
      return;
    }
    withTimeout(loadSeasonBundle(), LOAD_TIMEOUT_MS)
      .then((bundle) => {
        setEvents(bundle.events);
        setPlayers(bundle.players);
        setSquad(bundle.squad);
        setMatches(bundle.matches);
        setSubstitutions(bundle.substitutions);
      })
      .catch((e) => setError(e instanceof Error ? e.message : "שגיאה"))
      .finally(() => setLoading(false));
  }, []);

  const allowed = useMemo(() => matchIdsForTypes(matches, OFFICIAL_MATCH_TYPES), [matches]);
  const filteredMatches = useMemo(
    () => (allowed ? matches.filter((m) => allowed.has(m.id)) : matches),
    [matches, allowed]
  );
  const filteredEvents = useMemo(
    () => (allowed ? events.filter((e) => allowed.has(e.match_id)) : events),
    [events, allowed]
  );
  const filteredPlayers = useMemo(
    () => (allowed ? players.filter((p) => allowed.has(p.match_id)) : players),
    [players, allowed]
  );
  const filteredSubs = useMemo(
    () => (allowed ? substitutions.filter((s) => allowed.has(s.match_id)) : substitutions),
    [substitutions, allowed]
  );

  const rows = useMemo(() => {
    const impact = computeSeasonImpact(filteredEvents, filteredPlayers, squad, players);
    const minutes = computeSeasonMinutesByKey(
      filteredPlayers,
      filteredSubs,
      filteredMatches,
      filteredEvents,
      squad
    );
    return impact
      .filter((row) => isGkSeasonIdentity(row, squad, players))
      .map((row) => ({
        ...row,
        minutes: minutes.get(row.key) ?? 0,
      }))
      .sort((a, b) => b.gkSaves - a.gkSaves || b.minutes - a.minutes);
  }, [filteredEvents, filteredPlayers, filteredSubs, filteredMatches, squad, players]);

  const exportReport = () => {
    const lines = [
      "=== דוח שוערים עונתי ===",
      [
        "מס׳",
        "שם",
        "משחקים",
        "דקות",
        "הדיפת מפתח",
        "מסירה הגיע",
        "מסירה לא הגיע",
        "% מסירה",
        "גובה הגיע",
        "גובה לא הגיע",
        "% גובה",
        "יציאה טובה",
        "יציאה לא טובה",
        "% יציאה",
        "ציון",
      ].join(","),
      ...rows.map((r) =>
        [
          r.shirtNumber ?? "",
          `"${r.label.replace(/"/g, '""')}"`,
          r.matchesPlayed,
          Math.round(r.minutes),
          r.gkSaves,
          r.gkPassOk,
          r.gkPassMiss,
          pct(r.gkPassOk, r.gkPassOk + r.gkPassMiss),
          r.gkAerialOk,
          r.gkAerialMiss,
          pct(r.gkAerialOk, r.gkAerialOk + r.gkAerialMiss),
          r.gkExitOk,
          r.gkExitBad,
          pct(r.gkExitOk, r.gkExitOk + r.gkExitBad),
          r.score.toFixed(1),
        ].join(",")
      ),
    ];
    downloadCsv("goalkeepers_season.csv", lines.join("\n"));
  };

  return (
    <main className="mx-auto flex w-full max-w-3xl flex-1 flex-col px-4 page-shell pb-nav">
      <AppHeader title="דוח שוערים" subtitle="מדדי שוער בלבד — נפרד משחקני שדה" backHref="/season" />

      {loading && <PageSkeleton rows={5} />}
      {error && <p className="text-[var(--danger)]">{error}</p>}

      {!loading && !error && (
        <>
          <button
            type="button"
            onClick={exportReport}
            disabled={rows.length === 0}
            className="btn btn-primary mb-4 w-full py-3 text-sm"
          >
            ⬇ ייצוא דוח שוערים
          </button>
          {rows.length === 0 ? (
            <div className="card p-6 text-center text-sm text-[var(--muted)]">
              אין עדיין שוערים מסומנים בסגל.
            </div>
          ) : (
            <ul className="flex flex-col gap-2">
              {rows.map((row) => (
                <li key={row.key}>
                  <Link
                    href={`/season/gk/${encodeURIComponent(row.key)}`}
                    className="card flex flex-col gap-3 p-4 active:bg-white/[0.03]"
                  >
                    <div className="flex items-center justify-between gap-3">
                      <div className="min-w-0">
                        <p className="truncate font-extrabold">{row.label}</p>
                        <p className="text-xs text-[var(--muted)]">
                          שוער · {row.matchesPlayed} מש׳ · {Math.round(row.minutes)}׳
                        </p>
                      </div>
                      <p className="tabular text-lg font-black text-violet-300">
                        {row.score > 0 ? "+" : ""}
                        {row.score.toFixed(1)}
                      </p>
                    </div>
                    <div className="grid grid-cols-4 gap-2 text-center text-[11px] text-[var(--muted)]">
                      <span>
                        <b className="block tabular text-base text-[var(--text)]">{row.gkSaves}</b>
                        הדיפה
                      </span>
                      <span>
                        <b className="block tabular text-base text-[var(--text)]">
                          {pct(row.gkPassOk, row.gkPassOk + row.gkPassMiss)}
                        </b>
                        מסירה
                      </span>
                      <span>
                        <b className="block tabular text-base text-[var(--text)]">
                          {pct(row.gkAerialOk, row.gkAerialOk + row.gkAerialMiss)}
                        </b>
                        גובה
                      </span>
                      <span>
                        <b className="block tabular text-base text-[var(--text)]">
                          {pct(row.gkExitOk, row.gkExitOk + row.gkExitBad)}
                        </b>
                        יציאה
                      </span>
                    </div>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </>
      )}
    </main>
  );
}
