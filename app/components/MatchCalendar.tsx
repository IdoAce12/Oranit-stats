"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import {
  calendarEventIcs,
  eventsByDate,
  eventsOnDate,
  typeLine,
  whenLine,
  type CalendarEvent,
} from "@/lib/calendarEvents";
import {
  monthCells,
  monthTitle,
  parseISODate,
  shiftMonth,
  weekdayLabels,
} from "@/lib/calendarMonth";
import { israelToday } from "@/lib/fixtures";
import { IFA_OUR_NAME } from "@/lib/ifa/config";
import type { IfaStandingRow } from "@/lib/ifa/parse";
import { newTrainingId, type Training } from "@/lib/trainings";
import { CrestMark } from "./CrestMark";

function downloadIcs(event: CalendarEvent) {
  const blob = new Blob([calendarEventIcs(event)], { type: "text/calendar;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `oranit-${event.date}.ics`;
  a.click();
  URL.revokeObjectURL(url);
}

function MatchPeek({
  event,
  standings,
  isCoach,
}: {
  event: CalendarEvent;
  standings: IfaStandingRow[];
  isCoach: boolean;
}) {
  const href =
    event.status === "live" && event.matchId && isCoach
      ? `/live/${event.matchId}`
      : event.status === "finished" && event.matchId
        ? `/report/${event.matchId}`
        : null;

  return (
    <article className="cal-peek">
      <p className="cal-peek-when">{whenLine(event)}</p>
      <p className="cal-peek-meta">{typeLine(event)}</p>
      <div className="cal-peek-teams">
        <div className="cal-peek-club">
          <CrestMark name={IFA_OUR_NAME} standings={standings} ours size={56} />
          <span>אורנית</span>
        </div>
        <span className="cal-peek-vs">נגד</span>
        <div className="cal-peek-club">
          <CrestMark name={event.opponent} standings={standings} size={56} />
          <span>{event.opponent}</span>
        </div>
      </div>
      {event.score && <p className="cal-peek-score">{event.score}</p>}
      {href && (
        <Link href={href} className="mt-3 block text-center text-sm font-bold text-[var(--accent)]">
          {event.status === "live" ? "כניסה ללייב" : "לדוח המשחק"}
        </Link>
      )}
    </article>
  );
}

function TrainingPeek({
  event,
  isCoach,
  onEdit,
  onDelete,
}: {
  event: CalendarEvent;
  isCoach: boolean;
  onEdit: () => void;
  onDelete: () => void;
}) {
  return (
    <article className="cal-peek">
      <p className="cal-peek-when">{whenLine(event)}</p>
      <p className="cal-peek-meta">{typeLine(event)}</p>
      <div className="cal-training-hero">
        <CrestMark name={IFA_OUR_NAME} standings={[]} ours size={56} />
        <p className="cal-peek-score">אימון</p>
        {event.venue ? <p className="cal-peek-meta">{event.venue}</p> : null}
      </div>
      <div className="mt-3 flex justify-center gap-2">
        <button type="button" className="cal-add" onClick={() => downloadIcs(event)}>
          הוסף ליומן
        </button>
        {isCoach && (
          <>
            <button type="button" className="cal-add" onClick={onEdit}>
              עריכה
            </button>
            <button type="button" className="cal-add" onClick={onDelete}>
              מחק
            </button>
          </>
        )}
      </div>
    </article>
  );
}

function TrainingForm({
  date,
  initial,
  saving,
  onCancel,
  onSave,
}: {
  date: string;
  initial: Training | null;
  saving: boolean;
  onCancel: () => void;
  onSave: (row: Training) => void;
}) {
  const [sessionDate, setSessionDate] = useState(initial?.date ?? date);
  const [time, setTime] = useState(initial?.time ?? "20:00");
  const [venue, setVenue] = useState(initial?.venue ?? "");

  return (
    <form
      className="cal-peek text-start"
      onSubmit={(e) => {
        e.preventDefault();
        const loc = venue.trim();
        if (!loc) return;
        onSave({
          id: initial?.id ?? newTrainingId(),
          date: sessionDate,
          time: time.trim() || null,
          venue: loc,
        });
      }}
    >
      <p className="cal-peek-when mb-3">{initial ? "עריכת אימון" : "אימון חדש"}</p>
      <label className="mb-2 flex flex-col gap-1.5">
        <span className="label">תאריך</span>
        <input
          type="date"
          value={sessionDate}
          onChange={(e) => setSessionDate(e.target.value)}
          className="field w-full"
          required
        />
      </label>
      <label className="mb-2 flex flex-col gap-1.5">
        <span className="label">שעה</span>
        <input type="time" value={time} onChange={(e) => setTime(e.target.value)} className="field w-full" />
      </label>
      <label className="mb-3 flex flex-col gap-1.5">
        <span className="label">מיקום</span>
        <input
          value={venue}
          onChange={(e) => setVenue(e.target.value)}
          placeholder="לדוגמה: מגרש אורנית"
          className="field w-full"
          required
        />
      </label>
      <div className="flex gap-2">
        <button type="submit" disabled={saving} className="btn btn-primary flex-1 py-2.5 text-sm">
          {saving ? "שומר..." : "שמור"}
        </button>
        <button type="button" className="btn btn-ghost flex-1 py-2.5 text-sm" onClick={onCancel}>
          ביטול
        </button>
      </div>
    </form>
  );
}

export function MatchCalendar({
  events,
  standings,
  isCoach,
  focusDate,
  onSaveTraining,
  onDeleteTraining,
}: {
  events: CalendarEvent[];
  standings: IfaStandingRow[];
  isCoach: boolean;
  focusDate: string;
  onSaveTraining?: (row: Training) => Promise<void> | void;
  onDeleteTraining?: (id: string) => Promise<void> | void;
}) {
  const today = israelToday();
  const byDate = useMemo(() => eventsByDate(events), [events]);
  const [year, setYear] = useState(() => parseISODate(focusDate)?.year ?? new Date().getFullYear());
  const [month, setMonth] = useState(() => parseISODate(focusDate)?.month ?? new Date().getMonth() + 1);
  const [selected, setSelected] = useState(focusDate);
  const [editor, setEditor] = useState<Training | null | "new">(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    const parts = parseISODate(focusDate);
    if (!parts) return;
    setYear(parts.year);
    setMonth(parts.month);
    setSelected(focusDate);
  }, [focusDate]);

  const cells = useMemo(() => monthCells(year, month), [year, month]);
  const title = monthTitle(year, month);
  const selectedEvents = eventsOnDate(events, selected);
  const addTarget = selectedEvents.find((e) => e.kind !== "training") ?? selectedEvents[0] ?? null;

  const goMonth = (delta: number) => {
    const next = shiftMonth(year, month, delta);
    setYear(next.year);
    setMonth(next.month);
  };

  const saveTraining = async (row: Training) => {
    if (!onSaveTraining) return;
    setSaving(true);
    try {
      await onSaveTraining(row);
      setEditor(null);
      setSelected(row.date);
      const parts = parseISODate(row.date);
      if (parts) {
        setYear(parts.year);
        setMonth(parts.month);
      }
    } finally {
      setSaving(false);
    }
  };

  const removeTraining = async (id: string) => {
    if (!onDeleteTraining) return;
    if (!confirm("למחוק את האימון?")) return;
    await onDeleteTraining(id);
  };

  return (
    <section className="cal-wrap">
      <div className="cal-toolbar">
        <div className="cal-month-nav">
          <button type="button" className="cal-arrow" onClick={() => goMonth(-1)} aria-label="חודש קודם">
            ›
          </button>
          <div className="cal-month-label">
            <p>{title.month}</p>
            <span>{title.year}</span>
          </div>
          <button type="button" className="cal-arrow" onClick={() => goMonth(1)} aria-label="חודש הבא">
            ‹
          </button>
        </div>
        <div className="flex gap-2">
          {isCoach && (
            <button type="button" className="cal-add" onClick={() => setEditor("new")}>
              אימון
            </button>
          )}
          <button
            type="button"
            className="cal-add"
            disabled={!addTarget}
            onClick={() => addTarget && downloadIcs(addTarget)}
          >
            הוסף ליומן
          </button>
        </div>
      </div>

      <div className="cal-grid" role="grid" aria-label="לוח שנה">
        {weekdayLabels().map((d) => (
          <div key={d} className="cal-dow" role="columnheader">
            {d}
          </div>
        ))}
        {cells.map((cell, i) => {
          if (!cell.iso || !cell.day) {
            return <div key={`pad-${i}`} className="cal-cell is-empty" />;
          }
          const dayEvents = byDate.get(cell.iso) ?? [];
          const has = dayEvents.length > 0;
          const mark = dayEvents[0];
          const trainingOnly = has && dayEvents.every((e) => e.kind === "training");
          return (
            <button
              key={cell.iso}
              type="button"
              role="gridcell"
              aria-selected={selected === cell.iso}
              aria-label={`${cell.day}${has ? ` · ${trainingOnly ? "אימון" : `מול ${mark.opponent}`}` : ""}`}
              className={`cal-cell ${selected === cell.iso ? "is-selected" : ""} ${cell.iso === today ? "is-today" : ""} ${has ? "has-match" : ""}`}
              onClick={() => setSelected(cell.iso!)}
            >
              {has ? (
                trainingOnly ? (
                  <span className="cal-training-mark" aria-hidden>
                    א
                  </span>
                ) : (
                  <CrestMark name={mark.opponent} standings={standings} size={30} />
                )
              ) : (
                <span className="cal-num">{cell.day}</span>
              )}
            </button>
          );
        })}
      </div>

      <div className="cal-day-panel">
        {editor && isCoach ? (
          <TrainingForm
            key={editor === "new" ? `new-${selected}` : editor.id}
            date={selected}
            initial={editor === "new" ? null : editor}
            saving={saving}
            onCancel={() => setEditor(null)}
            onSave={(row) => void saveTraining(row)}
          />
        ) : selectedEvents.length === 0 ? (
          <div className="cal-peek cal-peek-empty">
            {isCoach ? "אין אירוע ביום הזה. אפשר להוסיף אימון." : "אין אירוע ביום הזה"}
          </div>
        ) : (
          selectedEvents.map((event) =>
            event.kind === "training" ? (
              <TrainingPeek
                key={event.key}
                event={event}
                isCoach={isCoach}
                onEdit={() =>
                  setEditor({
                    id: event.trainingId ?? event.key,
                    date: event.date,
                    time: event.time,
                    venue: event.venue,
                  })
                }
                onDelete={() => event.trainingId && void removeTraining(event.trainingId)}
              />
            ) : (
              <MatchPeek key={event.key} event={event} standings={standings} isCoach={isCoach} />
            )
          )
        )}
      </div>
    </section>
  );
}
