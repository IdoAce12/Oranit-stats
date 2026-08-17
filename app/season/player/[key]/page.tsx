"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { loadSeasonBundle } from "@/lib/db";
import {
  computePlayerSeasonMatches,
  computeSeasonImpact,
} from "@/lib/impactScore";
import { isSupabaseConfigured } from "@/lib/supabaseClient";
import { Match, MatchEvent, Player, SquadPlayer } from "@/lib/types";
import { AppHeader } from "../../../components/AppHeader";
import { PageSkeleton } from "../../../components/Skeleton";
import { RadarProfile } from "../../../components/RadarProfile";
import { TrendChart, TrendPoint } from "../../../components/TrendChart";
import { buildRadarData, roundMetric } from "@/lib/advancedMetrics";
import { withTimeout } from "@/lib/withTimeout";
import { METRIC_COLORS, METRIC_LABELS, MetricKey } from "@/lib/trendMetrics";

const PLAYER_TREND_METRICS: MetricKey[] = [
  "score",
  "goals",
  "assists",
  "keyPasses",
  "tackles",
  "losses",
  "xg",
  "xa",
];

const LOAD_TIMEOUT_MS = 12000;

export default function SeasonPlayerPage() {
  const params = useParams<{ key: string }>();
  const playerKey = decodeURIComponent(params.key ?? "");

  const [events, setEvents] = useState<MatchEvent[]>([]);
  const [players, setPlayers] = useState<Player[]>([]);
  const [squad, setSquad] = useState<SquadPlayer[]>([]);
  const [matches, setMatches] = useState<Match[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [trendMetric, setTrendMetric] = useState<MetricKey>("score");

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

  const allRows = useMemo(
    () => computeSeasonImpact(events, players, squad),
    [events, players, squad]
  );
  const seasonRow = useMemo(
    () => allRows.find((r) => r.key === playerKey) ?? null,
    [allRows, playerKey]
  );

  const matchLines = useMemo(
    () => computePlayerSeasonMatches(playerKey, events, players, matches),
    [playerKey, events, players, matches]
  );

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
        xg: roundMetric(l.xg),
        xa: roundMetric(l.xa),
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
      <main className="mx-auto w-full max-w-2xl px-4 pt-6">
        <AppHeader title="פרופיל" backHref="/season" />
        <PageSkeleton />
      </main>
    );
  }

  if (error || !seasonRow) {
    return (
      <main className="mx-auto flex w-full max-w-md flex-1 flex-col px-4 pt-8">
        <p className="rounded-2xl border border-red-500/40 bg-red-500/10 p-4 text-red-200">
          {error ?? "שחקן לא נמצא"}
        </p>
        <Link href="/season" className="mt-4 text-center text-[var(--muted)]">
          ← חזרה לטבלה
        </Link>
      </main>
    );
  }

  const avg = (n: number) =>
    seasonRow.matchesPlayed > 0 ? (n / seasonRow.matchesPlayed).toFixed(1) : "0";

  return (
    <main className="mx-auto flex w-full max-w-2xl flex-1 flex-col px-4 pt-6 pb-10">
      <AppHeader
        title={seasonRow.label}
        subtitle="פרופיל עונתי"
        backHref="/season"
        right={
          <button type="button" onClick={() => window.print()} className="btn btn-ghost no-print h-9 px-2 text-xs">
            PDF
          </button>
        }
      />

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
            </p>
          </div>
        </div>
      </section>

      {radar.length > 0 && (
        <section className="card mb-4 p-3">
          <p className="label mb-1">פרופיל רדאר מול הקבוצה</p>
          <RadarProfile data={radar} aLabel={seasonRow.label} />
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
        <MiniStat label="xG" value={roundMetric(seasonRow.xg)} avg={avg(seasonRow.xg)} tone="info" />
        <MiniStat label="xA" value={roundMetric(seasonRow.xa)} avg={avg(seasonRow.xa)} tone="info" />
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
                  </p>
                  <p className="mt-1 text-[11px] text-[var(--muted-2)]">
                    {line.goals} שער · {line.assists} ביש · {line.keyPasses} מס״מ · {line.tackles}{" "}
                    חילוץ · {line.losses} איבודים
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
    </main>
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
