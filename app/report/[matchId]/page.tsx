"use client";

import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { getEvents, getMatch, getPlayers, getSubstitutions, reopenMatch, updateMatchNotes } from "@/lib/db";
import {
  downloadCsv,
  exportTableCsv,
  EXPORT_TABLE_LABELS,
  ExportTableId,
  matchReportToCsv,
} from "@/lib/exportCsv";
import { computePlayerMatchStats, computeTeamTotals, PlayerMatchStats } from "@/lib/playerStats";
import { buildMatchSummary, zoneHeatPercent } from "@/lib/matchSummary";
import { clockDisplay, readClockState } from "@/lib/matchClock";
import { isSupabaseConfigured } from "@/lib/supabaseClient";
import { MatchEvent, Match, Player, Substitution, ZONE_LABELS } from "@/lib/types";
import { AppHeader } from "../../components/AppHeader";
import { LiveClockBadge } from "./LiveClockBadge";
import { PlayerCardSheet } from "./PlayerCardSheet";
import { PageSkeleton } from "../../components/Skeleton";
import { roundMetric } from "@/lib/advancedMetrics";

export default function ReportPage() {
  const params = useParams<{ matchId: string }>();
  const router = useRouter();
  const matchId = params.matchId;

  const [match, setMatch] = useState<Match | null>(null);
  const [players, setPlayers] = useState<Player[]>([]);
  const [events, setEvents] = useState<MatchEvent[]>([]);
  const [subs, setSubs] = useState<Substitution[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [reopening, setReopening] = useState(false);
  const [cardPlayerId, setCardPlayerId] = useState<string | null | undefined>(undefined);
  const [notes, setNotes] = useState("");
  const [notesSaving, setNotesSaving] = useState(false);

  useEffect(() => {
    if (!matchId) return;
    if (!isSupabaseConfigured) {
      setLoading(false);
      setError("Supabase לא מחובר. אי אפשר לטעון את הדוח.");
      return;
    }
    (async () => {
      try {
        const [m, ps, evs, subList] = await Promise.all([
          getMatch(matchId),
          getPlayers(matchId),
          getEvents(matchId),
          getSubstitutions(matchId).catch(() => [] as Substitution[]),
        ]);
        setMatch(m);
        setPlayers(ps);
        setEvents(evs);
        setSubs(subList);
        setNotes(m?.notes ?? "");
      } catch (e) {
        setError(e instanceof Error ? e.message : "שגיאה בטעינה");
      } finally {
        setLoading(false);
      }
    })();
  }, [matchId]);

  const liveFinalMinute = useMemo(() => {
    if (typeof window === "undefined") return undefined;
    if (match?.status !== "live") return undefined;
    return clockDisplay(readClockState(matchId)).minute;
  }, [match?.status, matchId, events.length, subs.length]);

  const statsOpts = useMemo(
    () => ({
      substitutions: subs,
      match,
      liveFinalMinute,
    }),
    [subs, match, liveFinalMinute]
  );

  const playerStats = useMemo(
    () => computePlayerMatchStats(events, players, statsOpts),
    [events, players, statsOpts]
  );
  const team = useMemo(() => computeTeamTotals(events), [events]);
  const summary = useMemo(() => buildMatchSummary(events, players), [events, players]);
  const lossHeat = useMemo(() => zoneHeatPercent(team.losses), [team.losses]);
  const tackleHeat = useMemo(() => zoneHeatPercent(team.tackles), [team.tackles]);

  const selectedStats = useMemo(() => {
    if (cardPlayerId === undefined) return null;
    return playerStats.find((p) => p.playerId === cardPlayerId) ?? null;
  }, [cardPlayerId, playerStats]);

  const defensiveLosses = useMemo(
    () =>
      events
        .filter((e) => e.action_type === "ball_loss" && e.zone === "def")
        .sort((a, b) => a.half - b.half || a.match_minute - b.match_minute),
    [events]
  );

  const meta = {
    opponent: match?.opponent,
    matchDate: match?.match_date,
    notes,
  };

  const exportOne = (id: ExportTableId) => {
    const csv =
      id === "full"
        ? matchReportToCsv(events, players, meta, statsOpts)
        : exportTableCsv(id, events, players, meta, statsOpts);
    const label = id === "full" ? "full" : id;
    downloadCsv(`scout_${match?.opponent ?? "match"}_${label}.csv`, csv);
  };

  const saveNotes = async () => {
    setNotesSaving(true);
    try {
      await updateMatchNotes(matchId, notes.trim());
      setMatch((m) => (m ? { ...m, notes: notes.trim() } : m));
    } catch {
      setError("שמירת הערה נכשלה (הרץ migration_v4.sql אם עמודת notes חסרה)");
    } finally {
      setNotesSaving(false);
    }
  };

  const handleReopen = async () => {
    setReopening(true);
    try {
      await reopenMatch(matchId);
      router.push(`/live/${matchId}`);
    } catch {
      setError("פתיחה מחדש נכשלה");
      setReopening(false);
    }
  };

  if (loading) {
    return (
      <main className="mx-auto w-full max-w-3xl px-4 pt-6">
        <AppHeader title="דוח משחק" backHref="/" />
        <PageSkeleton rows={7} />
      </main>
    );
  }

  if (error && !match) {
    return (
      <main className="mx-auto flex w-full max-w-md flex-1 flex-col px-4 pt-8">
        <p className="rounded-2xl border border-red-500/40 bg-red-500/10 p-4 text-red-200">{error}</p>
        <Link href="/" className="mt-4 text-center text-[var(--muted)]">
          ← חזרה לבית
        </Link>
      </main>
    );
  }

  const isLive = match?.status === "live";
  const hasData = players.length > 0 || events.length > 0;

  return (
    <main className="mx-auto flex w-full max-w-3xl flex-1 flex-col px-4 pt-6 pb-10">
      <AppHeader
        title={`דוח מול ${match?.opponent ?? ""}`}
        subtitle={match ? new Date(match.match_date).toLocaleDateString("he-IL") : undefined}
        backHref="/"
        right={
          <div className="no-print flex items-center gap-1">
            {isLive ? (
              <Link href={`/live/${matchId}`} className="text-xs font-bold text-[var(--info)]">
                חזרה ללייב
              </Link>
            ) : (
              <button type="button" onClick={() => window.print()} className="btn btn-ghost h-9 px-2 text-xs">
                PDF
              </button>
            )}
          </div>
        }
      />

      {error && (
        <p className="mb-3 rounded-xl border border-red-500/30 bg-red-500/10 px-3 py-2 text-sm text-red-200">
          {error}
        </p>
      )}

      {isLive && <LiveClockBadge matchId={matchId} />}

      {!isLive && (
        <div className="mb-4 rounded-2xl border border-[var(--border)] bg-[var(--panel)] px-4 py-3 text-sm text-[var(--muted)]">
          <p className="font-bold text-[var(--text)]">המשחק הושלם — אין יותר לייב או עריכת אירועים.</p>
          <button
            onClick={handleReopen}
            disabled={reopening}
            className="btn btn-ghost mt-2 w-full py-2.5 text-sm sm:w-auto"
          >
            {reopening ? "פותח..." : "טעות? פתח מחדש ללייב"}
          </button>
        </div>
      )}

      {!hasData && (
        <div className="card p-6 text-center text-[var(--muted)]">עדיין אין נתונים למשחק הזה.</div>
      )}

      {hasData && (
        <>
          {/* סיכום חכם */}
          <section className="card mb-4 p-4">
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="label">סיכום משחק</p>
                <p className="mt-1 text-3xl font-black tabular text-[var(--accent)]">
                  {summary.ourGoals} <span className="text-base font-bold text-[var(--muted)]">שערים</span>
                </p>
              </div>
              {summary.motm && (
                <button
                  onClick={() => summary.motm?.playerId && setCardPlayerId(summary.motm.playerId)}
                  className="rounded-2xl border border-[var(--accent)]/30 bg-[var(--accent)]/10 px-3 py-2 text-left"
                >
                  <p className="text-[10px] font-bold text-[var(--accent)]">שחקן המשחק</p>
                  <p className="font-extrabold">{summary.motm.label}</p>
                </button>
              )}
            </div>
            {summary.insights.length > 0 && (
              <ul className="mt-3 flex flex-col gap-1.5">
                {summary.insights.map((ins, i) => (
                  <li
                    key={i}
                    className={`rounded-xl px-3 py-2 text-sm ${
                      ins.tone === "good"
                        ? "bg-emerald-500/10 text-emerald-200"
                        : ins.tone === "warn"
                          ? "bg-amber-500/10 text-amber-200"
                          : "bg-[var(--panel-strong)] text-[var(--muted)]"
                    }`}
                  >
                    {ins.text}
                  </li>
                ))}
              </ul>
            )}
          </section>

          <section className="mb-4 grid grid-cols-2 gap-2 sm:grid-cols-4">
            <StatCard value={team.goals} label="שערים" tone="accent" />
            <StatCard value={team.assists} label="בישולים" tone="info" />
            <StatCard value={team.keyPasses} label="מסירות מפתח" tone="info" />
            <StatCard value={`${team.shotsInBox}/${team.shotsOutBox}`} label="איומים רחבה/חוץ" />
            <StatCard value={roundMetric(team.xg)} label="xG" tone="info" />
            <StatCard value={roundMetric(team.xa)} label="xA" tone="info" />
            <StatCard value={`${team.cornersFor}:${team.cornersAgainst}`} label="קרנות" />
            <StatCard value={team.eventsTotal} label="אירועים" />
          </section>

          {/* איבודים וחילוצים לפי אזור */}
          <section className="mb-4 grid grid-cols-1 gap-3 sm:grid-cols-2">
            <HeatCard title="איבודים לפי אזור" data={team.losses} pct={lossHeat} tone="danger" />
            <HeatCard title="חילוצים לפי אזור" data={team.tackles} pct={tackleHeat} tone="accent" />
          </section>

          {/* ייצוא */}
          <section className="card mb-5 p-4 no-print">
            <p className="label mb-2">ייצוא דוח</p>
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
              {(Object.keys(EXPORT_TABLE_LABELS) as (keyof typeof EXPORT_TABLE_LABELS)[]).map((id) => (
                <button
                  key={id}
                  onClick={() => exportOne(id)}
                  className="btn btn-ghost py-2.5 text-xs"
                >
                  ⬇ {EXPORT_TABLE_LABELS[id]}
                </button>
              ))}
            </div>
            <button onClick={() => exportOne("full")} className="btn btn-primary mt-2 w-full py-3 text-sm">
              ⬇ ייצוא מלא לאקסל (CSV)
            </button>
            <button onClick={() => window.print()} className="btn btn-ghost mt-2 w-full py-3 text-sm">
              ייצוא PDF להדפסה
            </button>
          </section>

          {/* כרטיסי שחקנים */}
          <section className="mb-5">
            <h2 className="label mb-2">כרטיסי שחקנים</h2>
            <div className="grid grid-cols-3 gap-2 sm:grid-cols-4">
              {playerStats
                .filter((p) => p.playerId !== null)
                .map((p) => (
                  <button
                    key={p.playerId!}
                    onClick={() => setCardPlayerId(p.playerId)}
                    className="card flex flex-col items-center py-3 active:scale-95"
                  >
                    <span className="text-xl font-black tabular">{p.shirtNumber}</span>
                    <span className="mt-0.5 max-w-full truncate px-1 text-[11px] text-[var(--muted)]">
                      {p.name}
                    </span>
                    <span className="mt-1 text-[10px] font-bold tabular text-[var(--accent)]">
                      {p.minutesPlayed}׳
                    </span>
                  </button>
                ))}
            </div>
          </section>

          <MetricTable
            title="דקות משחק"
            exportId="minutes"
            onExport={exportOne}
            headers={["דקות", "סטטוס"]}
            rows={playerStats}
            sortKey={(r) => r.minutesPlayed}
            cells={(r) => [r.minutesPlayed]}
            cellLabels={(r) => [String(r.minutesPlayed), r.isStarter ? "פותח" : "ספסל"]}
            onPlayer={setCardPlayerId}
            accentCol={0}
            showMinutes={false}
          />

          {subs.length > 0 && (
            <section className="mb-4">
              <h2 className="label mb-2">חילופים ({subs.length})</h2>
              <ul className="flex flex-col gap-1.5">
                {subs.map((s) => {
                  const outP = players.find((p) => p.id === s.player_out_id);
                  const inP = players.find((p) => p.id === s.player_in_id);
                  return (
                    <li
                      key={s.id}
                      className="card flex items-center justify-between px-3 py-2 text-sm"
                    >
                      <span className="tabular font-bold text-[var(--muted)]">{s.match_minute}׳</span>
                      <span>
                        <span className="text-[var(--danger)]">
                          ↓ #{outP?.shirt_number} {outP?.name}
                        </span>
                        {" · "}
                        <span className="text-[var(--accent)]">
                          ↑ #{inP?.shirt_number} {inP?.name}
                        </span>
                      </span>
                    </li>
                  );
                })}
              </ul>
            </section>
          )}

          <MetricTable
            title="שערים"
            exportId="goals"
            onExport={exportOne}
            headers={["שערים"]}
            rows={playerStats}
            sortKey={(r) => r.goals}
            cells={(r) => [r.goals]}
            onPlayer={setCardPlayerId}
            accentCol={0}
          />
          <MetricTable
            title="בישולים"
            exportId="assists"
            onExport={exportOne}
            headers={["בישולים"]}
            rows={playerStats}
            sortKey={(r) => r.assists}
            cells={(r) => [r.assists]}
            onPlayer={setCardPlayerId}
            infoCol={0}
          />
          <MetricTable
            title="איבודי כדור"
            exportId="losses"
            onExport={exportOne}
            headers={["הגנה", "אמצע", "התקפה", "סה״כ"]}
            rows={playerStats}
            sortKey={(r) => r.lossesTotal}
            cells={(r) => [r.losses.def, r.losses.mid, r.losses.att, r.lossesTotal]}
            onPlayer={setCardPlayerId}
            dangerCol={0}
            boldLast
          />
          <MetricTable
            title="חילוצים"
            exportId="tackles"
            onExport={exportOne}
            headers={["הגנה", "אמצע", "התקפה", "סה״כ"]}
            rows={playerStats}
            sortKey={(r) => r.tacklesTotal}
            cells={(r) => [r.tackles.def, r.tackles.mid, r.tackles.att, r.tacklesTotal]}
            onPlayer={setCardPlayerId}
            accentCol={2}
            boldLast
          />
          <MetricTable
            title="מסירות מפתח"
            exportId="key_passes"
            onExport={exportOne}
            headers={["הגנה", "אמצע", "התקפה", "סה״כ"]}
            rows={playerStats}
            sortKey={(r) => r.keyPassesTotal}
            cells={(r) => [r.keyPasses.def, r.keyPasses.mid, r.keyPasses.att, r.keyPassesTotal]}
            onPlayer={setCardPlayerId}
            infoCol={3}
            boldLast
          />
          <MetricTable
            title="איומים לשער"
            exportId="shots"
            onExport={exportOne}
            headers={["ברחבה", "מחוץ", "סה״כ"]}
            rows={playerStats}
            sortKey={(r) => r.shotsTotal}
            cells={(r) => [r.shotsInBox, r.shotsOutBox, r.shotsTotal]}
            onPlayer={setCardPlayerId}
            accentCol={0}
            boldLast
          />
          <MetricTable
            title="xG / xA"
            exportId="shots"
            onExport={exportOne}
            headers={["xG", "xA", "שערים", "בישולים"]}
            rows={playerStats}
            sortKey={(r) => r.xg}
            cells={(r) => [roundMetric(r.xg), roundMetric(r.xa), r.goals, r.assists]}
            onPlayer={setCardPlayerId}
            accentCol={0}
            infoCol={1}
          />

          <section className="mb-5">
            <h2 className="label mb-2">
              נקודות לחיתוך וידאו — איבודי הגנה ({defensiveLosses.length})
            </h2>
            {defensiveLosses.length === 0 ? (
              <div className="card p-4 text-center text-sm text-[var(--muted)]">אין איבודי הגנה.</div>
            ) : (
              <ul className="flex flex-col gap-1.5">
                {defensiveLosses.map((e) => {
                  const p = players.find((x) => x.id === e.player_id);
                  return (
                    <li
                      key={e.id}
                      className="flex items-center justify-between rounded-2xl border border-red-500/30 bg-red-500/10 px-4 py-2.5 text-sm"
                    >
                      <span className="font-bold tabular">
                        מחצית {e.half} · דקה {e.match_minute}׳
                      </span>
                      <button
                        onClick={() => e.player_id && setCardPlayerId(e.player_id)}
                        className="font-bold"
                      >
                        {p ? `#${p.shirt_number} ${p.name}` : "—"}
                      </button>
                    </li>
                  );
                })}
              </ul>
            )}
          </section>

          {/* הערת משחק */}
          <section className="card mb-5 p-4">
            <p className="label mb-2">הערת משחק</p>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="מזג אוויר, מגרש, שיפוט, דגשים למאמן..."
              rows={3}
              className="field w-full resize-none"
            />
            <button
              onClick={saveNotes}
              disabled={notesSaving}
              className="btn btn-ghost mt-2 w-full py-2.5 text-sm"
            >
              {notesSaving ? "שומר..." : "שמור הערה"}
            </button>
          </section>
        </>
      )}

      {selectedStats && (
        <PlayerCardSheet
          stats={selectedStats}
          events={events}
          onClose={() => setCardPlayerId(undefined)}
        />
      )}
    </main>
  );
}

function MetricTable({
  title,
  exportId,
  onExport,
  headers,
  rows,
  sortKey,
  cells,
  cellLabels,
  onPlayer,
  dangerCol,
  accentCol,
  infoCol,
  boldLast,
  showMinutes = true,
}: {
  title: string;
  exportId: ExportTableId;
  onExport: (id: ExportTableId) => void;
  headers: string[];
  rows: PlayerMatchStats[];
  sortKey: (r: PlayerMatchStats) => number;
  cells: (r: PlayerMatchStats) => number[];
  cellLabels?: (r: PlayerMatchStats) => (string | number)[];
  onPlayer: (id: string | null) => void;
  dangerCol?: number;
  accentCol?: number;
  infoCol?: number;
  boldLast?: boolean;
  showMinutes?: boolean;
}) {
  const [col, setCol] = useState<number | null>(null);
  const [dir, setDir] = useState<"desc" | "asc">("desc");

  const sorted = useMemo(() => {
    const list = rows.filter((r) => r.playerId !== null);
    return [...list].sort((a, b) => {
      const av = col == null ? sortKey(a) : (cells(a)[col] ?? 0);
      const bv = col == null ? sortKey(b) : (cells(b)[col] ?? 0);
      const cmp = Number(av) - Number(bv);
      if (cmp !== 0) return dir === "desc" ? -cmp : cmp;
      return (a.shirtNumber ?? 999) - (b.shirtNumber ?? 999);
    });
  }, [rows, sortKey, cells, col, dir]);

  return (
    <section className="mb-4">
      <div className="mb-2 flex items-center justify-between gap-2">
        <h2 className="label">{title}</h2>
        <button onClick={() => onExport(exportId)} className="btn btn-ghost h-8 px-3 text-xs">
          ⬇ ייצוא טבלה
        </button>
      </div>
      <div className="card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full border-collapse text-center text-sm">
            <thead>
              <tr className="border-b border-[var(--border)] bg-[var(--panel-strong)] text-[11px] text-[var(--muted)]">
                <th className="px-3 py-2 text-right font-bold">שחקן</th>
                {headers.map((h, i) => (
                  <th key={h} className="px-2 py-2 font-bold">
                    <button
                      type="button"
                      onClick={() => {
                        if (col === i) setDir((d) => (d === "desc" ? "asc" : "desc"));
                        else {
                          setCol(i);
                          setDir("desc");
                        }
                      }}
                    >
                      {h}
                      {col === i ? (dir === "desc" ? " ↓" : " ↑") : ""}
                    </button>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {sorted.map((row) => {
                const vals = cellLabels ? cellLabels(row) : cells(row);
                return (
                  <tr key={row.playerId!} className="border-b border-[var(--border)]/50 odd:bg-white/[0.02]">
                    <td className="px-3 py-2.5 text-right">
                      <button onClick={() => onPlayer(row.playerId)} className="text-right font-bold">
                        <span className="tabular text-[var(--muted)]">#{row.shirtNumber}</span>{" "}
                        <span className="underline decoration-[var(--border-strong)] underline-offset-2">
                          {row.name}
                        </span>
                        {showMinutes && (
                          <span className="mt-0.5 block text-[10px] font-semibold text-[var(--muted-2)]">
                            {row.minutesLabel || `${row.minutesPlayed}׳`}
                          </span>
                        )}
                      </button>
                    </td>
                    {vals.map((v, i) => {
                      const isLast = boldLast && i === vals.length - 1;
                      const num = typeof v === "number" ? v : Number(v);
                      const color =
                        typeof v !== "number"
                          ? "text-[var(--muted)]"
                          : v === 0
                            ? "text-[var(--muted-2)]"
                            : i === dangerCol
                              ? "text-[var(--danger)]"
                              : i === accentCol
                                ? "text-[var(--accent)]"
                                : i === infoCol
                                  ? "text-[var(--info)]"
                                  : "";
                      return (
                        <td
                          key={i}
                          className={`tabular px-2 py-2.5 ${isLast ? "font-black" : "font-semibold"} ${color}`}
                        >
                          {v}
                          {typeof v === "number" && title === "דקות משחק" && i === 0 ? "׳" : ""}
                        </td>
                      );
                    })}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </section>
  );
}

function HeatCard({
  title,
  data,
  pct,
  tone,
}: {
  title: string;
  data: Record<"def" | "mid" | "att", number>;
  pct: Record<"def" | "mid" | "att", number>;
  tone: "danger" | "accent";
}) {
  return (
    <div className="card p-3">
      <h3 className="label mb-2">{title}</h3>
      <div className="flex h-3 overflow-hidden rounded-full bg-[var(--panel-strong)]">
        {(["def", "mid", "att"] as const).map((z) => (
          <div
            key={z}
            style={{ width: `${pct[z]}%` }}
            className={
              z === "def"
                ? tone === "danger"
                  ? "bg-[var(--danger)]"
                  : "bg-red-400/70"
                : z === "mid"
                  ? "bg-[var(--muted-2)]"
                  : tone === "accent"
                    ? "bg-[var(--accent)]"
                    : "bg-emerald-400/70"
            }
            title={`${ZONE_LABELS[z]}: ${data[z]}`}
          />
        ))}
      </div>
      <div className="mt-2 grid grid-cols-3 gap-1 text-center text-xs">
        {(["def", "mid", "att"] as const).map((z) => (
          <div key={z}>
            <div className="tabular font-black">{data[z]}</div>
            <div className="text-[var(--muted-2)]">
              {ZONE_LABELS[z]} · {pct[z]}%
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function StatCard({
  value,
  label,
  tone,
}: {
  value: number | string;
  label: string;
  tone?: "accent" | "info";
}) {
  const color =
    tone === "accent" ? "text-[var(--accent)]" : tone === "info" ? "text-[var(--info)]" : "";
  return (
    <div className="card p-3 text-center">
      <div className={`tabular text-2xl font-black ${color}`}>{value}</div>
      <div className="mt-0.5 text-xs text-[var(--muted)]">{label}</div>
    </div>
  );
}
