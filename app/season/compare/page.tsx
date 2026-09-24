"use client";

import { Suspense, useEffect, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import { RadarProfile } from "../../components/RadarProfile";
import { TrendChart, TrendPoint } from "../../components/TrendChart";
import { AppHeader } from "../../components/AppHeader";
import { PageSkeleton } from "../../components/Skeleton";
import { MatchTypeChips, RateModeToggle } from "../../components/SeasonFilters";
import { loadSeasonBundle } from "@/lib/db";
import { computeAttackingPressByKey, AttackingPressRow } from "@/lib/attackingPress";
import { buildCompareRadar, roundMetric } from "@/lib/advancedMetrics";
import {
  computePlayerSeasonMatches,
  computeSeasonImpact,
  computeSeasonMinutesByKey,
  PlayerMatchLine,
  SeasonImpact,
} from "@/lib/impactScore";
import { formatMatchOption, matchIdsForTypes } from "@/lib/matchFilter";
import { findRowByPlayerKey } from "@/lib/playerKey";
import { attributeMatchEvents } from "@/lib/eventAttribution";
import { formatRate, RateMode, rateOf, scaleSeasonForRadar } from "@/lib/rates";
import { isSupabaseConfigured } from "@/lib/supabaseClient";
import { withTimeout } from "@/lib/withTimeout";
import {
  COMPARE_PALETTE,
  COMPARE_SLOT_KEYS,
  COMPARE_SLOT_LABELS,
  MAX_COMPARE_PLAYERS,
  METRIC_LABELS,
  MetricKey,
  type CompareSlotKey,
} from "@/lib/trendMetrics";
import { MATCH_TYPE_LABELS, Match, MatchEvent, MatchType, Player, SquadPlayer, Substitution } from "@/lib/types";

const LOAD_TIMEOUT_MS = 12000;

const COMPARE_METRICS: MetricKey[] = [
  "score",
  "goals",
  "assists",
  "keyPasses",
  "tackles",
  "losses",
];

/** ממלא חורים באמצע הרשימה, ומשאיר משבצות ריקות רק בסוף (אחרי ״הוסף שחקן״). */
function packKeys(keys: string[]): string[] {
  const filled = keys.filter((k) => k.length > 0);
  let trail = 0;
  for (let i = keys.length - 1; i >= 0 && !keys[i]; i--) trail += 1;
  if (filled.length === 0) {
    return Array.from({ length: Math.max(2, keys.length) }, () => "");
  }
  const next = [...filled, ...Array<string>(trail).fill("")];
  while (next.length < 2) next.push("");
  return next;
}

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
    default:
      return roundMetric(l.score);
  }
}

interface PresentPlayer {
  key: string;
  slot: CompareSlotKey;
  color: string;
  row: SeasonImpact;
  minutes: number;
  press: AttackingPressRow | undefined;
}

