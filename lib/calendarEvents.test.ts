import { describe, expect, it } from "vitest";
import { buildCalendarEvents, eventsOnDate, nextCalendarDate } from "./calendarEvents";
import type { IfaFixture } from "./ifa/parse";
import { ifaMatchKey } from "./ifa/parse";
import { makeMatch } from "./testHelpers";

const leagueGame: IfaFixture = {
  date: "2026-10-10",
  opponent: "הפועל כפר קאסם",
  home: true,
  venue: "אורנית",
  time: "19:15",
  score: null,
  gameId: "1",
};

describe("buildCalendarEvents", () => {
  it("לא מכפיל משחק שכבר במסד", () => {
    const matches = [
      makeMatch({
        id: "m1",
        opponent: "הפועל כפר קאסם",
        match_date: "2026-10-10",
        status: "scheduled",
        match_type: "league",
      }),
    ];
    const events = buildCalendarEvents(matches, [leagueGame]);
    expect(events).toHaveLength(1);
    expect(events[0].matchId).toBe("m1");
    expect(events[0].home).toBe(true);
    expect(events[0].venue).toBe("אורנית");
  });

  it("מוסיף משחק התאחדות שאין במסד", () => {
    const events = buildCalendarEvents([], [leagueGame]);
    expect(events).toHaveLength(1);
    expect(events[0].matchId).toBeNull();
    expect(events[0].opponent).toBe("הפועל כפר קאסם");
  });

  it("מדלג על משחק התאחדות שנמחק ידנית", () => {
    const key = ifaMatchKey(leagueGame.date, leagueGame.opponent);
    const events = buildCalendarEvents([], [leagueGame], [key]);
    expect(events).toHaveLength(0);
  });
});

describe("nextCalendarDate", () => {
  it("מעדיף את המשחק הבא מהיום", () => {
    const events = buildCalendarEvents(
      [
        makeMatch({ id: "old", match_date: "2026-09-01", status: "finished", opponent: "א" }),
        makeMatch({ id: "next", match_date: "2026-10-10", status: "scheduled", opponent: "ב" }),
      ],
      []
    );
    expect(nextCalendarDate(events, "2026-09-24")).toBe("2026-10-10");
    expect(eventsOnDate(events, "2026-10-10")).toHaveLength(1);
  });
});
