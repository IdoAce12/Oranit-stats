"use client";

import { useEffect, useMemo, useState } from "react";
import { deleteTraining, listMatches, listTrainings, upsertTraining } from "@/lib/db";
import { requestIfaSync } from "@/lib/ifa/client";
import type { IfaFixture, IfaStandingRow } from "@/lib/ifa/parse";
import { buildCalendarEvents, nextCalendarDate } from "@/lib/calendarEvents";
import { israelToday, splitMatches } from "@/lib/fixtures";
import { nextOfficialFixture } from "@/lib/homeNext";
import { isSupabaseConfigured } from "@/lib/supabaseClient";
import type { Training } from "@/lib/trainings";
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
  const [dismissedKeys, setDismissedKeys] = useState<string[]>([]);
  const [trainings, setTrainings] = useState<Training[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!isSupabaseConfigured) {
      setLoading(false);
      return;
    }
    let cancelled = false;
    const run = async () => {
      try {
        const rows = await listMatches();
        if (!cancelled) setMatches(rows);
        try {
          const sessions = await listTrainings();
          if (!cancelled) setTrainings(sessions);
        } catch {
          if (!cancelled) setTrainings([]);
        }
        const result = await requestIfaSync(true);
        if (cancelled) return;
        if (result) {
          setStandings(result.standings ?? []);
          setIfaFixtures(result.fixtures ?? []);
          setDismissedKeys(result.dismissedKeys ?? []);
          if ((result.inserted ?? 0) > 0 || (result.updated ?? 0) > 0) {
            const again = await listMatches();
            if (!cancelled) setMatches(again);
          }
        }
      } catch (e) {
        if (!cancelled) setError(e instanceof Error ? e.message : "שגיאה");
      } finally {
        if (!cancelled) setLoading(false);
      }
    };
    void run();
    return () => {
      cancelled = true;
    };
  }, []);

  const { live } = useMemo(() => splitMatches(matches), [matches]);
  const today = israelToday();
  const events = useMemo(
    () => buildCalendarEvents(matches, ifaFixtures, dismissedKeys, today, trainings),
    [matches, ifaFixtures, dismissedKeys, today, trainings]
  );
  const focusDate = nextCalendarDate(events, today, nextOfficialFixture(ifaFixtures, today)?.date) ?? today;

  return (
    <main className="mx-auto flex w-full max-w-md flex-1 flex-col px-4 page-shell pb-nav">
      <AppHeader title="לוח משחקים" subtitle="משחקים ואימונים על התאריכים" />

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

          <MatchCalendar
            events={events}
            standings={standings}
            isCoach={isCoach}
            focusDate={focusDate}
            onSaveTraining={async (row) => {
              const next = await upsertTraining(row);
              setTrainings(next);
            }}
            onDeleteTraining={async (id) => {
              const next = await deleteTraining(id);
              setTrainings(next);
            }}
          />
        </>
      )}
    </main>
  );
}
