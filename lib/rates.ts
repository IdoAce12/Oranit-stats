import { roundMetric } from "./advancedMetrics";
import { SeasonImpact } from "./impactScore";

export type RateMode = "total" | "per90";

/** מדד ל־90 דקות — משווה שחקנים עם דקות שונות על בסיס שווה. */
export function per90(value: number, minutes: number, digits = 1): number {
  if (minutes <= 0) return 0;
  return roundMetric((value * 90) / minutes, digits);
}

export function rateOf(value: number, minutes: number, mode: RateMode, digits = 1): number {
  return mode === "per90" ? per90(value, minutes, digits) : value;
}

/** מציג ספירות כמספר שלם בסה״כ, ועם עשרונית בל־90׳. */
export function formatRate(
  value: number,
  minutes: number,
  mode: RateMode,
  digits = 1
): string {
  if (mode !== "per90") {
    return Number.isInteger(value) ? String(value) : String(roundMetric(value, digits));
  }
  return String(per90(value, minutes, digits));
}

/** מנרמל שורת עונה ל־90׳ לצורך רדאר — משחק אחד שקול ל־90 דקות. */
export function scaleSeasonForRadar(row: SeasonImpact, minutes: number, mode: RateMode): SeasonImpact {
  if (mode !== "per90" || minutes <= 0) return row;
  const n = (v: number) => (v * 90) / minutes;
  return {
    ...row,
    goals: n(row.goals),
    assists: n(row.assists),
    keyPasses: n(row.keyPasses),
    tackles: n(row.tackles),
    lossesTotal: n(row.lossesTotal),
    shotsInBox: n(row.shotsInBox),
    xg: n(row.xg),
    xa: n(row.xa),
    score: n(row.score),
    matchesPlayed: 1,
  };
}
