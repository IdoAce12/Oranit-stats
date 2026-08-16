import { MatchEvent, Player, Zone } from "./types";
import { computeImpact, PlayerImpact } from "./impactScore";
import { computeTeamTotals, TeamMatchTotals } from "./playerStats";

export interface MatchInsight {
  text: string;
  tone: "good" | "warn" | "neutral";
}

export interface MatchSummary {
  scoreLine: string; // שערים שלנו (אין יריב עדיין)
  ourGoals: number;
  motm: PlayerImpact | null;
  insights: MatchInsight[];
  team: TeamMatchTotals;
}

/** סיכום חכם לסוף משחק / ראש הדוח */
export function buildMatchSummary(events: MatchEvent[], players: Player[]): MatchSummary {
  const team = computeTeamTotals(events);
  const impact = computeImpact(events, players).filter((p) => p.playerId !== null);
  const motm = impact[0] ?? null;

  const insights: MatchInsight[] = [];

  if (motm && motm.score !== 0) {
    insights.push({
      text: `שחקן המשחק: ${motm.label} (${motm.score > 0 ? "+" : ""}${motm.score.toFixed(1)})`,
      tone: "good",
    });
  }

  const defLosses = team.losses.def;
  if (defLosses >= 3) {
    insights.push({
      text: `${defLosses} איבודי כדור בשליש ההגנתי — שווה חיתוך וידאו`,
      tone: "warn",
    });
  } else if (defLosses === 0 && events.length > 0) {
    insights.push({ text: "אפס איבודי הגנה — הגנה נקייה", tone: "good" });
  }

  const attTackles = team.tackles.att;
  if (attTackles >= 3) {
    insights.push({
      text: `${attTackles} חילוצים בשליש ההתקפי — לחץ גבוה קדימה`,
      tone: "good",
    });
  }

  if (team.keyPasses >= 3) {
    insights.push({
      text: `${team.keyPasses} מסירות מפתח — יצירת מצבים טובה`,
      tone: "good",
    });
  }

  if (team.shotsInBox === 0 && team.shotsOutBox >= 3) {
    insights.push({
      text: "הרבה איומים מבחוץ, מעט מתוך הרחבה",
      tone: "warn",
    });
  }

  if (team.assists > 0 && team.goals > team.assists) {
    insights.push({
      text: `${team.goals} שערים · ${team.assists} בישולים`,
      tone: "neutral",
    });
  } else if (team.goals > 0) {
    insights.push({
      text: `כבשנו ${team.goals} שער${team.goals > 1 ? "ים" : ""}`,
      tone: "good",
    });
  }

  // מקסימום 3 תובנות
  const top = insights.slice(0, 3);
  if (top.length === 0 && events.length > 0) {
    top.push({ text: `${team.eventsTotal} אירועים נרשמו במשחק`, tone: "neutral" });
  }

  return {
    scoreLine: `${team.goals}`,
    ourGoals: team.goals,
    motm,
    insights: top,
    team,
  };
}

export function zoneHeatPercent(data: Record<Zone, number>): Record<Zone, number> {
  const total = data.def + data.mid + data.att || 1;
  return {
    def: Math.round((data.def / total) * 100),
    mid: Math.round((data.mid / total) * 100),
    att: Math.round((data.att / total) * 100),
  };
}
