import { describe, expect, it } from "vitest";
import { crestSrcForTeam, localCrestSrc, opponentInitials, OUR_CREST_SRC } from "./teamMark";

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
    expect(localCrestSrc("מ.כ. כפר קאסם ניבראס")).toBe("/crests/nibras-kafr-qasim.png");
    expect(localCrestSrc("ניברס כפר קאסם")).toBe("/crests/nibras-kafr-qasim.png");
    expect(localCrestSrc("ניבראס")).toBe("/crests/nibras-kafr-qasim.png");
    expect(localCrestSrc("כפר קאסם ניברס")).toBe("/crests/nibras-kafr-qasim.png");
    expect(localCrestSrc("Nibras")).toBe("/crests/nibras-kafr-qasim.png");
    expect(localCrestSrc("מכבי אורנית")).toBe("/crests/maccabi-oranit.png");
    expect(localCrestSrc("Maccabi Oranit")).toBe("/crests/maccabi-oranit.png");
  });

  it("לא מבלבל בין טייבה לטירה", () => {
    expect(localCrestSrc("בני טירה")).not.toBe("/crests/shimshon-bnei-taibe.png");
    expect(localCrestSrc("שמשון בני טייבה")).not.toBe("/crests/mk-taibe.png");
  });

  it("לא גונב סמל מהפועל אורנית או מהפועל כפר קאסם", () => {
    expect(localCrestSrc("הפועל אורנית")).toBeNull();
    expect(localCrestSrc("הפועל אורנית ע. עידו אגוזי")).toBeNull();
    expect(localCrestSrc("הפועל כפר קאסם")).toBeNull();
  });
});

describe("crestSrcForTeam", () => {
  it("משאיר את סמל אורנית מול מכבי אורנית וניבראס", () => {
    expect(crestSrcForTeam("הפועל אורנית", [], true)).toBe(OUR_CREST_SRC);
    expect(crestSrcForTeam("מכבי אורנית", [], true)).toBe(OUR_CREST_SRC);
    expect(crestSrcForTeam("מ.כ. כפר קאסם ניבראס", [], true)).toBe(OUR_CREST_SRC);
    expect(crestSrcForTeam("מכבי אורנית", [], false)).toBe("/crests/maccabi-oranit.png");
    expect(crestSrcForTeam("מ.כ. כפר קאסם ניבראס", [], false)).toBe("/crests/nibras-kafr-qasim.png");
  });
});

describe("opponentInitials", () => {
  it("מדלג על קידומת מועדון", () => {
    expect(opponentInitials("הפועל כפר קאסם")).toBe("כפ");
    expect(opponentInitials("מכבי פתח תקווה")).toBe("פת");
    expect(opponentInitials("בית״ר טוברוק")).toBe("טו");
  });
});
