import { describe, expect, it } from "vitest";
import { findRowByPlayerKey, playerKeyOf } from "./playerKey";
import { makePlayer, makeSquadPlayer } from "./testHelpers";

describe("playerKeyOf", () => {
  const squad = [makeSquadPlayer({ id: "sq1", shirt_number: 15, name: "מחליף" })];

  it("משתמש ב-squad_player_id כשיש", () => {
    expect(playerKeyOf(makePlayer({ squad_player_id: "sq1", name: "מחליף" }), squad)).toBe("sq:sq1");
  });

  it("מחבר לפי מספר חולצה ושם כשאין מזהה סגל", () => {
    expect(
      playerKeyOf(
        makePlayer({ squad_player_id: null, shirt_number: 15, name: "מחליף" }),
        squad
      )
    ).toBe("sq:sq1");
  });

  it("לא מבלבל מחרוזת ריקה עם מזהה סגל", () => {
    expect(
      playerKeyOf(
        makePlayer({ squad_player_id: "", shirt_number: 15, name: "מחליף" } as never),
        squad
      )
    ).toBe("sq:sq1");
  });
});

describe("findRowByPlayerKey", () => {
  it("מוצא שורת nm לפי מפתח sq של אותו שחקן סגל", () => {
    const squad = [makeSquadPlayer({ id: "sq1", shirt_number: 15, name: "מחליף" })];
    const players = [
      makePlayer({
        id: "cup-sub",
        squad_player_id: null,
        shirt_number: 15,
        name: "מחליף",
      }),
    ];
    const rows = [{ key: "nm:מחליף", label: "מחליף" }];
    const found = findRowByPlayerKey(rows, "sq:sq1", players, squad);
    expect(found?.key).toBe("nm:מחליף");
  });
});
