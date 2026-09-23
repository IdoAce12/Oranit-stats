"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { deleteMatch, getPlayers, listMatches, startMatch } from "@/lib/db";
import { matchKickoff, nextScheduledMatch, splitMatches } from "@/lib/fixtures";
import { isSupabaseConfigured } from "@/lib/supabaseClient";
import { MATCH_STATUS_LABELS, MATCH_TYPE_LABELS, Match } from "@/lib/types";
import { ConfigBanner } from "./components/ConfigBanner";
import { ThemeToggle } from "./components/ThemeToggle";
import { PageSkeleton } from "./components/Skeleton";
import { Countdown } from "./components/Countdown";
import { useAuth, usePlayerProfileHref } from "./components/AuthProvider";
import { useRouter } from "next/navigation";

export default function HomePage() {
  const { user, loading: authLoading, isCoach, logout } = useAuth();
  const profileHref = usePlayerProfileHref();
  const router = useRouter();
  const [matches, setMatches] = useState<Match[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);

  const load = () => {
    if (!isSupabaseConfigured) {
      setLoading(false);
      return;
    }
    setLoading(true);
    listMatches()
      .then(setMatches)
      .catch((e) => setError(e.message ?? "שגיאה בטעינת משחקים"))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    if (authLoading || !user) return;
    load();
  }, [authLoading, user]);

  const next = useMemo(() => nextScheduledMatch(matches), [matches]);
  const { scheduled, live, finished } = useMemo(() => splitMatches(matches), [matches]);

  const beginScheduled = async (m: Match) => {
    setBusyId(m.id);
    setError(null);
    try {
      const players = await getPlayers(m.id);
      if (players.length === 0) {
        router.push(`/setup?matchId=${m.id}`);
        return;
      }
      await startMatch(m.id);
      router.push(`/live/${m.id}`);
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
    } catch (e) {
      setError(e instanceof Error ? e.message : "שגיאה במחיקה");
    } finally {
      setBusyId(null);
    }
  };

  if (authLoading || !user) {
    return (
      <main className="mx-auto w-full max-w-md px-4 pt-6">
        <PageSkeleton rows={4} />
      </main>
    );
  }

  return (
    <main className="relative mx-auto flex w-full max-w-md flex-1 flex-col px-4 pt-6 pb-10">
      <div className="home-crest-bg" aria-hidden />
      <div className="relative z-10 flex flex-1 flex-col">
        <div className="mb-6 flex w-full items-center gap-3">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src="/hapoel-oranit.png"
            alt="הפועל אורנית"
            className="h-12 w-12 rounded-full object-cover ring-2 ring-white/25"
          />
          <div>
            <h1 className="text-xl font-extrabold leading-tight">הפועל אורנית</h1>
            <p className="text-xs text-[var(--muted)]">
              {isCoach ? "סקאוט · מאמן" : "העמוד שלי"}
            </p>
          </div>
          <div className="ms-auto flex items-center gap-1">
            <button type="button" onClick={() => void logout()} className="btn btn-ghost h-9 px-2 text-xs">
              יציאה
            </button>
            <ThemeToggle />
          </div>
        </div>

        {!isCoach && (
          <h2 className="mb-5 text-4xl font-black leading-tight">שלום, {user.username}</h2>
        )}

        <ConfigBanner />

        {next && (
          <section className="card mb-4 p-4">
            <p className="label mb-1">המשחק הבא</p>
            <p className="mb-1 text-2xl font-extrabold">מול {next.opponent}</p>
            <p className="mb-3 text-sm text-[var(--muted)]">
              {matchKickoff(next).toLocaleString("he-IL", {
                weekday: "long",
                day: "numeric",
                month: "long",
                hour: "2-digit",
                minute: "2-digit",
              })}
            </p>
            <Countdown target={matchKickoff(next)} />
          </section>
        )}

        {isCoach ? (
          <>
            <Link href="/setup" className="btn btn-primary mb-2 w-full py-4 text-lg">
              + משחק חדש (לייב)
            </Link>
            <Link href="/setup?mode=schedule" className="btn btn-ghost mb-3 w-full py-3 text-sm">
              + משחק מתוכנן ללוח
            </Link>
            <div className="mb-7 grid grid-cols-2 gap-2 sm:grid-cols-4">
              <Link href="/squad" className="btn btn-ghost py-3 text-sm">
                הסגל שלי
              </Link>
              <Link href="/season" className="btn btn-ghost py-3 text-sm">
                טבלה עונתית
              </Link>
              <Link href="/season/compare?from=home" className="btn btn-ghost py-3 text-sm">
                השוואה
              </Link>
              <Link href="/calendar" className="btn btn-ghost py-3 text-sm">
                לוח שנה
              </Link>
            </div>
          </>
        ) : (
          <div className="mb-7 grid grid-cols-2 gap-2">
            <Link href="/calendar" className="btn btn-primary py-3 text-sm">
              לוח שנה
            </Link>
            {profileHref ? (
              <Link href={profileHref} className="btn btn-ghost py-3 text-sm">
                הנתונים שלי
              </Link>
            ) : (
              <div className="btn btn-ghost py-3 text-sm opacity-50">אין קישור לסגל</div>
            )}
          </div>
        )}

        {error && <p className="mb-3 text-sm text-[var(--danger)]">{error}</p>}

        <h2 className="mb-3 text-sm font-bold text-[var(--muted)]">המשחקים</h2>

        {loading && <PageSkeleton rows={4} />}
        {!loading && matches.length === 0 && (
          <div className="card p-6 text-center text-sm text-[var(--muted)]">
            עדיין אין משחקים.
          </div>
        )}

        <ul className="flex flex-col gap-3">
          {live.map((m) => (
            <MatchRow key={m.id} match={m} isCoach={isCoach} />
          ))}
          {scheduled.map((m) => (
            <li key={m.id} className="card overflow-hidden">
              <div className="flex items-center justify-between p-4 pb-3">
                <div>
                  <p className="text-lg font-extrabold">מול {m.opponent}</p>
                  <p className="text-xs text-[var(--muted)]">
                    {matchKickoff(m).toLocaleString("he-IL", {
                      day: "numeric",
                      month: "long",
                      hour: "2-digit",
                      minute: "2-digit",
                    })}
                    {" · "}
                    {MATCH_TYPE_LABELS[m.match_type ?? "league"]}
                  </p>
                </div>
                <span className="chip border-white/10 text-[var(--muted)]">
                  {MATCH_STATUS_LABELS.scheduled}
                </span>
              </div>
              {isCoach && (
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
              )}
            </li>
          ))}
          {finished.map((m) => (
            <MatchRow key={m.id} match={m} isCoach={isCoach} />
          ))}
        </ul>
      </div>
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
