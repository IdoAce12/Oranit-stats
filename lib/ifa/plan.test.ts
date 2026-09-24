import { describe, expect, it } from "vitest";
import { makeMatch } from "../testHelpers";
import { ifaMatchKey, type IfaFixture } from "./parse";
import { findExistingIfaMatch, isIfaCacheFresh, planFixtureSync } from "./plan";

function fixture(overrides: Partial<IfaFixture> = {}): IfaFixture {
  return {
    date: "2026-09-28",
    opponent: "מכבי השרון נתניה",
    home: false,
    venue: "נתניה שפירא",
    time: "20:30",
    score: null,
    gameId: null,
    ...overrides,
  };
}

describe("planFixtureSync", () => {
  it("מוסיף משחק מתוכנן בלי תוצאה", () => {
    const plan = planFixtureSync([], [fixture()]);
    expect(plan.inserts).toHaveLength(1);
    expect(plan.inserts[0].status).toBe("scheduled");
    expect(plan.inserts[0].ifa_key).toBe(ifaMatchKey("2026-09-28", "מכבי השרון נתניה"));
    expect(plan.inserts[0].kickoff_at).toBe("2026-09-28T17:30:00.000Z");
    expect(plan.inserts[0].notes).toContain("חוץ");
  });

  it("מדלג על משחק עם תוצאה ולא מוחק ידידות", () => {
    const friendly = makeMatch({
      id: "f1",
      status: "scheduled",
      match_type: "friendly",
      opponent: "אימון פנימי",
      match_date: "2026-09-30",
    });
    const plan = planFixtureSync([friendly], [fixture({ score: "1-0" })]);
    expect(plan.inserts).toHaveLength(0);
    expect(plan.updates).toHaveLength(0);
    expect(plan.skipped).toBe(1);
  });

  it("לא יוצר כפילות לפי מפתח או תאריך+יריבה", () => {
    const existing = makeMatch({
      id: "m1",
      status: "scheduled",
      opponent: "מכבי השרון נתניה",
      match_date: "2026-09-28",
      ifa_key: ifaMatchKey("2026-09-28", "מכבי השרון נתניה"),
      kickoff_at: "2026-09-28T17:30:00.000Z",
      notes: "חוץ · נתניה שפירא",
    });
    const plan = planFixtureSync([existing], [fixture()]);
    expect(plan.inserts).toHaveLength(0);
    expect(plan.updates).toHaveLength(0);
  });

  it("מעדכן שעה של משחק מתוכנן ולא דורס לייב", () => {
    const scheduled = makeMatch({
      id: "s1",
      status: "scheduled",
      opponent: "מכבי השרון נתניה",
      match_date: "2026-09-28",
      kickoff_at: null,
    });
    const live = makeMatch({
      id: "l1",
      status: "live",
      opponent: "בני טירה",
      match_date: "2026-09-19",
    });
    const plan = planFixtureSync(
      [scheduled, live],
      [fixture(), fixture({ date: "2026-09-19", opponent: "בני טירה", time: "21:00" })]
    );
    expect(plan.inserts).toHaveLength(0);
    expect(plan.updates).toHaveLength(1);
    expect(plan.updates[0].id).toBe("s1");
    expect(plan.updates[0].kickoff_at).toBe("2026-09-28T17:30:00.000Z");
  });

  it("00:00 נשמר בלי שעת שריקה", () => {
    const plan = planFixtureSync([], [fixture({ time: null, home: true, venue: "" })]);
    expect(plan.inserts[0].kickoff_at).toBeNull();
    expect(plan.inserts[0].notes).toBe("בית");
  });

  it("מזהה דחייה לפי יריבה בלי ליצור כפילות", () => {
    const existing = makeMatch({
      id: "s1",
      status: "scheduled",
      opponent: "בית״ר טוברוק",
      match_date: "2026-10-01",
      match_type: "league",
    });
    const found = findExistingIfaMatch([existing], fixture({ date: "2026-10-08", opponent: 'בית"ר טוברוק' }));
    expect(found?.id).toBe("s1");
  });
});

describe("isIfaCacheFresh", () => {
  it("פג אחרי חלון היישון", () => {
    const now = Date.parse("2026-09-24T08:00:00.000Z");
    expect(isIfaCacheFresh("2026-09-24T07:00:00.000Z", now, 6 * 60 * 60 * 1000)).toBe(true);
    expect(isIfaCacheFresh("2026-09-23T08:00:00.000Z", now, 6 * 60 * 60 * 1000)).toBe(false);
    expect(isIfaCacheFresh(null, now, 6 * 60 * 60 * 1000)).toBe(false);
  });
});
