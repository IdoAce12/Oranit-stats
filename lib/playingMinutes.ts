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

function absMinute(half: Half, matchMinute: number): number {
  // match_minute כבר אבסולוטי במערכת (מחצית 2 מתחילה מ-45)
  // half נשמר לתיעוד; אם match_minute קטן מ-45 במחצית 2 — מתקנים
  if (half === 2 && matchMinute < 45) return 45 + matchMinute;
  return Math.max(0, matchMinute);
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
  const sortedSubs = [...subs].sort(
    (a, b) =>
      absMinute(a.half, a.match_minute) - absMinute(b.half, b.match_minute) ||
      a.created_at.localeCompare(b.created_at)
  );

  type Stint = { enter: number; exit: number | null };
  const stints = new Map<string, Stint[]>();
  const open = new Map<string, number | null>(); // enter minute or null if off

  for (const p of players) {
    stints.set(p.id, []);
    if (p.is_starter) {
      open.set(p.id, 0);
      stints.get(p.id)!.push({ enter: 0, exit: null });
    } else {
      open.set(p.id, null);
    }
  }

  const cameOn = new Set<string>();
  const subbedOff = new Set<string>();

  for (const s of sortedSubs) {
    const at = absMinute(s.half, s.match_minute);

    // יציאה
    const outOpen = open.get(s.player_out_id);
    if (outOpen !== null && outOpen !== undefined) {
      const list = stints.get(s.player_out_id) ?? [];
      const last = list[list.length - 1];
      if (last && last.exit === null) last.exit = Math.max(at, last.enter);
      open.set(s.player_out_id, null);
      subbedOff.add(s.player_out_id);
    }

    // כניסה
    if (open.get(s.player_in_id) === null || open.get(s.player_in_id) === undefined) {
      const list = stints.get(s.player_in_id) ?? [];
      stints.set(s.player_in_id, list);
      list.push({ enter: at, exit: null });
      open.set(s.player_in_id, at);
      cameOn.add(s.player_in_id);
    }
  }

  const end = Math.max(0, finalMinute);
  const result = new Map<string, PlayerMinutes>();

  for (const p of players) {
    const list = stints.get(p.id) ?? [];
    let minutes = 0;
    let finishedOnPitch = false;

    for (const st of list) {
      const exit = st.exit === null ? end : st.exit;
      if (st.exit === null) finishedOnPitch = true;
      minutes += Math.max(0, exit - st.enter);
    }

    // אם אין חילופים בכלל ופותח — דקות = final
    // אם ספסל בלי כניסה — 0
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
