"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { loadSeasonBundle } from "@/lib/db";
import { downloadCsv, seasonTableCsv } from "@/lib/exportCsv";
import { computeSeasonImpact, SeasonImpact } from "@/lib/impactScore";
import { computeTeamSeasonTrend, roundMetric } from "@/lib/advancedMetrics";
import { withTimeout } from "@/lib/withTimeout";
import { isSupabaseConfigured } from "@/lib/supabaseClient";
import {
  MATCH_TYPE_LABELS,
  MATCH_TYPE_ORDER,
  Match,
  MatchEvent,
  MatchType,
  Player,
  SquadPlayer,
} from "@/lib/types";
import { AppHeader } from "../components/AppHeader";
import { ConfigBanner } from "../components/ConfigBanner";
import { PageSkeleton } from "../components/Skeleton";
import { TrendChart, TrendPoint } from "../components/TrendChart";
import { METRIC_COLORS, METRIC_LABELS } from "@/lib/trendMetrics";

type SortKey =
  | "score"
  | "perMatch"
  | "goals"
  | "assists"
  | "keyPasses"
  | "tackles"
  | "lossesTotal"
  | "xg"
  | "xa"
  | "matchesPlayed";

/** מדד יחיד ששולט גם במיון הרשימה וגם בגרף המגמה. */
const SORT_META: Record<SortKey, { label: string; color: string; trendKey: keyof TrendPoint }> = {
  score: { label: METRIC_LABELS.score, color: METRIC_COLORS.score, trendKey: "score" },
  perMatch: { label: METRIC_LABELS.perMatch, color: METRIC_COLORS.perMatch, trendKey: "score" },
  goals: { label: METRIC_LABELS.goals, color: METRIC_COLORS.goals, trendKey: "goals" },
  assists: { label: METRIC_LABELS.assists, color: METRIC_COLORS.assists, trendKey: "assists" },
  keyPasses: { label: "מס״מ", color: METRIC_COLORS.keyPasses, trendKey: "keyPasses" },
  tackles: { label: METRIC_LABELS.tackles, color: METRIC_COLORS.tackles, trendKey: "tackles" },
  lossesTotal: { label: METRIC_LABELS.losses, color: METRIC_COLORS.losses, trendKey: "losses" },
  xg: { label: METRIC_LABELS.xg, color: METRIC_COLORS.xg, trendKey: "xg" },
  xa: { label: METRIC_LABELS.xa, color: METRIC_COLORS.xa, trendKey: "xa" },
  matchesPlayed: { label: METRIC_LABELS.matchesPlayed, color: METRIC_COLORS.matchesPlayed, trendKey: "matchesPlayed" },
};

const METRIC_ORDER: SortKey[] = [
  "score",
  "perMatch",
  "goals",
  "assists",
  "keyPasses",
  "tackles",
  "lossesTotal",
  "xg",
  "xa",
  "matchesPlayed",
];

const LOAD_TIMEOUT_MS = 12000;

function sortValue(r: SeasonImpact, key: SortKey): number {
  return r[key];
}

