import { describe, expect, it } from "vitest";
import { computeAttackingPressByKey } from "./attackingPress";
import { action, makeMatch, makePlayer, makeSquadPlayer, makeSub } from "./testHelpers";

describe("computeAttackingPressByKey", () => {
  it("סופר לחץ קבוצתי לתוקף על המגרש, לא לבלם", () => {
    const squad = [
      makeSquadPlayer({ id: "sq-st", name: "חלוץ", position: "חלוץ" }),
      makeSquadPlayer({ id: "sq-cb", name: "בלם", position: "בלם" }),
    ];
    const players = [
      makePlayer({
        id: "st",
        match_id: "m1",
        squad_player_id: "sq-st",
        name: "חלוץ",
        position: "חלוץ",
        is_starter: true,
      }),
      makePlayer({
        id: "cb",
        match_id: "m1",
        squad_player_id: "sq-cb",
        name: "בלם",
        position: "בלם",
        is_starter: true,
      }),
    ];
    const events = [
      action("cb", "tackle", { zone: "att", match_minute: 20, match_id: "m1" }),
      action("st", "tackle", { zone: "att", match_minute: 40, match_id: "m1" }),
      action("cb", "tackle", { zone: "def", match_minute: 50, match_id: "m1" }),
    ];
    const matches = [makeMatch({ id: "m1", final_half: 2, final_minute: 90 })];
    const map = computeAttackingPressByKey(events, players, [], matches, squad);
    const st = map.get("sq:sq-st")!;
    const cb = map.get("sq:sq-cb")!;
    expect(st.isAttacker).toBe(true);
    expect(st.press).toBe(2);
    expect(st.attTackles).toBe(1);
    expect(cb.isAttacker).toBe(false);
    expect(cb.press).toBe(0);
    expect(cb.attTackles).toBe(1);
  });

  it("לא סופר חילוץ התקפי אחרי שהתוקף ירד", () => {
    const squad = [makeSquadPlayer({ id: "sq-st", name: "חלוץ", position: "חלוץ" })];
    const players = [
      makePlayer({
        id: "st",
        match_id: "m1",
        squad_player_id: "sq-st",
        name: "חלוץ",
        position: "חלוץ",
        is_starter: true,
      }),
      makePlayer({
        id: "in",
        match_id: "m1",
        name: "מחליף",
        position: "קשר",
        is_starter: false,
        on_pitch: false,
      }),
    ];
    const subs = [
      makeSub({
        match_id: "m1",
        player_out_id: "st",
        player_in_id: "in",
        half: 2,
        match_minute: 25,
      }),
    ];
    const events = [
      action("in", "tackle", { zone: "att", match_minute: 80, match_id: "m1", half: 2 }),
    ];
    const matches = [makeMatch({ id: "m1", final_half: 2, final_minute: 90 })];
    const map = computeAttackingPressByKey(events, players, subs, matches, squad);
    expect(map.get("sq:sq-st")?.press).toBe(0);
  });
});
