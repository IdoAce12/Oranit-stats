import { describe, expect, it } from "vitest";
import { signSession, verifySession } from "./session";
import { nextScheduledMatch, splitMatches, toKickoffIso } from "./fixtures";
import { isCoachOnlyPath, isPublicPath, playerOwnsProfilePath } from "./authPaths";
import { makeMatch } from "./testHelpers";

describe("session", () => {
  it("חותם ומוודא משתמש", () => {
    const token = signSession({
      id: "u1",
      username: "מאמן",
      role: "coach",
      squadPlayerId: null,
    });
    expect(verifySession(token)).toEqual({
      id: "u1",
      username: "מאמן",
      role: "coach",
      squadPlayerId: null,
    });
  });

  it("דוחה חתימה שגויה ופג תוקף", () => {
    const token = signSession({
      id: "u1",
      username: "גיא",
      role: "player",
      squadPlayerId: "sq1",
    });
    expect(verifySession(token + "x")).toBeNull();
    expect(verifySession(token, Date.now() + 40 * 24 * 60 * 60 * 1000)).toBeNull();
  });
});

describe("fixtures", () => {
  it("בוחר את המשחק המתוכנן הקרוב", () => {
    const later = makeMatch({
      id: "later",
      status: "scheduled",
      match_date: "2026-10-10",
      kickoff_at: "2026-10-10T19:00:00.000Z",
    });
    const soon = makeMatch({
      id: "soon",
      status: "scheduled",
      match_date: "2026-10-01",
      kickoff_at: "2026-10-01T17:00:00.000Z",
    });
    const done = makeMatch({ id: "done", status: "finished", match_date: "2026-09-01" });
    expect(nextScheduledMatch([later, done, soon])?.id).toBe("soon");
    expect(splitMatches([later, done, soon]).finished[0].id).toBe("done");
  });

  it("ממיר תאריך ושעה ל-ISO", () => {
    expect(toKickoffIso("2026-10-01", "20:30")).toMatch(/^2026-10-01|^2026-09-30/);
  });
});

describe("authPaths", () => {
  it("מזהה מסלולי מאמן מול ציבור", () => {
    expect(isPublicPath("/login")).toBe(true);
    expect(isCoachOnlyPath("/live/abc")).toBe(true);
    expect(isCoachOnlyPath("/season")).toBe(true);
    expect(isCoachOnlyPath("/season/player/sq:1")).toBe(false);
    expect(isCoachOnlyPath("/calendar")).toBe(false);
  });

  it("מאפשר לשחקן רק את הפרופיל שלו", () => {
    expect(playerOwnsProfilePath("/season/player/sq%3Au1", "u1")).toBe(true);
    expect(playerOwnsProfilePath("/season/player/sq:other", "u1")).toBe(false);
  });
});
