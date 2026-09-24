"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import {
  calendarEventIcs,
  eventsByDate,
  eventsOnDate,
  nextCalendarDate,
  typeLine,
  whenLine,
  type CalendarEvent,
} from "@/lib/calendarEvents";
import {
  localISODate,
  monthCells,
  monthTitle,
  parseISODate,
  shiftMonth,
  weekdayLabels,
} from "@/lib/calendarMonth";
import { IFA_OUR_NAME } from "@/lib/ifa/config";
import type { IfaStandingRow } from "@/lib/ifa/parse";
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

export function MatchCalendar({
  events,
  standings,
  isCoach,
}: {
  events: CalendarEvent[];
  standings: IfaStandingRow[];
  isCoach: boolean;
}) {
  const today = localISODate();
  const byDate = useMemo(() => eventsByDate(events), [events]);
  const [year, setYear] = useState(() => {
    const iso = nextCalendarDate(events, today) ?? today;
    return parseISODate(iso)?.year ?? new Date().getFullYear();
  });
  const [month, setMonth] = useState(() => {
    const iso = nextCalendarDate(events, today) ?? today;
    return parseISODate(iso)?.month ?? new Date().getMonth() + 1;
  });
  const [selected, setSelected] = useState(() => nextCalendarDate(events, today) ?? today);
  const [didInit, setDidInit] = useState(events.length > 0);

  useEffect(() => {
    if (didInit || events.length === 0) return;
    const next = nextCalendarDate(events, today) ?? today;
    const parts = parseISODate(next);
    if (parts) {
      setYear(parts.year);
      setMonth(parts.month);
    }
    setSelected(next);
    setDidInit(true);
  }, [events, didInit, today]);

  const cells = useMemo(() => monthCells(year, month), [year, month]);
  const title = monthTitle(year, month);
  const selectedEvents = eventsOnDate(events, selected);
  const addTarget = selectedEvents[0] ?? null;

  const goMonth = (delta: number) => {
    const next = shiftMonth(year, month, delta);
    setYear(next.year);
    setMonth(next.month);
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
        <button
          type="button"
          className="cal-add"
          disabled={!addTarget}
          onClick={() => addTarget && downloadIcs(addTarget)}
        >
          הוסף ליומן
        </button>
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
          return (
            <button
              key={cell.iso}
              type="button"
              role="gridcell"
              aria-selected={selected === cell.iso}
              aria-label={`${cell.day}${has ? ` · מול ${mark.opponent}` : ""}`}
              className={`cal-cell ${selected === cell.iso ? "is-selected" : ""} ${cell.iso === today ? "is-today" : ""} ${has ? "has-match" : ""}`}
              onClick={() => setSelected(cell.iso!)}
            >
              {has ? (
                <CrestMark name={mark.opponent} standings={standings} size={30} />
              ) : (
                <span className="cal-num">{cell.day}</span>
              )}
            </button>
          );
        })}
      </div>

      <div className="cal-day-panel">
        {selectedEvents.length === 0 ? (
          <div className="cal-peek cal-peek-empty">אין משחק ביום הזה</div>
        ) : (
          selectedEvents.map((event) => (
            <MatchPeek key={event.key} event={event} standings={standings} isCoach={isCoach} />
          ))
        )}
      </div>
    </section>
  );
}
