import { describe, expect, it } from "vitest";
import { attributeMatchEvents } from "./eventAttribution";
import { action, makeMatch, makePlayer, makeSquadPlayer, makeSub } from "./testHelpers";

describe("attributeMatchEvents", () => {
  const squad = [makeSquadPlayer({ id: "sq-sub", shirt_number: 15, name: "מחליף" })];
  const match = makeMatch({ id: "cup", match_type: "cup", final_half: 2, final_minute: 90 });

  it("מעביר אירוע אחרי חילוף מהפותח למחליף", () => {
    const starter = makePlayer({
      id: "out",
      match_id: "cup",
      is_starter: true,
      name: "פותח",
      shirt_number: 9,
    });
    const sub = makePlayer({
      id: "in",
      match_id: "cup",
      squad_player_id: "sq-sub",
      is_starter: false,
      on_pitch: false,
      name: "מחליף",
      shirt_number: 15,
    });
    const subs = [
      makeSub({
        match_id: "cup",
        player_out_id: "out",
        player_in_id: "in",
        half: 2,
        match_minute: 25,
      }),
    ];
    const events = [
      action("out", "goal", { match_id: "cup", half: 1, match_minute: 20 }),
      action("out", "assist", { match_id: "cup", half: 2, match_minute: 80 }),
    ];
    const attributed = attributeMatchEvents(events, [starter, sub], subs, [match], squad);
    expect(attributed[0].player_id).toBe("out");
    expect(attributed[1].player_id).toBe("in");
  });

  it("משאיר אירוע של מחליף על המחליף", () => {
    const starter = makePlayer({ id: "out", match_id: "cup", is_starter: true, name: "פותח" });
    const sub = makePlayer({
      id: "in",
      match_id: "cup",
      is_starter: false,
      name: "מחליף",
      shirt_number: 15,
    });
    const subs = [
      makeSub({ match_id: "cup", player_out_id: "out", player_in_id: "in", half: 2, match_minute: 25 }),
    ];
    const events = [action("in", "goal", { match_id: "cup", half: 2, match_minute: 80 })];
    const attributed = attributeMatchEvents(events, [starter, sub], subs, [match], squad);
    expect(attributed[0].player_id).toBe("in");
  });

  it("מחבר אירוע עם מזהה ממשחק אחר למחליף המקומי", () => {
    const league = makePlayer({
      id: "league-id",
      match_id: "league",
      squad_player_id: "sq-sub",
      name: "מחליף",
      shirt_number: 15,
    });
    const cupSub = makePlayer({
      id: "cup-id",
      match_id: "cup",
      squad_player_id: null,
      is_starter: false,
      name: "מחליף",
      shirt_number: 15,
    });
    const events = [action("league-id", "goal", { match_id: "cup", match_minute: 70 })];
    const attributed = attributeMatchEvents(
      events,
      [cupSub],
      [],
      [match],
      squad,
      [league, cupSub]
    );
    expect(attributed[0].player_id).toBe("cup-id");
  });
});
