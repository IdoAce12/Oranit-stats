"use client";

import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { getEvents, getMatch, getPlayers, reopenMatch } from "@/lib/db";
import { downloadCsv, matchReportToCsv } from "@/lib/exportCsv";
import { computePlayerMatchStats, computeTeamTotals, PlayerMatchStats } from "@/lib/playerStats";
import { isSupabaseConfigured } from "@/lib/supabaseClient";
import { MatchEvent, Match, Player, ZONE_LABELS } from "@/lib/types";
import { AppHeader } from "../../components/AppHeader";
import { LiveClockBadge } from "./LiveClockBadge";
import { PlayerCardSheet } from "./PlayerCardSheet";

export default function ReportPage() {
  const params = useParams<{ matchId: string }>();
  const router = useRouter();
  const matchId = params.matchId;

  const [match, setMatch] = useState<Match | null>(null);
  const [players, setPlayers] = useState<Player[]>([]);
  const [events, setEvents] = useState<MatchEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [reopening, setReopening] = useState(false);
  const [cardPlayerId, setCardPlayerId] = useState<string | null | undefined>(undefined);

  useEffect(() => {
    if (!matchId) return;
    if (!isSupabaseConfigured) {
      setLoading(false);
      setError("Supabase לא מחובר. אי אפשר לטעון את הדוח.");
      return;
    }
    (async () => {
      try {
        const [m, ps, evs] = await Promise.all([
          getMatch(matchId),
          getPlayers(matchId),
          getEvents(matchId),
        ]);
        setMatch(m);
        setPlayers(ps);
        setEvents(evs);
      } catch (e) {
        setError(e instanceof Error ? e.message : "שגיאה בטעינה");
      } finally {
        setLoading(false);
      }
    })();
  }, [matchId]);

  const playerStats = useMemo(
    () => computePlayerMatchStats(events, players),
    [events, players]
  );
  const team = useMemo(() => computeTeamTotals(events), [events]);

  const selectedStats = useMemo(() => {
    if (cardPlayerId === undefined) return null;
    if (cardPlayerId === null) {
      return playerStats.find((p) => p.playerId === null) ?? null;
    }
    return playerStats.find((p) => p.playerId === cardPlayerId) ?? null;
  }, [cardPlayerId, playerStats]);

  const defensiveLosses = useMemo(
    () =>
      events
        .filter((e) => e.action_type === "ball_loss" && e.zone === "def")
        .sort((a, b) => a.half - b.half || a.match_minute - b.match_minute),
    [events]
  );

  const playerLabel = (id: string | null) => {
    if (!id) return "—";
    const p = players.find((x) => x.id === id);
    return p ? `#${p.shirt_number} ${p.name}` : "?";
  };

  const openPlayer = (playerId: string | null) => setCardPlayerId(playerId);

  const handleExport = () => {
    const csv = matchReportToCsv(events, players, {
      opponent: match?.opponent,
      matchDate: match?.match_date,
    });
    downloadCsv(`scout_${match?.opponent ?? ""}_${match?.match_date ?? "match"}.csv`, csv);
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

  if (loading) return <main className="p-8 text-center text-[var(--muted)]">טוען דוח...</main>;

  if (error) {
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
          isLive ? (
            <Link href={`/live/${matchId}`} className="text-xs font-bold text-[var(--info)]">
              חזרה ללייב
            </Link>
          ) : undefined
        }
      />

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
          <section className="mb-4 grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-6">
            <StatCard value={team.goals} label="שערים" tone="accent" />
            <StatCard value={team.assists} label="בישולים" tone="info" />
            <StatCard value={team.keyPasses} label="מסירות מפתח" tone="info" />
            <StatCard value={`${team.shotsInBox}/${team.shotsOutBox}`} label="איומים רחבה/חוץ" />
            <StatCard value={`${team.cornersFor}:${team.cornersAgainst}`} label="קרנות (לנו:להם)" />
            <StatCard value={team.eventsTotal} label="סה״כ אירועים" />
          </section>

          {/* בחירת שחקן מהירה לכרטיס */}
          <section className="mb-5">
            <div className="mb-2 flex items-end justify-between gap-2">
              <div>
                <h2 className="label">כרטיסי שחקנים</h2>
                <p className="text-[11px] text-[var(--muted-2)]">לחיצה פותחת פירוט אישי מלא</p>
              </div>
              <button onClick={handleExport} className="btn btn-primary h-9 shrink-0 px-4 text-sm">
                ⬇ ייצוא לאקסל
              </button>
            </div>
            <div className="grid grid-cols-3 gap-2 sm:grid-cols-4">
              {playerStats
                .filter((p) => p.playerId !== null)
                .map((p) => (
                  <button
                    key={p.playerId!}
                    onClick={() => openPlayer(p.playerId)}
                    className="card flex flex-col items-center py-3 active:scale-95"
                  >
                    <span className="text-xl font-black tabular">{p.shirtNumber}</span>
                    <span className="mt-0.5 max-w-full truncate px-1 text-[11px] text-[var(--muted)]">
                      {p.name}
                    </span>
                    {(p.goals > 0 || p.assists > 0) && (
                      <span className="mt-1 text-[10px] font-bold text-[var(--accent)]">
                        {p.goals > 0 ? `${p.goals}ש׳` : ""}
                        {p.goals > 0 && p.assists > 0 ? " · " : ""}
                        {p.assists > 0 ? `${p.assists}ב׳` : ""}
                      </span>
                    )}
                  </button>
                ))}
            </div>
          </section>

          <MetricTable
            title="שערים"
            headers={["שערים"]}
            rows={playerStats}
            sortKey={(r) => r.goals}
            cells={(r) => [r.goals]}
            onPlayer={openPlayer}
            accentCol={0}
          />

          <MetricTable
            title="בישולים"
            headers={["בישולים"]}
            rows={playerStats}
            sortKey={(r) => r.assists}
            cells={(r) => [r.assists]}
            onPlayer={openPlayer}
            infoCol={0}
          />

          <MetricTable
            title="איבודי כדור"
            headers={["הגנה", "אמצע", "התקפה", "סה״כ"]}
            rows={playerStats}
            sortKey={(r) => r.lossesTotal}
            cells={(r) => [r.losses.def, r.losses.mid, r.losses.att, r.lossesTotal]}
            onPlayer={openPlayer}
            dangerCol={0}
            boldLast
          />

          <MetricTable
            title="חילוצים"
            headers={["הגנה", "אמצע", "התקפה", "סה״כ"]}
            rows={playerStats}
            sortKey={(r) => r.tacklesTotal}
            cells={(r) => [r.tackles.def, r.tackles.mid, r.tackles.att, r.tacklesTotal]}
            onPlayer={openPlayer}
            accentCol={2}
            boldLast
          />

          <MetricTable
            title="מסירות מפתח"
            headers={["הגנה", "אמצע", "התקפה", "סה״כ"]}
            rows={playerStats}
            sortKey={(r) => r.keyPassesTotal}
            cells={(r) => [r.keyPasses.def, r.keyPasses.mid, r.keyPasses.att, r.keyPassesTotal]}
            onPlayer={openPlayer}
            infoCol={3}
            boldLast
          />

          <MetricTable
            title="איומים לשער"
            headers={["ברחבה", "מחוץ", "סה״כ"]}
            rows={playerStats}
            sortKey={(r) => r.shotsTotal}
            cells={(r) => [r.shotsInBox, r.shotsOutBox, r.shotsTotal]}
            onPlayer={openPlayer}
            accentCol={0}
            boldLast
          />

          <section className="mb-5 grid grid-cols-1 gap-3 sm:grid-cols-2">
            <ZoneCard title="איבודי כדור (קבוצה)" data={team.losses} highlight="def" tone="danger" />
            <ZoneCard title="חילוצים (קבוצה)" data={team.tackles} highlight="att" tone="accent" />
          </section>

          <section className="mb-5">
            <h2 className="label mb-2">
              נקודות לחיתוך וידאו — איבודים בשליש הגנתי ({defensiveLosses.length})
            </h2>
            {defensiveLosses.length === 0 ? (
              <div className="card p-4 text-center text-sm text-[var(--muted)]">
                אין איבודים בשליש ההגנתי.
              </div>
            ) : (
              <ul className="flex flex-col gap-1.5">
                {defensiveLosses.map((e) => (
                  <li
                    key={e.id}
                    className="flex items-center justify-between rounded-2xl border border-red-500/30 bg-red-500/10 px-4 py-2.5 text-sm"
                  >
                    <span className="font-bold tabular">
                      מחצית {e.half} · דקה {e.match_minute}׳
                    </span>
                    <button
                      onClick={() => e.player_id && openPlayer(e.player_id)}
                      className="font-bold text-[var(--text)] underline-offset-2 active:opacity-70"
                    >
                      {playerLabel(e.player_id)}
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </section>

          <button onClick={handleExport} className="btn btn-primary w-full py-3.5">
            ⬇ ייצוא לאקסל (טבלאות נפרדות + לוג)
          </button>
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
  headers,
  rows,
  sortKey,
  cells,
  onPlayer,
  dangerCol,
  accentCol,
  infoCol,
  boldLast,
}: {
  title: string;
  headers: string[];
  rows: PlayerMatchStats[];
  sortKey: (r: PlayerMatchStats) => number;
  cells: (r: PlayerMatchStats) => number[];
  onPlayer: (id: string | null) => void;
  dangerCol?: number;
  accentCol?: number;
  infoCol?: number;
  boldLast?: boolean;
}) {
  const sorted = [...rows]
    .filter((r) => r.playerId !== null)
    .sort((a, b) => sortKey(b) - sortKey(a) || (a.shirtNumber ?? 999) - (b.shirtNumber ?? 999));

  return (
    <section className="mb-4">
      <h2 className="label mb-2">{title}</h2>
      <div className="card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full border-collapse text-center text-sm">
            <thead>
              <tr className="border-b border-[var(--border)] bg-[var(--panel-strong)] text-[11px] text-[var(--muted)]">
                <th className="px-3 py-2 text-right font-bold">שחקן</th>
                {headers.map((h) => (
                  <th key={h} className="px-2 py-2 font-bold">
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {sorted.map((row) => {
                const vals = cells(row);
                return (
                  <tr
                    key={row.playerId ?? row.name}
                    className="border-b border-[var(--border)]/50 odd:bg-white/[0.02]"
                  >
                    <td className="px-3 py-2.5 text-right">
                      <button
                        onClick={() => onPlayer(row.playerId)}
                        className="font-bold active:opacity-70"
                      >
                        <span className="tabular text-[var(--muted)]">#{row.shirtNumber}</span>{" "}
                        <span className="underline decoration-[var(--border-strong)] underline-offset-2">
                          {row.name}
                        </span>
                      </button>
                    </td>
                    {vals.map((v, i) => {
                      const isLast = boldLast && i === vals.length - 1;
                      const color =
                        v === 0
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

function ZoneCard({
  title,
  data,
  highlight,
  tone,
}: {
  title: string;
  data: Record<"def" | "mid" | "att", number>;
  highlight: "def" | "mid" | "att";
  tone: "danger" | "accent";
}) {
  return (
    <div className="card p-3">
      <h3 className="label mb-2">{title}</h3>
      <div className="grid grid-cols-3 gap-1 text-center">
        {(["def", "mid", "att"] as const).map((z) => (
          <div key={z} className="rounded-xl bg-[var(--panel-strong)] py-3">
            <div
              className={`tabular text-2xl font-black ${
                z === highlight
                  ? tone === "danger"
                    ? "text-[var(--danger)]"
                    : "text-[var(--accent)]"
                  : ""
              }`}
            >
              {data[z]}
            </div>
            <div className="text-xs text-[var(--muted)]">{ZONE_LABELS[z]}</div>
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
