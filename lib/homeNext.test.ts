import { describe, expect, it } from "vitest";
import { homeLiveMatch, homeNextMatch, isPendingIfaMatch, nextOfficialFixture } from "./homeNext";
import type { IfaFixture } from "./ifa/parse";
import { ifaMatchKey } from "./ifa/parse";
import { makeMatch } from "./testHelpers";

const hasharon: IfaFixture = {
  date: "2026-09-28",
  opponent: "מכבי השרון נתניה ויקטור עטיה",
  home: false,
  venue: "נתניה שפירא",
  time: "20:30",
  score: null,
  gameId: null,
};

const tovrok: IfaFixture = {
  date: "2026-10-01",
  opponent: 'בית"ר טוברוק',
  home: true,
  venue: "אורנית",
  time: null,
  score: null,
  gameId: null,
};

describe("nextOfficialFixture", () => {
  it("בוחר השרון לפני טוברוק", () => {
    expect(nextOfficialFixture([tovrok, hasharon], "2026-09-26")?.opponent).toContain("השרון");
  });
});

describe("homeNextMatch", () => {
  it("מציג השרון גם כשבמסד יש רק טוברוק מתוכננת", () => {
    const next = homeNextMatch(
      [
        makeMatch({
          id: "tovrok",
          status: "scheduled",
          opponent: 'בית"ר טוברוק',
          match_date: "2026-10-01",
        }),
      ],
      [hasharon, tovrok],
      "2026-09-26"
    );
    expect(next?.opponent).toContain("השרון");
    expect(isPendingIfaMatch(next!)).toBe(true);
  });

  it("לא שם טוברוק לייב מעל השרון בכרטיס הבית", () => {
    const liveTovrok = makeMatch({
      id: "live-t",
      status: "live",
      opponent: 'בית"ר טוברוק',
      match_date: "2026-10-01",
    });
    expect(homeLiveMatch([liveTovrok], [hasharon, tovrok], "2026-09-26")).toBeNull();
    expect(homeNextMatch([liveTovrok], [hasharon, tovrok], "2026-09-26")?.opponent).toContain("השרון");
  });

  it("משתמש במשחק מתוכנן מהמסד כשיש השרון", () => {
    const row = makeMatch({
      id: "h1",
      status: "scheduled",
      opponent: "מכבי השרון נתניה ויקטור עטיה",
      match_date: "2026-09-28",
      ifa_key: ifaMatchKey("2026-09-28", "מכבי השרון נתניה ויקטור עטיה"),
    });
    expect(homeNextMatch([row], [hasharon, tovrok], "2026-09-26")?.id).toBe("h1");
  });
});
