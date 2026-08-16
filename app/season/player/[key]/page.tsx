"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { loadSeasonBundle } from "@/lib/db";
import {
  computePlayerSeasonMatches,
  computeSeasonImpact,
} from "@/lib/impactScore";
import { isSupabaseConfigured } from "@/lib/supabaseClient";
import { Match, MatchEvent, Player, SquadPlayer } from "@/lib/types";
import { AppHeader } from "../../../components/AppHeader";

const LOAD_TIMEOUT_MS = 12000;

function withTimeout<T>(promise: Promise<T>, ms: number): Promise<T> {
  return new Promise((resolve, reject) => {
    const t = setTimeout(() => reject(new Error("הטעינה ארכה יותר מדי. נסה שוב.")), ms);
    promise.then(
      (v) => {
        clearTimeout(t);
        resolve(v);
      },
      (e) => {
        clearTimeout(t);
        reject(e);
      }
    );
  });
}

export default function SeasonPlayerPage() {
  const params = useParams<{ key: string }>();
  const playerKey = decodeURIComponent(params.key ?? "");

  const [events, setEvents] = useState<MatchEvent[]>([]);
  const [players, setPlayers] = useState<Player[]>([]);
  const [squad, setSquad] = useState<SquadPlayer[]>([]);
  const [matches, setMatches] = useState<Match[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!isSupabaseConfigured) {
      setLoading(false);
      setError("Supabase לא מחובר");
      return;
    }
    withTimeout(loadSeasonBundle(), LOAD_TIMEOUT_MS)
      .then((bundle) => {
        setEvents(bundle.events);
        setPlayers(bundle.players);
        setSquad(bundle.squad);
        setMatches(bundle.matches);
      })
      .catch((e) => setError(e instanceof Error ? e.message : "שגיאה"))
      .finally(() => setLoading(false));
  }, []);

  const seasonRow = useMemo(() => {
    const all = computeSeasonImpact(events, players, squad);
    return all.find((r) => r.key === playerKey) ?? null;
  }, [events, players, squad, playerKey]);

  const matchLines = useMemo(
    () => computePlayerSeasonMatches(playerKey, events, players, matches),
    [playerKey, events, players, matches]
  );

  if (loading) {
    return <main className="p-8 text-center text-[var(--muted)]">טוען פרופיל...</main>;
  }

  if (error || !seasonRow) {
    return (
      <main className="mx-auto flex w-full max-w-md flex-1 flex-col px-4 pt-8">
        <p className="rounded-2xl border border-red-500/40 bg-red-500/10 p-4 text-red-200">
          {error ?? "שחקן לא נמצא"}
        </p>
        <Link href="/season" className="mt-4 text-center text-[var(--muted)]">
          ← חזרה לטבלה
        </Link>
      </main>
    );
  }

  const avg = (n: number) =>
    seasonRow.matchesPlayed > 0 ? (n / seasonRow.matchesPlayed).toFixed(1) : "0";

  return (
    <main className="mx-auto flex w-full max-w-2xl flex-1 flex-col px-4 pt-6 pb-10">
      <AppHeader title={seasonRow.label} subtitle="פרופיל עונתי" backHref="/season" />

      <section className="card mb-4 p-4">
        <div className="flex items-end justify-between gap-3">
          <div>
            <p className="label">ציון Impact</p>
            <p
              className={`mt-1 text-4xl font-black tabular ${
                seasonRow.score > 0
                  ? "text-[var(--accent)]"
                  : seasonRow.score < 0
                    ? "text-[var(--danger)]"
                    : "text-[var(--muted)]"
              }`}
            >
              {seasonRow.score > 0 ? "+" : ""}
              {seasonRow.score.toFixed(1)}
            </p>
          </div>
          <div className="text-left text-sm text-[var(--muted)]">
            <p>
              ממוצע למשחק:{" "}
              <b className="tabular text-[var(--text)]">
                {seasonRow.perMatch > 0 ? "+" : ""}
                {seasonRow.perMatch.toFixed(1)}
              </b>
            </p>
            <p>
              משחקים: <b className="tabular text-[var(--text)]">{seasonRow.matchesPlayed}</b>
            </p>
          </div>
        </div>
      </section>

      <section className="mb-4 grid grid-cols-3 gap-2 sm:grid-cols-4">
        <MiniStat label="שערים" value={seasonRow.goals} avg={avg(seasonRow.goals)} tone="accent" />
        <MiniStat label="בישולים" value={seasonRow.assists} avg={avg(seasonRow.assists)} tone="info" />
        <MiniStat label="מס״מ" value={seasonRow.keyPasses} avg={avg(seasonRow.keyPasses)} />
        <MiniStat label="חילוצים" value={seasonRow.tackles} avg={avg(seasonRow.tackles)} />
        <MiniStat label="איבודים" value={seasonRow.lossesTotal} avg={avg(seasonRow.lossesTotal)} />
        <MiniStat
          label="איבודי הגנה"
          value={seasonRow.defLosses}
          avg={avg(seasonRow.defLosses)}
          tone="danger"
        />
        <MiniStat label="איומים רחבה" value={seasonRow.shotsInBox} avg={avg(seasonRow.shotsInBox)} />
        <MiniStat
          label="איומים חוץ"
          value={seasonRow.shotsOutBox}
          avg={avg(seasonRow.shotsOutBox)}
        />
      </section>

      <section className="card mb-4 p-3">
        <p className="label mb-2">פיזור איבודים</p>
        <div className="grid grid-cols-3 gap-2 text-center text-sm">
          <div>
            <div className="tabular text-xl font-black text-[var(--danger)]">{seasonRow.defLosses}</div>
            <div className="text-[var(--muted-2)]">הגנה</div>
          </div>
          <div>
            <div className="tabular text-xl font-black">{seasonRow.midLosses}</div>
            <div className="text-[var(--muted-2)]">אמצע</div>
          </div>
          <div>
            <div className="tabular text-xl font-black">{seasonRow.attLosses}</div>
            <div className="text-[var(--muted-2)]">התקפה</div>
          </div>
        </div>
      </section>

      <h2 className="label mb-2">משחק אחר משחק</h2>
      {matchLines.length === 0 ? (
        <div className="card p-4 text-center text-sm text-[var(--muted)]">אין משחקים</div>
      ) : (
        <ul className="flex flex-col gap-2">
          {matchLines.map((line) => (
            <li key={line.matchId}>
              <Link
                href={`/report/${line.matchId}`}
                className="card flex items-center justify-between gap-3 p-3 active:scale-[0.99]"
              >
                <div className="min-w-0">
                  <p className="truncate font-bold">מול {line.opponent}</p>
                  <p className="text-xs text-[var(--muted)]">
                    {line.matchDate
                      ? new Date(line.matchDate).toLocaleDateString("he-IL")
                      : "—"}
                  </p>
                  <p className="mt-1 text-[11px] text-[var(--muted-2)]">
                    {line.goals} שער · {line.assists} ביש · {line.keyPasses} מס״מ · {line.tackles}{" "}
                    חילוץ · {line.defLosses} איב׳ הגנה
                  </p>
                </div>
                <div
                  className={`tabular text-xl font-black ${
                    line.score > 0
                      ? "text-[var(--accent)]"
                      : line.score < 0
                        ? "text-[var(--danger)]"
                        : "text-[var(--muted)]"
                  }`}
                >
                  {line.score > 0 ? "+" : ""}
                  {line.score.toFixed(1)}
                </div>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </main>
  );
}

function MiniStat({
  label,
  value,
  avg,
  tone,
}: {
  label: string;
  value: number;
  avg: string;
  tone?: "accent" | "info" | "danger";
}) {
  const color =
    tone === "accent"
      ? "text-[var(--accent)]"
      : tone === "info"
        ? "text-[var(--info)]"
        : tone === "danger"
          ? "text-[var(--danger)]"
          : "";
  return (
    <div className="card p-2.5 text-center">
      <div className={`tabular text-xl font-black ${color}`}>{value}</div>
      <div className="text-[10px] text-[var(--muted)]">{label}</div>
      <div className="text-[10px] text-[var(--muted-2)]">{avg}/מש׳</div>
    </div>
  );
}
