import { describe, expect, it } from "vitest";
import { describeRadarAxis, radarAxisFromLabel } from "./radarExplain";

const row = {
  goals: 3,
  assists: 2,
  keyPasses: 4,
  tackles: 8,
  lossesTotal: 5,
  shotsInBox: 6,
  score: 12.5,
  matchesPlayed: 4,
};

describe("radarAxisFromLabel", () => {
  it("ממפה תווית עברית למפתח", () => {
    expect(radarAxisFromLabel("השפעה")).toBe("impact");
    expect(radarAxisFromLabel("התקפה")).toBe("attack");
    expect(radarAxisFromLabel("אין")).toBeNull();
  });
});

describe("describeRadarAxis", () => {
  it("מחשב התקפה לפי שערים, איומים ומס״מ", () => {
    const d = describeRadarAxis("attack", row, 80);
    expect(d.raw).toBe(3 * 3 + 6 + 4);
    expect(d.percentile).toBe(80);
    expect(d.inputs.map((i) => i.label)).toEqual(["שערים", "איומים ברחבה", "מסירות מפתח"]);
  });

  it("מסביר השפעה לפי ציון Impact", () => {
    const d = describeRadarAxis("impact", row, 55);
    expect(d.raw).toBe(12.5);
    expect(d.blurb).toMatch(/Impact/);
    expect(d.formula).toContain("Impact");
  });

  it("שליטה יורדת עם איבודים", () => {
    const d = describeRadarAxis("control", row, 40);
    expect(d.raw).toBe(4 * 3 - 5);
  });
});
