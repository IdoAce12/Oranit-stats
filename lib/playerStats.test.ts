import { describe, expect, it } from "vitest";
import { computePlayerMatchStats, computeTeamTotals } from "./playerStats";
import { action, makeMatch, makePlayer, makeSub } from "./testHelpers";

describe("computeTeamTotals", () => {
  it("מסכם את כלל אירועי הקבוצה כולל קרנות ו-xG", () => {
    const events = [
      action("a", "goal"),
      action("a", "assist"),
      action("b", "shot", { shot_location: "in_box" }),
      action("b", "shot", { shot_location: "out_box" }),
      action("c", "tackle", { zone: "att" }),
      action("c", "ball_loss", { zone: "def" }),
      action("", "corner_for"),
      action("", "corner_against"),
    ];
    const t = computeTeamTotals(events);
    expect(t.goals).toBe(1);
    expect(t.assists).toBe(1);
    expect(t.shotsInBox).toBe(1);
    expect(t.shotsOutBox).toBe(1);
    expect(t.tackles.att).toBe(1);
    expect(t.losses.def).toBe(1);
    expect(t.cornersFor).toBe(1);
    expect(t.cornersAgainst).toBe(1);
    expect(t.eventsTotal).toBe(8);
    expect(t.xg).toBeCloseTo(0.32); // 0.25 + 0.07
  });
});

describe("computePlayerMatchStats", () => {
  it("מחשב פעולות ודקות משחק עם חילוף", () => {
    const players = [
      makePlayer({ id: "out", is_starter: true, shirt_number: 10, name: "פותח" }),
      makePlayer({ id: "in", is_starter: false, on_pitch: false, shirt_number: 15, name: "מחליף" }),
    ];
    const events = [action("out", "goal"), action("out", "key_pass", { zone: "mid" })];
    const subs = [makeSub({ player_out_id: "out", player_in_id: "in", half: 2, match_minute: 30 })]; // abs 75
    const match = makeMatch({ final_half: 2, final_minute: 90 });

    const stats = computePlayerMatchStats(events, players, { substitutions: subs, match });
    const out = stats.find((s) => s.playerId === "out")!;
    const inn = stats.find((s) => s.playerId === "in")!;

    expect(out.goals).toBe(1);
    expect(out.keyPassesTotal).toBe(1);
    expect(out.minutesPlayed).toBe(75);
    expect(inn.minutesPlayed).toBe(15);
    expect(inn.isStarter).toBe(false);
  });
});
