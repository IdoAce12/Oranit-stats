"use client";

import { useEffect, useMemo, useState } from "react";
import { loadSeasonBundle } from "@/lib/db";
import { computeSeasonImpact } from "@/lib/impactScore";
import { isSupabaseConfigured } from "@/lib/supabaseClient";
import { MatchEvent, Player, SquadPlayer } from "@/lib/types";
import { AppHeader } from "../components/AppHeader";
import { ConfigBanner } from "../components/ConfigBanner";

type SortKey = "score" | "perMatch";

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

export default function SeasonPage() {
  const [events, setEvents] = useState<MatchEvent[]>([]);
  const [players, setPlayers] = useState<Player[]>([]);
  const [squad, setSquad] = useState<SquadPlayer[]>([]);
  const [matchesCount, setMatchesCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [sortKey, setSortKey] = useState<SortKey>("score");

  const load = () => {
    if (!isSupabaseConfigured) {
      setLoading(false);
      return;
    }
    setLoading(true);
    setError(null);
    withTimeout(loadSeasonBundle(), LOAD_TIMEOUT_MS)
      .then((bundle) => {
        setEvents(bundle.events);
        setPlayers(bundle.players);
        setSquad(bundle.squad);
        setMatchesCount(bundle.matchesCount);
      })
      .catch((e) => setError(e instanceof Error ? e.message : "שגיאה בטעינה"))
      .finally(() => setLoading(false));
  };

  useEffect(load, []);

  const rows = useMemo(() => {
    const base = computeSeasonImpact(events, players, squad);
    // מציגים רק שחקנים עם לפחות אירוע אחד או ציון ≠ 0
    const withActivity = base.filter(
      (r) => r.score !== 0 || r.keyPasses + r.tackles + r.defLosses + r.shotsInBox > 0
    );
    const list = withActivity.length > 0 ? withActivity : base;
    if (sortKey === "perMatch") {
      return [...list].sort((a, b) => b.perMatch - a.perMatch);
    }
    return list;
  }, [events, players, squad, sortKey]);

  const maxAbs = useMemo(
    () => Math.max(1, ...rows.map((r) => Math.abs(sortKey === "perMatch" ? r.perMatch : r.score))),
    [rows, sortKey]
  );

  return (
    <main className="mx-auto flex w-full max-w-2xl flex-1 flex-col px-4 pt-6 pb-10">
      <AppHeader
        title="טבלה עונתית"
        subtitle={loading ? "טוען..." : `${matchesCount} משחקים · ${rows.length} שחקנים`}
        backHref="/"
      />

      <ConfigBanner />

      <div className="mb-3 flex gap-2">
        <button
          onClick={() => setSortKey("score")}
          className={`btn h-9 flex-1 text-sm ${sortKey === "score" ? "btn-primary" : "btn-ghost"}`}
        >
          ציון מצטבר
        </button>
        <button
          onClick={() => setSortKey("perMatch")}
          className={`btn h-9 flex-1 text-sm ${sortKey === "perMatch" ? "btn-primary" : "btn-ghost"}`}
        >
          ממוצע למשחק
        </button>
      </div>

      {loading && (
        <div className="card flex flex-col items-center gap-3 p-8 text-sm text-[var(--muted)]">
          <div className="h-8 w-8 animate-spin rounded-full border-2 border-[var(--border-strong)] border-t-[var(--accent)]" />
          טוען נתונים עונתיים...
        </div>
      )}

      {error && (
        <div className="card border border-red-500/30 p-4 text-sm text-red-200">
          <p>{error}</p>
          <button onClick={load} className="btn btn-ghost mt-3 w-full py-2.5 text-sm">
            נסה שוב
          </button>
        </div>
      )}

      {!loading && !error && rows.length === 0 && (
        <div className="card p-6 text-center text-sm text-[var(--muted)]">
          {matchesCount === 0
            ? "עדיין אין משחקים. צור משחק חדש ואסוף אירועים."
            : events.length === 0
              ? "יש משחקים, אבל עדיין בלי אירועים עם שחקן — רשום פעולות בלייב."
              : "עדיין אין נתונים עונתיים להצגה."}
        </div>
      )}

      {!loading && rows.length > 0 && (
        <div className="card divide-y divide-[var(--border)] overflow-hidden">
          {rows.map((row, i) => {
            const value = sortKey === "perMatch" ? row.perMatch : row.score;
            return (
              <div key={row.key} className="flex items-center gap-3 p-3">
                <span
                  className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-lg text-xs font-black ${
                    i === 0
                      ? "bg-amber-400 text-[#241a00]"
                      : i === 1
                        ? "bg-slate-300 text-slate-900"
                        : i === 2
                          ? "bg-orange-700 text-orange-100"
                          : "bg-[var(--panel-strong)] text-[var(--muted)]"
                  }`}
                >
                  {i + 1}
                </span>
                <div className="min-w-0 flex-1">
                  <p className="truncate font-bold">{row.label}</p>
                  <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-[var(--panel-strong)]">
                    <div
                      className={`h-full rounded-full ${value >= 0 ? "bg-[var(--accent)]" : "bg-[var(--danger)]"}`}
                      style={{ width: `${(Math.abs(value) / maxAbs) * 100}%` }}
                    />
                  </div>
                  <p className="mt-1 text-[11px] text-[var(--muted-2)]">
                    {row.matchesPlayed} משחקים · {row.keyPasses} מס״מ · {row.tackles} חילוצים ·{" "}
                    {row.defLosses} איבודי הגנה
                  </p>
                </div>
                <div className="text-left">
                  <div
                    className={`tabular text-xl font-black ${
                      value > 0
                        ? "text-[var(--accent)]"
                        : value < 0
                          ? "text-[var(--danger)]"
                          : "text-[var(--muted)]"
                    }`}
                  >
                    {value > 0 ? "+" : ""}
                    {value.toFixed(1)}
                  </div>
                  <div className="text-[10px] text-[var(--muted-2)]">
                    {sortKey === "perMatch" ? "למשחק" : "מצטבר"}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </main>
  );
}
