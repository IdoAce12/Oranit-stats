export type ActionType =
  | "key_pass"
  | "tackle"
  | "ball_loss"
  | "shot"
  | "goal"
  | "assist"
  | "corner_for"
  | "corner_against"
  | "aerial_won"
  | "aerial_lost"
  | "ground_won"
  | "ground_lost";

export type Zone = "def" | "mid" | "att";

export type ShotLocation = "in_box" | "out_box";

export type DuelKind = "aerial" | "ground";
export type DuelResult = "won" | "lost";

export type Half = 1 | 2;

export type MatchStatus = "live" | "finished";

// סוג משחק — לסיווג וסינון בטבלאות
export type MatchType = "league" | "cup" | "friendly";

// שחקן בסגל הקבוע של הקבוצה (לא קשור למשחק)
export interface SquadPlayer {
  id: string;
  shirt_number: number;
  name: string;
  position: string | null;
  active: boolean;
  created_at: string;
}

export interface Match {
  id: string;
  opponent: string;
  match_date: string;
  our_team_name: string;
  status: MatchStatus;
  match_type: MatchType;
  ended_at: string | null;
  created_at: string;
  notes?: string;
  final_half?: number | null;
  final_minute?: number | null;
}

// שחקן במשחק ספציפי (snapshot מהסגל)
export interface Player {
  id: string;
  match_id: string;
  squad_player_id: string | null;
  shirt_number: number;
  name: string;
  position: string | null;
  is_starter?: boolean;
  /** על המגרש כרגע (מתעדכן בחילוף) */
  on_pitch?: boolean;
  /** עמדה בפורמציה 4-3-3 (0–9). null = ספסל */
  lineup_slot?: number | null;
}

export interface Substitution {
  id: string;
  match_id: string;
  player_out_id: string;
  player_in_id: string;
  half: Half;
  match_minute: number;
  created_at: string;
}

export interface MatchEvent {
  id: string;
  match_id: string;
  player_id: string | null;
  action_type: ActionType;
  zone: Zone | null;
  shot_location: ShotLocation | null;
  half: Half;
  match_minute: number;
  created_at: string;
}

// שורת האירוע שנשלחת ל-Supabase (ה-id נוצר בצד הלקוח לתמיכה ב-Undo ובתור אופליין)
export interface EventRow {
  id: string;
  match_id: string;
  player_id: string | null;
  action_type: ActionType;
  zone: Zone | null;
  shot_location: ShotLocation | null;
  half: Half;
  match_minute: number;
  created_at: string;
}

// אירוע כפי שהוא מוצג בממשק החי, כולל מצב הסנכרון
export interface LiveEvent extends EventRow {
  synced: boolean;
}

// תוויות סוג משחק (קצר — לצ׳יפים ולסינון)
export const MATCH_TYPE_LABELS: Record<MatchType, string> = {
  league: "ליגה",
  cup: "גביע",
  friendly: "אימון",
};

// תוויות מלאות — לבחירה במסך יצירת המשחק
export const MATCH_TYPE_FULL_LABELS: Record<MatchType, string> = {
  league: "משחק ליגה",
  cup: "גביע המדינה",
  friendly: "משחק אימון",
};

// סדר קבוע להצגה
export const MATCH_TYPE_ORDER: MatchType[] = ["league", "cup", "friendly"];

export const ACTION_LABELS: Record<ActionType, string> = {
  ball_loss: "איבוד כדור",
  tackle: "חילוץ",
  key_pass: "מסירת מפתח",
  shot: "איום לשער",
  goal: "שער",
  assist: "בישול",
  corner_for: "קרן לזכותנו",
  corner_against: "קרן לחובתנו",
  aerial_won: "מאבק אוויר · זכה",
  aerial_lost: "מאבק אוויר · הפסיד",
  ground_won: "מאבק קרקע · זכה",
  ground_lost: "מאבק קרקע · הפסיד",
};

export const DUEL_KIND_LABELS: Record<DuelKind, string> = {
  aerial: "מאבקי אוויר",
  ground: "מאבקי קרקע",
};

export const DUEL_RESULT_LABELS: Record<DuelResult, string> = {
  won: "זכה",
  lost: "הפסיד",
};

export function duelAction(kind: DuelKind, result: DuelResult): ActionType {
  if (kind === "aerial") return result === "won" ? "aerial_won" : "aerial_lost";
  return result === "won" ? "ground_won" : "ground_lost";
}

export const ZONE_LABELS: Record<Zone, string> = {
  def: "הגנה",
  mid: "אמצע",
  att: "התקפה",
};

export const SHOT_LABELS: Record<ShotLocation, string> = {
  in_box: "מתוך הרחבה",
  out_box: "מחוץ לרחבה",
};

// אילו פעולות דורשות בחירת אזור (הגנה/אמצע/התקפה)
export const ACTIONS_NEED_ZONE: ActionType[] = ["ball_loss", "tackle", "key_pass"];

// אילו פעולות דורשות תגית בתוך/מחוץ לרחבה
export const ACTIONS_NEED_SHOT_LOCATION: ActionType[] = ["shot"];

// פעולות שהן אירוע קבוצתי (ללא שחקן ספציפי) ונרשמות מיד
export const TEAM_ACTIONS: ActionType[] = ["corner_for", "corner_against"];

export const DUEL_ACTIONS: ActionType[] = ["aerial_won", "aerial_lost", "ground_won", "ground_lost"];
