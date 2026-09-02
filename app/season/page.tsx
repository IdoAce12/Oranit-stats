"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { loadSeasonBundle } from "@/lib/db";
import { downloadCsv, seasonTableCsv } from "@/lib/exportCsv";
import { downloadTableauSeasonWorkbook } from "@/lib/tableauExport";
import { computeSeasonImpact, computeSeasonMinutesByKey, SeasonImpact } from "@/lib/impactScore";
import { computeAttackingPressByKey } from "@/lib/attackingPress";
import { computeTeamSeasonTrend, roundMetric } from "@/lib/advancedMetrics";
import { matchIdsForTypes } from "@/lib/matchFilter";
import { attributeMatchEvents } from "@/lib/eventAttribution";
import { formatRate, RateMode, rateOf } from "@/lib/rates";
import { withTimeout } from "@/lib/withTimeout";
import { isSupabaseConfigured } from "@/lib/supabaseClient";
import {
  Match,
  MatchEvent,
  MatchType,
  Player,
  SquadPlayer,
  Substitution,
} from "@/lib/types";
import { AppHeader } from "../components/AppHeader";
import { ConfigBanner } from "../components/ConfigBanner";
import { PageSkeleton } from "../components/Skeleton";
import { MatchTypeChips, RateModeToggle } from "../components/SeasonFilters";
import { TrendChart, TrendPoint } from "../components/TrendChart";
import { METRIC_COLORS, METRIC_LABELS } from "@/lib/trendMetrics";

type SortKey =
  | "score"
  | "perMatch"
  | "goals"
  | "assists"
  | "keyPasses"
  | "tackles"
  | "press"
  | "lossesTotal"
  | "aerialWon"
  | "groundWon"
  | "xg"
  | "xa"
  | "minutes"
  | "matchesPlayed";

type SeasonRow = SeasonImpact & {
  minutes: number;
  press: number;
  attTackles: number;
};

/** מדד יחיד ששולט גם במיון הרשימה וגם בגרף המגמה. */
const SORT_META: Record<SortKey, { label: string; color: string; trendKey: keyof TrendPoint }> = {
  score: { label: METRIC_LABELS.score, color: METRIC_COLORS.score, trendKey: "score" },
  perMatch: { label: METRIC_LABELS.perMatch, color: METRIC_COLORS.perMatch, trendKey: "score" },
  goals: { label: METRIC_LABELS.goals, color: METRIC_COLORS.goals, trendKey: "goals" },
  assists: { label: METRIC_LABELS.assists, color: METRIC_COLORS.assists, trendKey: "assists" },
  keyPasses: { label: "מס״מ", color: METRIC_COLORS.keyPasses, trendKey: "keyPasses" },
  tackles: { label: METRIC_LABELS.tackles, color: METRIC_COLORS.tackles, trendKey: "tackles" },
  press: { label: "לחץ", color: "#fb7185", trendKey: "tackles" },
  lossesTotal: { label: METRIC_LABELS.losses, color: METRIC_COLORS.losses, trendKey: "losses" },
  aerialWon: { label: "אוויר", color: "#38bdf8", trendKey: "score" },
  groundWon: { label: "קרקע", color: "#a3e635", trendKey: "score" },
  xg: { label: METRIC_LABELS.xg, color: METRIC_COLORS.xg, trendKey: "xg" },
  xa: { label: METRIC_LABELS.xa, color: METRIC_COLORS.xa, trendKey: "xa" },
  minutes: { label: "דק׳", color: "#94a3b8", trendKey: "matchesPlayed" },
  matchesPlayed: { label: METRIC_LABELS.matchesPlayed, color: METRIC_COLORS.matchesPlayed, trendKey: "matchesPlayed" },
};

const METRIC_ORDER: SortKey[] = [
  "score",
  "perMatch",
  "goals",
  "assists",
  "keyPasses",
  "tackles",
  "press",
  "lossesTotal",
  "aerialWon",
  "groundWon",
  "xg",
  "xa",
  "minutes",
  "matchesPlayed",
];

const LOAD_TIMEOUT_MS = 12000;

const COUNT_KEYS = new Set<SortKey>([
  "score",
  "goals",
  "assists",
  "keyPasses",
  "tackles",
  "press",
  "lossesTotal",
  "aerialWon",
  "groundWon",
  "xg",
  "xa",
]);

function sortValue(r: SeasonRow, key: SortKey, mode: RateMode): number {
  if (key === "press") return rateOf(r.press, r.minutes, mode);
  if (key === "minutes") return r.minutes;
  if (COUNT_KEYS.has(key)) {
    const raw = r[key as keyof SeasonImpact];
    return rateOf(typeof raw === "number" ? raw : 0, r.minutes, mode, key === "xg" || key === "xa" ? 2 : 1);
  }
  return r[key];
}

function fmt(r: SeasonRow, key: "goals" | "assists" | "keyPasses" | "tackles" | "press" | "lossesTotal" | "xg" | "xa", mode: RateMode): string {
  const digits = key === "xg" || key === "xa" ? 2 : 1;
  const raw = key === "press" ? r.press : r[key];
  return formatRate(raw, r.minutes, mode, digits);
}

