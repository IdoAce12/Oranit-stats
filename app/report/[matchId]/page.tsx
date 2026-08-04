"use client";

import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { getEvents, getMatch, getPlayers, reopenMatch } from "@/lib/db";
import { downloadCsv, matchReportToCsv } from "@/lib/exportCsv";
import { computePlayerMatchStats, computeTeamTotals } from "@/lib/playerStats";
import { isSupabaseConfigured } from "@/lib/supabaseClient";
import { MatchEvent, Match, Player, ZONE_LABELS } from "@/lib/types";
import { AppHeader } from "../../components/AppHeader";
import { LiveClockBadge } from "./LiveClockBadge";

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
    <main className="mx-auto flex w-full max-w-6xl flex-1 flex-col px-4 pt-6 pb-10">
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
          {/* סיכום קבוצתי קצר */}
          <section className="mb-4 grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-6">
            <StatCard value={team.goals} label="שערים" tone="accent" />
            <StatCard value={team.assists} label="בישולים" tone="info" />
            <StatCard value={team.keyPasses} label="מסירות מפתח" tone="info" />
            <StatCard
              value={`${team.shotsInBox}/${team.shotsOutBox}`}
              label="איומים רחבה/חוץ"
            />
            <StatCard value={`${team.cornersFor}:${team.cornersAgainst}`} label="קרנות (לנו:להם)" />
            <StatCard value={team.eventsTotal} label="סה״כ אירועים" />
          </section>

          {/* טבלת נתונים מקיפה — העיקר */}
          <section className="mb-5">
            <div className="mb-2 flex items-end justify-between gap-2">
              <div>
                <h2 className="label">טבלת נתונים מקיפה</h2>
                <p className="text-[11px] text-[var(--muted-2)]">
                  כל הפעולות לפי שחקן ואזור · גלול הצידה במובייל
                </p>
              </div>
              <button onClick={handleExport} className="btn btn-primary h-9 shrink-0 px-4 text-sm">
                ⬇ ייצוא לאקסל
              </button>
            </div>

            <div className="card overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full min-w-[980px] border-collapse text-center text-xs">
                  <thead>
                    <tr className="border-b border-[var(--border)] bg-[var(--panel-strong)] text-[10px] text-[var(--muted)]">
                      <th className="sticky right-0 bg-[var(--panel-strong)] px-2 py-2 text-right font-bold" rowSpan={2}>
                        שחקן
                      </th>
                      <th className="px-1 py-1 font-bold text-violet-300" rowSpan={2}>
                        שערים
                      </th>
                      <th className="px-1 py-1 font-bold text-cyan-300" rowSpan={2}>
                        בישולים
                      </th>
                      <th className="px-1 py-1 font-bold text-[var(--danger)]" colSpan={4}>
                        איבודי כדור
                      </th>
                      <th className="px-1 py-1 font-bold text-[var(--accent)]" colSpan={4}>
                        חילוצים
                      </th>
                      <th className="px-1 py-1 font-bold text-[var(--info)]" colSpan={4}>
                        מסירות מפתח
                      </th>
                      <th className="px-1 py-1 font-bold text-amber-300" colSpan={3}>
                        איומים
                      </th>
                      <th className="px-2 py-1 font-bold" rowSpan={2}>
                        סה״כ
                      </th>
                    </tr>
                    <tr className="border-b border-[var(--border)] bg-[var(--panel-strong)] text-[10px] text-[var(--muted-2)]">
                      {(["הג׳", "אמ׳", "הת׳", "Σ"] as const).map((h) => (
                        <th key={`l-${h}`} className="px-1 py-1.5 font-semibold">
                          {h}
                        </th>
                      ))}
                      {(["הג׳", "אמ׳", "הת׳", "Σ"] as const).map((h) => (
                        <th key={`t-${h}`} className="px-1 py-1.5 font-semibold">
                          {h}
                        </th>
                      ))}
                      {(["הג׳", "אמ׳", "הת׳", "Σ"] as const).map((h) => (
                        <th key={`k-${h}`} className="px-1 py-1.5 font-semibold">
                          {h}
                        </th>
                      ))}
                      <th className="px-1 py-1.5 font-semibold">רחבה</th>
                      <th className="px-1 py-1.5 font-semibold">חוץ</th>
                      <th className="px-1 py-1.5 font-semibold">Σ</th>
                    </tr>
                  </thead>
                  <tbody>
                    {playerStats.map((row) => (
                      <tr
                        key={row.playerId ?? "none"}
                        className="border-b border-[var(--border)]/60 odd:bg-white/[0.02]"
                      >
                        <td className="sticky right-0 bg-[var(--bg)] px-2 py-2 text-right font-bold whitespace-nowrap">
                          <span className="tabular text-[var(--muted)]">
                            {row.shirtNumber != null ? `#${row.shirtNumber}` : "—"}
                          </span>{" "}
                          {row.name}
                        </td>
                        <Num cell={row.goals} bold accent />
                        <Num cell={row.assists} bold info />
                        <Num cell={row.losses.def} danger />
                        <Num cell={row.losses.mid} />
                        <Num cell={row.losses.att} />
                        <Num cell={row.lossesTotal} bold />
                        <Num cell={row.tackles.def} />
                        <Num cell={row.tackles.mid} />
                        <Num cell={row.tackles.att} accent />
                        <Num cell={row.tacklesTotal} bold />
                        <Num cell={row.keyPasses.def} />
                        <Num cell={row.keyPasses.mid} />
                        <Num cell={row.keyPasses.att} />
                        <Num cell={row.keyPassesTotal} bold info />
                        <Num cell={row.shotsInBox} accent />
                        <Num cell={row.shotsOutBox} />
                        <Num cell={row.shotsTotal} bold />
                        <Num cell={row.actionsTotal} bold />
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <p className="border-t border-[var(--border)] px-3 py-2 text-[10px] text-[var(--muted-2)]">
                הג׳ = {ZONE_LABELS.def} · אמ׳ = {ZONE_LABELS.mid} · הת׳ = {ZONE_LABELS.att} · Σ = סה״כ
              </p>
            </div>
          </section>

          {/* פירוק אזורים קבוצתי */}
          <section className="mb-5 grid grid-cols-1 gap-3 sm:grid-cols-2">
            <ZoneCard title="איבודי כדור (קבוצה)" data={team.losses} highlight="def" tone="danger" />
            <ZoneCard title="חילוצים (קבוצה)" data={team.tackles} highlight="att" tone="accent" />
          </section>

          {/* חיתוך וידאו */}
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
                    <span className="text-[var(--muted)]">{playerLabel(e.player_id)}</span>
                  </li>
                ))}
              </ul>
            )}
          </section>

          <button onClick={handleExport} className="btn btn-primary w-full py-3.5">
            ⬇ ייצוא מלא לאקסל (טבלת שחקנים + לוג אירועים)
          </button>
        </>
      )}
    </main>
  );
}

function Num({
  cell,
  bold,
  danger,
  accent,
  info,
}: {
  cell: number;
  bold?: boolean;
  danger?: boolean;
  accent?: boolean;
  info?: boolean;
}) {
  const color =
    cell === 0
      ? "text-[var(--muted-2)]"
      : danger
        ? "text-[var(--danger)]"
        : accent
          ? "text-[var(--accent)]"
          : info
            ? "text-[var(--info)]"
            : "";
  return (
    <td className={`tabular px-1 py-2 ${bold ? "font-black" : "font-semibold"} ${color}`}>
      {cell}
    </td>
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
