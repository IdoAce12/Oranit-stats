import { MATCH_TYPE_LABELS, type MatchType } from "./types";

export type TrendLabelRow = {
  id: string;
  opponent: string;
  matchType?: MatchType | null;
  matchDate?: string;
};

function typeTag(type: MatchType | null | undefined): string {
  return MATCH_TYPE_LABELS[type ?? "league"];
}

function dateTag(iso: string | undefined): string {
  if (!iso || iso.length < 10) return "";
  return `${iso.slice(8, 10)}.${iso.slice(5, 7)}`;
}

/**
 * תווית ייחודית לגרף מגמה — שני משחקים מול אותה יריבה (ליגה/גביע)
 * לא נדרסים זה על זה ב-Recharts.
 */
export function uniqueTrendLabels(rows: TrendLabelRow[]): Map<string, string> {
  const byOpp = new Map<string, number>();
  for (const r of rows) {
    const k = r.opponent.trim();
    byOpp.set(k, (byOpp.get(k) ?? 0) + 1);
  }

  const used = new Set<string>();
  const out = new Map<string, string>();
  for (const r of rows) {
    let label = r.opponent.trim() || "משחק";
    if ((byOpp.get(label) ?? 0) > 1) {
      label = `${r.opponent.trim()} · ${typeTag(r.matchType)}`;
    }
    if (used.has(label)) {
      const d = dateTag(r.matchDate);
      label = d ? `${label} · ${d}` : `${label} · ${r.id.slice(0, 4)}`;
    }
    used.add(label);
    out.set(r.id, label);
  }
  return out;
}
