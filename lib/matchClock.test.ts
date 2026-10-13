import { describe, expect, it } from "vitest";
import { baseMinute, clockDisplay, elapsedSeconds, freezeClock, type ClockState } from "./matchClock";

describe("baseMinute", () => {
  it("מחצית ראשונה מתחילה ב-0, שנייה ב-45", () => {
    expect(baseMinute(1)).toBe(0);
    expect(baseMinute(2)).toBe(45);
  });
});

describe("elapsedSeconds", () => {
  it("שעון מושהה מחזיר את הזמן הצבור בלבד", () => {
    const state: ClockState = { half: 1, accumulated: 130, startedAt: null };
    expect(elapsedSeconds(state)).toBe(130);
  });

  it("שעון רץ מוסיף את הזמן שחלף מאז ההפעלה", () => {
    const now = 1_000_000;
    const state: ClockState = { half: 1, accumulated: 60, startedAt: now - 5000 };
    expect(elapsedSeconds(state, now)).toBe(65);
  });
});

describe("clockDisplay", () => {
  it("מחשב דקה ושניות במחצית שנייה", () => {
    const state: ClockState = { half: 2, accumulated: 125, startedAt: null };
    const d = clockDisplay(state);
    expect(d.half).toBe(2);
    expect(d.minute).toBe(45 + 2); // 47
    expect(d.seconds).toBe(5);
    expect(d.running).toBe(false);
  });
});

describe("freezeClock", () => {
  it("עוצר שעון רץ על הזמן שחלף באותו רגע", () => {
    const now = 1_000_000;
    const state: ClockState = { half: 2, accumulated: 120, startedAt: now - 10_000 };
    const frozen = freezeClock(state, now);
    expect(frozen.startedAt).toBeNull();
    expect(frozen.accumulated).toBe(130);
    expect(clockDisplay(frozen, now + 60_000).minute).toBe(47);
  });
});
