import { describe, expect, it } from "vitest";
import {
  computeImpact,
  computePlayerSeasonMatches,
  computeSeasonImpact,
  computeSeasonMinutesByKey,
  scoreForEvent,
} from "./impactScore";
import { action, makeEvent, makeMatch, makePlayer, makeSquadPlayer, makeSub } from "./testHelpers";

describe("scoreForEvent", () => {
  it("מנקד פעולות לפי המשקולות", () => {
    expect(scoreForEvent(action("p", "key_pass", { zone: "mid" }))).toBe(2);
    expect(scoreForEvent(action("p", "goal"))).toBe(3);
    expect(scoreForEvent(action("p", "assist"))).toBe(2);
  });

  it("חילוץ תלוי אזור", () => {
    expect(scoreForEvent(action("p", "tackle", { zone: "def" }))).toBe(0.5);
    expect(scoreForEvent(action("p", "tackle", { zone: "mid" }))).toBe(1.5);
    expect(scoreForEvent(action("p", "tackle", { zone: "att" }))).toBe(1.5);
  });

  it("איבוד כדור בהגנה מעניש, באמצע/התקפה ניטרלי", () => {
    expect(scoreForEvent(action("p", "ball_loss", { zone: "def" }))).toBe(-2);
    expect(scoreForEvent(action("p", "ball_loss", { zone: "mid" }))).toBe(0);
    expect(scoreForEvent(action("p", "ball_loss", { zone: "att" }))).toBe(0);
  });

  it("איום מתוך הרחבה שווה נקודה, מבחוץ ניטרלי", () => {
    expect(scoreForEvent(action("p", "shot", { shot_location: "in_box" }))).toBe(1);
    expect(scoreForEvent(action("p", "shot", { shot_location: "out_box" }))).toBe(0);
  });

  it("קרנות לא משפיעות על שחקן", () => {
    expect(scoreForEvent(action("p", "corner_for"))).toBe(0);
    expect(scoreForEvent(action("p", "corner_against"))).toBe(0);
  });
});

describe("computeImpact", () => {
  it("מסכם ניקוד וסופר פעולות לכל שחקן וממיין יורד", () => {
    const players = [
      makePlayer({ id: "a", shirt_number: 10, name: "עידו" }),
      makePlayer({ id: "b", shirt_number: 4, name: "דן" }),
    ];
    const events = [
      action("a", "goal"),
      action("a", "key_pass", { zone: "mid" }),
      action("b", "ball_loss", { zone: "def" }),
    ];
    const res = computeImpact(events, players);
    expect(res[0].playerId).toBe("a");
    expect(res[0].score).toBe(5);
    expect(res[0].goals).toBe(1);
    expect(res[0].keyPasses).toBe(1);
    const dan = res.find((r) => r.playerId === "b")!;
    expect(dan.score).toBe(-2);
    expect(dan.lossesByZone.def).toBe(1);
  });

  it("מקבץ אירועים ללא שחקן תחת מפתח נפרד", () => {
    const events = [makeEvent({ player_id: null, action_type: "goal" })];
    const res = computeImpact(events, []);
    expect(res.some((r) => r.playerId === null)).toBe(true);
  });
});

