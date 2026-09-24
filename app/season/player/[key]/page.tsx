"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { loadSeasonBundle } from "@/lib/db";
import {
  computePlayerSeasonMatches,
  computeSeasonImpact,
  explainImpact,
  type SeasonImpact,
} from "@/lib/impactScore";
import { findRowByPlayerKey, playerMatchesKey } from "@/lib/playerKey";
import { isSupabaseConfigured } from "@/lib/supabaseClient";
import { MATCH_TYPE_LABELS, Match, MatchEvent, Player, SquadPlayer } from "@/lib/types";
import { AppHeader } from "../../../components/AppHeader";
import { PageSkeleton } from "../../../components/Skeleton";
import { RadarProfile } from "../../../components/RadarProfile";
import { RadarAxisSheet } from "../../../components/RadarAxisSheet";
import { TrendChart, TrendPoint } from "../../../components/TrendChart";
import { useAuth } from "../../../components/AuthProvider";
import { buildRadarData, roundMetric } from "@/lib/advancedMetrics";
import { describeRadarAxis, radarAxisFromLabel } from "@/lib/radarExplain";
import { matchIdsForTypes, OFFICIAL_MATCH_TYPES } from "@/lib/matchFilter";
import { withTimeout } from "@/lib/withTimeout";
import { METRIC_COLORS, METRIC_LABELS, MetricKey } from "@/lib/trendMetrics";

const PLAYER_TREND_METRICS: MetricKey[] = [
  "score",
  "goals",
  "assists",
  "keyPasses",
  "tackles",
  "losses",
];

const LOAD_TIMEOUT_MS = 12000;

function emptySeasonRow(base: SeasonImpact): SeasonImpact {
  return {
    ...base,
    score: 0,
    matchesPlayed: 0,
    keyPasses: 0,
    goals: 0,
    assists: 0,
    tackles: 0,
    lossesTotal: 0,
    defLosses: 0,
    midLosses: 0,
    attLosses: 0,
    shotsInBox: 0,
    shotsOutBox: 0,
    aerialWon: 0,
    aerialLost: 0,
    groundWon: 0,
    groundLost: 0,
    perMatch: 0,
  };
}