export default function SeasonPage() {
  const [events, setEvents] = useState<MatchEvent[]>([]);
  const [players, setPlayers] = useState<Player[]>([]);
  const [squad, setSquad] = useState<SquadPlayer[]>([]);
  const [matches, setMatches] = useState<Match[]>([]);
  const [substitutions, setSubstitutions] = useState<Substitution[]>([]);
  const [matchesCount, setMatchesCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [exporting, setExporting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sortKey, setSortKey] = useState<SortKey>("score");
  const [sortDir, setSortDir] = useState<"desc" | "asc">("desc");
  const [view, setView] = useState<"cards" | "table">("cards");
  const [query, setQuery] = useState("");
  const [selectedTypes, setSelectedTypes] = useState<MatchType[]>([]);
  const [rateMode, setRateMode] = useState<RateMode>("total");

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
        setSubstitutions(bundle.substitutions);
        setMatchesCount(bundle.matchesCount);
      })
      .catch((e) => setError(e instanceof Error ? e.message : "שגיאה בטעינה"))
      .finally(() => setLoading(false));
  };

  useEffect(load, []);

  const allowedMatchIds = useMemo(
    () => matchIdsForTypes(matches, selectedTypes),
    [matches, selectedTypes]
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

  const typeCounts = useMemo(() => {
    const counts: Record<MatchType, number> = { league: 0, cup: 0, friendly: 0 };
    for (const m of matches) counts[m.match_type ?? "league"] += 1;
    return counts;
  }, [matches]);

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

  const rows = useMemo(() => {
    const base = computeSeasonImpact(statsEvents, filteredPlayers, squad, players);
    const enriched: SeasonRow[] = base.map((r) => ({
      ...r,
      minutes: minutesByKey.get(r.key) ?? 0,
      press: pressByKey.get(r.key)?.press ?? 0,
      attTackles: pressByKey.get(r.key)?.attTackles ?? 0,
    }));
    const withActivity = enriched.filter(
      (r) =>
        r.score !== 0 ||
        r.press > 0 ||
        r.goals + r.assists + r.keyPasses + r.tackles + r.lossesTotal + r.shotsInBox > 0
    );
    const list = withActivity.length > 0 ? withActivity : enriched;
    const q = query.trim().toLowerCase();
    const filtered = q
      ? list.filter(
          (r) =>
            r.label.toLowerCase().includes(q) || String(r.shirtNumber ?? "").includes(q)
        )
      : list;
    return [...filtered].sort((a, b) => {
      const av = sortValue(a, sortKey, rateMode);
      const bv = sortValue(b, sortKey, rateMode);
      if (av === bv) return a.label.localeCompare(b.label, "he");
      const cmp = av - bv;
      return sortDir === "desc" ? -cmp : cmp;
    });
  }, [
    filteredEvents,
    filteredPlayers,
    squad,
    minutesByKey,
    pressByKey,
    sortKey,
    sortDir,
    query,
    rateMode,
    statsEvents,
    players,
  ]);

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
    () => Math.max(1, ...rows.map((r) => Math.abs(sortValue(r, sortKey, rateMode)))),
    [rows, sortKey, rateMode]
  );

  const exportSeason = () => {
    downloadCsv("scout_season.csv", seasonTableCsv(rows));
  };

  const exportTableau = () => {
    if (filteredMatches.length === 0) return;
    setExporting(true);
    try {
      downloadTableauSeasonWorkbook({
        matches: filteredMatches,
        events: filteredEvents,
        players: filteredPlayers,
        squad,
        substitutions: filteredSubs,
      });
    } finally {
      setExporting(false);
    }
  };

  const formatCardValue = (row: SeasonRow, value: number) => {
    if (sortKey === "minutes" || sortKey === "matchesPlayed") return value;
    if (sortKey === "score" || sortKey === "perMatch" || rateMode === "per90") {
      const n =
        sortKey === "perMatch" ? row.perMatch : sortValue(row, sortKey, rateMode);
      const digits = sortKey === "xg" || sortKey === "xa" ? 2 : 1;
      const shown = Number(n.toFixed(digits));
      if (sortKey === "score" || sortKey === "perMatch") {
        return `${shown > 0 ? "+" : ""}${shown.toFixed(digits)}`;
      }
      return shown;
    }
    return value;
  };

  return (
    <main className="mx-auto flex w-full max-w-3xl flex-1 flex-col px-4 pt-6 pb-10">
      <AppHeader
        title="טבלה עונתית"
        subtitle={
          loading
            ? "טוען..."
            : `${filteredMatches.length}${
                selectedTypes.length === 0 ? "" : `/${matchesCount}`
              } משחקים · ${rows.length} שחקנים${rateMode === "per90" ? " · ל־90׳" : ""}`
        }
        backHref="/"
      />

      <ConfigBanner />

      <button
        type="button"
        onClick={exportTableau}
        disabled={filteredMatches.length === 0 || exporting || loading}
        className="btn btn-primary mb-3 w-full py-3 text-sm"
      >
        {exporting ? "מייצא..." : "⬇ ייצוא Excel שנתי ל-Tableau"}
      </button>

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
        <button
          onClick={exportSeason}
          disabled={rows.length === 0}
          className="btn btn-ghost h-9 px-3 text-sm"
          title="ייצוא CSV של הטבלה הנוכחית"
        >
          CSV
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

      <MatchTypeChips
        selected={selectedTypes}
        onChange={setSelectedTypes}
        typeCounts={typeCounts}
        total={matchesCount}
      />

      <RateModeToggle mode={rateMode} onChange={setRateMode} />

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
      <p className="mb-3 text-[11px] text-[var(--muted-2)]">
        לחץ התקפי: חילוצי הקבוצה בשליש ההתקפי בזמן ששיחק כשחקן התקפה
      </p>

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
            : selectedTypes.length > 0 && filteredMatches.length === 0
              ? "אין משחקים בסוגים שנבחרו."
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
            const value = sortValue(row, sortKey, rateMode);
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
                    {row.matchesPlayed} מש׳ · {row.minutes}׳ · {fmt(row, "goals", rateMode)} שער ·{" "}
                    {fmt(row, "assists", rateMode)} ביש · {fmt(row, "keyPasses", rateMode)} מס״מ ·{" "}
                    {fmt(row, "tackles", rateMode)} חילוץ · לחץ {fmt(row, "press", rateMode)} ·{" "}
                    {fmt(row, "lossesTotal", rateMode)} איבודים · אוויר{" "}
                    <span className="text-emerald-400">
                      {formatRate(row.aerialWon, row.minutes, rateMode)}
                    </span>
                    /
                    <span className="text-[var(--danger)]">
                      {formatRate(row.aerialLost, row.minutes, rateMode)}
                    </span>{" "}
                    · קרקע{" "}
                    <span className="text-emerald-400">
                      {formatRate(row.groundWon, row.minutes, rateMode)}
                    </span>
                    /
                    <span className="text-[var(--danger)]">
                      {formatRate(row.groundLost, row.minutes, rateMode)}
                    </span>{" "}
                    · xG {fmt(row, "xg", rateMode)}
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
                    {formatCardValue(row, value)}
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
                      ["minutes", "דק׳"],
                      ["goals", "שער"],
                      ["assists", "ביש"],
                      ["keyPasses", "מס״מ"],
                      ["tackles", "חילוץ"],
                      ["press", "לחץ"],
                      ["lossesTotal", "איבודים"],
                      ["aerialWon", "אוויר W–L"],
                      ["groundWon", "קרקע W–L"],
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
                    <td className="tabular px-1.5 py-2">{row.minutes}</td>
                    <td className="tabular px-1.5 py-2 font-bold text-[var(--accent)]">
                      {fmt(row, "goals", rateMode)}
                    </td>
                    <td className="tabular px-1.5 py-2 text-[var(--info)]">
                      {fmt(row, "assists", rateMode)}
                    </td>
                    <td className="tabular px-1.5 py-2">{fmt(row, "keyPasses", rateMode)}</td>
                    <td className="tabular px-1.5 py-2">{fmt(row, "tackles", rateMode)}</td>
                    <td className="tabular px-1.5 py-2" title="חילוצי קבוצה בהתקפה בזמן ששיחק כתוקף">
                      {fmt(row, "press", rateMode)}
                    </td>
                    <td className="tabular px-1.5 py-2 text-[var(--danger)]">
                      {fmt(row, "lossesTotal", rateMode)}
                    </td>
                    <td className="tabular px-1.5 py-2">
                      <span className="text-emerald-400">
                        {formatRate(row.aerialWon, row.minutes, rateMode)}
                      </span>
                      <span className="text-[var(--muted-2)]">–</span>
                      <span className="text-[var(--danger)]">
                        {formatRate(row.aerialLost, row.minutes, rateMode)}
                      </span>
                    </td>
                    <td className="tabular px-1.5 py-2">
                      <span className="text-emerald-400">
                        {formatRate(row.groundWon, row.minutes, rateMode)}
                      </span>
                      <span className="text-[var(--muted-2)]">–</span>
                      <span className="text-[var(--danger)]">
                        {formatRate(row.groundLost, row.minutes, rateMode)}
                      </span>
                    </td>
                    <td className="tabular px-1.5 py-2">{fmt(row, "xg", rateMode)}</td>
                    <td className="tabular px-1.5 py-2">{fmt(row, "xa", rateMode)}</td>
                    <td
                      className={`tabular px-1.5 py-2 font-black ${
                        row.score > 0
                          ? "text-[var(--accent)]"
                          : row.score < 0
                            ? "text-[var(--danger)]"
                            : ""
                      }`}
                    >
                      {rateOf(row.score, row.minutes, rateMode) > 0 ? "+" : ""}
                      {rateOf(row.score, row.minutes, rateMode).toFixed(1)}
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
