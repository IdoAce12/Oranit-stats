"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { listMatches } from "@/lib/db";
import { matchKickoff, splitMatches } from "@/lib/fixtures";
import { isSupabaseConfigured } from "@/lib/supabaseClient";
import { MATCH_TYPE_LABELS, Match } from "@/lib/types";
import { AppHeader } from "../components/AppHeader";
import { PageSkeleton } from "../components/Skeleton";
import { useAuth } from "../components/AuthProvider";

function formatWhen(m: Match) {
  return matchKickoff(m).toLocaleString("he-IL", {
    weekday: "short",
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export default function CalendarPage() {
  const { isCoach } = useAuth();
  const [matches, setMatches] = useState<Match[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!isSupabaseConfigured) {
      setLoading(false);
      return;
    }
    listMatches()
      .then(setMatches)
      .catch((e) => setError(e.message ?? "שגיאה"))
      .finally(() => setLoading(false));
  }, []);

  const { scheduled, live, finished } = useMemo(() => splitMatches(matches), [matches]);

  return (
    <main className="mx-auto flex w-full max-w-md flex-1 flex-col px-4 pt-6 pb-10">
      <AppHeader title="לוח משחקים" subtitle="המשחקים הבאים והמשחקים ששוחקו" backHref="/" />

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

          <section className="mb-5">
            <h2 className="mb-2 text-sm font-bold text-[var(--muted)]">משחקים הבאים</h2>
            {scheduled.length === 0 ? (
              <div className="card p-4 text-center text-sm text-[var(--muted)]">אין משחקים מתוכננים</div>
            ) : (
              <ul className="flex flex-col gap-2">
                {scheduled.map((m) => (
                  <li key={m.id} className="card p-4">
                    <p className="font-extrabold">מול {m.opponent}</p>
                    <p className="text-xs text-[var(--muted)]">
                      {formatWhen(m)} · {MATCH_TYPE_LABELS[m.match_type ?? "league"]}
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
