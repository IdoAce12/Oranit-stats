"use client";

import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { AppHeader } from "../../../components/AppHeader";
import { PageSkeleton } from "../../../components/Skeleton";
import { loadSeasonBundle } from "@/lib/db";
import {
  computePlayerSeasonMatches,
  computeSeasonImpact,
  computeSeasonMinutesByKey,
} from "@/lib/impactScore";
import { findRowByPlayerKey } from "@/lib/playerKey";
import { isSupabaseConfigured } from "@/lib/supabaseClient";
import { MATCH_TYPE_LABELS, Match, MatchEvent, Player, SquadPlayer, Substitution } from "@/lib/types";
import { matchIdsForTypes, OFFICIAL_MATCH_TYPES } from "@/lib/matchFilter";
import { withTimeout } from "@/lib/withTimeout";
import { useAuth } from "../../../components/AuthProvider";
import { isGkSeasonIdentity, pct } from "@/lib/gk";

const LOAD_TIMEOUT_MS = 12000;

export default function GoalkeeperProfilePage() {
  const params = useParams<{ key: string }>();
  const router = useRouter();
  const playerKey = decodeURIComponent(params.key ?? "");
  const { isCoach } = useAuth();

  const [events, setEvents] = useState<MatchEvent[]>([]);
  const [players, setPlayers] = useState<Player[]>([]);
  const [squad, setSquad] = useState<SquadPlayer[]>([]);
  const [matches, setMatches] = useState<Match[]>([]);
  const [substitutions, setSubstitutions] = useState<Substitution[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [officialOnly, setOfficialOnly] = useState(true);

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

  const allowedMatchIds = useMemo(
    () => matchIdsForTypes(matches, officialOnly ? OFFICIAL_MATCH_TYPES : []),
    [matches, officialOnly]
  );
  const filteredMatches = useMemo(
    () => (allowedMatchIds ? matches.filter((m) => allowedMatchIds.has(m.id)) : matches),
    [matches, allowedMatchIds]
  );
  const filteredEvents = useMemo(
    () => (allowedMatchIds ? events.filter((e) => allowedMatchIds.has(e.match_id)) : events),
    [events, allowedMatchIds]
  );
  const filteredPlayers = useMemo(
    () => (allowedMatchIds ? players.filter((p) => allowedMatchIds.has(p.match_id)) : players),
    [players, allowedMatchIds]
  );
  const filteredSubs = useMemo(
    () =>
      allowedMatchIds ? substitutions.filter((s) => allowedMatchIds.has(s.match_id)) : substitutions,
    [substitutions, allowedMatchIds]
  );

  const allRows = useMemo(
    () => computeSeasonImpact(filteredEvents, filteredPlayers, squad, players),
    [filteredEvents, filteredPlayers, squad, players]
  );
  const seasonRow = useMemo(
    () => findRowByPlayerKey(allRows, playerKey, players, squad),
    [allRows, playerKey, players, squad]
  );
  const minutesByKey = useMemo(
    () =>
      computeSeasonMinutesByKey(filteredPlayers, filteredSubs, filteredMatches, filteredEvents, squad),
    [filteredPlayers, filteredSubs, filteredMatches, filteredEvents, squad]
  );
  const myMinutes = seasonRow ? (minutesByKey.get(seasonRow.key) ?? 0) : 0;
  const matchLines = useMemo(
    () =>
      computePlayerSeasonMatches(playerKey, filteredEvents, filteredPlayers, filteredMatches, squad),
    [playerKey, filteredEvents, filteredPlayers, filteredMatches, squad]
  );

  useEffect(() => {
    if (loading || !seasonRow) return;
    if (!isGkSeasonIdentity(seasonRow, squad, players)) {
      router.replace(`/season/player/${encodeURIComponent(seasonRow.key)}`);
    }
  }, [loading, seasonRow, squad, players, router]);

  if (loading) {
    return (
      <main className="mx-auto w-full max-w-2xl px-4 page-shell pb-nav">
        <AppHeader title="פרופיל שוער" />
        <PageSkeleton />
      </main>
    );
  }

  if (error || !seasonRow) {
    return (
      <main className="mx-auto flex w-full max-w-md flex-1 flex-col px-4 page-shell">
        <p className="rounded-2xl border border-red-500/40 bg-red-500/10 p-4 text-red-200">
          {error ?? "שוער לא נמצא"}
        </p>
        <Link href="/season/gk" className="mt-4 text-center text-[var(--muted)]">
          ← חזרה לדוח שוערים
        </Link>
      </main>
    );
  }

  if (!isGkSeasonIdentity(seasonRow, squad, players)) {
    return (
      <main className="mx-auto w-full max-w-2xl px-4 page-shell pb-nav">
        <AppHeader title="פרופיל" />
        <PageSkeleton />
      </main>
    );
  }

  const passTotal = seasonRow.gkPassOk + seasonRow.gkPassMiss;
  const aerialTotal = seasonRow.gkAerialOk + seasonRow.gkAerialMiss;
  const exitTotal = seasonRow.gkExitOk + seasonRow.gkExitBad;

  return (
    <main className="mx-auto flex w-full max-w-2xl flex-1 flex-col px-4 page-shell pb-nav">
      <AppHeader
        title={seasonRow.label}
        subtitle="פרופיל שוער"
        backHref={isCoach ? "/season/gk" : "/season"}
        right={
          <button type="button" onClick={() => window.print()} className="btn btn-ghost no-print h-9 px-2 text-xs">
            PDF
          </button>
        }
      />

      <div className="mb-4 flex gap-1.5">
        <button
          type="button"
          onClick={() => setOfficialOnly(true)}
          className={`btn h-9 flex-1 px-3 text-xs ${officialOnly ? "btn-primary" : "btn-ghost"}`}
        >
          רשמי · ליגה וגביע
        </button>
        <button
          type="button"
          onClick={() => setOfficialOnly(false)}
          className={`btn h-9 flex-1 px-3 text-xs ${!officialOnly ? "btn-primary" : "btn-ghost"}`}
        >
          הכל כולל אימונים
        </button>
      </div>

      <section className="card mb-4 border border-violet-400/25 bg-violet-500/10 p-4">
        <p className="label">ציון Impact שוער</p>
        <div className="mt-1 flex items-end justify-between gap-3">
          <p className="text-4xl font-black tabular text-violet-300">
            {seasonRow.score > 0 ? "+" : ""}
            {seasonRow.score.toFixed(1)}
          </p>
          <p className="text-sm text-[var(--muted)]">
            {seasonRow.matchesPlayed} משחקים · {Math.round(myMinutes)}׳
          </p>
        </div>
      </section>

      <section className="mb-4 grid grid-cols-2 gap-2">
        <article className="card p-4 text-center">
          <p className="tabular text-3xl font-black text-violet-300">{seasonRow.gkSaves}</p>
          <p className="mt-1 text-xs text-[var(--muted)]">הדיפת מפתח</p>
        </article>
        <article className="card p-4 text-center">
          <p className="tabular text-3xl font-black text-[var(--accent)]">{Math.round(myMinutes)}</p>
          <p className="mt-1 text-xs text-[var(--muted)]">דקות</p>
        </article>
      </section>

      <OutcomeBlock
        title="מסירה"
        ok={seasonRow.gkPassOk}
        miss={seasonRow.gkPassMiss}
        okLabel="הגיע"
        missLabel="לא הגיע"
        rate={pct(seasonRow.gkPassOk, passTotal)}
      />
      <OutcomeBlock
        title="כדור גובה"
        ok={seasonRow.gkAerialOk}
        miss={seasonRow.gkAerialMiss}
        okLabel="הגיע"
        missLabel="לא הגיע"
        rate={pct(seasonRow.gkAerialOk, aerialTotal)}
      />
      <OutcomeBlock
        title="יציאה מהשער"
        ok={seasonRow.gkExitOk}
        miss={seasonRow.gkExitBad}
        okLabel="טובה"
        missLabel="לא טובה"
        rate={pct(seasonRow.gkExitOk, exitTotal)}
      />

      <section className="mb-4">
        <h2 className="label mb-2">לפי משחק</h2>
        {matchLines.length === 0 ? (
          <p className="card p-4 text-center text-sm text-[var(--muted)]">אין עדיין משחקים לשוער הזה.</p>
        ) : (
          <ul className="flex flex-col gap-2">
            {matchLines.map((line) => (
              <li key={line.matchId} className="card p-3">
                <div className="flex items-center justify-between gap-2">
                  <div>
                    <p className="font-extrabold">מול {line.opponent}</p>
                    <p className="text-[11px] text-[var(--muted)]">
                      {line.matchDate
                        ? new Date(`${line.matchDate}T12:00:00`).toLocaleDateString("he-IL")
                        : ""}
                      {matchTypeById(filteredMatches, line.matchId)}
                    </p>
                  </div>
                  <p className="tabular text-sm font-black text-violet-300">
                    {line.score > 0 ? "+" : ""}
                    {line.score.toFixed(1)}
                  </p>
                </div>
                <p className="mt-2 text-xs text-[var(--muted)]">
                  {line.gkSaves} הדיפה · מסירה {line.gkPassOk}/{line.gkPassMiss} · גובה {line.gkAerialOk}/
                  {line.gkAerialMiss} · יציאה {line.gkExitOk}/{line.gkExitBad}
                </p>
              </li>
            ))}
          </ul>
        )}
      </section>
    </main>
  );
}

function OutcomeBlock({
  title,
  ok,
  miss,
  okLabel,
  missLabel,
  rate,
}: {
  title: string;
  ok: number;
  miss: number;
  okLabel: string;
  missLabel: string;
  rate: string;
}) {
  return (
    <section className="card mb-3 p-4">
      <div className="mb-2 flex items-center justify-between">
        <h2 className="text-sm font-extrabold">{title}</h2>
        <p className="tabular text-sm font-black text-violet-300">{rate}</p>
      </div>
      <div className="grid grid-cols-2 gap-2 text-center">
        <div className="rounded-xl bg-emerald-500/10 py-3">
          <p className="tabular text-2xl font-black text-emerald-300">{ok}</p>
          <p className="text-[11px] text-[var(--muted)]">{okLabel}</p>
        </div>
        <div className="rounded-xl bg-red-500/10 py-3">
          <p className="tabular text-2xl font-black text-red-300">{miss}</p>
          <p className="text-[11px] text-[var(--muted)]">{missLabel}</p>
        </div>
      </div>
    </section>
  );
}

function matchTypeById(matches: Match[], id: string): string {
  const t = matches.find((m) => m.id === id)?.match_type;
  return t ? ` · ${MATCH_TYPE_LABELS[t]}` : "";
}