describe("computeSeasonImpact", () => {
  it("מאחד שחקן סגל בין משחקים לפי squad_player_id", () => {
    const squad = [makeSquadPlayer({ id: "sq1", shirt_number: 9, name: "רועי" })];
    const players = [
      makePlayer({ id: "pa", match_id: "m1", squad_player_id: "sq1", shirt_number: 9, name: "רועי" }),
      makePlayer({ id: "pb", match_id: "m2", squad_player_id: "sq1", shirt_number: 9, name: "רועי" }),
    ];
    const events = [
      action("pa", "goal", { match_id: "m1" }),
      action("pb", "goal", { match_id: "m2" }),
      action("pb", "assist", { match_id: "m2" }),
    ];
    const rows = computeSeasonImpact(events, players, squad);
    expect(rows).toHaveLength(1);
    const row = rows[0];
    expect(row.key).toBe("sq:sq1");
    expect(row.goals).toBe(2);
    expect(row.assists).toBe(1);
    expect(row.matchesPlayed).toBe(2);
    expect(row.score).toBe(8);
    expect(row.perMatch).toBeCloseTo(4);
  });

  it("ממיין את השחקנים לפי ציון יורד", () => {
    const squad = [
      makeSquadPlayer({ id: "s1", shirt_number: 1, name: "נמוך" }),
      makeSquadPlayer({ id: "s2", shirt_number: 2, name: "גבוה" }),
    ];
    const players = [
      makePlayer({ id: "p1", squad_player_id: "s1", name: "נמוך" }),
      makePlayer({ id: "p2", squad_player_id: "s2", name: "גבוה" }),
    ];
    const events = [action("p1", "ball_loss", { zone: "def" }), action("p2", "goal")];
    const rows = computeSeasonImpact(events, players, squad);
    expect(rows[0].key).toBe("sq:s2");
    expect(rows[rows.length - 1].key).toBe("sq:s1");
  });

  it("מעגל xG/xA לשתי ספרות (בלי שאריות נקודה צפה)", () => {
    const squad = [makeSquadPlayer({ id: "s1", name: "חלוץ" })];
    const players = [makePlayer({ id: "p1", squad_player_id: "s1", name: "חלוץ" })];
    const events = [
      action("p1", "shot", { shot_location: "in_box" }),
      action("p1", "shot", { shot_location: "in_box" }),
      action("p1", "shot", { shot_location: "out_box" }),
      action("p1", "shot", { shot_location: "out_box" }),
    ];
    const row = computeSeasonImpact(events, players, squad)[0];
    expect(row.xg).toBe(0.64);
  });

  it("מפצל איבודים לפי אזור", () => {
    const squad = [makeSquadPlayer({ id: "s1", name: "בלם" })];
    const players = [makePlayer({ id: "p1", squad_player_id: "s1", name: "בלם" })];
    const events = [
      action("p1", "ball_loss", { zone: "def" }),
      action("p1", "ball_loss", { zone: "mid" }),
      action("p1", "ball_loss", { zone: "att" }),
    ];
    const row = computeSeasonImpact(events, players, squad)[0];
    expect(row.lossesTotal).toBe(3);
    expect(row.defLosses).toBe(1);
    expect(row.midLosses).toBe(1);
    expect(row.attLosses).toBe(1);
  });
});

describe("computeSeasonMinutesByKey", () => {
  it("מסכם דקות לאורך כמה משחקים לאותו שחקן סגל", () => {
    const matches = [
      makeMatch({ id: "m1", final_half: 2, final_minute: 90 }),
      makeMatch({ id: "m2", final_half: 2, final_minute: 90 }),
    ];
    const players = [
      makePlayer({ id: "pa", match_id: "m1", squad_player_id: "sq1", is_starter: true }),
      makePlayer({ id: "pb", match_id: "m2", squad_player_id: "sq1", is_starter: true }),
    ];
    const map = computeSeasonMinutesByKey(players, [], matches, []);
    expect(map.get("sq:sq1")).toBe(180);
  });

  it("מפחית דקות למי שהוחלף", () => {
    const matches = [makeMatch({ id: "m1", final_half: 2, final_minute: 90 })];
    const players = [
      makePlayer({ id: "out", match_id: "m1", squad_player_id: "sq1", is_starter: true }),
      makePlayer({ id: "in", match_id: "m1", squad_player_id: "sq2", is_starter: false, on_pitch: false }),
    ];
    const subs = [makeSub({ match_id: "m1", player_out_id: "out", player_in_id: "in", half: 2, match_minute: 60 })];
    const map = computeSeasonMinutesByKey(players, subs, matches, []);
    expect(map.get("sq:sq1")).toBe(60);
    expect(map.get("sq:sq2")).toBe(30);
  });
});

describe("computePlayerSeasonMatches", () => {
  it("מחזיר שורה לכל משחק ששיחק בו השחקן, ממוין מהחדש לישן", () => {
    const matches = [
      makeMatch({ id: "m1", opponent: "א", match_date: "2026-01-01" }),
      makeMatch({ id: "m2", opponent: "ב", match_date: "2026-02-01" }),
    ];
    const players = [
      makePlayer({ id: "pa", match_id: "m1", squad_player_id: "sq1", name: "עידו" }),
      makePlayer({ id: "pb", match_id: "m2", squad_player_id: "sq1", name: "עידו" }),
    ];
    const events = [action("pa", "goal", { match_id: "m1" }), action("pb", "assist", { match_id: "m2" })];
    const lines = computePlayerSeasonMatches("sq:sq1", events, players, matches);
    expect(lines).toHaveLength(2);
    expect(lines[0].matchId).toBe("m2");
    expect(lines[0].assists).toBe(1);
    expect(lines[1].goals).toBe(1);
  });
});
