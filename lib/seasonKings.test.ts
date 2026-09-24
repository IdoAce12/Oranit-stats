import { describe, expect, it } from "vitest";
import { rankSeasonKings, seasonKingLeaders, type KingPlayer } from "./seasonKings";

function p(overrides: Partial<KingPlayer> & Pick<KingPlayer, "key" | "label">): KingPlayer {
  return {
    goals: 0,
    assists: 0,
    minutes: 0,
    tackles: 0,
    keyPasses: 0,
    score: 0,
    ...overrides,
  };
}

describe("rankSeasonKings", () => {
  const squad: KingPlayer[] = [
    p({ key: "a", label: "#7 דני", goals: 5, assists: 1, minutes: 90, tackles: 4, score: 8 }),
    p({ key: "b", label: "#9 יוסי", goals: 5, assists: 4, minutes: 200, tackles: 1, score: 12 }),
    p({ key: "c", label: "#11 עידו", goals: 2, assists: 0, minutes: 40, tackles: 9, score: 3 }),
  ];

  it("מכתיר מלך ומציין שוויון", () => {
    const mine = rankSeasonKings(squad, "a");
    const goals = mine.find((k) => k.id === "goals")!;
    expect(goals.rank).toBe(1);
    expect(goals.tied).toBe(true);
    expect(goals.isKing).toBe(true);

    const assists = mine.find((k) => k.id === "assists")!;
    expect(assists.rank).toBe(2);
    expect(assists.isKing).toBe(false);
    expect(assists.leaderLabel).toBe("#9 יוסי");

    const minutes = mine.find((k) => k.id === "minutes")!;
    expect(minutes.rank).toBe(2);
    expect(minutes.leaderValue).toBe(200);
  });

  it("מחזיר את המלך של כל מדד לטבלה", () => {
    const leaders = seasonKingLeaders(squad);
    expect(leaders.find((k) => k.id === "assists")?.label).toBe("#9 יוסי");
    expect(leaders.find((k) => k.id === "tackles")?.label).toBe("#11 עידו");
    expect(leaders.find((k) => k.id === "minutes")?.value).toBe(200);
  });

  it("בלי ערכים — אין דירוג", () => {
    const empty = rankSeasonKings([p({ key: "a", label: "א" })], "a");
    expect(empty.every((k) => k.rank === null && !k.isKing)).toBe(true);
  });
});
