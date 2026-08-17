import { describe, expect, it } from "vitest";
import {
  buildRadarData,
  computeTeamSeasonTrend,
  RADAR_AXES,
  roundMetric,
  xaForEvent,
  xgForEvent,
  type RadarSource,
} from "./advancedMetrics";
import { action, makeMatch } from "./testHelpers";

describe("xgForEvent / xaForEvent", () => {
  it("xG לפי מיקום האיום", () => {
    expect(xgForEvent(action("p", "shot", { shot_location: "in_box" }))).toBeCloseTo(0.25);
    expect(xgForEvent(action("p", "shot", { shot_location: "out_box" }))).toBeCloseTo(0.07);
    expect(xgForEvent(action("p", "goal"))).toBe(0);
  });

  it("xA רק על מסירת מפתח", () => {
    expect(xaForEvent(action("p", "key_pass", { zone: "att" }))).toBeCloseTo(0.12);
    expect(xaForEvent(action("p", "assist"))).toBe(0);
  });
});

describe("roundMetric", () => {
  it("מעגל לשתי ספרות כברירת מחדל", () => {
    expect(roundMetric(1.23456)).toBe(1.23);
    expect(roundMetric(0.005)).toBe(0.01);
    expect(roundMetric(2)).toBe(2);
  });

  it("מכבד מספר ספרות מותאם", () => {
    expect(roundMetric(1.23456, 1)).toBe(1.2);
  });
});

function source(overrides: Partial<RadarSource> = {}): RadarSource {
  return {
    goals: 0,
    assists: 0,
    keyPasses: 0,
    tackles: 0,
    lossesTotal: 0,
    shotsInBox: 0,
    xg: 0,
    xa: 0,
    score: 0,
    matchesPlayed: 1,
    ...overrides,
  };
}

describe("buildRadarData", () => {
  it("מחזיר ציר לכל מדד עם ערכים 0–100", () => {
    const striker = source({ goals: 5, shotsInBox: 5, xg: 2, score: 15 });
    const defender = source({ tackles: 8, score: 6 });
    const data = buildRadarData(striker, [striker, defender]);
    expect(data).toHaveLength(RADAR_AXES.length);
    expect(data[0].axis).toBe("התקפה");
    for (const d of data) {
      expect(d.a).toBeGreaterThanOrEqual(0);
      expect(d.a).toBeLessThanOrEqual(100);
    }
    const attack = data.find((d) => d.axis === "התקפה")!;
    expect(attack.a).toBe(100); // החלוץ מוביל בהתקפה מול הסגל
  });

  it("כולל סדרה שנייה בהשוואה", () => {
    const a = source({ goals: 4, score: 12 });
    const b = source({ tackles: 6, score: 5 });
    const data = buildRadarData(a, [a, b], b);
    const defense = data.find((d) => d.axis === "הגנה")!;
    expect(defense.b).toBe(100);
  });
});

describe("computeTeamSeasonTrend", () => {
  it("סופר מדדים לכל משחק וצובר מספר משחקים לפי תאריך", () => {
    const matches = [
      makeMatch({ id: "m1", opponent: "א", match_date: "2026-01-10" }),
      makeMatch({ id: "m2", opponent: "ב", match_date: "2026-02-10" }),
    ];
    const events = [
      action("p", "goal", { match_id: "m1" }),
      action("p", "assist", { match_id: "m1" }),
      action("p", "key_pass", { match_id: "m2", zone: "att" }),
      action("p", "tackle", { match_id: "m2", zone: "mid" }),
      action("p", "ball_loss", { match_id: "m2", zone: "def" }),
    ];
    const trend = computeTeamSeasonTrend(events, matches);
    expect(trend.map((t) => t.matchId)).toEqual(["m1", "m2"]);
    expect(trend[0].matchesPlayed).toBe(1);
    expect(trend[1].matchesPlayed).toBe(2);
    expect(trend[0].goals).toBe(1);
    expect(trend[0].assists).toBe(1);
    expect(trend[1].keyPasses).toBe(1);
    expect(trend[1].tackles).toBe(1);
    expect(trend[1].losses).toBe(1);
  });
});
