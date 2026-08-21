"use client";

import { MatchEvent } from "@/lib/types";
import { PlayerMatchStats } from "@/lib/playerStats";
import { roundMetric } from "@/lib/advancedMetrics";
import { ACTION_LABELS, ZONE_LABELS, SHOT_LABELS } from "@/lib/types";
import type { ReactNode } from "react";

interface Props {
  stats: PlayerMatchStats;
  events: MatchEvent[];
  onClose: () => void;
}

export function PlayerCardSheet({ stats, events, onClose }: Props) {
  const playerEvents = events
    .filter((e) => e.player_id === stats.playerId)
    .sort(
      (a, b) =>
        a.half - b.half || a.match_minute - b.match_minute || a.created_at.localeCompare(b.created_at)
    );

  const scoreText = `${stats.score > 0 ? "+" : ""}${stats.score.toFixed(1)}`;

  const printPlayer = () => {
    const prev = document.title;
    document.title = `כרטיס שחקן — ${stats.label} · ציון ${scoreText}`;
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
            <p className="text-[11px] font-bold text-[var(--muted)]">כרטיס שחקן</p>
            <h2 className="text-2xl font-black leading-tight">
              <span className="tabular text-[var(--accent)]">
                {stats.shirtNumber != null ? `#${stats.shirtNumber}` : "—"}
              </span>{" "}
              {stats.name}
            </h2>
            <p className="mt-1 text-xs text-[var(--muted-2)]">
              {stats.minutesLabel || `${stats.minutesPlayed}׳`} · {stats.actionsTotal} פעולות
            </p>
          </div>
          <div className="no-print flex shrink-0 items-center gap-1.5">
            <button onClick={printPlayer} className="btn btn-ghost h-9 px-3 text-sm">
              PDF
            </button>
            <button onClick={onClose} className="btn btn-ghost h-9 px-3 text-sm">
              סגור
            </button>
          </div>
        </div>

        <div className="card mb-3 border border-[var(--accent)]/30 bg-[var(--accent)]/10 p-4 text-center">
          <p className="label mb-1">ציון Impact</p>
          <p
            className={`tabular text-5xl font-black ${
              stats.score > 0
                ? "text-[var(--accent)]"
                : stats.score < 0
                  ? "text-[var(--danger)]"
                  : "text-[var(--muted)]"
            }`}
          >
            {scoreText}
          </p>
          <p className="mt-1 text-xs text-[var(--muted)]">
            {stats.minutesPlayed} דקות משחק
            {stats.isStarter ? " · פותח" : " · ספסל"}
          </p>
        </div>

        <div className="mb-3 grid grid-cols-3 gap-2">
          <BigStat value={stats.minutesPlayed} label="דקות" tone="accent" />
          <BigStat value={stats.goals} label="שערים" tone="violet" />
          <BigStat value={stats.assists} label="בישולים" tone="cyan" />
        </div>

        <div className="mb-3 grid grid-cols-3 gap-2">
          <BigStat value={stats.keyPassesTotal} label="מס״מ" tone="info" />
          <BigStat value={stats.tacklesTotal} label="חילוצים" tone="accent" />
          <BigStat value={stats.lossesTotal} label="איבודים" tone="danger" />
        </div>
        <div className="mb-3 grid grid-cols-2 gap-2">
          <BigStat value={roundMetric(stats.xg)} label="xG" tone="info" />
          <BigStat value={roundMetric(stats.xa)} label="xA" tone="cyan" />
        </div>

        <div className="mb-3 grid grid-cols-2 gap-2">
          <BigStat
            value={`זכה ${stats.aerialWon} · הפסיד ${stats.aerialLost}`}
            label="מאבקי אוויר"
            tone="info"
          />
          <BigStat
            value={`זכה ${stats.groundWon} · הפסיד ${stats.groundLost}`}
            label="מאבקי קרקע"
            tone="accent"
          />
        </div>

        {/* פירוק אזורים */}
        <Section title="איבודי כדור לפי אזור">
          <ZoneRow data={stats.losses} highlight="def" tone="danger" />
        </Section>

        <Section title="חילוצים לפי אזור">
          <ZoneRow data={stats.tackles} highlight="att" tone="accent" />
        </Section>

        <Section title="מסירות מפתח לפי אזור">
          <ZoneRow data={stats.keyPasses} highlight="att" tone="info" />
        </Section>

        <Section title="איומים לשער">
          <div className="grid grid-cols-3 gap-2 text-center">
            <Mini value={stats.shotsInBox} label="ברחבה" />
            <Mini value={stats.shotsOutBox} label="מחוץ" />
            <Mini value={stats.shotsTotal} label="סה״כ" bold />
          </div>
        </Section>

        {/* לוג אישי */}
        <Section title={`פעולות במשחק (${playerEvents.length})`}>
          {playerEvents.length === 0 ? (
            <p className="text-center text-sm text-[var(--muted)]">אין עדיין פעולות לשחקן זה.</p>
          ) : (
            <ul className="flex flex-col gap-1.5">
              {playerEvents.map((ev) => (
                <li
                  key={ev.id}
                  className="flex items-center justify-between rounded-xl border border-[var(--border)] bg-[var(--panel)] px-3 py-2 text-sm"
                >
                  <span className="flex items-center gap-2">
                    <span className="tabular text-[var(--muted-2)]">{ev.match_minute}׳</span>
                    <span className="font-bold">{ACTION_LABELS[ev.action_type]}</span>
                    {ev.zone && (
                      <span className="text-[var(--muted-2)]">· {ZONE_LABELS[ev.zone]}</span>
                    )}
                    {ev.shot_location && (
                      <span className="text-[var(--muted-2)]">· {SHOT_LABELS[ev.shot_location]}</span>
                    )}
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

function BigStat({
  value,
  label,
  tone,
}: {
  value: number | string;
  label: string;
  tone?: "accent" | "info" | "danger" | "violet" | "cyan";
}) {
  const color =
    tone === "accent"
      ? "text-[var(--accent)]"
      : tone === "info"
        ? "text-[var(--info)]"
        : tone === "danger"
          ? "text-[var(--danger)]"
          : tone === "violet"
            ? "text-violet-300"
            : tone === "cyan"
              ? "text-cyan-300"
              : "";
  return (
    <div className="card p-3 text-center">
      <div className={`tabular text-3xl font-black ${color}`}>{value}</div>
      <div className="mt-0.5 text-xs text-[var(--muted)]">{label}</div>
    </div>
  );
}

function Mini({ value, label, bold }: { value: number; label: string; bold?: boolean }) {
  return (
    <div className="rounded-xl bg-[var(--panel-strong)] py-3">
      <div className={`tabular text-xl ${bold ? "font-black" : "font-bold"}`}>{value}</div>
      <div className="text-[11px] text-[var(--muted)]">{label}</div>
    </div>
  );
}

function ZoneRow({
  data,
  highlight,
  tone,
}: {
  data: Record<"def" | "mid" | "att", number>;
  highlight: "def" | "mid" | "att";
  tone: "danger" | "accent" | "info";
}) {
  return (
    <div className="grid grid-cols-3 gap-2 text-center">
      {(["def", "mid", "att"] as const).map((z) => (
        <div key={z} className="rounded-xl bg-[var(--panel-strong)] py-3">
          <div
            className={`tabular text-xl font-black ${
              z === highlight
                ? tone === "danger"
                  ? "text-[var(--danger)]"
                  : tone === "accent"
                    ? "text-[var(--accent)]"
                    : "text-[var(--info)]"
                : ""
            }`}
          >
            {data[z]}
          </div>
          <div className="text-[11px] text-[var(--muted)]">{ZONE_LABELS[z]}</div>
        </div>
      ))}
    </div>
  );
}
