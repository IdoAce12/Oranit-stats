import { describe, expect, it } from "vitest";
import { computePlayingMinutes, resolveFinalMinute } from "./playingMinutes";
import { makeMatch, makePlayer, makeSub } from "./testHelpers";

describe("resolveFinalMinute", () => {
  it("משתמש בזמן הסיום השמור (דקה אבסולוטית) של המשחק", () => {
    const match = makeMatch({ final_half: 2, final_minute: 93 });
    expect(resolveFinalMinute(match, [], 0)).toBe(93);
  });

  it("מתקן דקה יחסית שנשמרה במחצית שנייה", () => {
    const match = makeMatch({ final_half: 2, final_minute: 3 }); // 45 + 3
    expect(resolveFinalMinute(match, [], 0)).toBe(48);
  });

  it("ברירת מחדל 90 כשאין מידע", () => {
    expect(resolveFinalMinute(null, [], 0)).toBe(90);
  });

  it("לא פחות מהדקה המקסימלית של אירוע/חילוף", () => {
    expect(resolveFinalMinute(null, [], 96)).toBe(96);
    const subs = [makeSub({ half: 2, match_minute: 95 })]; // אבסולוטי 95
    expect(resolveFinalMinute(null, subs, 0)).toBe(95);
  });
});

describe("computePlayingMinutes", () => {
  it("פותח בלי חילופים משחק את כל המשחק", () => {
    const players = [makePlayer({ id: "p1", is_starter: true })];
    const mins = computePlayingMinutes(players, [], 90);
    const p = mins.get("p1")!;
    expect(p.minutesPlayed).toBe(90);
    expect(p.started).toBe(true);
    expect(p.label).toBe("פותח · 90׳");
  });

  it("ספסל שלא נכנס = 0 דקות", () => {
    const players = [makePlayer({ id: "b1", is_starter: false, on_pitch: false })];
    const mins = computePlayingMinutes(players, [], 90);
    const b = mins.get("b1")!;
    expect(b.minutesPlayed).toBe(0);
    expect(b.started).toBe(false);
    expect(b.label).toBe("ספסל · 0׳");
  });

  it("חילוף: יוצא נעצר, נכנס צובר עד הסוף", () => {
    const players = [
      makePlayer({ id: "out", is_starter: true }),
      makePlayer({ id: "in", is_starter: false, on_pitch: false }),
    ];
    const subs = [makeSub({ player_out_id: "out", player_in_id: "in", half: 2, match_minute: 25 })]; // abs 70
    const mins = computePlayingMinutes(players, subs, 90);
    expect(mins.get("out")!.minutesPlayed).toBe(70);
    expect(mins.get("out")!.subbedOff).toBe(true);
    expect(mins.get("in")!.minutesPlayed).toBe(20);
    expect(mins.get("in")!.cameOnAsSub).toBe(true);
  });
});
