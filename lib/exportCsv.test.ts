import { describe, expect, it } from "vitest";
import { coachSheetCsv } from "./exportCsv";
import { action, makePlayer } from "./testHelpers";

describe("coachSheetCsv", () => {
  it("נשאר CSV עם איומים בטבלה הקטנה", () => {
    const players = [makePlayer({ id: "a", name: "כובש", shirt_number: 9 })];
    const events = [
      action("a", "goal"),
      action("a", "shot", { shot_location: "in_box" }),
      action("a", "shot", { shot_location: "out_box" }),
    ];
    const csv = coachSheetCsv(events, players, { opponent: "יריבה", matchDate: "2026-01-01" });
    expect(csv).toContain("איומים ברחבה,איומים מחוץ,איומים");
    expect(csv.split("\n").some((line) => line.includes("כובש") && line.includes(",1,1,2,"))).toBe(
      true
    );
  });
});
