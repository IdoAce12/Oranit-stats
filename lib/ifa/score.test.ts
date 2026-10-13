import { describe, expect, it } from "vitest";
import { homeAwaySides, parseIfaScore } from "./score";

describe("parseIfaScore", () => {
  it("קורא בית–חוץ", () => {
    expect(parseIfaScore("1-2")).toEqual({ home: 1, away: 2 });
    expect(parseIfaScore("0:0")).toEqual({ home: 0, away: 0 });
  });
});

describe("homeAwaySides", () => {
  it("בבית: אורנית היא הבית והמספר הראשון שלה", () => {
    const sides = homeAwaySides({ opponent: "טוברוק", home: true, score: "2-1" });
    expect(sides.homeName).toBe("אורנית");
    expect(sides.awayName).toBe("טוברוק");
    expect(sides.homeIsUs).toBe(true);
    expect(sides.homeGoals).toBe(2);
    expect(sides.awayGoals).toBe(1);
  });

  it("בחוץ: היריבה היא הבית והמספר הראשון שלה — בלי היפוך", () => {
    const sides = homeAwaySides({ opponent: "בני טירה", home: false, score: "1-2" });
    expect(sides.homeName).toBe("בני טירה");
    expect(sides.awayName).toBe("אורנית");
    expect(sides.homeIsUs).toBe(false);
    expect(sides.awayIsUs).toBe(true);
    expect(sides.homeGoals).toBe(1);
    expect(sides.awayGoals).toBe(2);
  });
});
