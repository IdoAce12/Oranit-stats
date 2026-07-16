"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { getEvents, getMatch, getPlayers } from "@/lib/db";
import { downloadCsv, eventsToCsv } from "@/lib/exportCsv";
import { computeImpact } from "@/lib/impactScore";
import { isSupabaseConfigured } from "@/lib/supabaseClient";
import { MatchEvent, Match, Player, Zone, ZONE_LABELS } from "@/lib/types";

export default function ReportPage() {
  const params = useParams<{ matchId: string }>();
  const matchId = params.matchId;

  const [match, setMatch] = useState<Match | null>(null);
  const [players, setPlayers] = useState<Player[]>([]);
  const [events, setEvents] = useState<MatchEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

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

  const teamZones = useMemo(() => {
    const losses: Record<Zone, number> = { def: 0, mid: 0, att: 0 };
    const tackles: Record<Zone, number> = { def: 0, mid: 0, att: 0 };
    let inBox = 0;
    let outBox = 0;
    let keyPasses = 0;
    for (const e of events) {
      if (e.action_type === "ball_loss" && e.zone) losses[e.zone] += 1;
      if (e.action_type === "tackle" && e.zone) tackles[e.zone] += 1;
      if (e.action_type === "shot") e.shot_location === "in_box" ? inBox++ : outBox++;
      if (e.action_type === "key_pass") keyPasses++;
    }
    return { losses, tackles, inBox, outBox, keyPasses };
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
    const dateStr = match?.match_date ?? "match";
    downloadCsv(`scout_${match?.opponent ?? ""}_${dateStr}.csv`, csv);
  };

  if (loading) return <main className="p-6 text-center text-white/60">טוען דוח...</main>;

  if (error) {
    return (
      <main className="mx-auto flex w-full max-w-md flex-1 flex-col px-4 pt-6">
        <p className="rounded-xl border border-red-500/40 bg-red-500/10 p-4 text-red-200">{error}</p>
        <Link href="/" className="mt-4 text-center text-white/60">
          ← חזרה לבית
        </Link>
      </main>
    );
  }

  return (
    <main className="mx-auto flex w-full max-w-2xl flex-1 flex-col px-4 pt-4 pb-10">
      <header className="mb-4 flex items-center justify-between">
        <Link href="/" className="text-sm text-white/60">
          ← בית
        </Link>
        <div className="text-center">
          <h1 className="text-lg font-bold">דוח מול {match?.opponent}</h1>
          {match && (
            <p className="text-xs text-white/50">
              {new Date(match.match_date).toLocaleDateString("he-IL")}
            </p>
          )}
        </div>
        <Link href={`/live/${matchId}`} className="text-sm font-semibold text-blue-400">
          לייב ←
        </Link>
      </header>

      {events.length === 0 && (
        <p className="rounded-xl border border-white/10 bg-white/5 p-4 text-center text-white/50">
          עדיין אין אירועים למשחק הזה.
        </p>
      )}

      {/* מדד השפעה */}
      <section className="mb-5">
        <h2 className="mb-2 text-sm font-semibold text-white/70">מדד השפעה (Impact Score)</h2>
        <div className="overflow-hidden rounded-2xl border border-white/10">
          <table className="w-full text-sm">
            <thead className="bg-white/5 text-white/60">
              <tr>
                <th className="p-2 text-right">שחקן</th>
                <th className="p-2">ציון</th>
                <th className="p-2">מס״מ</th>
                <th className="p-2">חילוצים</th>
                <th className="p-2">איבודי הגנה</th>
                <th className="p-2">איום ברחבה</th>
              </tr>
            </thead>
            <tbody>
              {impact.map((row) => (
                <tr key={row.playerId ?? "none"} className="border-t border-white/5">
                  <td className="p-2 text-right font-semibold">{row.label}</td>
                  <td
                    className={`p-2 text-center font-bold tabular-nums ${
                      row.score > 0 ? "text-green-400" : row.score < 0 ? "text-red-400" : "text-white/60"
                    }`}
                  >
                    {row.score.toFixed(1)}
                  </td>
                  <td className="p-2 text-center tabular-nums">{row.keyPasses}</td>
                  <td className="p-2 text-center tabular-nums">{row.counts.tackle}</td>
                  <td className="p-2 text-center tabular-nums text-red-300">{row.lossesByZone.def}</td>
                  <td className="p-2 text-center tabular-nums">{row.shotsInBox}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      {/* פירוק אזורים */}
      <section className="mb-5 grid grid-cols-2 gap-3">
        <div className="rounded-2xl border border-white/10 bg-white/5 p-3">
          <h3 className="mb-2 text-sm font-semibold text-white/70">איבודי כדור לפי אזור</h3>
          <div className="grid grid-cols-3 gap-1 text-center">
            {(["def", "mid", "att"] as Zone[]).map((z) => (
              <div key={z} className="rounded-lg bg-white/5 py-3">
                <div className={`text-2xl font-bold tabular-nums ${z === "def" ? "text-red-400" : ""}`}>
                  {teamZones.losses[z]}
                </div>
                <div className="text-xs text-white/50">{ZONE_LABELS[z]}</div>
              </div>
            ))}
          </div>
        </div>
        <div className="rounded-2xl border border-white/10 bg-white/5 p-3">
          <h3 className="mb-2 text-sm font-semibold text-white/70">חילוצים לפי אזור</h3>
          <div className="grid grid-cols-3 gap-1 text-center">
            {(["def", "mid", "att"] as Zone[]).map((z) => (
              <div key={z} className="rounded-lg bg-white/5 py-3">
                <div className={`text-2xl font-bold tabular-nums ${z === "att" ? "text-green-400" : ""}`}>
                  {teamZones.tackles[z]}
                </div>
                <div className="text-xs text-white/50">{ZONE_LABELS[z]}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* איכות מצבים */}
      <section className="mb-5 grid grid-cols-3 gap-3 text-center">
        <div className="rounded-2xl border border-white/10 bg-white/5 p-3">
          <div className="text-2xl font-bold tabular-nums text-green-400">{teamZones.inBox}</div>
          <div className="text-xs text-white/50">איומים מתוך הרחבה</div>
        </div>
        <div className="rounded-2xl border border-white/10 bg-white/5 p-3">
          <div className="text-2xl font-bold tabular-nums text-white/70">{teamZones.outBox}</div>
          <div className="text-xs text-white/50">איומים מחוץ לרחבה</div>
        </div>
        <div className="rounded-2xl border border-white/10 bg-white/5 p-3">
          <div className="text-2xl font-bold tabular-nums text-blue-400">{teamZones.keyPasses}</div>
          <div className="text-xs text-white/50">מסירות מפתח</div>
        </div>
      </section>

      {/* רשימת חיתוך וידאו */}
      <section className="mb-5">
        <h2 className="mb-2 text-sm font-semibold text-white/70">
          נקודות לחיתוך וידאו — איבודים בשליש הגנתי ({defensiveLosses.length})
        </h2>
        {defensiveLosses.length === 0 ? (
          <p className="rounded-xl border border-white/10 bg-white/5 p-3 text-center text-sm text-white/40">
            אין איבודים בשליש ההגנתי. מצוין.
          </p>
        ) : (
          <ul className="flex flex-col gap-1.5">
            {defensiveLosses.map((e) => (
              <li
                key={e.id}
                className="flex items-center justify-between rounded-xl border border-red-500/30 bg-red-500/10 px-3 py-2 text-sm"
              >
                <span className="font-semibold tabular-nums">
                  מחצית {e.half} · דקה {e.match_minute}׳
                </span>
                <span className="text-white/70">{playerLabel(e.player_id)}</span>
              </li>
            ))}
          </ul>
        )}
      </section>

      <button
        onClick={handleExport}
        disabled={events.length === 0}
        className="rounded-2xl bg-white/10 px-4 py-3.5 text-center font-bold active:scale-[0.98] disabled:opacity-40"
      >
        ⬇ ייצוא CSV
      </button>
    </main>
  );
}
