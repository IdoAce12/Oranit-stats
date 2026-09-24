import { describe, expect, it } from "vitest";
import { monthCells, shiftMonth, isoFromParts } from "./calendarMonth";

describe("monthCells", () => {
  it("אוקטובר 2026 מתחיל ביום חמישי", () => {
    const cells = monthCells(2026, 10);
    expect(cells).toHaveLength(35);
    expect(cells[0]).toEqual({ iso: null, day: null });
    expect(cells[4]).toEqual({ iso: "2026-10-01", day: 1 });
    expect(cells[5]?.day).toBe(2);
    expect(cells[9]?.iso).toBe("2026-10-06");
  });
});

describe("shiftMonth", () => {
  it("גולש משנה לשנה", () => {
    expect(shiftMonth(2026, 12, 1)).toEqual({ year: 2027, month: 1 });
    expect(shiftMonth(2026, 1, -1)).toEqual({ year: 2025, month: 12 });
  });
});

describe("isoFromParts", () => {
  it("מרפד חודש ויום", () => {
    expect(isoFromParts(2026, 9, 4)).toBe("2026-09-04");
  });
});
