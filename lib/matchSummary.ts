import { MatchEvent, Player, Zone } from "./types";
import { computeTeamTotals, TeamMatchTotals } from "./playerStats";

export interface MatchInsight {
  text: string;
  tone: "good" | "warn" | "neutral";
}

export interface MatchSummary {
  scoreLine: string;
  ourGoals: number;
  insights: MatchInsight[];
  team: TeamMatchTotals;
}

/** סיכום חכם לסוף משחק / ראש הדוח (ללא שחקן מצטיין) */
export function buildMatchSummary(events: MatchEvent[], _players: Player[]): MatchSummary {
  const team = computeTeamTotals(events);
  const insights: MatchInsight[] = [];

  const totalLosses = team.losses.def + team.losses.mid + team.losses.att;
  if (totalLosses >= 5) {
    insights.push({
      text: `${totalLosses} איבודים כלליים במשחק — שווה חיתוך וידאו`,
      tone: "warn",
    });
  } else if (totalLosses === 0 && events.length > 0) {
    insights.push({ text: "אפס איבודים — שליטה טובה בכדור", tone: "good" });
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

  const aerialTotal = team.aerialWon + team.aerialLost;
  if (aerialTotal >= 3) {
    insights.push({
      text: `מאבקי אוויר: ${team.aerialWon} זכיות / ${team.aerialLost} הפסדים`,
      tone: team.aerialWon >= team.aerialLost ? "good" : "warn",
    });
  }

  const groundTotal = team.groundWon + team.groundLost;
  if (groundTotal >= 3) {
    insights.push({
      text: `מאבקי קרקע: ${team.groundWon} זכיות / ${team.groundLost} הפסדים`,
      tone: team.groundWon >= team.groundLost ? "good" : "warn",
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

  const top = insights.slice(0, 3);
  if (top.length === 0 && events.length > 0) {
    top.push({ text: `${team.eventsTotal} אירועים נרשמו במשחק`, tone: "neutral" });
  }

  return {
    scoreLine: `${team.goals}`,
    ourGoals: team.goals,
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
