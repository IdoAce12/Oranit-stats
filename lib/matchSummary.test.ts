import { describe, expect, it } from "vitest";
import { buildMatchSummary, zoneHeatPercent } from "./matchSummary";
import { action, makePlayer } from "./testHelpers";

describe("zoneHeatPercent", () => {
  it("מחשב אחוזים לכל אזור", () => {
    expect(zoneHeatPercent({ def: 1, mid: 1, att: 2 })).toEqual({ def: 25, mid: 25, att: 50 });
  });

  it("מונע חלוקה באפס", () => {
    expect(zoneHeatPercent({ def: 0, mid: 0, att: 0 })).toEqual({ def: 0, mid: 0, att: 0 });
  });
});

describe("buildMatchSummary", () => {
  it("לא מחזיר שחקן מצטיין", () => {
    const players = [
      makePlayer({ id: "a", name: "כובש", shirt_number: 9 }),
      makePlayer({ id: "b", name: "מאבד", shirt_number: 5 }),
    ];
    const events = [
      action("a", "goal"),
      action("a", "assist"),
      action("b", "ball_loss", { zone: "def" }),
    ];
    const summary = buildMatchSummary(events, players);
    expect("motm" in summary).toBe(false);
    expect(summary.ourGoals).toBe(1);
  });

  it("מתריע על ריבוי איבודים כלליים", () => {
    const players = [makePlayer({ id: "a" })];
    const events = [
      action("a", "ball_loss", { zone: "def" }),
      action("a", "ball_loss", { zone: "mid" }),
      action("a", "ball_loss", { zone: "att" }),
      action("a", "ball_loss", { zone: "def" }),
      action("a", "ball_loss", { zone: "mid" }),
    ];
    const summary = buildMatchSummary(events, players);
    expect(summary.insights.some((i) => i.tone === "warn" && i.text.includes("איבודים כלליים"))).toBe(
      true
    );
  });

  it("מגביל ל-3 תובנות לכל היותר", () => {
    const players = [makePlayer({ id: "a" })];
    const events = [
      action("a", "goal"),
      action("a", "assist"),
      action("a", "key_pass", { zone: "att" }),
      action("a", "key_pass", { zone: "att" }),
      action("a", "key_pass", { zone: "att" }),
      action("a", "tackle", { zone: "att" }),
      action("a", "tackle", { zone: "att" }),
      action("a", "tackle", { zone: "att" }),
    ];
    const summary = buildMatchSummary(events, players);
    expect(summary.insights.length).toBeLessThanOrEqual(3);
  });
});
