"use client";

import { useEffect, useMemo, useState } from "react";
import { formatIfaFetchedAt, requestIfaSync } from "@/lib/ifa/client";
import { IFA_TEAM_URL } from "@/lib/ifa/config";
import type { IfaStandingRow } from "@/lib/ifa/parse";
import { AppHeader } from "../components/AppHeader";
import { LeagueTable } from "../components/LeagueTable";
import { PageSkeleton } from "../components/Skeleton";

export default function TablePage() {
  const [standings, setStandings] = useState<IfaStandingRow[]>([]);
  const [fetchedAt, setFetchedAt] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const load = async (fresh: boolean) => {
    const result = await requestIfaSync(fresh);
    if (!result) {
      setError("לא הצלחנו לטעון את הטבלה מההתאחדות");
      return;
    }
    setStandings(result.standings ?? []);
    setFetchedAt(result.fetchedAt ?? null);
    setError(result.error ?? null);
  };

  useEffect(() => {
    void load(true).finally(() => setLoading(false));
  }, []);

  const refresh = async () => {
    setRefreshing(true);
    await load(true);
    setRefreshing(false);
  };

  const us = useMemo(() => standings.find((r) => r.isUs) ?? null, [standings]);
  const syncedAt = formatIfaFetchedAt(fetchedAt);

  return (
    <main className="mx-auto flex w-full max-w-md flex-1 flex-col px-4 page-shell pb-nav">
      <AppHeader
        title="טבלה"
        subtitle="ליגה ג׳ שומרון · מההתאחדות"
        right={
          <button
            type="button"
            disabled={refreshing || loading}
            onClick={() => void refresh()}
            className="btn btn-ghost h-9 px-3 text-xs disabled:opacity-50"
          >
            {refreshing ? "..." : "רענון"}
          </button>
        }
      />

      {loading && <PageSkeleton rows={6} />}

      {!loading && us && (
        <section className="card mb-4 p-4">
          <p className="text-[11px] font-semibold tracking-[0.16em] text-[var(--muted)]">המקום שלנו</p>
          <div className="mt-1 flex items-end justify-between gap-3">
            <h2 className="text-3xl font-black tabular text-[var(--accent)]">{us.place}</h2>
            <div className="min-w-0 text-left">
              <p className="truncate text-sm font-extrabold">{us.team}</p>
              <p className="text-xs text-[var(--muted)]">
                {us.points} נק׳ · {us.played} מש׳ · {us.goals}
              </p>
            </div>
          </div>
        </section>
      )}

      {!loading && <LeagueTable rows={standings} />}

      <p className="mt-3 text-[11px] text-[var(--muted-2)]">
        {error
          ? error
          : syncedAt
            ? `עודכן מההתאחדות · ${syncedAt}`
            : "נפתח את הדף — נמשכת הטבלה העדכנית מהאתר"}
        {" · "}
        <a href={IFA_TEAM_URL} target="_blank" rel="noreferrer" className="underline underline-offset-2">
          לאתר ההתאחדות
        </a>
      </p>
    </main>
  );
}
