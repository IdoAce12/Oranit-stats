import { describe, expect, it } from "vitest";
import { buildCoachSheetXlsx, coachSheetCsv, matchReportToCsv } from "./exportCsv";
import { action, makePlayer } from "./testHelpers";

describe("coachSheetCsv", () => {
  it("מייצא טבלה אחת עם איומים לשער וכל המדדים שנאספים", () => {
    const players = [makePlayer({ id: "a", name: "כובש", shirt_number: 9 })];
    const events = [
      action("a", "goal"),
      action("a", "shot", { shot_location: "in_box" }),
      action("a", "shot", { shot_location: "out_box" }),
      action("a", "key_pass", { zone: "att" }),
    ];
    const csv = coachSheetCsv(events, players, { opponent: "יריבה", matchDate: "2026-01-01" });
    const rows = csv.split("\n");
    expect(rows[0]).toContain("סיכום משחק");
    expect(rows[1]).toBe(
      "מס׳,שם,ציון,דקות,שערים,בישולים,מס״מ,חילוצים,איבודים,איומים ברחבה,איומים מחוץ,איומים,xG,xA,אוויר זכה,אוויר הפסיד,קרקע זכה,קרקע הפסיד"
    );
    expect(csv).not.toContain("תובנות");
    const playerRow = rows.find((line) => line.includes("כובש"));
    expect(playerRow).toBeDefined();
    expect(playerRow).toContain(",1,1,2,");
    expect(rows.some((line) => line.startsWith(",סה״כ,"))).toBe(true);
  });

  it("מייצא Excel עם שורה לבנה ושורה כחולה לסירוגין", () => {
    const players = [
      makePlayer({ id: "a", name: "ראשון", shirt_number: 9 }),
      makePlayer({ id: "b", name: "שני", shirt_number: 10 }),
    ];
    const events = [
      action("a", "shot", { shot_location: "in_box" }),
      action("b", "shot", { shot_location: "out_box" }),
    ];
    const bytes = buildCoachSheetXlsx(events, players, { opponent: "יריבה" });
    const text = new TextDecoder().decode(bytes);
    expect(bytes[0]).toBe(0x50); // P of PK zip
    expect(text).toContain("xl/styles.xml");
    expect(text).toContain("FFFFFFFF");
    expect(text).toContain("FFD6EAF8");
    expect(text).toContain('s="2"');
    expect(text).toContain('s="3"');
  });
});

describe("matchReportToCsv", () => {
  it("מסכם איומים בסיכום הקבוצתי", () => {
    const players = [makePlayer({ id: "a", name: "כובש", shirt_number: 9 })];
    const events = [
      action("a", "shot", { shot_location: "in_box" }),
      action("a", "shot", { shot_location: "out_box" }),
    ];
    const csv = matchReportToCsv(events, players, { opponent: "יריבה" });
    expect(csv).toContain("=== סיכום קבוצתי ===");
    expect(csv).toContain("איומים ברחבה");
    expect(csv).toContain("=== טבלת איומים לשער ===");
  });
});
