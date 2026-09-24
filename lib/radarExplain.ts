import {
  RADAR_AXES,
  rawRadarFromSeason,
  type RadarAxisKey,
  type RadarSource,
} from "./advancedMetrics";

export interface RadarInputRow {
  label: string;
  value: number;
  weight?: string;
  contribution: number;
}

export interface RadarAxisExplain {
  key: RadarAxisKey;
  title: string;
  percentile: number;
  raw: number;
  formula: string;
  blurb: string;
  inputs: RadarInputRow[];
}

const BLURBS: Record<RadarAxisKey, string> = {
  attack:
    "כמה אתה מייצר שערים ומצבים מסוכנים. שער שווה הכי הרבה, איום מתוך הרחבה ומסירת מפתח מוסיפים כי הם פותחים סכנה לשער.",
  creation:
    "כמה אתה מייצר לאחרים. בישול שווה כפול ממסירת מפתח, כי הוא הפך מצב לביצוע.",
  defense:
    "חילוצים בלבד — כמה פעמים לקחת את הכדור מהיריב. ככל שיש יותר חילוצים, הציר גבוה יותר.",
  control:
    "כמה אתה שומר על הכדור. כל משחק נותן בסיס, וכל איבוד מוריד. פחות איבודים = יותר שליטה.",
  finishing:
    "הסיום מול השער: שערים ואיומים מתוך הרחבה. זה לא כולל איומים מחוץ לרחבה.",
  impact:
    "ציון ה-Impact העונתי שלך. הוא נבנה מכל הפעולות שנרשמו במשחק — שערים, בישולים, חילוצים, איומים, מאבקים ואיבודים. ברדאר מוצג רק החלק החיובי, ואז הוא מושווה לשחקן עם ההשפעה הגבוהה ביותר בקבוצה.",
};

function attackInputs(row: RadarSource): RadarInputRow[] {
  return [
    { label: "שערים", value: row.goals, weight: "× 3", contribution: row.goals * 3 },
    { label: "איומים ברחבה", value: row.shotsInBox, weight: "× 1", contribution: row.shotsInBox },
    { label: "מסירות מפתח", value: row.keyPasses, weight: "× 1", contribution: row.keyPasses },
  ];
}

function creationInputs(row: RadarSource): RadarInputRow[] {
  return [
    { label: "בישולים", value: row.assists, weight: "× 2", contribution: row.assists * 2 },
    { label: "מסירות מפתח", value: row.keyPasses, weight: "× 1", contribution: row.keyPasses },
  ];
}

function defenseInputs(row: RadarSource): RadarInputRow[] {
  return [{ label: "חילוצים", value: row.tackles, weight: "× 1", contribution: row.tackles }];
}

function controlInputs(row: RadarSource): RadarInputRow[] {
  const matches = Math.max(1, row.matchesPlayed);
  return [
    { label: "משחקים (בסיס)", value: matches, weight: "× 3", contribution: matches * 3 },
    { label: "איבודים", value: row.lossesTotal, weight: "− 1", contribution: -row.lossesTotal },
  ];
}

function finishingInputs(row: RadarSource): RadarInputRow[] {
  return [
    { label: "שערים", value: row.goals, weight: "× 1", contribution: row.goals },
    { label: "איומים ברחבה", value: row.shotsInBox, weight: "× 1", contribution: row.shotsInBox },
  ];
}

function impactInputs(row: RadarSource): RadarInputRow[] {
  return [
    { label: "ציון Impact", value: row.score, contribution: Math.max(0, row.score) },
    { label: "משחקים", value: row.matchesPlayed, contribution: 0 },
  ];
}

const INPUTS: Record<RadarAxisKey, (row: RadarSource) => RadarInputRow[]> = {
  attack: attackInputs,
  creation: creationInputs,
  defense: defenseInputs,
  control: controlInputs,
  finishing: finishingInputs,
  impact: impactInputs,
};

const FORMULAS: Record<RadarAxisKey, string> = {
  attack: "שערים×3 + איומים ברחבה + מסירות מפתח",
  creation: "בישולים×2 + מסירות מפתח",
  defense: "חילוצים",
  control: "מקס(0, משחקים×3 − איבודים)",
  finishing: "שערים + איומים ברחבה",
  impact: "מקס(0, ציון Impact)",
};

export function radarAxisFromLabel(label: string): RadarAxisKey | null {
  return RADAR_AXES.find((a) => a.label === label)?.key ?? null;
}

export function describeRadarAxis(
  key: RadarAxisKey,
  row: RadarSource,
  percentile: number
): RadarAxisExplain {
  const axis = RADAR_AXES.find((a) => a.key === key)!;
  const raw = rawRadarFromSeason(row)[key];
  return {
    key,
    title: axis.label,
    percentile,
    raw,
    formula: FORMULAS[key],
    blurb: BLURBS[key],
    inputs: INPUTS[key](row),
  };
}
