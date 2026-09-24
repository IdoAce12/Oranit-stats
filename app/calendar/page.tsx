"use client";

import { useEffect, useMemo, useState } from "react";
import { listMatches } from "@/lib/db";
import { requestIfaSync } from "@/lib/ifa/client";
import type { IfaFixture, IfaStandingRow } from "@/lib/ifa/parse";
import { buildCalendarEvents } from "@/lib/calendarEvents";
import { splitMatches } from "@/lib/fixtures";
import { isSupabaseConfigured } from "@/lib/supabaseClient";
import { Match } from "@/lib/types";
import { AppHeader } from "../components/AppHeader";
import { MatchCalendar } from "../components/MatchCalendar";
import { PageSkeleton } from "../components/Skeleton";
import { useAuth } from "../components/AuthProvider";
import Link from "next/link";

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

  const { live } = useMemo(() => splitMatches(matches), [matches]);
  const events = useMemo(() => buildCalendarEvents(matches, ifaFixtures), [matches, ifaFixtures]);

  return (
    <main className="mx-auto flex w-full max-w-md flex-1 flex-col px-4 page-shell pb-nav">
      <AppHeader title="לוח משחקים" subtitle="החודש, עם כל המשחקים על התאריכים" />

      {loading && <PageSkeleton rows={4} />}
      {error && <p className="text-[var(--danger)]">{error}</p>}

      {!loading && !error && (
        <>
          {live.length > 0 && (
            <section className="mb-4">
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

          <MatchCalendar events={events} standings={standings} isCoach={isCoach} />
        </>
      )}
    </main>
  );
}
