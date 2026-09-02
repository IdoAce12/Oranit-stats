"use client";

import { Suspense, useEffect, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import { RadarProfile } from "../../components/RadarProfile";
import { TrendChart, TrendPoint } from "../../components/TrendChart";
import { AppHeader } from "../../components/AppHeader";
import { PageSkeleton } from "../../components/Skeleton";
import { MatchTypeChips, RateModeToggle } from "../../components/SeasonFilters";
import { loadSeasonBundle } from "@/lib/db";
import { computeAttackingPressByKey } from "@/lib/attackingPress";
import { buildRadarData, roundMetric } from "@/lib/advancedMetrics";
import {
  computePlayerSeasonMatches,
  computeSeasonImpact,
  computeSeasonMinutesByKey,
  PlayerMatchLine,
} from "@/lib/impactScore";
import { formatMatchOption, matchIdsForTypes } from "@/lib/matchFilter";
import { findRowByPlayerKey } from "@/lib/playerKey";
import { attributeMatchEvents } from "@/lib/eventAttribution";
import { formatRate, RateMode, rateOf, scaleSeasonForRadar } from "@/lib/rates";
import { isSupabaseConfigured } from "@/lib/supabaseClient";
import { withTimeout } from "@/lib/withTimeout";
import { COMPARE_COLORS, METRIC_LABELS, MetricKey } from "@/lib/trendMetrics";
import { Match, MatchEvent, MatchType, Player, SquadPlayer, Substitution } from "@/lib/types";

const LOAD_TIMEOUT_MS = 12000;

const COMPARE_METRICS: MetricKey[] = [
  "score",
  "goals",
  "assists",
  "keyPasses",
  "tackles",
  "losses",
  "xg",
  "xa",
];

function lineMetric(l: PlayerMatchLine, m: MetricKey): number {
  switch (m) {
    case "goals":
      return l.goals;
    case "assists":
      return l.assists;
    case "keyPasses":
      return l.keyPasses;
    case "tackles":
      return l.tackles;
    case "losses":
      return l.losses;
    case "xg":
      return roundMetric(l.xg);
    case "xa":
      return roundMetric(l.xa);
    default:
      return roundMetric(l.score);
  }
}

export default function ComparePage() {
  return (
    <Suspense
      fallback={
        <main className="mx-auto w-full max-w-3xl px-4 pt-6">
          <AppHeader title="השוואת שחקנים" backHref="/" />
          <PageSkeleton />
        </main>
      }
    >
      <ComparePageInner />
    </Suspense>
  );
}

function ComparePageInner() {
  const searchParams = useSearchParams();
  const backHref = searchParams.get("from") === "home" ? "/" : "/season";

  const [events, setEvents] = useState<MatchEvent[]>([]);
  const [players, setPlayers] = useState<Player[]>([]);
  const [squad, setSquad] = useState<SquadPlayer[]>([]);
  const [matches, setMatches] = useState<Match[]>([]);
  const [subs, setSubs] = useState<Substitution[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [aKey, setAKey] = useState("");
  const [bKey, setBKey] = useState("");
  const [compareMetric, setCompareMetric] = useState<MetricKey>("score");
  const [selectedTypes, setSelectedTypes] = useState<MatchType[]>([]);
  const [matchId, setMatchId] = useState("all");
  const [rateMode, setRateMode] = useState<RateMode>("total");

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
        setSubs(bundle.substitutions);
      })
      .catch((e) => setError(e instanceof Error ? e.message : "שגיאה"))
      .finally(() => setLoading(false));
  }, []);

  const typeCounts = useMemo(() => {
    const counts: Record<MatchType, number> = { league: 0, cup: 0, friendly: 0 };
    for (const m of matches) counts[m.match_type ?? "league"] += 1;
    return counts;
  }, [matches]);

  const typeMatchIds = useMemo(
    () => matchIdsForTypes(matches, selectedTypes),
    [matches, selectedTypes]
  );

  const typeFilteredMatches = useMemo(
    () =>
      [...(typeMatchIds ? matches.filter((m) => typeMatchIds.has(m.id)) : matches)].sort((a, b) =>
        (b.match_date || "").localeCompare(a.match_date || "")
      ),
    [matches, typeMatchIds]
  );

  useEffect(() => {
    if (matchId === "all") return;
    if (!typeFilteredMatches.some((m) => m.id === matchId)) setMatchId("all");
  }, [typeFilteredMatches, matchId]);

  const allowedMatchIds = useMemo(() => {
    if (matchId !== "all") return new Set([matchId]);
    return typeMatchIds;
  }, [matchId, typeMatchIds]);

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
    () => (allowedMatchIds ? subs.filter((s) => allowedMatchIds.has(s.match_id)) : subs),
    [subs, allowedMatchIds]
  );

  const statsEvents = useMemo(
    () =>
      attributeMatchEvents(
        filteredEvents,
        filteredPlayers,
        filteredSubs,
        filteredMatches,
        squad,
        players
      ),
    [filteredEvents, filteredPlayers, filteredSubs, filteredMatches, squad, players]
  );

  const rows = useMemo(
    () => computeSeasonImpact(statsEvents, filteredPlayers, squad, players),
    [statsEvents, filteredPlayers, squad, players]
  );

  const playerOptions = useMemo(() => {
    return [...rows].sort((x, y) => {
      const an = x.shirtNumber ?? 999;
      const bn = y.shirtNumber ?? 999;
      if (an !== bn) return an - bn;
      return x.label.localeCompare(y.label, "he");
    });
  }, [rows]);

  const a = findRowByPlayerKey(rows, aKey, filteredPlayers, squad);
  const b = findRowByPlayerKey(rows, bKey, filteredPlayers, squad);

  const minutesByKey = useMemo(
    () =>
      computeSeasonMinutesByKey(
        filteredPlayers,
        filteredSubs,
        filteredMatches,
        filteredEvents,
        squad
      ),
    [filteredPlayers, filteredSubs, filteredMatches, filteredEvents, squad]
  );
  const pressByKey = useMemo(
    () =>
      computeAttackingPressByKey(
        statsEvents,
        filteredPlayers,
        filteredSubs,
        filteredMatches,
        squad
      ),
    [statsEvents, filteredPlayers, filteredSubs, filteredMatches, squad]
  );

  const aMinutes = a ? minutesByKey.get(a.key) ?? minutesByKey.get(aKey) ?? 0 : 0;
  const bMinutes = b ? minutesByKey.get(b.key) ?? minutesByKey.get(bKey) ?? 0 : 0;
  const aPress = a ? pressByKey.get(a.key) ?? pressByKey.get(aKey) : undefined;
  const bPress = b ? pressByKey.get(b.key) ?? pressByKey.get(bKey) : undefined;

  const radar = useMemo(() => {
    if (!a) return [];
    const pool = rows.map((r) =>
      scaleSeasonForRadar(r, minutesByKey.get(r.key) ?? 0, rateMode)
    );
    const aScaled = scaleSeasonForRadar(a, aMinutes, rateMode);
    const bScaled = b ? scaleSeasonForRadar(b, bMinutes, rateMode) : null;
    return buildRadarData(aScaled, pool, bScaled);
  }, [a, b, rows, minutesByKey, rateMode, aMinutes, bMinutes]);

  const aLines = useMemo(
    () =>
      aKey
        ? computePlayerSeasonMatches(aKey, statsEvents, players, filteredMatches, squad)
        : [],
    [aKey, statsEvents, players, filteredMatches, squad]
  );

  const bLines = useMemo(
    () =>
      bKey
        ? computePlayerSeasonMatches(bKey, statsEvents, players, filteredMatches, squad)
        : [],
    [bKey, statsEvents, players, filteredMatches, squad]
  );

  const compareTrend = useMemo<TrendPoint[]>(() => {
    const byMatch = new Map<string, { label: string; date: string; a?: number; b?: number }>();
    for (const l of aLines) {
      byMatch.set(l.matchId, {
        label: l.opponent.slice(0, 10),
        date: l.matchDate,
        a: lineMetric(l, compareMetric),
      });
    }
    for (const l of bLines) {
      const cur = byMatch.get(l.matchId) ?? { label: l.opponent.slice(0, 10), date: l.matchDate };
      cur.b = lineMetric(l, compareMetric);
      byMatch.set(l.matchId, cur);
    }
    return Array.from(byMatch.values())
      .sort((x, y) => (x.date || "").localeCompare(y.date || ""))
      .map((p) => ({ label: p.label, a: p.a, b: p.b }));
  }, [aLines, bLines, compareMetric]);

  const compareSeries = useMemo(
    () => [
      { key: "a" as keyof TrendPoint, label: a?.label ?? "שחקן א׳", color: COMPARE_COLORS.a },
      ...(b ? [{ key: "b" as keyof TrendPoint, label: b.label, color: COMPARE_COLORS.b }] : []),
    ],
    [a, b]
  );

  const allSeasonRows = useMemo(
    () => computeSeasonImpact(events, players, squad),
    [events, players, squad]
  );

  const selectedALabel =
    a?.label ??
    playerOptions.find((r) => r.key === aKey)?.label ??
    findRowByPlayerKey(allSeasonRows, aKey, players, squad)?.label;
  const selectedBLabel =
    b?.label ??
    playerOptions.find((r) => r.key === bKey)?.label ??
    findRowByPlayerKey(allSeasonRows, bKey, players, squad)?.label;
  const singleMatch = matchId !== "all";

  if (loading) {
    return (
      <main className="mx-auto w-full max-w-3xl px-4 pt-6">
        <AppHeader title="השוואת שחקנים" backHref={backHref} />
        <PageSkeleton />
      </main>
    );
  }

  return (
    <main className="mx-auto flex w-full max-w-3xl flex-1 flex-col px-4 pt-6 pb-10">
      <AppHeader
        title="השוואת שחקנים"
        subtitle={singleMatch ? "משחק בודד" : "Head to Head"}
        backHref={backHref}
      />
      {error && <p className="mb-3 text-[var(--danger)]">{error}</p>}

      <MatchTypeChips
        selected={selectedTypes}
        onChange={setSelectedTypes}
        typeCounts={typeCounts}
        total={matches.length}
      />

      <label className="mb-3 flex flex-col gap-1">
        <span className="label">משחק</span>
        <select value={matchId} onChange={(e) => setMatchId(e.target.value)} className="field w-full">
          <option value="all">כל המשחקים במסנן ({typeFilteredMatches.length})</option>
          {typeFilteredMatches.map((m) => (
            <option key={m.id} value={m.id}>
              {formatMatchOption(m)}
            </option>
          ))}
        </select>
      </label>

      <RateModeToggle mode={rateMode} onChange={setRateMode} />

      <div className="mb-4 grid grid-cols-1 gap-2 sm:grid-cols-2">
        <label className="flex flex-col gap-1">
          <span className="label">שחקן א׳</span>
          <select value={aKey} onChange={(e) => setAKey(e.target.value)} className="field w-full">
            <option value="">בחר שחקן</option>
            {aKey && !playerOptions.some((r) => r.key === aKey) && (
              <option value={aKey}>{selectedALabel ?? aKey}</option>
            )}
            {playerOptions.map((r) => (
              <option key={r.key} value={r.key}>
                {r.label}
                {singleMatch ? ` · ${minutesByKey.get(r.key) ?? 0}׳` : ""}
              </option>
            ))}
          </select>
        </label>
        <label className="flex flex-col gap-1">
          <span className="label">שחקן ב׳</span>
          <select value={bKey} onChange={(e) => setBKey(e.target.value)} className="field w-full">
            <option value="">בחר שחקן</option>
            {bKey && !playerOptions.some((r) => r.key === bKey) && (
              <option value={bKey}>{selectedBLabel ?? bKey}</option>
            )}
            {playerOptions.map((r) => (
              <option key={r.key} value={r.key} disabled={r.key === aKey}>
                {r.label}
                {singleMatch ? ` · ${minutesByKey.get(r.key) ?? 0}׳` : ""}
              </option>
            ))}
          </select>
        </label>
      </div>

      {!aKey && (
        <div className="card p-6 text-center text-sm text-[var(--muted)]">
          בחר שני שחקנים מהסגל כדי להשוות רדאר, xG ומגמה. אפשר לצמצם לליגה/גביע/אימון או למשחק בודד.
        </div>
      )}

      {aKey && !a && (
        <div className="card p-6 text-center text-sm text-[var(--muted)]">
          {selectedALabel ?? "השחקן"} לא שותף במסנן שנבחר.
        </div>
      )}

      {a && (
        <>
          {bKey && !b && (
            <p className="mb-3 text-sm text-[var(--muted)]">
              {selectedBLabel ?? "שחקן ב׳"} לא שותף במסנן שנבחר — מוצג רק שחקן א׳.
            </p>
          )}
          <section className="card mb-4 p-3">
            <p className="label mb-1">
              פרופיל רדאר ({rateMode === "per90" ? "אחוזון לפי קצב ל־90׳" : "אחוזון מול הקבוצה"})
            </p>
            <RadarProfile data={radar} aLabel={a.label} bLabel={b?.label} />
          </section>

          <div className="mb-4 overflow-x-auto">
            <table className="w-full border-collapse text-center text-sm">
              <thead>
                <tr className="text-[11px] text-[var(--muted)]">
                  <th className="px-2 py-2 text-right">
                    מדד{rateMode === "per90" ? " · ל־90׳" : ""}
                  </th>
                  <th className="px-2 py-2">{a.label}</th>
                  <th className="px-2 py-2">{b?.label ?? "—"}</th>
                </tr>
              </thead>
              <tbody>
                {(
                  [
                    ["משחקים", String(a.matchesPlayed), b ? String(b.matchesPlayed) : null],
                    ["דקות", `${aMinutes}׳`, b ? `${bMinutes}׳` : null],
                    ["שערים", formatRate(a.goals, aMinutes, rateMode), b ? formatRate(b.goals, bMinutes, rateMode) : null],
                    ["בישולים", formatRate(a.assists, aMinutes, rateMode), b ? formatRate(b.assists, bMinutes, rateMode) : null],
                    ["מס״מ", formatRate(a.keyPasses, aMinutes, rateMode), b ? formatRate(b.keyPasses, bMinutes, rateMode) : null],
                    ["חילוצים", formatRate(a.tackles, aMinutes, rateMode), b ? formatRate(b.tackles, bMinutes, rateMode) : null],
                    [
                      "לחץ התקפי",
                      formatRate(aPress?.press ?? 0, aMinutes, rateMode),
                      b ? formatRate(bPress?.press ?? 0, bMinutes, rateMode) : null,
                    ],
                    [
                      "חילוץ התק׳",
                      formatRate(aPress?.attTackles ?? 0, aMinutes, rateMode),
                      b ? formatRate(bPress?.attTackles ?? 0, bMinutes, rateMode) : null,
                    ],
                    ["איבודים", formatRate(a.lossesTotal, aMinutes, rateMode), b ? formatRate(b.lossesTotal, bMinutes, rateMode) : null],
                    ["xG", formatRate(a.xg, aMinutes, rateMode, 2), b ? formatRate(b.xg, bMinutes, rateMode, 2) : null],
                    ["xA", formatRate(a.xa, aMinutes, rateMode, 2), b ? formatRate(b.xa, bMinutes, rateMode, 2) : null],
                    [
                      "Impact",
                      rateOf(a.score, aMinutes, rateMode).toFixed(1),
                      b ? rateOf(b.score, bMinutes, rateMode).toFixed(1) : null,
                    ],
                  ] as [string, string, string | null][]
                ).map(([label, av, bv]) => (
                  <tr key={label} className="border-t border-[var(--border)]">
                    <td className="px-2 py-2 text-right font-bold">{label}</td>
                    <td className="tabular px-2 py-2 text-[var(--accent)]">{av}</td>
                    <td className="tabular px-2 py-2 text-[var(--info)]">{bv ?? "—"}</td>
                  </tr>
                ))}
                <tr className="border-t border-[var(--border)]">
                  <td className="px-2 py-2 text-right font-bold">מאבקי אוויר</td>
                  <td className="px-2 py-2">
                    <DuelWl
                      won={rateOf(a.aerialWon, aMinutes, rateMode)}
                      lost={rateOf(a.aerialLost, aMinutes, rateMode)}
                    />
                  </td>
                  <td className="px-2 py-2">
                    {b ? (
                      <DuelWl
                        won={rateOf(b.aerialWon, bMinutes, rateMode)}
                        lost={rateOf(b.aerialLost, bMinutes, rateMode)}
                      />
                    ) : (
                      "—"
                    )}
                  </td>
                </tr>
                <tr className="border-t border-[var(--border)]">
                  <td className="px-2 py-2 text-right font-bold">מאבקי קרקע</td>
                  <td className="px-2 py-2">
                    <DuelWl
                      won={rateOf(a.groundWon, aMinutes, rateMode)}
                      lost={rateOf(a.groundLost, aMinutes, rateMode)}
                    />
                  </td>
                  <td className="px-2 py-2">
                    {b ? (
                      <DuelWl
                        won={rateOf(b.groundWon, bMinutes, rateMode)}
                        lost={rateOf(b.groundLost, bMinutes, rateMode)}
                      />
                    ) : (
                      "—"
                    )}
                  </td>
                </tr>
              </tbody>
            </table>
            <p className="mt-2 px-1 text-[11px] text-[var(--muted-2)]">
              לחץ התקפי: חילוצי הקבוצה בשליש ההתקפי בזמן ששיחק כשחקן התקפה. חילוץ התק׳: החילוצים האישיים שלו שם.
            </p>
          </div>

          {!singleMatch && compareTrend.length > 0 && (
            <section className="card p-3">
              <p className="label mb-2">מגמת השוואה — {METRIC_LABELS[compareMetric]}</p>
              <div className="mb-3 flex flex-wrap gap-1.5">
                {COMPARE_METRICS.map((m) => (
                  <button
                    key={m}
                    onClick={() => setCompareMetric(m)}
                    className={`btn h-8 px-2.5 text-xs ${compareMetric === m ? "btn-primary" : "btn-ghost"}`}
                  >
                    {METRIC_LABELS[m]}
                  </button>
                ))}
              </div>
              <TrendChart data={compareTrend} series={compareSeries} />
            </section>
          )}
        </>
      )}
    </main>
  );
}

function DuelWl({ won, lost }: { won: number; lost: number }) {
  const w = Number.isInteger(won) ? String(won) : won.toFixed(1);
  const l = Number.isInteger(lost) ? String(lost) : lost.toFixed(1);
  return (
    <span className="tabular font-black">
      <span className="text-emerald-400">W {w}</span>
      <span className="mx-1 text-[var(--muted-2)]">/</span>
      <span className="text-[var(--danger)]">L {l}</span>
    </span>
  );
}
