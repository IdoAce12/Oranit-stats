import { describe, expect, it } from "vitest";
import { formatRate, per90, scaleSeasonForRadar } from "./rates";
import type { SeasonImpact } from "./impactScore";

describe("per90", () => {
  it("מנרמל ל־90 דקות", () => {
    expect(per90(3, 90)).toBe(3);
    expect(per90(1, 45)).toBe(2);
    expect(per90(2, 60)).toBe(3);
    expect(per90(5, 0)).toBe(0);
  });
});

describe("formatRate", () => {
  it("בסה״כ מציג מספר שלם, בל־90׳ עשרונית", () => {
    expect(formatRate(2, 45, "total")).toBe("2");
    expect(formatRate(2, 45, "per90")).toBe("4");
  });
});

describe("scaleSeasonForRadar", () => {
  it("משאיר סה״כ כמו שהוא", () => {
    const row = { goals: 4, matchesPlayed: 8 } as SeasonImpact;
    expect(scaleSeasonForRadar(row, 180, "total").goals).toBe(4);
  });

  it("מנרמל מדדים ל־90׳ ומציב משחק אחד", () => {
    const row = {
      goals: 2,
      assists: 1,
      keyPasses: 4,
      tackles: 6,
      lossesTotal: 3,
      shotsInBox: 2,
      xg: 1,
      xa: 0.5,
      score: 9,
      matchesPlayed: 4,
    } as SeasonImpact;
    const scaled = scaleSeasonForRadar(row, 180, "per90");
    expect(scaled.goals).toBe(1);
    expect(scaled.matchesPlayed).toBe(1);
    expect(scaled.score).toBe(4.5);
  });
});
