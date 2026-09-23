import { describe, expect, it } from "vitest";
import { action, makeEvent, makeMatch, makePlayer, makeSquadPlayer, makeSub } from "./testHelpers";
import { buildTableauSeasonTables, buildTableauWorkbookBytes } from "./tableauExport";

describe("buildTableauSeasonTables", () => {
  const squad = makeSquadPlayer({
    id: "sq1",
    shirt_number: 10,
    name: "רן",
    position: "קשר",
  });
  const match = makeMatch({
    id: "m1",
    opponent: "מכבי יהוד",
    match_date: "2026-08-22",
    match_type: "friendly",
    our_team_name: "הפועל אורנית",
    status: "finished",
    final_minute: 90,
  });
  const player = makePlayer({
    id: "p1",
    match_id: "m1",
    squad_player_id: "sq1",
    shirt_number: 10,
    name: "רן",
    is_starter: true,
  });

  it("בונה משחק עם מדדי קבוצה מספריים וכותרות באנגלית", () => {
    const tables = buildTableauSeasonTables({
      matches: [match],
      players: [player],
      squad: [squad],
      substitutions: [],
      events: [
        action("p1", "goal", { match_id: "m1" }),
        action("p1", "assist", { match_id: "m1" }),
        action("p1", "tackle", { match_id: "m1", zone: "mid" }),
        action("p1", "ball_loss", { match_id: "m1", zone: "att" }),
        action("p1", "ground_won", { match_id: "m1" }),
        action("p1", "ground_lost", { match_id: "m1" }),
        makeEvent({ match_id: "m1", action_type: "corner_for", player_id: null }),
      ],
    });

    expect(tables.matches).toHaveLength(1);
    const m = tables.matches[0];
    expect(m.match_id).toBe("m1");
    expect(m.opponent).toBe("מכבי יהוד");
    expect(m.match_type).toBe("Friendly");
    expect(m.goals_scored).toBe(1);
    expect(m.goals_conceded).toBeNull();
    expect(m.assists).toBe(1);
    expect(m.recoveries).toBe(1);
    expect(m.turnovers).toBe(1);
    expect(m.ground_duels_won).toBe(1);
    expect(m.ground_duels_lost).toBe(1);
    expect(m.duel_win_rate).toBe(0.5);
    expect(m.corners_for).toBe(1);
    expect(typeof m.goals_scored).toBe("number");
    expect(m.impact_score).toBe(4);
  });

  it("בונה שורת שחקן-משחק וצבירה עונתית עם עמדה וציון", () => {
    const tables = buildTableauSeasonTables({
      matches: [match],
      players: [player],
      squad: [squad],
      substitutions: [],
      events: [
        action("p1", "goal", { match_id: "m1" }),
        action("p1", "key_pass", { match_id: "m1", zone: "att" }),
        action("p1", "aerial_won", { match_id: "m1" }),
      ],
    });

    expect(tables.playerMatch).toHaveLength(1);
    const line = tables.playerMatch[0];
    expect(line.player_name).toBe("רן");
    expect(line.squad_number).toBe(10);
    expect(line.position).toBe("קשר");
    expect(line.starter).toBe(1);
    expect(line.goals).toBe(1);
    expect(line.key_passes).toBe(1);
    expect(line.aerial_duels_won).toBe(1);
    expect(typeof line.match_rating).toBe("number");
    expect(line.minutes).toBeGreaterThan(0);

    expect(tables.playerSeason).toHaveLength(1);
    const season = tables.playerSeason[0];
    expect(season.matches_played).toBe(1);
    expect(season.goals).toBe(1);
    expect(season.avg_rating).toBe(season.total_rating);
    expect(season.aerial_duel_win_rate).toBe(1);
    expect(season.ground_duel_win_rate).toBeNull();
  });

  it("מסכם שני משחקים לשחקן אחד", () => {
    const m2 = makeMatch({
      id: "m2",
      opponent: "עמישב",
      match_date: "2026-08-18",
      match_type: "league",
      final_minute: 90,
    });
    const p2 = makePlayer({
      id: "p2",
      match_id: "m2",
      squad_player_id: "sq1",
      shirt_number: 10,
      name: "רן",
      is_starter: true,
    });
    const tables = buildTableauSeasonTables({
      matches: [match, m2],
      players: [player, p2],
      squad: [squad],
      substitutions: [],
      events: [
        action("p1", "goal", { match_id: "m1" }),
        action("p2", "assist", { match_id: "m2" }),
      ],
    });
    expect(tables.matches).toHaveLength(2);
    expect(tables.playerMatch).toHaveLength(2);
    expect(tables.playerSeason).toHaveLength(1);
    expect(tables.playerSeason[0].matches_played).toBe(2);
    expect(tables.playerSeason[0].goals).toBe(1);
    expect(tables.playerSeason[0].assists).toBe(1);
  });

  it("מתעלם משחקן ללא דקות וללא פעולות", () => {
    const bench = makePlayer({
      id: "p-bench",
      match_id: "m1",
      shirt_number: 99,
      name: "ספסל",
      is_starter: false,
      on_pitch: false,
    });
    const tables = buildTableauSeasonTables({
      matches: [match],
      players: [player, bench],
      squad: [squad],
      substitutions: [],
      events: [action("p1", "tackle", { match_id: "m1", zone: "def" })],
    });
    expect(tables.playerMatch.every((r) => r.player_name !== "ספסל")).toBe(true);
  });

  it("סופר דקות אחרי חילוף", () => {
    const incoming = makePlayer({
      id: "p-in",
      match_id: "m1",
      shirt_number: 7,
      name: "מחליף",
      is_starter: false,
    });
    const tables = buildTableauSeasonTables({
      matches: [match],
      players: [player, incoming],
      squad: [squad],
      substitutions: [
        makeSub({
          match_id: "m1",
          player_out_id: "p1",
          player_in_id: "p-in",
          match_minute: 60,
        }),
      ],
      events: [],
    });
    const starter = tables.playerMatch.find((r) => r.player_key.startsWith("sq:"));
    const sub = tables.playerMatch.find((r) => r.player_name === "מחליף");
    expect(starter?.minutes).toBe(60);
    expect(sub?.minutes).toBe(30);
    expect(sub?.starter).toBe(0);
  });
});

describe("buildTableauWorkbookBytes", () => {
  it("מייצר קובץ xlsx עם חתימת ZIP", () => {
    const tables = buildTableauSeasonTables({
      matches: [makeMatch({ id: "m1", final_minute: 90 })],
      players: [makePlayer({ id: "p1", match_id: "m1", is_starter: true })],
      squad: [],
      substitutions: [],
      events: [action("p1", "goal", { match_id: "m1" })],
    });
    const bytes = buildTableauWorkbookBytes(tables);
    expect(bytes[0]).toBe(0x50);
    expect(bytes[1]).toBe(0x4b);
    expect(bytes.length).toBeGreaterThan(200);
  });
});
