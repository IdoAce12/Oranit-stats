/** תוויות וצבעים משותפים למדדי מגמה — מקור אמת אחד לגרפים ולצ'יפים. */

export type MetricKey =
  | "score"
  | "perMatch"
  | "goals"
  | "assists"
  | "keyPasses"
  | "tackles"
  | "losses"
  | "xg"
  | "xa"
  | "matchesPlayed";

export const METRIC_LABELS: Record<MetricKey, string> = {
  score: "ציון",
  perMatch: "ממוצע",
  goals: "שערים",
  assists: "בישולים",
  keyPasses: "מסירות מפתח",
  tackles: "חילוצים",
  losses: "איבודים",
  xg: "xG",
  xa: "xA",
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
  xg: "#38bdf8",
  xa: "#22d3ee",
  matchesPlayed: "#fbbf24",
};

/** צבעים קבועים לשני שחקנים בהשוואה (לא תלוי במדד). */
export const COMPARE_COLORS = { a: "#34d399", b: "#60a5fa" } as const;
