"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { listMatches } from "@/lib/db";
import { isSupabaseConfigured } from "@/lib/supabaseClient";
import { Match } from "@/lib/types";
import { ConfigBanner } from "./components/ConfigBanner";
import { ThemeToggle } from "./components/ThemeToggle";
import { PageSkeleton } from "./components/Skeleton";

export default function HomePage() {
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
      .catch((e) => setError(e.message ?? "שגיאה בטעינת משחקים"))
      .finally(() => setLoading(false));
  }, []);

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
          <p className="text-xs text-[var(--muted)]">סקאוט · ניתוח משחק</p>
        </div>
        <div className="ms-auto">
          <ThemeToggle />
        </div>
      </div>

      <ConfigBanner />

      <Link href="/setup" className="btn btn-primary mb-3 w-full py-4 text-lg">
        + משחק חדש
      </Link>

      <div className="mb-7 grid grid-cols-3 gap-2">
        <Link href="/squad" className="btn btn-ghost flex-1 py-3 text-sm">
          הסגל שלי
        </Link>
        <Link href="/season" className="btn btn-ghost flex-1 py-3 text-sm">
          טבלה עונתית
        </Link>
        <Link href="/season/compare" className="btn btn-ghost flex-1 py-3 text-sm">
          השוואה
        </Link>
      </div>

      <h2 className="mb-3 text-sm font-bold text-[var(--muted)]">המשחקים שלי</h2>

      {loading && <PageSkeleton rows={4} />}
      {error && <p className="text-[var(--danger)]">{error}</p>}
      {!loading && !error && matches.length === 0 && (
        <div className="card p-6 text-center text-sm text-[var(--muted)]">
          עדיין אין משחקים.
          <br />
          צור משחק חדש כדי להתחיל לאסוף נתונים.
        </div>
      )}

      <ul className="flex flex-col gap-3">
        {matches.map((m) => (
          <li key={m.id} className="card overflow-hidden">
            <div className="flex items-center justify-between p-4 pb-3">
              <div>
                <p className="text-lg font-extrabold">מול {m.opponent}</p>
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
              ) : (
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
              )}
            </div>
          </li>
        ))}
      </ul>
      </div>
    </main>
  );
}
