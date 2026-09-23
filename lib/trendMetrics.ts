/** תוויות וצבעים משותפים למדדי מגמה — מקור אמת אחד לגרפים ולצ'יפים. */

export type MetricKey =
  | "score"
  | "perMatch"
  | "goals"
  | "assists"
  | "keyPasses"
  | "tackles"
  | "losses"
  | "matchesPlayed";

export const METRIC_LABELS: Record<MetricKey, string> = {
  score: "ציון",
  perMatch: "ממוצע",
  goals: "שערים",
  assists: "בישולים",
  keyPasses: "מסירות מפתח",
  tackles: "חילוצים",
  losses: "איבודים",
  matchesPlayed: "משחקים",
};

export const METRIC_COLORS: Record<MetricKey, string> = {
  score: "#a78bfa",
  perMatch: "#a78bfa",
  goals: "#34d399",
  assists: "#60a5fa",
  keyPasses: "#818cf8",
  tackles: "#2dd4bf",
  losses: "#f87171",
  matchesPlayed: "#fbbf24",
};

/** צבעים קבועים לשחקנים בהשוואה (לא תלוי במדד). */
export const COMPARE_PALETTE = ["#34d399", "#60a5fa", "#fbbf24", "#fb7185", "#a78bfa"] as const;
export const COMPARE_COLORS = { a: COMPARE_PALETTE[0], b: COMPARE_PALETTE[1] } as const;
export const COMPARE_SLOT_KEYS = ["a", "b", "c", "d", "e"] as const;
export type CompareSlotKey = (typeof COMPARE_SLOT_KEYS)[number];
export const COMPARE_SLOT_LABELS = ["שחקן א׳", "שחקן ב׳", "שחקן ג׳", "שחקן ד׳", "שחקן ה׳"] as const;
export const MAX_COMPARE_PLAYERS = COMPARE_SLOT_KEYS.length;