export default function ComparePage() {
  return (
    <Suspense
      fallback={
        <main className="mx-auto w-full max-w-4xl px-4 page-shell">
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
  const [selectedKeys, setSelectedKeys] = useState<string[]>(["", ""]);
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

  const allSeasonRows = useMemo(
    () => computeSeasonImpact(events, players, squad),
    [events, players, squad]
  );

  const present = useMemo<PresentPlayer[]>(() => {
    const out: PresentPlayer[] = [];
    for (const key of selectedKeys) {
      if (!key) continue;
      const row = findRowByPlayerKey(rows, key, filteredPlayers, squad);
      if (!row) continue;
      const i = out.length;
      const slot = COMPARE_SLOT_KEYS[i];
      if (!slot) break;
      out.push({
        key,
        slot,
        color: COMPARE_PALETTE[i],
        row,
        minutes: minutesByKey.get(row.key) ?? minutesByKey.get(key) ?? 0,
        press: pressByKey.get(row.key) ?? pressByKey.get(key),
      });
    }
    return out;
  }, [selectedKeys, rows, filteredPlayers, squad, minutesByKey, pressByKey]);

  const radar = useMemo(() => {
    if (present.length === 0) return [];
    const pool = rows.map((r) =>
      scaleSeasonForRadar(r, minutesByKey.get(r.key) ?? 0, rateMode)
    );
    const sources = present.map((p) => scaleSeasonForRadar(p.row, p.minutes, rateMode));
    return buildCompareRadar(sources, pool);
  }, [present, rows, minutesByKey, rateMode]);

  const linesByKey = useMemo(() => {
    const map = new Map<string, PlayerMatchLine[]>();
    for (const p of present) {
      if (map.has(p.key)) continue;
      map.set(p.key, computePlayerSeasonMatches(p.key, statsEvents, players, filteredMatches, squad));
    }
    return map;
  }, [present, statsEvents, players, filteredMatches, squad]);

  const compareTrend = useMemo<TrendPoint[]>(() => {
    type Acc = { label: string; date: string } & Partial<Record<CompareSlotKey, number>>;
    const byMatch = new Map<string, Acc>();
    for (const p of present) {
      for (const l of linesByKey.get(p.key) ?? []) {
        const cur = byMatch.get(l.matchId) ?? {
          label: l.opponent.slice(0, 10),
          date: l.matchDate,
        };
        cur[p.slot] = lineMetric(l, compareMetric);
        byMatch.set(l.matchId, cur);
      }
    }
    return Array.from(byMatch.values())
      .sort((x, y) => (x.date || "").localeCompare(y.date || ""))
      .map(({ date: _date, ...p }) => p);
  }, [present, linesByKey, compareMetric]);

  const compareSeries = useMemo(
    () =>
      present.map((p) => ({
        key: p.slot as keyof TrendPoint,
        label: p.row.label,
        color: p.color,
      })),
    [present]
  );

  const radarSeries = useMemo(
    () =>
      present.map((p) => ({
        key: p.slot,
        label: p.row.label,
        color: p.color,
      })),
    [present]
  );

  const singleMatch = matchId !== "all";
  const selectedMatch = typeFilteredMatches.find((m) => m.id === matchId);
  const hasSelection = selectedKeys.some((k) => k.length > 0);

  const missingSelected = useMemo(() => {
    return selectedKeys.flatMap((key, i) => {
      if (!key) return [];
      if (findRowByPlayerKey(rows, key, filteredPlayers, squad)) return [];
      const label =
        playerOptions.find((r) => r.key === key)?.label ??
        findRowByPlayerKey(allSeasonRows, key, players, squad)?.label ??
        key;
      return [{ key, label, slotLabel: COMPARE_SLOT_LABELS[i] ?? "שחקן" }];
    });
  }, [selectedKeys, rows, filteredPlayers, squad, playerOptions, allSeasonRows, players]);

  const scopeLabel = useMemo(() => {
    const typePart =
      selectedTypes.length === 0
        ? "כל סוגי המשחק"
        : selectedTypes.map((t) => MATCH_TYPE_LABELS[t]).join(" · ");
    const matchPart = selectedMatch ? formatMatchOption(selectedMatch) : `כל המשחקים (${filteredMatches.length})`;
    const ratePart = rateMode === "per90" ? "ל־90׳" : "סה״כ";
    return `${typePart} · ${matchPart} · ${ratePart}`;
  }, [selectedTypes, selectedMatch, filteredMatches.length, rateMode]);

  function labelForKey(key: string) {
    return (
      playerOptions.find((r) => r.key === key)?.label ??
      findRowByPlayerKey(allSeasonRows, key, players, squad)?.label ??
      key
    );
  }

  function updateKey(index: number, value: string) {
    setSelectedKeys((prev) => packKeys(prev.map((k, i) => (i === index ? value : k))));
  }

  function addSlot() {
    setSelectedKeys((prev) => (prev.length >= MAX_COMPARE_PLAYERS ? prev : packKeys([...prev, ""])));
  }

  function removeSlot(index: number) {
    setSelectedKeys((prev) => {
      if (prev.length <= 2) return packKeys(prev.map((k, i) => (i === index ? "" : k)));
      return packKeys(prev.filter((_, i) => i !== index));
    });
  }

  const printCompare = () => {
    const prev = document.title;
    const names = present.map((p) => p.row.label).join(" · ");
    document.title = names ? `השוואת שחקנים — ${names}` : "השוואת שחקנים";
    window.print();
    window.setTimeout(() => {
      document.title = prev;
    }, 1000);
  };

  if (loading) {
    return (
      <main className="mx-auto w-full max-w-4xl px-4 page-shell">
        <AppHeader title="השוואת שחקנים" backHref={backHref} />
        <PageSkeleton />
      </main>
    );
  }

  return (
    <main className="mx-auto flex w-full max-w-4xl flex-1 flex-col px-4 page-shell pb-10">
      <AppHeader
        title="השוואת שחקנים"
        subtitle={scopeLabel}
        backHref={backHref}
        right={
          present.length > 0 ? (
            <button type="button" onClick={printCompare} className="btn btn-ghost no-print h-9 px-2 text-xs">
              PDF
            </button>
          ) : undefined
        }
      />
      {error && <p className="mb-3 text-[var(--danger)]">{error}</p>}

      <p className="print-only mb-3 text-sm font-bold">
        {present.map((p) => p.row.label).join("  ·  ")}
      </p>

      <div className="no-print">
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

        <div className="mb-3 grid grid-cols-1 gap-2 sm:grid-cols-2">
          {selectedKeys.map((key, i) => (
            <label key={`slot-${i}`} className="flex flex-col gap-1">
              <span className="label flex items-center justify-between gap-2">
                <span className="flex items-center gap-1.5">
                  <span
                    className="h-2 w-2 rounded-full"
                    style={{ background: COMPARE_PALETTE[i] ?? COMPARE_PALETTE[0] }}
                  />
                  {COMPARE_SLOT_LABELS[i]}
                </span>
                {(selectedKeys.length > 2 || key) && (
                  <button
                    type="button"
                    onClick={() => removeSlot(i)}
                    className="text-[11px] font-semibold text-[var(--muted)]"
                  >
                    {selectedKeys.length > 2 ? "הסר" : "נקה"}
                  </button>
                )}
              </span>
              <select
                value={key}
                onChange={(e) => updateKey(i, e.target.value)}
                className="field w-full"
              >
                <option value="">בחר שחקן</option>
                {key && !playerOptions.some((r) => r.key === key) && (
                  <option value={key}>{labelForKey(key)}</option>
                )}
                {playerOptions.map((r) => (
                  <option
                    key={r.key}
                    value={r.key}
                    disabled={selectedKeys.some((other, j) => j !== i && other === r.key)}
                  >
                    {r.label}
                    {singleMatch ? ` · ${minutesByKey.get(r.key) ?? 0}׳` : ""}
                  </option>
                ))}
              </select>
            </label>
          ))}
        </div>

        {selectedKeys.length < MAX_COMPARE_PLAYERS && (
          <button type="button" onClick={addSlot} className="btn btn-ghost mb-4 w-full py-2.5 text-sm">
            הוסף שחקן ({selectedKeys.length}/{MAX_COMPARE_PLAYERS})
          </button>
        )}

        {present.length > 0 && (
          <button type="button" onClick={printCompare} className="btn btn-ghost mb-4 w-full py-3 text-sm">
            ייצוא PDF — השוואת שחקנים
          </button>
        )}
      </div>

      {!hasSelection && (
        <div className="card p-6 text-center text-sm text-[var(--muted)]">
          בחר שחקנים מהסגל כדי להשוות רדאר ומגמה. אפשר עד חמישה שחקנים, לצמצם לליגה/גביע/אימון
          או למשחק בודד, ולייצא PDF כמו דוח משחק.
        </div>
      )}

      {missingSelected.length > 0 && (
        <p className="mb-3 text-sm text-[var(--muted)]">
          {missingSelected.map((m) => m.label).join(" · ")}{" "}
          {missingSelected.length === 1 ? "לא שותף" : "לא שותפו"} במסנן שנבחר.
        </p>
      )}

      {present.length > 0 && (
        <>
          <section className="card mb-4 p-3">
            <p className="label mb-1">
              פרופיל רדאר ({rateMode === "per90" ? "אחוזון לפי קצב ל־90׳" : "אחוזון מול הקבוצה"})
            </p>
            <RadarProfile data={radar} series={radarSeries} />
          </section>

          <div className="mb-4 overflow-x-auto">
            <table className="w-full border-collapse text-center text-sm">
              <thead>
                <tr className="text-[11px] text-[var(--muted)]">
                  <th className="px-2 py-2 text-right">
                    מדד{rateMode === "per90" ? " · ל־90׳" : ""}
                  </th>
                  {present.map((p) => (
                    <th
                      key={p.slot}
                      className="compare-tint px-2 py-2"
                      style={{ ["--compare-tint" as string]: p.color }}
                    >
                      {p.row.label}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {(
                  [
                    ["משחקים", (p) => String(p.row.matchesPlayed)],
                    ["דקות", (p) => `${p.minutes}׳`],
                    ["שערים", (p) => formatRate(p.row.goals, p.minutes, rateMode)],
                    ["בישולים", (p) => formatRate(p.row.assists, p.minutes, rateMode)],
                    ["מס״מ", (p) => formatRate(p.row.keyPasses, p.minutes, rateMode)],
                    ["חילוצים", (p) => formatRate(p.row.tackles, p.minutes, rateMode)],
                    ["לחץ התקפי", (p) => formatRate(p.press?.press ?? 0, p.minutes, rateMode)],
                    ["חילוץ התק׳", (p) => formatRate(p.press?.attTackles ?? 0, p.minutes, rateMode)],
                    ["איבודים", (p) => formatRate(p.row.lossesTotal, p.minutes, rateMode)],
                    ["Impact", (p) => rateOf(p.row.score, p.minutes, rateMode).toFixed(1)],
                  ] as [string, (p: PresentPlayer) => string][]
                ).map(([label, val]) => (
                  <tr key={label} className="border-t border-[var(--border)]">
                    <td className="px-2 py-2 text-right font-bold">{label}</td>
                    {present.map((p) => (
                      <td
                        key={p.slot}
                        className="compare-tint tabular px-2 py-2"
                        style={{ ["--compare-tint" as string]: p.color }}
                      >
                        {val(p)}
                      </td>
                    ))}
                  </tr>
                ))}
                <tr className="border-t border-[var(--border)]">
                  <td className="px-2 py-2 text-right font-bold">מאבקי אוויר</td>
                  {present.map((p) => (
                    <td key={p.slot} className="px-2 py-2">
                      <DuelWl
                        won={rateOf(p.row.aerialWon, p.minutes, rateMode)}
                        lost={rateOf(p.row.aerialLost, p.minutes, rateMode)}
                      />
                    </td>
                  ))}
                </tr>
                <tr className="border-t border-[var(--border)]">
                  <td className="px-2 py-2 text-right font-bold">מאבקי קרקע</td>
                  {present.map((p) => (
                    <td key={p.slot} className="px-2 py-2">
                      <DuelWl
                        won={rateOf(p.row.groundWon, p.minutes, rateMode)}
                        lost={rateOf(p.row.groundLost, p.minutes, rateMode)}
                      />
                    </td>
                  ))}
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
              <div className="no-print mb-3 flex flex-wrap gap-1.5">
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
