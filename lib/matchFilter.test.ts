import { describe, expect, it } from "vitest";
import { formatMatchOption, matchIdsForTypes, OFFICIAL_MATCH_TYPES, toggleMatchType } from "./matchFilter";
import { makeMatch } from "./testHelpers";

describe("matchIdsForTypes", () => {
  const matches = [
    makeMatch({ id: "l", match_type: "league" }),
    makeMatch({ id: "c", match_type: "cup" }),
    makeMatch({ id: "f", match_type: "friendly" }),
  ];

  it("ריק = כל המשחקים", () => {
    expect(matchIdsForTypes(matches, [])).toBeNull();
  });

  it("מסנן לכמה סוגים", () => {
    const ids = matchIdsForTypes(matches, ["league", "cup"]);
    expect(ids?.has("l")).toBe(true);
    expect(ids?.has("c")).toBe(true);
    expect(ids?.has("f")).toBe(false);
  });

  it("רשמי = ליגה וגביע", () => {
    expect(OFFICIAL_MATCH_TYPES).toEqual(["league", "cup"]);
    const ids = matchIdsForTypes(matches, OFFICIAL_MATCH_TYPES);
    expect(ids?.has("f")).toBe(false);
  });
});

describe("toggleMatchType", () => {
  it("מוסיף ומוריד סוג", () => {
    expect(toggleMatchType([], "cup")).toEqual(["cup"]);
    expect(toggleMatchType(["cup", "league"], "cup")).toEqual(["league"]);
  });
});

describe("formatMatchOption", () => {
  it("מציג תאריך, יריבה וסוג", () => {
    const m = makeMatch({
      opponent: "ראשון",
      match_date: "2026-03-01",
      match_type: "cup",
    });
    expect(formatMatchOption(m)).toBe("2026-03-01 · ראשון · גביע");
  });
});
