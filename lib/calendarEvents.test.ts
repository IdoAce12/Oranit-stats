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

  it("מדלג על משחק התאחדות שנמחק אחרי שהתאריך עבר", () => {
    const past = { ...leagueGame, date: "2026-09-01" };
    const key = ifaMatchKey(past.date, past.opponent);
    const events = buildCalendarEvents([], [past], [key], "2026-09-26");
    expect(events).toHaveLength(0);
  });

  it("מציג משחק עתידי גם אם נמחק, כל עוד התאריך לא הגיע", () => {
    const key = ifaMatchKey(leagueGame.date, leagueGame.opponent);
    const events = buildCalendarEvents([], [leagueGame], [key], "2026-09-26");
    expect(events).toHaveLength(1);
    expect(events[0].opponent).toBe("הפועל כפר קאסם");
  });

  it("מוסיף אימון ללוח בלי לבלבל עם משחק", () => {
    const events = buildCalendarEvents(
      [
        makeMatch({
          id: "m1",
          opponent: "מכבי השרון נתניה",
          match_date: "2026-09-28",
          status: "scheduled",
        }),
      ],
      [],
      [],
      "2026-09-26",
      [{ id: "tr1", date: "2026-09-27", time: "20:00", venue: "אורנית" }]
    );
    const training = events.find((e) => e.kind === "training");
    expect(training?.date).toBe("2026-09-27");
    expect(training?.venue).toBe("אורנית");
    expect(events.find((e) => e.kind === "match")?.opponent).toContain("השרון");
  });

  it("מציג השרון כמתוכנן גם אם נשאר משחק הושלם מול אותה יריבה", () => {
    const hasharon: IfaFixture = {
      date: "2026-09-28",
      opponent: "מכבי השרון נתניה",
      home: false,
      venue: "נתניה שפירא",
      time: "20:30",
      score: null,
      gameId: null,
    };
    const events = buildCalendarEvents(
      [
        makeMatch({
          id: "old",
          opponent: "מכבי השרון נתניה",
          match_date: "2026-09-28",
          status: "finished",
        }),
        makeMatch({
          id: "tovrok",
          opponent: 'בית"ר טוברוק',
          match_date: "2026-10-01",
          status: "scheduled",
        }),
      ],
      [hasharon],
      [],
      "2026-09-26"
    );
    const hasharonEvent = events.find((e) => e.opponent.includes("השרון"));
    expect(hasharonEvent?.status).toBe("scheduled");
    expect(nextCalendarDate(events, "2026-09-26", "2026-09-28")).toBe("2026-09-28");
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

  it("לא קופץ לטוברוק אם יש תאריך רשמי של השרון", () => {
    const events = buildCalendarEvents(
      [makeMatch({ id: "tovrok", match_date: "2026-10-01", status: "scheduled", opponent: 'בית"ר טוברוק' })],
      []
    );
    expect(nextCalendarDate(events, "2026-09-26", "2026-09-28")).toBe("2026-09-28");
  });
});

describe("כפילויות אחרי עדכון שעה", () => {
  it("משאיר שמשון אחד כשיש תאריך ישן בלי שעה ותאריך חדש עם שעה", () => {
    const events = buildCalendarEvents(
      [
        makeMatch({
          id: "old",
          opponent: "שמשון בני טייבה",
          match_date: "2026-10-06",
          status: "scheduled",
          match_type: "league",
        }),
      ],
      [
        {
          date: "2026-10-06",
          opponent: "שמשון בני טייבה",
          home: false,
          venue: "",
          time: null,
          score: null,
          gameId: null,
        },
        {
          date: "2026-10-08",
          opponent: "שמשון בני טייבה",
          home: false,
          venue: "",
          time: "20:00",
          score: null,
          gameId: "99",
        },
      ],
      [],
      "2026-09-30"
    );
    const shimshon = events.filter((e) => e.kind === "match" && e.opponent.includes("שמשון"));
    expect(shimshon).toHaveLength(1);
    expect(shimshon[0].date).toBe("2026-10-08");
    expect(shimshon[0].time).toBe("20:00");
  });

  it("מציג את טוברוק בדחייה ל-6/10 ולא את 1/10", () => {
    const events = buildCalendarEvents(
      [
        makeMatch({
          id: "t1",
          opponent: 'בית"ר טוברוק',
          match_date: "2026-10-01",
          status: "scheduled",
          match_type: "league",
          kickoff_at: "2026-10-01T14:00:00.000Z",
        }),
      ],
      [
        {
          date: "2026-10-06",
          opponent: 'בית"ר טוברוק',
          home: true,
          venue: "קרית אונו ישן",
          time: "21:30",
          score: null,
          gameId: "1",
        },
      ],
      [],
      "2026-09-30"
    );
    const tovrok = events.filter((e) => e.opponent.includes("טוברוק"));
    expect(tovrok).toHaveLength(1);
    expect(tovrok[0].date).toBe("2026-10-06");
    expect(tovrok[0].time).toBe("21:30");
    expect(nextCalendarDate(events, "2026-09-30", "2026-10-06")).toBe("2026-10-06");
  });
});
