/** תוצאת התאחדות היא בית–חוץ, כמו עמודת "משחק": בית - חוץ. */

export interface ParsedIfaScore {
  home: number;
  away: number;
}

export interface HomeAwaySides {
  homeName: string;
  awayName: string;
  homeIsUs: boolean;
  awayIsUs: boolean;
  homeGoals: number | null;
  awayGoals: number | null;
}

export function parseIfaScore(score: string | null | undefined): ParsedIfaScore | null {
  if (!score) return null;
  const m = score.trim().match(/^(\d+)\s*[-:–]\s*(\d+)$/);
  if (!m) return null;
  return { home: Number(m[1]), away: Number(m[2]) };
}

const OUR_LABEL = "אורנית";

/**
 * קבוצת הבית + שערי הבית מול קבוצת החוץ + שערי החוץ.
 * לא מחליפים מספרים לפי מי אורנית — כל צד נשאר עם הקבוצה שלו.
 */
export function homeAwaySides(
  event: { opponent: string; home: boolean | null; score: string | null },
  ourName = OUR_LABEL
): HomeAwaySides {
  const weAreHome = event.home !== false;
  const parsed = parseIfaScore(event.score);
  return {
    homeName: weAreHome ? ourName : event.opponent,
    awayName: weAreHome ? event.opponent : ourName,
    homeIsUs: weAreHome,
    awayIsUs: !weAreHome,
    homeGoals: parsed ? parsed.home : null,
    awayGoals: parsed ? parsed.away : null,
  };
}
