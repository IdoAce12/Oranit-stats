import { describe, expect, it } from "vitest";
import {
  autoAssignSlots,
  inferSlotGroup,
  isAttackingRole,
  FORMATION_5_3_2,
  LINEUP_SIZE,
  resolveOccupants,
  slotOfPlayer,
  type PitchOccupant,
} from "./formation";

describe("inferSlotGroup", () => {
  it("מזהה קבוצת עמדה מטקסט עברי", () => {
    expect(inferSlotGroup("בלם")).toBe("def");
    expect(inferSlotGroup("מגן ימני")).toBe("def");
    expect(inferSlotGroup("קשר אחורי")).toBe("mid");
    expect(inferSlotGroup("קשר התקפי")).toBe("att");
    expect(inferSlotGroup("חלוץ")).toBe("att");
    expect(inferSlotGroup("כנף שמאל")).toBe("att");
    expect(inferSlotGroup("ימין התקפה")).toBe("att");
  });

  it("מזהה גם ראשי תיבות באנגלית", () => {
    expect(inferSlotGroup("CB")).toBe("def");
    expect(inferSlotGroup("CM")).toBe("mid");
    expect(inferSlotGroup("ST")).toBe("att");
  });

  it("מחזיר null כשאין התאמה", () => {
    expect(inferSlotGroup(null)).toBeNull();
    expect(inferSlotGroup("")).toBeNull();
    expect(inferSlotGroup("שוער")).toBeNull();
  });
});

describe("isAttackingRole", () => {
  it("מזהה תוקף לפי עמדת משחק או סגל", () => {
    expect(isAttackingRole({ position: "חלוץ" })).toBe(true);
    expect(isAttackingRole({ position: "קשר" }, "חלוץ")).toBe(true);
    expect(isAttackingRole({ position: "קשר התקפי" })).toBe(true);
    expect(isAttackingRole({ position: "בלם" })).toBe(false);
    expect(isAttackingRole({ position: "קשר" })).toBe(false);
  });

  it("מזהה משבצת התקפית ב־4-3-3 כשאין טקסט עמדה", () => {
    expect(isAttackingRole({ position: null, lineup_slot: 8 })).toBe(true);
    expect(isAttackingRole({ position: null, lineup_slot: 1 })).toBe(false);
  });
});

describe("autoAssignSlots", () => {
  it("ממקם לפי עמדה ואז ממלא את השאר בלי לדרוס", () => {
    const players = [
      { id: "gk-ish", position: "לא ידוע" },
      { id: "cb", position: "בלם" },
      { id: "st", position: "חלוץ" },
    ];
    const slots = autoAssignSlots(players);
    expect(slots).toHaveLength(LINEUP_SIZE);
    // בלם נכנס לאחת המשבצות ההגנתיות (0–3)
    expect(slots.slice(0, 4)).toContain("cb");
    // חלוץ לאחת ההתקפיות (7–9)
    expect(slots.slice(7, 10)).toContain("st");
    // כל השחקנים מוקמו
    for (const p of players) expect(slots).toContain(p.id);
  });

  it("לא ממקם יותר מ-10 שחקנים", () => {
    const players = Array.from({ length: 14 }, (_, i) => ({ id: `p${i}`, position: "קשר" }));
    const slots = autoAssignSlots(players);
    const filled = slots.filter((s) => s !== null);
    expect(filled).toHaveLength(LINEUP_SIZE);
  });

  it("במערך 5-3-2 ממקם 5 שחקני הגנה", () => {
    const players = [
      { id: "d1", position: "בלם" },
      { id: "d2", position: "בלם" },
      { id: "d3", position: "מגן" },
      { id: "d4", position: "מגן" },
      { id: "d5", position: "בלם" },
    ];
    const slots = autoAssignSlots(players, FORMATION_5_3_2);
    expect(slots.slice(0, 5).every((id) => id != null)).toBe(true);
    expect(slots.slice(5).every((id) => id == null)).toBe(true);
  });
});

describe("resolveOccupants", () => {
  const p = (id: string, extra: Partial<PitchOccupant> = {}): PitchOccupant => ({
    id,
    shirt_number: 1,
    name: id,
    ...extra,
  });

  it("מכבד lineup_slot", () => {
    const occ = resolveOccupants([p("a", { lineup_slot: 5 }), p("b", { lineup_slot: 8 })]);
    expect(occ[5]?.id).toBe("a");
    expect(occ[8]?.id).toBe("b");
  });

  it("שחקנים בלי עמדה ממלאים משבצות פנויות", () => {
    const occ = resolveOccupants([p("a", { lineup_slot: 0 }), p("b")]);
    expect(occ[0]?.id).toBe("a");
    expect(occ[1]?.id).toBe("b");
  });

  it("מתעלם משחקנים שאינם על המגרש", () => {
    const occ = resolveOccupants([p("bench", { on_pitch: false })]);
    expect(occ.every((o) => o === null)).toBe(true);
  });
});

describe("slotOfPlayer", () => {
  it("מחזיר אינדקס משבצת או null", () => {
    const occ = resolveOccupants([
      { id: "a", shirt_number: 1, name: "a", lineup_slot: 3 },
    ]);
    expect(slotOfPlayer(occ, "a")).toBe(3);
    expect(slotOfPlayer(occ, "missing")).toBeNull();
  });
});
