import { describe, expect, it } from "vitest";
import { localCrestSrc, opponentInitials } from "./teamMark";

describe("opponentInitials", () => {
  it("מדלג על קידומת מועדון", () => {
    expect(opponentInitials("הפועל כפר קאסם")).toBe("כפ");
    expect(opponentInitials("מכבי פתח תקווה")).toBe("פת");
    expect(opponentInitials("בית״ר טוברוק")).toBe("טו");
  });
});

describe("localCrestSrc", () => {
  it("מזהה יריבות לפי כינוי", () => {
    expect(localCrestSrc("מכבי השרון נתניה ויקטור עטיה")).toBe("/crests/hasharon-netanya.png");
    expect(localCrestSrc('בית"ר טוברוק')).toBe("/crests/beitar-tovrok.png");
    expect(localCrestSrc("בני טירה")).toBe("/crests/bnei-tira.png");
    expect(localCrestSrc("שמשון בני טייבה")).toBe("/crests/shimshon-bnei-taibe.png");
    expect(localCrestSrc("מ.כ. טייבה")).toBe("/crests/mk-taibe.png");
    expect(localCrestSrc("הפועל פרדסייה נועם")).toBe("/crests/hapoel-pardesiya.png");
    expect(localCrestSrc("מכבי צעירי קלנסואה")).toBe("/crests/maccabi-qlansawa.png");
  });

  it("לא מבלבל בין טייבה לטירה", () => {
    expect(localCrestSrc("בני טירה")).not.toBe("/crests/shimshon-bnei-taibe.png");
    expect(localCrestSrc("שמשון בני טייבה")).not.toBe("/crests/mk-taibe.png");
  });
});

describe("opponentInitials", () => {
  it("מדלג על קידומת מועדון", () => {
    expect(opponentInitials("הפועל כפר קאסם")).toBe("כפ");
    expect(opponentInitials("מכבי פתח תקווה")).toBe("פת");
    expect(opponentInitials("בית״ר טוברוק")).toBe("טו");
  });
});
