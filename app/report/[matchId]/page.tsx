"use client";

import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { getEvents, getMatch, getPlayers, reopenMatch } from "@/lib/db";
import { downloadCsv, eventsToCsv } from "@/lib/exportCsv";
import { computeImpact } from "@/lib/impactScore";
import { isSupabaseConfigured } from "@/lib/supabaseClient";
import { MatchEvent, Match, Player, Zone, ZONE_LABELS } from "@/lib/types";
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

  const impact = useMemo(() => computeImpact(events, players), [events, players]);
  const maxAbs = useMemo(
    () => Math.max(1, ...impact.map((r) => Math.abs(r.score))),
    [impact]
  );

  const stats = useMemo(() => {
    const losses: Record<Zone, number> = { def: 0, mid: 0, att: 0 };
    const tackles: Record<Zone, number> = { def: 0, mid: 0, att: 0 };
    let inBox = 0;
    let outBox = 0;
    let keyPasses = 0;
    let cornersFor = 0;
    let cornersAgainst = 0;
    for (const e of events) {
      if (e.action_type === "ball_loss" && e.zone) losses[e.zone] += 1;
      if (e.action_type === "tackle" && e.zone) tackles[e.zone] += 1;
      if (e.action_type === "shot") e.shot_location === "in_box" ? inBox++ : outBox++;
      if (e.action_type === "key_pass") keyPasses++;
      if (e.action_type === "corner_for") cornersFor++;
      if (e.action_type === "corner_against") cornersAgainst++;
    }
    return { losses, tackles, inBox, outBox, keyPasses, cornersFor, cornersAgainst };
  }, [events]);

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
    const csv = eventsToCsv(events, players);
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

  return (
    <main className="mx-auto flex w-full max-w-2xl flex-1 flex-col px-4 pt-6 pb-10">
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
            className="btn btn-ghost mt-2 w-full py-2.5 text-sm"
          >
            {reopening ? "פותח..." : "טעות? פתח מחדש ללייב"}
          </button>
        </div>
      )}

      {events.length === 0 && (
        <div className="card p-6 text-center text-[var(--muted)]">עדיין אין אירועים למשחק הזה.</div>
      )}

      {events.length > 0 && (
        <>
          {/* מדד השפעה */}
          <section className="mb-5">
            <h2 className="label mb-2">מדד השפעה — Impact Score</h2>
            <div className="card divide-y divide-[var(--border)] overflow-hidden">
              {impact.map((row, i) => (
                <div key={row.playerId ?? "none"} className="flex items-center gap-3 p-3">
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
                        className={`h-full rounded-full ${row.score >= 0 ? "bg-[var(--accent)]" : "bg-[var(--danger)]"}`}
                        style={{ width: `${(Math.abs(row.score) / maxAbs) * 100}%` }}
                      />
                    </div>
                    <p className="mt-1 text-[11px] text-[var(--muted-2)]">
                      {row.keyPasses} מס״מ · {row.counts.tackle} חילוצים · {row.lossesByZone.def} איבודי הגנה · {row.shotsInBox} ברחבה
                    </p>
                  </div>
                  <span
                    className={`tabular text-2xl font-black ${
                      row.score > 0 ? "text-[var(--accent)]" : row.score < 0 ? "text-[var(--danger)]" : "text-[var(--muted)]"
                    }`}
                  >
                    {row.score > 0 ? "+" : ""}
                    {row.score.toFixed(1)}
                  </span>
                </div>
              ))}
            </div>
          </section>

          {/* פירוק אזורים */}
          <section className="mb-5 grid grid-cols-2 gap-3">
            <ZoneCard title="איבודי כדור" data={stats.losses} highlight="def" tone="danger" />
            <ZoneCard title="חילוצים" data={stats.tackles} highlight="att" tone="accent" />
          </section>

          {/* איכות מצבים + קרנות */}
          <section className="mb-5 grid grid-cols-2 gap-3 sm:grid-cols-4">
            <StatCard value={stats.inBox} label="איום מהרחבה" tone="accent" />
            <StatCard value={stats.outBox} label="איום מבחוץ" />
            <StatCard value={stats.keyPasses} label="מסירות מפתח" tone="info" />
            <StatCard value={`${stats.cornersFor}:${stats.cornersAgainst}`} label="קרנות (לנו:להם)" />
          </section>

          {/* חיתוך וידאו */}
          <section className="mb-5">
            <h2 className="label mb-2">
              נקודות לחיתוך וידאו — איבודים בשליש הגנתי ({defensiveLosses.length})
            </h2>
            {defensiveLosses.length === 0 ? (
              <div className="card p-4 text-center text-sm text-[var(--muted)]">
                אין איבודים בשליש ההגנתי. מצוין.
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

          <button onClick={handleExport} className="btn btn-ghost w-full py-3.5">
            ⬇ ייצוא CSV
          </button>
        </>
      )}
    </main>
  );
}

function ZoneCard({
  title,
  data,
  highlight,
  tone,
}: {
  title: string;
  data: Record<Zone, number>;
  highlight: Zone;
  tone: "danger" | "accent";
}) {
  return (
    <div className="card p-3">
      <h3 className="label mb-2">{title} לפי אזור</h3>
      <div className="grid grid-cols-3 gap-1 text-center">
        {(["def", "mid", "att"] as Zone[]).map((z) => (
          <div key={z} className="rounded-xl bg-[var(--panel-strong)] py-3">
            <div
              className={`tabular text-2xl font-black ${
                z === highlight ? (tone === "danger" ? "text-[var(--danger)]" : "text-[var(--accent)]") : ""
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
  const color = tone === "accent" ? "text-[var(--accent)]" : tone === "info" ? "text-[var(--info)]" : "";
  return (
    <div className="card p-3 text-center">
      <div className={`tabular text-2xl font-black ${color}`}>{value}</div>
      <div className="mt-0.5 text-xs text-[var(--muted)]">{label}</div>
    </div>
  );
}
