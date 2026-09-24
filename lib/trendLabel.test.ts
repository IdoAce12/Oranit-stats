import { describe, expect, it } from "vitest";
import { uniqueTrendLabels } from "./trendLabel";

describe("uniqueTrendLabels", () => {
  it("מפריד ליגה וגביע מול אותה יריבה", () => {
    const labels = uniqueTrendLabels([
      { id: "cup", opponent: "בני טירה", matchType: "cup", matchDate: "2026-09-01" },
      { id: "league", opponent: "בני טירה", matchType: "league", matchDate: "2026-09-20" },
    ]);
    expect(labels.get("cup")).toBe("בני טירה · גביע");
    expect(labels.get("league")).toBe("בני טירה · ליגה");
    expect(labels.get("cup")).not.toBe(labels.get("league"));
  });

  it("משאיר שם רגיל כשאין כפילות", () => {
    const labels = uniqueTrendLabels([
      { id: "a", opponent: "הפועל כפר קאסם", matchType: "league" },
      { id: "b", opponent: "מכבי פתח תקווה", matchType: "league" },
    ]);
    expect(labels.get("a")).toBe("הפועל כפר קאסם");
  });
});
