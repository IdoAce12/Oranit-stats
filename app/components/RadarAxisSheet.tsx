"use client";

import type { ImpactBreakdownRow } from "@/lib/impactScore";
import { type RadarAxisExplain } from "@/lib/radarExplain";

interface Props {
  explain: RadarAxisExplain;
  breakdown?: ImpactBreakdownRow[];
  onClose: () => void;
}

export function RadarAxisSheet({ explain, breakdown, onClose }: Props) {
  const shownBreakdown = explain.key === "impact" ? breakdown?.filter((r) => r.count > 0) : undefined;

  return (
    <div
      className="sheet-overlay no-print fixed inset-0 z-[80] flex items-end bg-black/60 backdrop-blur-sm sm:items-center sm:justify-center sm:p-6"
      onClick={onClose}
    >
      <div
        className="sheet-panel sheet max-h-[88vh] w-full max-w-lg overflow-y-auto rounded-t-3xl border-t border-[var(--border-strong)] bg-[var(--bg)] p-4 pb-10 sm:rounded-3xl sm:border"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-4 flex items-start justify-between gap-3">
          <div>
            <p className="home-kicker">ציר ברדאר</p>
            <h2 className="mt-1 font-[family-name:var(--font-frank)] text-3xl font-bold leading-tight">
              {explain.title}
            </h2>
          </div>
          <button type="button" onClick={onClose} className="btn btn-ghost h-9 px-3 text-sm">
            סגור
          </button>
        </div>

        <div className="mb-4 grid grid-cols-2 gap-2">
          <div className="card p-3 text-center">
            <p className="label">מול הקבוצה</p>
            <p className="tabular mt-1 text-3xl font-black text-[var(--accent)]">{explain.percentile}</p>
            <p className="text-[11px] text-[var(--muted-2)]">מתוך 100</p>
          </div>
          <div className="card p-3 text-center">
            <p className="label">ציון גולמי</p>
            <p className="tabular mt-1 text-3xl font-black">{explain.raw}</p>
            <p className="text-[11px] text-[var(--muted-2)]">לפי הנוסחה</p>
          </div>
        </div>

        <p className="mb-3 text-[15px] leading-relaxed text-[var(--text)]">{explain.blurb}</p>
        <p className="mb-3 text-xs text-[var(--muted)]">
          100 ברדאר שייך לשחקן החזק ביותר בקבוצה בציר הזה, באותם משחקים שסוננו.
        </p>
        <p className="mb-3 rounded-2xl border border-[var(--border)] bg-[var(--panel)] px-3 py-2 text-sm text-[var(--muted)]">
          נוסחה: {explain.formula}
        </p>

        <h3 className="label mb-2">הנתונים שנכנסו</h3>
        <ul className="mb-4 flex flex-col gap-1.5">
          {explain.inputs.map((row) => (
            <li
              key={row.label}
              className="flex items-center justify-between rounded-xl border border-[var(--border)] bg-[var(--panel)] px-3 py-2 text-sm"
            >
              <span>
                {row.label}
                {row.weight ? <span className="text-[var(--muted-2)]"> {row.weight}</span> : null}
              </span>
              <span className="tabular font-bold">
                {row.value}
                {row.contribution !== 0 && row.contribution !== row.value ? (
                  <span className="ms-2 text-[var(--muted)]">
                    {row.contribution > 0 ? "+" : ""}
                    {row.contribution}
                  </span>
                ) : null}
              </span>
            </li>
          ))}
        </ul>

        {shownBreakdown && shownBreakdown.length > 0 && (
          <>
            <h3 className="label mb-2">פירוט ציון Impact</h3>
            <ul className="flex flex-col gap-1.5">
              {shownBreakdown.map((row) => (
                <li
                  key={row.key}
                  className="flex items-center justify-between rounded-xl border border-[var(--border)] bg-[var(--panel)] px-3 py-2 text-sm"
                >
                  <span>
                    {row.label}
                    <span className="ms-1 text-[11px] text-[var(--muted-2)]">
                      ({row.count} × {row.pointsEach > 0 ? "+" : ""}
                      {row.pointsEach})
                    </span>
                  </span>
                  <span
                    className={`tabular font-bold ${
                      row.total > 0
                        ? "text-[var(--accent)]"
                        : row.total < 0
                          ? "text-[var(--danger)]"
                          : "text-[var(--muted)]"
                    }`}
                  >
                    {row.total > 0 ? "+" : ""}
                    {row.total.toFixed(1)}
                  </span>
                </li>
              ))}
            </ul>
          </>
        )}
      </div>
    </div>
  );
}
