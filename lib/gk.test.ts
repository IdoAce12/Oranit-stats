import { describe, expect, it } from "vitest";
import { isGkAction, isGoalkeeper, playerIsGoalkeeper, seasonProfileHref } from "./gk";

describe("isGoalkeeper", () => {
  it("מזהה שוער בעברית ובאנגלית", () => {
    expect(isGoalkeeper("שוער")).toBe(true);
    expect(isGoalkeeper("GK")).toBe(true);
    expect(isGoalkeeper("goalkeeper")).toBe(true);
    expect(isGoalkeeper("קשר")).toBe(false);
    expect(isGoalkeeper(null)).toBe(false);
  });
});

describe("isGkAction", () => {
  it("מסמן רק פעולות שוער", () => {
    expect(isGkAction("gk_save")).toBe(true);
    expect(isGkAction("gk_pass_ok")).toBe(true);
    expect(isGkAction("gk_pass_miss")).toBe(true);
    expect(isGkAction("gk_exit_ok")).toBe(true);
    expect(isGkAction("gk_aerial_miss")).toBe(true);
    expect(isGkAction("goal")).toBe(false);
  });
});

describe("seasonProfileHref", () => {
  it("מפנה שוער לפרופיל שוער", () => {
    expect(
      seasonProfileHref({ key: "sq:1", squadPlayerId: "1" }, [
        { id: "1", shirt_number: 1, name: "דני", position: "שוער", active: true, created_at: "" },
      ])
    ).toBe("/season/gk/sq%3A1");
  });

  it("מפנה שחקן שדה לפרופיל רגיל", () => {
    expect(
      seasonProfileHref({ key: "sq:2", squadPlayerId: "2" }, [
        { id: "2", shirt_number: 9, name: "יוסי", position: "חלוץ", active: true, created_at: "" },
      ])
    ).toBe("/season/player/sq%3A2");
  });

  it("מזהה שוער לפי פעולות גם בלי עמדה בסגל", () => {
    expect(
      seasonProfileHref({ key: "p1", squadPlayerId: null, gkSaves: 3 }, [], [])
    ).toBe("/season/gk/p1");
  });
});

describe("playerIsGoalkeeper", () => {
  it("בודק גם עמדה בסגל", () => {
    expect(
      playerIsGoalkeeper(
        { position: null, squad_player_id: "1" },
        [{ id: "1", shirt_number: 1, name: "דני", position: "שוער", active: true, created_at: "" }]
      )
    ).toBe(true);
  });
});