export default function SeasonPlayerPage() {
  const params = useParams<{ key: string }>();
  const playerKey = decodeURIComponent(params.key ?? "");
  const { displayName, isCoach } = useAuth();

  const [events, setEvents] = useState<MatchEvent[]>([]);
  const [players, setPlayers] = useState<Player[]>([]);
  const [squad, setSquad] = useState<SquadPlayer[]>([]);
  const [matches, setMatches] = useState<Match[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [trendMetric, setTrendMetric] = useState<MetricKey>("score");
  const [officialOnly, setOfficialOnly] = useState(true);
  const [radarAxis, setRadarAxis] = useState<string | null>(null);

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

  const identityRow = useMemo(
    () => findRowByPlayerKey(computeSeasonImpact(events, players, squad), playerKey, players, squad),
    [events, players, squad, playerKey]
  );

  const allRows = useMemo(
    () => computeSeasonImpact(filteredEvents, filteredPlayers, squad, players),
    [filteredEvents, filteredPlayers, squad, players]
  );
  const seasonRow = useMemo(() => {
    const row = findRowByPlayerKey(allRows, playerKey, players, squad);
    if (row) return row;
    if (identityRow) return emptySeasonRow(identityRow);
    return null;
  }, [allRows, playerKey, players, squad, identityRow]);

  const matchLines = useMemo(
    () =>
      computePlayerSeasonMatches(playerKey, filteredEvents, filteredPlayers, filteredMatches, squad),
    [playerKey, filteredEvents, filteredPlayers, filteredMatches, squad]
  );

  const matchTypeById = useMemo(
    () => new Map(filteredMatches.map((m) => [m.id, m.match_type ?? "league"] as const)),
    [filteredMatches]
  );

  const myEvents = useMemo(() => {
    const ids = new Set<string>();
    for (const p of filteredPlayers) {
      if (!playerMatchesKey(p, playerKey, squad)) continue;
      ids.add(p.id);
      if (p.squad_player_id) ids.add(p.squad_player_id);
    }
    if (playerKey.startsWith("sq:")) ids.add(playerKey.slice(3));
    return filteredEvents.filter((e) => e.player_id && ids.has(e.player_id));
  }, [filteredEvents, filteredPlayers, playerKey, squad]);

  const impactBreakdown = useMemo(() => explainImpact(myEvents), [myEvents]);

  const radar = useMemo(
    () => (seasonRow ? buildRadarData(seasonRow, allRows) : []),
    [seasonRow, allRows]
  );

  const trendData = useMemo<TrendPoint[]>(
    () =>
      [...matchLines].reverse().map((l) => ({
        label: l.opponent.slice(0, 10),
        score: roundMetric(l.score),
        goals: l.goals,
        assists: l.assists,
        keyPasses: l.keyPasses,
        tackles: l.tackles,
        losses: l.losses,
      })),
    [matchLines]
  );

  const trendSeries = useMemo(
    () => [
      {
        key: trendMetric as keyof TrendPoint,
        label: METRIC_LABELS[trendMetric],
        color: METRIC_COLORS[trendMetric],
      },
    ],
    [trendMetric]
  );

  if (loading) {
    return (
      <main className="mx-auto w-full max-w-2xl px-4 page-shell pb-nav">
        <AppHeader title="פרופיל" />
        <PageSkeleton />
      </main>
    );
  }

  if (error || !seasonRow) {
    return (
      <main className="mx-auto flex w-full max-w-md flex-1 flex-col px-4 page-shell">
        <p className="rounded-2xl border border-red-500/40 bg-red-500/10 p-4 text-red-200">
          {error ?? "שחקן לא נמצא"}
        </p>
        <Link href="/season" className="mt-4 text-center text-[var(--muted)]">
          ← חזרה לנתונים
        </Link>
      </main>
    );
  }

  const avg = (n: number) =>
    seasonRow.matchesPlayed > 0 ? (n / seasonRow.matchesPlayed).toFixed(1) : "0";

  const axisKey = radarAxis ? radarAxisFromLabel(radarAxis) : null;
  const axisExplain =
    axisKey && seasonRow
      ? describeRadarAxis(axisKey, seasonRow, radar.find((d) => d.axis === radarAxis)?.a ?? 0)
      : null;

  return (
    <main className="mx-auto flex w-full max-w-2xl flex-1 flex-col px-4 page-shell pb-nav">
      {!isCoach && (
        <p className="mb-2 text-center font-[family-name:var(--font-frank)] text-3xl font-bold leading-tight">
          שלום, {displayName}
        </p>
      )}
      <AppHeader
        title={seasonRow.label}
        subtitle="הנתונים שלי"
        backHref={isCoach ? "/season" : undefined}
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

      <section className="card mb-4 p-4">
        <div className="flex items-end justify-between gap-3">
          <div>
            <p className="label">ציון Impact</p>
            <p
              className={`mt-1 text-4xl font-black tabular ${
                seasonRow.score > 0
                  ? "text-[var(--accent)]"
                  : seasonRow.score < 0
                    ? "text-[var(--danger)]"
                    : "text-[var(--muted)]"
              }`}
            >
              {seasonRow.score > 0 ? "+" : ""}
              {seasonRow.score.toFixed(1)}
            </p>
          </div>
          <div className="text-left text-sm text-[var(--muted)]">
            <p>
              ממוצע למשחק:{" "}
              <b className="tabular text-[var(--text)]">
                {seasonRow.perMatch > 0 ? "+" : ""}
                {seasonRow.perMatch.toFixed(1)}
              </b>
            </p>
            <p>
              משחקים: <b className="tabular text-[var(--text)]">{seasonRow.matchesPlayed}</b>
              <span className="text-[var(--muted-2)]">
                {" "}
                · {officialOnly ? "ליגה וגביע" : "כל המשחקים"}
              </span>
            </p>
          </div>
        </div>
      </section>

      {radar.length > 0 && (
        <section className="card mb-4 p-3">
          <p className="label mb-1">פרופיל רדאר מול הקבוצה</p>
          <p className="mb-2 text-[11px] text-[var(--muted-2)]">לחצו על ציר — למשל השפעה — לפירוט</p>
          <RadarProfile
            data={radar}
            aLabel={seasonRow.label}
            onAxisSelect={setRadarAxis}
          />
        </section>
      )}

      <section className="mb-4 grid grid-cols-3 gap-2 sm:grid-cols-4">
        <MiniStat label="שערים" value={seasonRow.goals} avg={avg(seasonRow.goals)} tone="accent" />
        <MiniStat label="בישולים" value={seasonRow.assists} avg={avg(seasonRow.assists)} tone="info" />
        <MiniStat label="מס״מ" value={seasonRow.keyPasses} avg={avg(seasonRow.keyPasses)} />
        <MiniStat label="חילוצים" value={seasonRow.tackles} avg={avg(seasonRow.tackles)} />
        <MiniStat label="איבודים" value={seasonRow.lossesTotal} avg={avg(seasonRow.lossesTotal)} />
        <MiniStat
          label="איבודי הגנה"
          value={seasonRow.defLosses}
          avg={avg(seasonRow.defLosses)}
          tone="danger"
        />
        <MiniStat label="איומים רחבה" value={seasonRow.shotsInBox} avg={avg(seasonRow.shotsInBox)} />
        <MiniStat label="איומים חוץ" value={seasonRow.shotsOutBox} avg={avg(seasonRow.shotsOutBox)} />
        <DuelSeasonStat
          label="מאבקי אוויר"
          won={seasonRow.aerialWon}
          lost={seasonRow.aerialLost}
          matches={seasonRow.matchesPlayed}
        />
        <DuelSeasonStat
          label="מאבקי קרקע"
          won={seasonRow.groundWon}
          lost={seasonRow.groundLost}
          matches={seasonRow.matchesPlayed}
        />
      </section>

      <section className="card mb-4 p-3">
        <p className="label mb-2">פיזור איבודים</p>
        <div className="grid grid-cols-3 gap-2 text-center text-sm">
          <div>
            <div className="tabular text-xl font-black text-[var(--danger)]">{seasonRow.defLosses}</div>
            <div className="text-[var(--muted-2)]">הגנה</div>
          </div>
          <div>
            <div className="tabular text-xl font-black">{seasonRow.midLosses}</div>
            <div className="text-[var(--muted-2)]">אמצע</div>
          </div>
          <div>
            <div className="tabular text-xl font-black">{seasonRow.attLosses}</div>
            <div className="text-[var(--muted-2)]">התקפה</div>
          </div>
        </div>
      </section>

      {matchLines.length > 1 && (
        <section className="card mb-4 p-3">
          <p className="label mb-2">מגמה לאורך העונה — {METRIC_LABELS[trendMetric]}</p>
          <div className="mb-3 flex flex-wrap gap-1.5">
            {PLAYER_TREND_METRICS.map((m) => (
              <button
                key={m}
                onClick={() => setTrendMetric(m)}
                className={`btn h-8 px-2.5 text-xs ${trendMetric === m ? "btn-primary" : "btn-ghost"}`}
              >
                {METRIC_LABELS[m]}
              </button>
            ))}
          </div>
          <TrendChart data={trendData} series={trendSeries} />
        </section>
      )}

      <h2 className="label mb-2">משחק אחר משחק</h2>
      {matchLines.length === 0 ? (
        <div className="card p-4 text-center text-sm text-[var(--muted)]">אין משחקים</div>
      ) : (
        <ul className="flex flex-col gap-2">
          {matchLines.map((line) => (
            <li key={line.matchId}>
              <Link
                href={`/report/${line.matchId}`}
                className="card flex items-center justify-between gap-3 p-3 active:scale-[0.99]"
              >
                <div className="min-w-0">
                  <p className="truncate font-bold">מול {line.opponent}</p>
                  <p className="text-xs text-[var(--muted)]">
                    {line.matchDate
                      ? new Date(line.matchDate).toLocaleDateString("he-IL")
                      : "—"}
                    {" · "}
                    {MATCH_TYPE_LABELS[matchTypeById.get(line.matchId) ?? "league"]}
                  </p>
                  <p className="mt-1 text-[11px] text-[var(--muted-2)]">
                    {line.goals} שער · {line.assists} ביש · {line.keyPasses} מס״מ · {line.tackles}{" "}
                    חילוץ · {line.losses} איבודים · אוויר{" "}
                    <span className="text-emerald-400">{line.aerialWon}</span>/
                    <span className="text-[var(--danger)]">{line.aerialLost}</span> · קרקע{" "}
                    <span className="text-emerald-400">{line.groundWon}</span>/
                    <span className="text-[var(--danger)]">{line.groundLost}</span>
                  </p>
                </div>
                <div
                  className={`tabular text-xl font-black ${
                    line.score > 0
                      ? "text-[var(--accent)]"
                      : line.score < 0
                        ? "text-[var(--danger)]"
                        : "text-[var(--muted)]"
                  }`}
                >
                  {line.score > 0 ? "+" : ""}
                  {line.score.toFixed(1)}
                </div>
              </Link>
            </li>
          ))}
        </ul>
      )}

      {axisExplain && (
        <RadarAxisSheet
          explain={axisExplain}
          breakdown={impactBreakdown}
          onClose={() => setRadarAxis(null)}
        />
      )}
    </main>
  );
}

function DuelSeasonStat({
  label,
  won,
  lost,
  matches,
}: {
  label: string;
  won: number;
  lost: number;
  matches: number;
}) {
  const n = Math.max(matches, 1);
  return (
    <div className="card col-span-2 p-2.5 text-center sm:col-span-2">
      <div className="flex items-center justify-center gap-3 text-xl font-black tabular">
        <span className="text-emerald-400">W {won}</span>
        <span className="text-[var(--danger)]">L {lost}</span>
      </div>
      <div className="text-[10px] text-[var(--muted)]">{label}</div>
      <div className="text-[10px] text-[var(--muted-2)]">
        {(won / n).toFixed(1)}W / {(lost / n).toFixed(1)}L למש׳
      </div>
    </div>
  );
}

function MiniStat({
  label,
  value,
  avg,
  tone,
}: {
  label: string;
  value: number;
  avg: string;
  tone?: "accent" | "info" | "danger";
}) {
  const color =
    tone === "accent"
      ? "text-[var(--accent)]"
      : tone === "info"
        ? "text-[var(--info)]"
        : tone === "danger"
          ? "text-[var(--danger)]"
          : "";
  return (
    <div className="card p-2.5 text-center">
      <div className={`tabular text-xl font-black ${color}`}>{value}</div>
      <div className="text-[10px] text-[var(--muted)]">{label}</div>
      <div className="text-[10px] text-[var(--muted-2)]">{avg}/מש׳</div>
    </div>
  );
}
