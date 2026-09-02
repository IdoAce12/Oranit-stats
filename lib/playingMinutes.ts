/** חישוב דקות משחק לפי הרכב פותח + חילופים + זמן סיום */

import { Half, Match, Player, Substitution } from "./types";

export const MAX_STARTERS = 10;

export interface PlayerMinutes {
  playerId: string;
  minutesPlayed: number;
  started: boolean;
  finishedOnPitch: boolean;
  /** נכנס מהספסל לפחות פעם אחת */
  cameOnAsSub: boolean;
  /** יצא בחילוף לפחות פעם אחת */
  subbedOff: boolean;
  label: string; // לדוגמה: "פותח · 72׳" / "ספסל · 18׳"
}

export function absMinute(half: Half, matchMinute: number): number {
  // match_minute כבר אבסולוטי במערכת (מחצית 2 מתחילה מ-45)
  // half נשמר לתיעוד; אם match_minute קטן מ-45 במחצית 2 — מתקנים
  if (half === 2 && matchMinute < 45) return 45 + matchMinute;
  return Math.max(0, matchMinute);
}

export interface PitchStint {
  enter: number;
  /** דקת יציאה — בלעדית, חוץ מסטנט שנסגר בסוף המשחק */
  exit: number;
}

export function computePitchStints(
  players: Player[],
  subs: Substitution[],
  finalMinute: number
): Map<string, PitchStint[]> {
  const sortedSubs = [...subs].sort(
    (a, b) =>
      absMinute(a.half, a.match_minute) - absMinute(b.half, b.match_minute) ||
      a.created_at.localeCompare(b.created_at)
  );

  type OpenStint = { enter: number; exit: number | null };
  const openStints = new Map<string, OpenStint[]>();
  const isOn = new Map<string, boolean>();

  for (const p of players) {
    if (p.is_starter) {
      openStints.set(p.id, [{ enter: 0, exit: null }]);
      isOn.set(p.id, true);
    } else {
      openStints.set(p.id, []);
      isOn.set(p.id, false);
    }
  }

  for (const s of sortedSubs) {
    const at = absMinute(s.half, s.match_minute);
    if (isOn.get(s.player_out_id)) {
      const list = openStints.get(s.player_out_id) ?? [];
      const last = list[list.length - 1];
      if (last && last.exit === null) last.exit = Math.max(at, last.enter);
      isOn.set(s.player_out_id, false);
    }
    if (!isOn.get(s.player_in_id)) {
      const list = openStints.get(s.player_in_id) ?? [];
      openStints.set(s.player_in_id, list);
      list.push({ enter: at, exit: null });
      isOn.set(s.player_in_id, true);
    }
  }

  const end = Math.max(0, finalMinute);
  const closed = new Map<string, PitchStint[]>();
  for (const p of players) {
    const list = openStints.get(p.id) ?? [];
    closed.set(
      p.id,
      list.map((st) => ({
        enter: st.enter,
        exit: st.exit === null ? end : st.exit,
      }))
    );
  }
  return closed;
}

export function wasOnPitchAt(stints: PitchStint[], minute: number, finalMinute: number): boolean {
  return stints.some((s) => {
    const untilEnd = s.exit >= finalMinute;
    return minute >= s.enter && (untilEnd ? minute <= s.exit : minute < s.exit);
  });
}

export function resolveFinalMinute(
  match: Match | null,
  subs: Substitution[],
  eventsMaxMinute = 0
): number {
  if (match?.final_minute != null) {
    return absMinute((match.final_half as Half) || 2, match.final_minute);
  }
  const fromSubs = Math.max(0, ...subs.map((s) => absMinute(s.half, s.match_minute)));
  return Math.max(90, fromSubs, eventsMaxMinute);
}

/**
 * בונה דקות לכל שחקן.
 * פותחים נכנסים בדקה 0; חילוף סוגר/פותח סטנט; מי שנשאר על המגרש עד הסוף נסגר ב-finalMinute.
 */
export function computePlayingMinutes(
  players: Player[],
  subs: Substitution[],
  finalMinute: number
): Map<string, PlayerMinutes> {
  const stintsById = computePitchStints(players, subs, finalMinute);
  const cameOn = new Set<string>();
  const subbedOff = new Set<string>();
  for (const s of subs) {
    subbedOff.add(s.player_out_id);
    cameOn.add(s.player_in_id);
  }

  const end = Math.max(0, finalMinute);
  const result = new Map<string, PlayerMinutes>();

  for (const p of players) {
    const list = stintsById.get(p.id) ?? [];
    let minutes = 0;
    let finishedOnPitch = false;
    for (const st of list) {
      minutes += Math.max(0, st.exit - st.enter);
      if (st.exit >= end) finishedOnPitch = true;
    }

    const started = p.is_starter === true;
    const label =
      minutes <= 0
        ? started
          ? "פותח · 0׳"
          : "ספסל · 0׳"
        : started
          ? subbedOff.has(p.id)
            ? `פותח · הוחלף · ${minutes}׳`
            : `פותח · ${minutes}׳`
          : cameOn.has(p.id)
            ? finishedOnPitch
              ? `ספסל · נכנס · ${minutes}׳`
              : `ספסל · ${minutes}׳`
            : `ספסל · 0׳`;

    result.set(p.id, {
      playerId: p.id,
      minutesPlayed: minutes,
      started,
      finishedOnPitch: finishedOnPitch && minutes > 0,
      cameOnAsSub: cameOn.has(p.id),
      subbedOff: subbedOff.has(p.id),
      label,
    });
  }

  return result;
}
