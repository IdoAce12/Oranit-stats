export type ActionType =
  | "key_pass"
  | "tackle"
  | "ball_loss"
  | "shot"
  | "goal"
  | "assist"
  | "corner_for"
  | "corner_against";

export type Zone = "def" | "mid" | "att";

export type ShotLocation = "in_box" | "out_box";

export type Half = 1 | 2;

export type MatchStatus = "live" | "finished";

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
  ended_at: string | null;
  created_at: string;
  notes?: string;
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

export const ACTION_LABELS: Record<ActionType, string> = {
  ball_loss: "איבוד כדור",
  tackle: "חילוץ",
  key_pass: "מסירת מפתח",
  shot: "איום לשער",
  goal: "שער",
  assist: "בישול",
  corner_for: "קרן לזכותנו",
  corner_against: "קרן לחובתנו",
};

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
