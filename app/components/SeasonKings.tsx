"use client";

import { useEffect, useMemo, useState } from "react";
import { loadSeasonBundle } from "@/lib/db";
import { computeSeasonImpact, computeSeasonMinutesByKey } from "@/lib/impactScore";
import { matchIdsForTypes, OFFICIAL_MATCH_TYPES } from "@/lib/matchFilter";
import { seasonKingLeaders, type KingLeader, type KingPlayer } from "@/lib/seasonKings";
import { isSupabaseConfigured } from "@/lib/supabaseClient";

function formatValue(leader: KingLeader): string {
  if (leader.id === "score") {
    const n = leader.value;
    return `${n > 0 ? "+" : ""}${n.toFixed(1)}`;
  }
  if (leader.id === "minutes") return `${Math.round(leader.value)}`;
  return String(leader.value);
}

export function SeasonKingsBoard() {
  const [leaders, setLeaders] = useState<KingLeader[] | null>(null);

  useEffect(() => {
    if (!isSupabaseConfigured) {
      setLeaders([]);
      return;
    }
    void loadSeasonBundle()
      .then((bundle) => {
        const allowed = matchIdsForTypes(bundle.matches, OFFICIAL_MATCH_TYPES);
        const matches = allowed ? bundle.matches.filter((m) => allowed.has(m.id)) : bundle.matches;
        const events = allowed ? bundle.events.filter((e) => allowed.has(e.match_id)) : bundle.events;
        const players = allowed ? bundle.players.filter((p) => allowed.has(p.match_id)) : bundle.players;
        const subs = allowed
          ? bundle.substitutions.filter((s) => allowed.has(s.match_id))
          : bundle.substitutions;
        const rows = computeSeasonImpact(events, players, bundle.squad, bundle.players);
        const minutesByKey = computeSeasonMinutesByKey(players, subs, matches, events, bundle.squad);
        const kings: KingPlayer[] = rows.map((row) => ({
          key: row.key,
          label: row.label,
          goals: row.goals,
          assists: row.assists,
          minutes: minutesByKey.get(row.key) ?? 0,
          tackles: row.tackles,
          keyPasses: row.keyPasses,
          score: row.score,
        }));
        setLeaders(seasonKingLeaders(kings));
      })
      .catch(() => setLeaders([]));
  }, []);

  const items = useMemo(() => leaders ?? [], [leaders]);
  if (leaders === null || items.length === 0) return null;

  return (
    <section className="mb-4">
      <p className="label mb-2">כתרי העונה</p>
      <div className="grid grid-cols-2 gap-2">
        {items.map((leader) => (
          <article key={leader.id} className="king-card is-king">
            <p className="king-title">{leader.title}</p>
            <p className="king-place">{leader.label}</p>
            <p className="king-value">
              {formatValue(leader)} <span>{leader.unit}</span>
            </p>
          </article>
        ))}
      </div>
    </section>
  );
}
