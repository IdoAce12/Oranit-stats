"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { createMatch, deleteMatch, getPlayers, listMatches, startMatch } from "@/lib/db";
import { requestIfaSync } from "@/lib/ifa/client";
import type { IfaFixture } from "@/lib/ifa/parse";
import { matchKickoff, splitMatches } from "@/lib/fixtures";
import { homeLiveMatch, homeNextMatch, isPendingIfaMatch } from "@/lib/homeNext";
import { isSupabaseConfigured } from "@/lib/supabaseClient";
import { MATCH_STATUS_LABELS, MATCH_TYPE_LABELS, Match } from "@/lib/types";
import { ConfigBanner } from "./components/ConfigBanner";
import { ThemeToggle } from "./components/ThemeToggle";
import { PageSkeleton } from "./components/Skeleton";
import { Countdown } from "./components/Countdown";
import { PhotoCarousel } from "./components/PhotoCarousel";
import { useAuth } from "./components/AuthProvider";
import { useRouter } from "next/navigation";

export default function HomePage() {
  const { user, loading: authLoading, isCoach, displayName, logout } = useAuth();
  const router = useRouter();
  const [matches, setMatches] = useState<Match[]>([]);
  const [fixtures, setFixtures] = useState<IfaFixture[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);

  useEffect(() => {
    if (authLoading || !user) return;
    if (!isSupabaseConfigured) {
      setLoading(false);
      return;
    }
    let cancelled = false;
    setLoading(true);
    const run = async () => {
      try {
        const rows = await listMatches();
        const result = await requestIfaSync(true);
        if (!cancelled && result?.fixtures) setFixtures(result.fixtures);
        const needReload = Boolean(result && ((result.inserted ?? 0) > 0 || (result.updated ?? 0) > 0));
        const nextRows = needReload ? await listMatches() : rows;
        if (!cancelled) setMatches(nextRows);
      } catch (e) {
        if (!cancelled) setError(e instanceof Error ? e.message : "שגיאה בטעינת משחקים");
      } finally {
        if (!cancelled) setLoading(false);
      }
    };
    void run();
    return () => {
      cancelled = true;
    };
  }, [authLoading, user]);

  const next = useMemo(() => homeNextMatch(matches, fixtures), [matches, fixtures]);
  const { scheduled, live, finished } = useMemo(() => splitMatches(matches), [matches]);
  const liveNow = useMemo(() => homeLiveMatch(matches, fixtures), [matches, fixtures]);

  const beginScheduled = async (m: Match) => {
    setBusyId(m.id);
    setError(null);
    try {
      let match = m;
      if (isPendingIfaMatch(m)) {
        match = await createMatch({
          opponent: m.opponent,
          match_date: m.match_date,
          our_team_name: m.our_team_name,
          match_type: m.match_type ?? "league",
          status: "scheduled",
          kickoff_at: m.kickoff_at ?? null,
          ifa_key: m.ifa_key ?? null,
          notes: m.notes,
        });
      }
      const players = await getPlayers(match.id);
      if (players.length === 0) {
        router.push(`/setup?matchId=${match.id}`);
        return;
      }
      await startMatch(match.id);
      router.push(`/live/${match.id}`);
    } catch (e) {
      setError(e instanceof Error ? e.message : "שגיאה");
      setBusyId(null);
    }
  };

  const cancelScheduled = async (m: Match) => {
    if (!confirm(`למחוק את המשחק מול ${m.opponent}?`)) return;
    setBusyId(m.id);
    try {
      await deleteMatch(m.id);
      setMatches((prev) => prev.filter((x) => x.id !== m.id));
      const result = await requestIfaSync(true);
      if (result?.fixtures) setFixtures(result.fixtures);
      if (result && ((result.inserted ?? 0) > 0 || (result.updated ?? 0) > 0)) {
        const rows = await listMatches();
        setMatches(rows);
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "שגיאה במחיקה");
    } finally {
      setBusyId(null);
    }
  };

  if (authLoading || !user) {
    return (
      <main className="mx-auto w-full max-w-md px-4 page-shell">
        <PageSkeleton rows={4} />
      </main>
    );
  }

  const when = next
    ? next.kickoff_at
      ? matchKickoff(next).toLocaleString("he-IL", {
          weekday: "long",
          day: "numeric",
          month: "long",
          hour: "2-digit",
          minute: "2-digit",
        })
      : `${new Date(`${next.match_date}T12:00:00`).toLocaleDateString("he-IL", {
          weekday: "long",
          day: "numeric",
          month: "long",
        })} · שעה טרם נקבעה`
    : null;

  return (
    <main className="home-screen">
      <section className="home-hero">
        <PhotoCarousel />

        <header className="home-top">
        <div className="flex min-w-0 items-center gap-3">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src="/hapoel-oranit.png"
            alt=""
            className="h-11 w-11 rounded-full object-cover shadow-[0_8px_24px_rgba(0,0,0,0.45)] ring-1 ring-white/25"
          />
          <div className="min-w-0">
            <p className="home-kicker">הפועל אורנית</p>
            <h1 className="home-hello truncate">
              {isCoach ? "הספסל" : `שלום, ${displayName}`}
            </h1>
          </div>
        </div>
        <div className="flex items-center gap-1">
          <button type="button" onClick={() => void logout()} className="home-ghost-btn">
            יציאה
          </button>
          <ThemeToggle />
        </div>
      </header>

      <div className="home-bottom">
        <ConfigBanner />
        {error && <p className="mb-3 text-sm text-red-300">{error}</p>}

        {loading ? (
          <PageSkeleton rows={3} />
        ) : liveNow ? (
          <section className="match-glass">
            <p className="home-kicker text-[var(--accent)]">עכשיו בלייב</p>
            <h2 className="match-title">מול {liveNow.opponent}</h2>
            {isCoach ? (
              <Link href={`/live/${liveNow.id}`} className="btn btn-primary mt-4 w-full py-3.5 text-base">
                כניסה למשחק
              </Link>
            ) : (
              <p className="mt-2 text-sm text-white/65">המשחק רץ אצל המאמן</p>
            )}
          </section>
        ) : next ? (
          <section className="match-glass">
            <div className="mb-3 flex items-end justify-between gap-3">
              <div>
                <p className="home-kicker">המשחק הבא</p>
                <h2 className="match-title">מול {next.opponent}</h2>
                <p className="mt-1 text-[13px] text-white/70">{when}</p>
                {next.notes?.trim() ? (
                  <p className="mt-0.5 text-[13px] text-white/70">{next.notes.trim()}</p>
                ) : null}
              </div>
              <span className="chip border-white/10 bg-white/5 text-[11px] text-white/70">
                {MATCH_TYPE_LABELS[next.match_type ?? "league"]}
              </span>
            </div>
            {next.kickoff_at ? (
              <Countdown target={matchKickoff(next)} />
            ) : (
              <p className="mt-2 text-sm text-white/65">שעה טרם נקבעה באתר ההתאחדות</p>
            )}
            {isCoach && (
              <div className="mt-4 flex gap-2">
                <button
                  type="button"
                  disabled={busyId === next.id}
                  onClick={() => void beginScheduled(next)}
                  className="btn btn-primary flex-1 py-3 text-sm"
                >
                  {busyId === next.id ? "..." : "התחל משחק"}
                </button>
                {!isPendingIfaMatch(next) && (
                  <button
                    type="button"
                    disabled={busyId === next.id}
                    onClick={() => void cancelScheduled(next)}
                    className="btn btn-ghost flex-1 py-3 text-sm text-white/80"
                  >
                    מחק
                  </button>
                )}
              </div>
            )}
          </section>
        ) : (
          <section className="match-glass">
            <p className="home-kicker">המשחק הבא</p>
            <h2 className="match-title">עוד לא נקבע</h2>
            <p className="mt-1 text-sm text-white/65">כשיהיה משחק בלוח — הוא יופיע כאן.</p>
          </section>
        )}

        {isCoach && (
          <div className="mt-3 flex gap-2">
            <Link href="/setup" className="btn btn-primary flex-1 py-3.5 text-[15px] tracking-wide">
              משחק חדש
            </Link>
            <Link href="/setup?mode=schedule" className="btn btn-ghost flex-1 py-3.5 text-[15px] text-white/90">
              תזמן ללוח
            </Link>
          </div>
        )}
      </div>
      </section>

      {isCoach && (
        <section className="home-feed">
          <h2 className="mb-3 text-[13px] font-semibold tracking-[0.18em] text-white/45">משחקים</h2>
          {loading && <PageSkeleton rows={3} />}
          {!loading && matches.length === 0 && (
            <p className="text-sm text-white/45">עדיין אין משחקים.</p>
          )}
          <ul className="flex flex-col gap-3">
            {live.filter((m) => m.id !== liveNow?.id).map((m) => (
              <MatchRow key={m.id} match={m} isCoach={isCoach} />
            ))}
            {scheduled
              .filter((m) => m.id !== next?.id)
              .map((m) => (
                <li key={m.id} className="card overflow-hidden">
                  <div className="flex items-center justify-between p-4 pb-3">
                    <div>
                      <p className="text-lg font-extrabold">מול {m.opponent}</p>
                      <p className="text-xs text-[var(--muted)]">
                        {m.kickoff_at
                          ? matchKickoff(m).toLocaleString("he-IL", {
                              day: "numeric",
                              month: "long",
                              hour: "2-digit",
                              minute: "2-digit",
                            })
                          : `${new Date(`${m.match_date}T12:00:00`).toLocaleDateString("he-IL", {
                              day: "numeric",
                              month: "long",
                            })} · שעה טרם נקבעה`}
                        {" · "}
                        {MATCH_TYPE_LABELS[m.match_type ?? "league"]}
                        {m.notes?.trim() ? ` · ${m.notes.trim()}` : ""}
                      </p>
                    </div>
                    <span className="chip border-white/10 text-[var(--muted)]">
                      {MATCH_STATUS_LABELS.scheduled}
                    </span>
                  </div>
                  <div className="flex gap-px bg-[var(--border)]">
                    <button
                      type="button"
                      disabled={busyId === m.id}
                      onClick={() => void beginScheduled(m)}
                      className="flex-1 bg-[var(--panel-strong)] py-3 text-center text-sm font-bold text-[var(--accent)]"
                    >
                      {busyId === m.id ? "..." : "התחל משחק"}
                    </button>
                    <button
                      type="button"
                      disabled={busyId === m.id}
                      onClick={() => void cancelScheduled(m)}
                      className="flex-1 bg-[var(--panel-strong)] py-3 text-center text-sm font-bold text-[var(--danger)]"
                    >
                      מחק
                    </button>
                  </div>
                </li>
              ))}
            {finished.slice(0, 6).map((m) => (
              <MatchRow key={m.id} match={m} isCoach={isCoach} />
            ))}
          </ul>
        </section>
      )}
    </main>
  );
}

