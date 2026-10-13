"use client";

import { MatchEvent } from "@/lib/types";
import { PlayerMatchStats } from "@/lib/playerStats";
import { ACTION_LABELS } from "@/lib/types";
import { gkCountsTotal, isGkAction, pct } from "@/lib/gk";
import type { ReactNode } from "react";

interface Props {
  stats: PlayerMatchStats;
  events: MatchEvent[];
  opponent?: string;
  onClose: () => void;
}

export function GkCardSheet({ stats, events, opponent, onClose }: Props) {
  const gkEvents = events
    .filter((e) => e.player_id === stats.playerId && isGkAction(e.action_type))
    .sort(
      (a, b) =>
        a.half - b.half || a.match_minute - b.match_minute || a.created_at.localeCompare(b.created_at)
    );

  const scoreText = `${stats.score > 0 ? "+" : ""}${stats.score.toFixed(1)}`;
  const passTotal = stats.gkPassOk + stats.gkPassMiss;
  const aerialTotal = stats.gkAerialOk + stats.gkAerialMiss;
  const exitTotal = stats.gkExitOk + stats.gkExitBad;

  const printCard = () => {
    const prev = document.title;
    document.title = `כרטיס שוער — ${stats.label} · ציון ${scoreText}`;
    window.print();
    window.setTimeout(() => {
      document.title = prev;
    }, 1000);
  };

  return (
    <div
      className="sheet-overlay fixed inset-0 z-50 flex items-end bg-black/60 backdrop-blur-sm sm:items-center sm:justify-center sm:p-6"
      onClick={onClose}
    >
      <div
        className="sheet-panel sheet max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-t-3xl border-t border-[var(--border-strong)] bg-[var(--bg)] p-4 pb-8 sm:rounded-3xl sm:border"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-4 flex items-start justify-between gap-3">
          <div>
            <p className="text-[11px] font-bold text-[var(--muted)]">כרטיס שוער</p>
            <h2 className="text-2xl font-black leading-tight">
              <span className="tabular text-violet-300">
                {stats.shirtNumber != null ? `#${stats.shirtNumber}` : "—"}
              </span>{" "}
              {stats.name}
            </h2>
            <p className="mt-1 text-xs text-[var(--muted-2)]">
              {stats.minutesLabel || `${stats.minutesPlayed}׳`} · {gkCountsTotal(stats)} פעולות שוער
              {opponent ? ` · מול ${opponent}` : ""}
            </p>
          </div>
          <div className="no-print flex shrink-0 items-center gap-1.5">
            <button onClick={printCard} className="btn btn-ghost h-9 px-3 text-sm">
              PDF
            </button>
            <button onClick={onClose} className="btn btn-ghost h-9 px-3 text-sm">
              סגור
            </button>
          </div>
        </div>

        <div className="card mb-3 border border-violet-400/30 bg-violet-500/10 p-4 text-center">
          <p className="label mb-1">ציון Impact שוער</p>
          <p
            className={`tabular text-5xl font-black ${
              stats.score > 0
                ? "text-violet-300"
                : stats.score < 0
                  ? "text-[var(--danger)]"
                  : "text-[var(--muted)]"
            }`}
          >
            {scoreText}
          </p>
          <p className="mt-1 text-xs text-[var(--muted)]">
            {stats.minutesPlayed} דקות
            {stats.isStarter ? " · פותח" : " · ספסל"}
          </p>
        </div>

        <div className="mb-3 grid grid-cols-2 gap-2">
          <BigStat value={stats.gkSaves} label="הדיפת מפתח" tone="violet" />
          <BigStat value={stats.minutesPlayed} label="דקות" tone="accent" />
        </div>

        <OutcomeCard
          title="מסירה"
          ok={stats.gkPassOk}
          miss={stats.gkPassMiss}
          okLabel="הגיע"
          missLabel="לא הגיע"
          rate={pct(stats.gkPassOk, passTotal)}
        />
        <OutcomeCard
          title="כדור גובה"
          ok={stats.gkAerialOk}
          miss={stats.gkAerialMiss}
          okLabel="הגיע"
          missLabel="לא הגיע"
          rate={pct(stats.gkAerialOk, aerialTotal)}
        />
        <OutcomeCard
          title="יציאה מהשער"
          ok={stats.gkExitOk}
          miss={stats.gkExitBad}
          okLabel="טובה"
          missLabel="לא טובה"
          rate={pct(stats.gkExitOk, exitTotal)}
        />

        <Section title={`פעולות שוער (${gkEvents.length})`}>
          {gkEvents.length === 0 ? (
            <p className="text-center text-sm text-[var(--muted)]">אין עדיין פעולות שוער.</p>
          ) : (
            <ul className="flex flex-col gap-1.5">
              {gkEvents.map((ev) => (
                <li
                  key={ev.id}
                  className="flex items-center justify-between rounded-xl border border-[var(--border)] bg-[var(--panel)] px-3 py-2 text-sm"
                >
                  <span className="flex items-center gap-2">
                    <span className="tabular text-[var(--muted-2)]">{ev.match_minute}׳</span>
                    <span className="font-bold">{ACTION_LABELS[ev.action_type]}</span>
                  </span>
                  <span className="text-[10px] text-[var(--muted-2)]">מח׳ {ev.half}</span>
                </li>
              ))}
            </ul>
          )}
        </Section>
      </div>
    </div>
  );
}

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div className="mb-4">
      <p className="label mb-2">{title}</p>
      {children}
    </div>
  );
}

function OutcomeCard({
  title,
  ok,
  miss,
  okLabel,
  missLabel,
  rate,
}: {
  title: string;
  ok: number;
  miss: number;
  okLabel: string;
  missLabel: string;
  rate: string;
}) {
  return (
    <div className="card mb-3 p-3">
      <div className="mb-2 flex items-center justify-between">
        <p className="text-sm font-extrabold">{title}</p>
        <p className="tabular text-sm font-black text-violet-300">{rate}</p>
      </div>
      <div className="grid grid-cols-2 gap-2 text-center">
        <div className="rounded-xl bg-emerald-500/10 py-3">
          <div className="tabular text-2xl font-black text-emerald-300">{ok}</div>
          <div className="text-[11px] text-[var(--muted)]">{okLabel}</div>
        </div>
        <div className="rounded-xl bg-red-500/10 py-3">
          <div className="tabular text-2xl font-black text-red-300">{miss}</div>
          <div className="text-[11px] text-[var(--muted)]">{missLabel}</div>
        </div>
      </div>
    </div>
  );
}

function BigStat({
  value,
  label,
  tone,
}: {
  value: number | string;
  label: string;
  tone?: "accent" | "violet";
}) {
  const color = tone === "violet" ? "text-violet-300" : "text-[var(--accent)]";
  return (
    <div className="card p-3 text-center">
      <div className={`tabular text-3xl font-black ${color}`}>{value}</div>
      <div className="mt-0.5 text-xs text-[var(--muted)]">{label}</div>
    </div>
  );
}
