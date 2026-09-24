"use client";

import type { IfaStandingRow } from "@/lib/ifa/parse";

export function LeagueTable({ rows }: { rows: IfaStandingRow[] }) {
  if (rows.length === 0) {
    return <div className="card p-4 text-center text-sm text-[var(--muted)]">אין טבלה עדיין</div>;
  }

  return (
    <div className="card overflow-hidden">
      <div className="overflow-x-auto">
        <table className="league-table">
          <thead>
            <tr>
              <th className="w-8">#</th>
              <th className="text-right">קבוצה</th>
              <th>מש׳</th>
              <th>נצ׳</th>
              <th>ת׳</th>
              <th>הפ׳</th>
              <th>שע׳</th>
              <th>נק׳</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={`${r.place}-${r.teamId ?? r.team}`} className={r.isUs ? "is-us" : undefined}>
                <td className="tabular">{r.place}</td>
                <td className="team-name">{r.team}</td>
                <td className="tabular">{r.played}</td>
                <td className="tabular">{r.won}</td>
                <td className="tabular">{r.drawn}</td>
                <td className="tabular">{r.lost}</td>
                <td className="tabular whitespace-nowrap">{r.goals}</td>
                <td className="tabular font-extrabold">{r.points}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
