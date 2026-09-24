import { describe, expect, it } from "vitest";
import { opponentInitials } from "./teamMark";

describe("opponentInitials", () => {
  it("מדלג על קידומת מועדון", () => {
    expect(opponentInitials("הפועל כפר קאסם")).toBe("כפ");
    expect(opponentInitials("מכבי פתח תקווה")).toBe("פת");
    expect(opponentInitials("בית״ר טוברוק")).toBe("טו");
  });
});