function MatchRow({ match: m, isCoach }: { match: Match; isCoach: boolean }) {
  return (
    <li className="card overflow-hidden">
      <div className="flex items-center justify-between p-4 pb-3">
        <div>
          <div className="flex items-center gap-2">
            <p className="text-lg font-extrabold">מול {m.opponent}</p>
            <span className="chip border-white/10 text-[10px] text-[var(--muted)]">
              {MATCH_TYPE_LABELS[m.match_type ?? "league"]}
            </span>
          </div>
          <p className="text-xs text-[var(--muted)]">
            {new Date(m.match_date).toLocaleDateString("he-IL", {
              day: "numeric",
              month: "long",
              year: "numeric",
            })}
          </p>
        </div>
        {m.status === "finished" ? (
          <span className="chip border-white/10 text-[var(--muted)]">הושלם</span>
        ) : (
          <span className="chip border-[var(--accent)]/40 text-[var(--accent)]">
            <span className="h-1.5 w-1.5 rounded-full bg-[var(--accent)]" /> חי
          </span>
        )}
      </div>
      <div className="flex gap-px bg-[var(--border)]">
        {m.status === "finished" ? (
          <Link
            href={`/report/${m.id}`}
            className="flex-1 bg-[var(--panel-strong)] py-3 text-center text-sm font-bold text-[var(--accent)] active:bg-white/10"
          >
            דוח
          </Link>
        ) : isCoach ? (
          <>
            <Link
              href={`/live/${m.id}`}
              className="flex-1 bg-[var(--panel-strong)] py-3 text-center text-sm font-bold text-[var(--accent)] active:bg-white/10"
            >
              לייב
            </Link>
            <Link
              href={`/report/${m.id}`}
              className="flex-1 bg-[var(--panel-strong)] py-3 text-center text-sm font-bold active:bg-white/10"
            >
              דוח
            </Link>
          </>
        ) : (
          <div className="flex-1 bg-[var(--panel-strong)] py-3 text-center text-sm text-[var(--muted)]">
            המשחק חי אצל המאמן
          </div>
        )}
      </div>
    </li>
  );
}