export default function SeasonPage() {
  const [events, setEvents] = useState<MatchEvent[]>([]);
  const [players, setPlayers] = useState<Player[]>([]);
  const [squad, setSquad] = useState<SquadPlayer[]>([]);
  const [matches, setMatches] = useState<Match[]>([]);
  const [matchesCount, setMatchesCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [sortKey, setSortKey] = useState<SortKey>("score");
  const [sortDir, setSortDir] = useState<"desc" | "asc">("desc");
  const [view, setView] = useState<"cards" | "table">("cards");
  const [query, setQuery] = useState("");
  const [typeFilter, setTypeFilter] = useState<MatchType | "all">("all");

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
        setMatches(bundle.matches);
        setMatchesCount(bundle.matchesCount);
      })
      .catch((e) => setError(e instanceof Error ? e.message : "שגיאה בטעינה"))
      .finally(() => setLoading(false));
  };

  useEffect(load, []);

  // סינון לפי סוג משחק — מצמצמים אירועים/שחקנים/משחקים למשחקים מהסוג שנבחר
  const allowedMatchIds = useMemo(() => {
    if (typeFilter === "all") return null;
    return new Set(
      matches.filter((m) => (m.match_type ?? "league") === typeFilter).map((m) => m.id)
    );
  }, [matches, typeFilter]);

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

  const typeCounts = useMemo(() => {
    const counts: Record<MatchType, number> = { league: 0, cup: 0, friendly: 0 };
    for (const m of matches) counts[m.match_type ?? "league"] += 1;
    return counts;
  }, [matches]);

  const rows = useMemo(() => {
    const base = computeSeasonImpact(filteredEvents, filteredPlayers, squad);
    const withActivity = base.filter(
      (r) =>
        r.score !== 0 ||
        r.goals + r.assists + r.keyPasses + r.tackles + r.lossesTotal + r.shotsInBox > 0
    );
    const list = withActivity.length > 0 ? withActivity : base;
    const q = query.trim().toLowerCase();
    const filtered = q
      ? list.filter(
          (r) =>
            r.label.toLowerCase().includes(q) || String(r.shirtNumber ?? "").includes(q)
        )
      : list;
    return [...filtered].sort((a, b) => {
      const av = sortValue(a, sortKey);
      const bv = sortValue(b, sortKey);
      if (av === bv) return a.label.localeCompare(b.label, "he");
      const cmp = av - bv;
      return sortDir === "desc" ? -cmp : cmp;
    });
  }, [filteredEvents, filteredPlayers, squad, sortKey, sortDir, query]);

  const teamTrend = useMemo<TrendPoint[]>(
    () =>
      computeTeamSeasonTrend(filteredEvents, filteredMatches).map((m) => ({
        label: m.opponent.slice(0, 10),
        score: m.score,
        goals: m.goals,
        assists: m.assists,
        keyPasses: m.keyPasses,
        tackles: m.tackles,
        losses: m.losses,
        xg: m.xg,
        xa: m.xa,
        matchesPlayed: m.matchesPlayed,
      })),
    [filteredEvents, filteredMatches]
  );

  const trendSeries = useMemo(() => {
    const meta = SORT_META[sortKey];
    return [{ key: meta.trendKey, label: meta.label, color: meta.color }];
  }, [sortKey]);

  const toggleSort = (key: SortKey) => {
    if (sortKey === key) setSortDir((d) => (d === "desc" ? "asc" : "desc"));
    else {
      setSortKey(key);
      setSortDir("desc");
    }
  };

  const maxAbs = useMemo(
    () => Math.max(1, ...rows.map((r) => Math.abs(sortValue(r, sortKey)))),
    [rows, sortKey]
  );

  const exportSeason = () => {
    downloadCsv("scout_season.csv", seasonTableCsv(rows));
  };

  return (
    <main className="mx-auto flex w-full max-w-3xl flex-1 flex-col px-4 pt-6 pb-10">
      <AppHeader
        title="טבלה עונתית"
        subtitle={
          loading
            ? "טוען..."
            : `${filteredMatches.length}${
                typeFilter === "all" ? "" : `/${matchesCount}`
              } משחקים · ${rows.length} שחקנים`
        }
        backHref="/"
      />

      <ConfigBanner />

      <div className="mb-3 flex gap-2">
        <button
          onClick={() => setView("cards")}
          className={`btn h-9 flex-1 text-sm ${view === "cards" ? "btn-primary" : "btn-ghost"}`}
        >
          כרטיסים
        </button>
        <button
          onClick={() => setView("table")}
          className={`btn h-9 flex-1 text-sm ${view === "table" ? "btn-primary" : "btn-ghost"}`}
        >
          טבלה מלאה
        </button>
        <button onClick={exportSeason} disabled={rows.length === 0} className="btn btn-ghost h-9 px-3 text-sm">
          ⬇
        </button>
        <Link href="/season/compare" className="btn btn-ghost h-9 px-3 text-sm">
          H2H
        </Link>
      </div>

      <input
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        placeholder="חיפוש שחקן / מספר..."
        className="field mb-3 w-full"
      />

      <p className="mb-1.5 text-[11px] text-[var(--muted-2)]">סינון לפי סוג משחק</p>
      <div className="mb-3 flex flex-wrap gap-1.5">
        <button
          onClick={() => setTypeFilter("all")}
          className={`btn h-8 px-3 text-xs ${typeFilter === "all" ? "btn-primary" : "btn-ghost"}`}
        >
          הכל ({matchesCount})
        </button>
        {MATCH_TYPE_ORDER.map((t) => (
          <button
            key={t}
            onClick={() => setTypeFilter(t)}
            className={`btn h-8 px-3 text-xs ${typeFilter === t ? "btn-primary" : "btn-ghost"}`}
          >
            {MATCH_TYPE_LABELS[t]} ({typeCounts[t]})
          </button>
        ))}
      </div>

      <p className="mb-1.5 text-[11px] text-[var(--muted-2)]">
        בחר מדד — משפיע גם על המגמה למעלה וגם על מיון השחקנים למטה
      </p>
      <div className="mb-3 flex flex-wrap gap-1.5">
        {METRIC_ORDER.map((k) => (
          <button
            key={k}
            onClick={() => toggleSort(k)}
            className={`btn h-8 px-2.5 text-xs ${sortKey === k ? "btn-primary" : "btn-ghost"}`}
          >
            {SORT_META[k].label}
            {sortKey === k ? (sortDir === "desc" ? " ↓" : " ↑") : ""}
          </button>
        ))}
      </div>

      {loading && <PageSkeleton rows={8} />}

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
            : typeFilter !== "all" && filteredMatches.length === 0
              ? `אין עדיין משחקים מסוג ${MATCH_TYPE_LABELS[typeFilter]}.`
              : filteredEvents.length === 0
                ? "יש משחקים, אבל עדיין בלי אירועים עם שחקן — רשום פעולות בלייב."
                : "עדיין אין נתונים עונתיים להצגה."}
        </div>
      )}

      {!loading && rows.length > 0 && teamTrend.length > 1 && (
        <section className="card mb-4 p-3">
          <p className="label mb-2">מגמת קבוצה לאורך העונה — {SORT_META[sortKey].label}</p>
          <TrendChart data={teamTrend} series={trendSeries} />
        </section>
      )}

      {!loading && rows.length > 0 && view === "cards" && (
        <div className="card divide-y divide-[var(--border)] overflow-hidden">
          {rows.map((row, i) => {
            const value = sortValue(row, sortKey);
            return (
              <Link
                key={row.key}
                href={`/season/player/${encodeURIComponent(row.key)}`}
                className="flex items-center gap-3 p-3 active:bg-white/[0.03]"
              >
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
                    {row.matchesPlayed} מש׳ · {row.goals} שער · {row.assists} ביש · {row.keyPasses}{" "}
                    מס״מ · {row.tackles} חילוץ · {row.lossesTotal} איבודים · xG{" "}
                    {roundMetric(row.xg)}
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
                    {typeof value === "number" && (sortKey === "score" || sortKey === "perMatch")
                      ? `${value > 0 ? "+" : ""}${value.toFixed(1)}`
                      : value}
                  </div>
                  <div className="text-[10px] text-[var(--muted-2)]">פרופיל ←</div>
                </div>
              </Link>
            );
          })}
        </div>
      )}

      {!loading && rows.length > 0 && view === "table" && (
        <div className="card overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full border-collapse text-center text-xs">
              <thead>
                <tr className="border-b border-[var(--border)] bg-[var(--panel-strong)] text-[10px] text-[var(--muted)]">
                  <th className="sticky right-0 bg-[var(--panel-strong)] px-2 py-2 text-right">#</th>
                  <th className="sticky right-8 bg-[var(--panel-strong)] px-2 py-2 text-right">שחקן</th>
                  {(
                    [
                      ["matchesPlayed", "מש׳"],
                      ["goals", "שער"],
                      ["assists", "ביש"],
                      ["keyPasses", "מס״מ"],
                      ["tackles", "חילוץ"],
                      ["lossesTotal", "איבודים"],
                      ["xg", "xG"],
                      ["xa", "xA"],
                      ["score", "ציון"],
                      ["perMatch", "ממ׳"],
                    ] as [SortKey, string][]
                  ).map(([k, label]) => (
                    <th key={k} className="px-1.5 py-2">
                      <button type="button" onClick={() => toggleSort(k)} className="font-bold">
                        {label}
                        {sortKey === k ? (sortDir === "desc" ? " ↓" : " ↑") : ""}
                      </button>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {rows.map((row, i) => (
                  <tr key={row.key} className="border-b border-[var(--border)]/50 odd:bg-white/[0.02]">
                    <td className="sticky right-0 bg-[var(--bg)] px-2 py-2 tabular text-[var(--muted)]">
                      {i + 1}
                    </td>
                    <td className="sticky right-8 bg-[var(--bg)] px-2 py-2 text-right">
                      <Link
                        href={`/season/player/${encodeURIComponent(row.key)}`}
                        className="font-bold underline decoration-[var(--border-strong)] underline-offset-2"
                      >
                        {row.label}
                      </Link>
                    </td>
                    <td className="tabular px-1.5 py-2">{row.matchesPlayed}</td>
                    <td className="tabular px-1.5 py-2 font-bold text-[var(--accent)]">{row.goals}</td>
                    <td className="tabular px-1.5 py-2 text-[var(--info)]">{row.assists}</td>
                    <td className="tabular px-1.5 py-2">{row.keyPasses}</td>
                    <td className="tabular px-1.5 py-2">{row.tackles}</td>
                    <td className="tabular px-1.5 py-2 text-[var(--danger)]">{row.lossesTotal}</td>
                    <td className="tabular px-1.5 py-2">{roundMetric(row.xg)}</td>
                    <td className="tabular px-1.5 py-2">{roundMetric(row.xa)}</td>
                    <td
                      className={`tabular px-1.5 py-2 font-black ${
                        row.score > 0
                          ? "text-[var(--accent)]"
                          : row.score < 0
                            ? "text-[var(--danger)]"
                            : ""
                      }`}
                    >
                      {row.score > 0 ? "+" : ""}
                      {row.score.toFixed(1)}
                    </td>
                    <td className="tabular px-1.5 py-2 text-[var(--muted)]">{row.perMatch.toFixed(1)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </main>
  );
}
