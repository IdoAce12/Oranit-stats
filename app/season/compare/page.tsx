"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { RadarProfile } from "../../components/RadarProfile";
import { TrendChart } from "../../components/TrendChart";
import { AppHeader } from "../../components/AppHeader";
import { PageSkeleton } from "../../components/Skeleton";
import { loadSeasonBundle } from "@/lib/db";
import { buildRadarData, roundMetric } from "@/lib/advancedMetrics";
import {
  computePlayerSeasonMatches,
  computeSeasonImpact,
  computeSeasonMinutesByKey,
} from "@/lib/impactScore";
import { isSupabaseConfigured } from "@/lib/supabaseClient";
import { Match, MatchEvent, Player, SquadPlayer, Substitution } from "@/lib/types";

const LOAD_TIMEOUT_MS = 12000;

function withTimeout<T>(promise: Promise<T>, ms: number): Promise<T> {
  return new Promise((resolve, reject) => {
    const t = setTimeout(() => reject(new Error("הטעינה ארכה יותר מדי. נסה שוב.")), ms);
    promise.then(
      (v) => {
        clearTimeout(t);
        resolve(v);
      },
      (e) => {
        clearTimeout(t);
        reject(e);
      }
    );
  });
}

export default function ComparePage() {
  const [events, setEvents] = useState<MatchEvent[]>([]);
  const [players, setPlayers] = useState<Player[]>([]);
  const [squad, setSquad] = useState<SquadPlayer[]>([]);
  const [matches, setMatches] = useState<Match[]>([]);
  const [subs, setSubs] = useState<Substitution[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [aKey, setAKey] = useState("");
  const [bKey, setBKey] = useState("");

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

  const rows = useMemo(() => computeSeasonImpact(events, players, squad), [events, players, squad]);
  const a = rows.find((r) => r.key === aKey) ?? null;
  const b = rows.find((r) => r.key === bKey) ?? null;
  const radar = useMemo(
    () => (a ? buildRadarData(a, rows, b) : []),
    [a, b, rows]
  );

  const aLines = useMemo(
    () => (a ? computePlayerSeasonMatches(a.key, events, players, matches) : []),
    [a, events, players, matches]
  );

  const minutesByKey = useMemo(
    () => computeSeasonMinutesByKey(players, subs, matches, events),
    [players, subs, matches, events]
  );
  const aMinutes = a ? minutesByKey.get(a.key) ?? 0 : 0;
  const bMinutes = b ? minutesByKey.get(b.key) ?? 0 : 0;

  if (loading) {
    return (
      <main className="mx-auto w-full max-w-3xl px-4 pt-6">
        <AppHeader title="השוואת שחקנים" backHref="/season" />
        <PageSkeleton />
      </main>
    );
  }

  return (
    <main className="mx-auto flex w-full max-w-3xl flex-1 flex-col px-4 pt-6 pb-10">
      <AppHeader title="השוואת שחקנים" subtitle="Head to Head" backHref="/season" />
      {error && <p className="mb-3 text-[var(--danger)]">{error}</p>}

      <div className="mb-4 grid grid-cols-1 gap-2 sm:grid-cols-2">
        <label className="flex flex-col gap-1">
          <span className="label">שחקן א׳</span>
          <select value={aKey} onChange={(e) => setAKey(e.target.value)} className="field w-full">
            <option value="">בחר שחקן</option>
            {rows.map((r) => (
              <option key={r.key} value={r.key}>
                {r.label}
              </option>
            ))}
          </select>
        </label>
        <label className="flex flex-col gap-1">
          <span className="label">שחקן ב׳</span>
          <select value={bKey} onChange={(e) => setBKey(e.target.value)} className="field w-full">
            <option value="">בחר שחקן</option>
            {rows.map((r) => (
              <option key={r.key} value={r.key} disabled={r.key === aKey}>
                {r.label}
              </option>
            ))}
          </select>
        </label>
      </div>

      {!a && (
        <div className="card p-6 text-center text-sm text-[var(--muted)]">
          בחר שני שחקנים מהסגל כדי להשוות רדאר, xG ומגמה.
        </div>
      )}

      {a && (
        <>
          <section className="card mb-4 p-3">
            <p className="label mb-1">פרופיל רדאר (אחוזון מול הקבוצה)</p>
            <RadarProfile data={radar} aLabel={a.label} bLabel={b?.label} />
          </section>

          <div className="mb-4 overflow-x-auto">
            <table className="w-full border-collapse text-center text-sm">
              <thead>
                <tr className="text-[11px] text-[var(--muted)]">
                  <th className="px-2 py-2 text-right">מדד</th>
                  <th className="px-2 py-2">{a.label}</th>
                  <th className="px-2 py-2">{b?.label ?? "—"}</th>
                </tr>
              </thead>
              <tbody>
                {(
                  [
                    ["משחקים", a.matchesPlayed, b?.matchesPlayed],
                    ["דקות (עונה)", `${aMinutes}׳`, b ? `${bMinutes}׳` : null],
                    ["שערים", a.goals, b?.goals],
                    ["בישולים", a.assists, b?.assists],
                    ["מס״מ", a.keyPasses, b?.keyPasses],
                    ["חילוצים", a.tackles, b?.tackles],
                    ["איבודים", a.lossesTotal, b?.lossesTotal],
                    ["xG", roundMetric(a.xg), b ? roundMetric(b.xg) : null],
                    ["xA", roundMetric(a.xa), b ? roundMetric(b.xa) : null],
                    ["Impact", a.score.toFixed(1), b?.score.toFixed(1)],
                  ] as [string, string | number, string | number | null | undefined][]
                ).map(([label, av, bv]) => (
                  <tr key={label} className="border-t border-[var(--border)]">
                    <td className="px-2 py-2 text-right font-bold">{label}</td>
                    <td className="tabular px-2 py-2 text-[var(--accent)]">{av}</td>
                    <td className="tabular px-2 py-2 text-[var(--info)]">{bv ?? "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {aLines.length > 0 && (
            <section className="card p-3">
              <p className="label mb-1">מגמת Impact — {a.label}</p>
              <TrendChart
                data={[...aLines].reverse().map((l) => ({
                  label: l.opponent.slice(0, 8),
                  score: l.score,
                  xg: roundMetric(l.xg),
                }))}
              />
            </section>
          )}
        </>
      )}
    </main>
  );
}
