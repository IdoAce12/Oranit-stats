"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { listMatches } from "@/lib/db";
import { isSupabaseConfigured } from "@/lib/supabaseClient";
import { Match } from "@/lib/types";
import { ConfigBanner } from "./components/ConfigBanner";

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
    <main className="mx-auto flex w-full max-w-md flex-1 flex-col px-4 pt-6 pb-10">
      <header className="mb-6 text-center">
        <h1 className="text-2xl font-bold">סקאוט ליגה ג׳</h1>
        <p className="mt-1 text-sm text-white/60">איסוף חי + ניתוח משחק</p>
      </header>

      <ConfigBanner />

      <Link
        href="/setup"
        className="mb-6 block rounded-2xl bg-green-500 px-4 py-4 text-center text-lg font-bold text-black active:scale-[0.98]"
      >
        + משחק חדש
      </Link>

      <h2 className="mb-3 text-sm font-semibold text-white/70">המשחקים שלי</h2>

      {loading && <p className="text-white/50">טוען...</p>}
      {error && <p className="text-red-400">{error}</p>}
      {!loading && !error && matches.length === 0 && (
        <p className="rounded-xl border border-white/10 bg-white/5 p-4 text-center text-white/50">
          עדיין אין משחקים. צור משחק חדש כדי להתחיל.
        </p>
      )}

      <ul className="flex flex-col gap-3">
        {matches.map((m) => (
          <li
            key={m.id}
            className="rounded-2xl border border-white/10 bg-white/5 p-4"
          >
            <div className="mb-3">
              <p className="text-lg font-bold">מול {m.opponent}</p>
              <p className="text-sm text-white/50">
                {new Date(m.match_date).toLocaleDateString("he-IL")}
              </p>
            </div>
            <div className="flex gap-2">
              <Link
                href={`/live/${m.id}`}
                className="flex-1 rounded-xl bg-blue-500 py-2.5 text-center font-semibold text-white active:scale-[0.98]"
              >
                לייב
              </Link>
              <Link
                href={`/report/${m.id}`}
                className="flex-1 rounded-xl bg-white/10 py-2.5 text-center font-semibold active:scale-[0.98]"
              >
                דוח
              </Link>
            </div>
          </li>
        ))}
      </ul>
    </main>
  );
}
