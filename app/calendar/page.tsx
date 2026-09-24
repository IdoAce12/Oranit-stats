"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { listMatches } from "@/lib/db";
import { requestIfaSync } from "@/lib/ifa/client";
import { namesMatch, type IfaFixture, type IfaStandingRow } from "@/lib/ifa/parse";
import { matchKickoff, splitMatches } from "@/lib/fixtures";
import { isSupabaseConfigured } from "@/lib/supabaseClient";
import { MATCH_TYPE_LABELS, Match } from "@/lib/types";
import { AppHeader } from "../components/AppHeader";
import { PageSkeleton } from "../components/Skeleton";
import { useAuth } from "../components/AuthProvider";

function formatWhen(m: Match) {
  if (!m.kickoff_at) {
    return `${new Date(`${m.match_date}T12:00:00`).toLocaleDateString("he-IL", {
      weekday: "short",
      day: "numeric",
      month: "short",
    })} · שעה טרם נקבעה`;
  }
  return matchKickoff(m).toLocaleString("he-IL", {
    weekday: "short",
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function extraIfaFixtures(scheduled: Match[], fixtures: IfaFixture[]): IfaFixture[] {
  return fixtures.filter((f) => {
    if (f.score) return false;
    return !scheduled.some((m) => m.match_date === f.date && namesMatch(m.opponent, f.opponent));
  });
}

export default function CalendarPage() {
  const { isCoach } = useAuth();
  const [matches, setMatches] = useState<Match[]>([]);
  const [standings, setStandings] = useState<IfaStandingRow[]>([]);
  const [ifaFixtures, setIfaFixtures] = useState<IfaFixture[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadMatches = () => {
    if (!isSupabaseConfigured) return Promise.resolve();
    return listMatches().then(setMatches);
  };

  useEffect(() => {
    if (!isSupabaseConfigured) {
      setLoading(false);
      return;
    }
    loadMatches()
      .catch((e) => setError(e.message ?? "שגיאה"))
      .finally(() => setLoading(false));

    void requestIfaSync().then((result) => {
      if (!result) return;
      setStandings(result.standings ?? []);
      setIfaFixtures(result.fixtures ?? []);
      if ((result.inserted ?? 0) > 0 || (result.updated ?? 0) > 0) {
        void loadMatches();
      }
    });
  }, []);

  const { scheduled, live, finished } = useMemo(() => splitMatches(matches), [matches]);
  const ifaOnly = useMemo(() => extraIfaFixtures(scheduled, ifaFixtures), [scheduled, ifaFixtures]);
  const us = useMemo(() => standings.find((r) => r.isUs) ?? null, [standings]);

  return (
    <main className="mx-auto flex w-full max-w-md flex-1 flex-col px-4 page-shell pb-nav">
      <AppHeader title="לוח משחקים" subtitle="המשחקים הבאים והמשחקים ששוחקו" />

      {loading && <PageSkeleton rows={4} />}
      {error && <p className="text-[var(--danger)]">{error}</p>}

      {!loading && !error && (
        <>
          {live.length > 0 && (
            <section className="mb-5">
              <h2 className="mb-2 text-sm font-bold text-[var(--accent)]">עכשיו בלייב</h2>
              <ul className="flex flex-col gap-2">
                {live.map((m) => (
                  <li key={m.id} className="card p-4">
                    <p className="font-extrabold">מול {m.opponent}</p>
                    {isCoach ? (
                      <Link href={`/live/${m.id}`} className="mt-2 block text-sm font-bold text-[var(--accent)]">
                        כניסה ללייב
                      </Link>
                    ) : (
                      <p className="mt-1 text-xs text-[var(--muted)]">המשחק רץ אצל המאמן</p>
                    )}
                  </li>
                ))}
              </ul>
            </section>
          )}

          {us && (
            <Link href="/table" className="card mb-5 flex items-center justify-between gap-3 p-4 active:scale-[0.99]">
              <div>
                <p className="text-[11px] font-semibold tracking-[0.16em] text-[var(--muted)]">המקום בליגה</p>
                <p className="mt-1 text-lg font-extrabold">
                  מקום {us.place} · {us.points} נק׳
                </p>
              </div>
              <span className="text-sm font-bold text-[var(--accent)]">לטבלה</span>
            </Link>
          )}

          <section className="mb-5">
            <h2 className="mb-2 text-sm font-bold text-[var(--muted)]">משחקים הבאים</h2>
            {scheduled.length === 0 && ifaOnly.length === 0 ? (
              <div className="card p-4 text-center text-sm text-[var(--muted)]">אין משחקים מתוכננים</div>
            ) : (
              <ul className="flex flex-col gap-2">
                {scheduled.map((m) => (
                  <li key={m.id} className="card p-4">
                    <p className="font-extrabold">מול {m.opponent}</p>
                    <p className="text-xs text-[var(--muted)]">
                      {formatWhen(m)} · {MATCH_TYPE_LABELS[m.match_type ?? "league"]}
                      {m.notes ? ` · ${m.notes}` : ""}
                    </p>
                  </li>
                ))}
                {ifaOnly.map((f) => (
                  <li key={`${f.date}|${f.opponent}`} className="card p-4">
                    <p className="font-extrabold">מול {f.opponent}</p>
                    <p className="text-xs text-[var(--muted)]">
                      {f.time
                        ? new Date(`${f.date}T${f.time}:00`).toLocaleString("he-IL", {
                            weekday: "short",
                            day: "numeric",
                            month: "short",
                            hour: "2-digit",
                            minute: "2-digit",
                          })
                        : `${new Date(`${f.date}T12:00:00`).toLocaleDateString("he-IL", {
                            weekday: "short",
                            day: "numeric",
                            month: "short",
                          })} · שעה טרם נקבעה`}
                      {" · ליגה · "}
                      {f.home ? "בית" : "חוץ"}
                      {f.venue ? ` · ${f.venue}` : ""}
                    </p>
                  </li>
                ))}
              </ul>
            )}
          </section>

          <section>
            <h2 className="mb-2 text-sm font-bold text-[var(--muted)]">משחקים ששוחקו</h2>
            {finished.length === 0 ? (
              <div className="card p-4 text-center text-sm text-[var(--muted)]">עדיין אין משחקים</div>
            ) : (
              <ul className="flex flex-col gap-2">
                {finished.map((m) => (
                  <li key={m.id}>
                    <Link href={`/report/${m.id}`} className="card block p-4 active:scale-[0.99]">
                      <p className="font-extrabold">מול {m.opponent}</p>
                      <p className="text-xs text-[var(--muted)]">
                        {new Date(m.match_date).toLocaleDateString("he-IL")} ·{" "}
                        {MATCH_TYPE_LABELS[m.match_type ?? "league"]}
                      </p>
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </section>
        </>
      )}
    </main>
  );
}
