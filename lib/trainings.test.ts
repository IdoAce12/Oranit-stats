import { describe, expect, it } from "vitest";
import { parseTrainings } from "./trainings";

describe("parseTrainings", () => {
  it("שומר רק אימונים עם תאריך ומזהה", () => {
    const rows = parseTrainings([
      { id: "t1", date: "2026-09-27", time: "20:00", venue: "אורנית" },
      { id: "", date: "2026-09-27", venue: "x" },
      { id: "t2", date: "bad", venue: "x" },
      { date: "2026-09-28", venue: "x" },
    ]);
    expect(rows).toEqual([{ id: "t1", date: "2026-09-27", time: "20:00", venue: "אורנית" }]);
  });
});
