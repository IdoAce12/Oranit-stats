export type KingId = "goals" | "assists" | "minutes" | "tackles" | "keyPasses" | "score";

export type KingPlayer = {
  key: string;
  label: string;
  goals: number;
  assists: number;
  minutes: number;
  tackles: number;
  keyPasses: number;
  score: number;
};

export type KingDef = {
  id: KingId;
  title: string;
  unit: string;
};

export const KING_DEFS: KingDef[] = [
  { id: "goals", title: "מלך שערים", unit: "שערים" },
  { id: "assists", title: "מלך בישולים", unit: "בישולים" },
  { id: "minutes", title: "מלך דקות", unit: "דק׳" },
  { id: "tackles", title: "מלך חילוצים", unit: "חילוצים" },
  { id: "keyPasses", title: "מלך מס״מ", unit: "מס״מ" },
  { id: "score", title: "מלך Impact", unit: "נק׳" },
];

export type KingRank = {
  id: KingId;
  title: string;
  unit: string;
  value: number;
  rank: number | null;
  tied: boolean;
  isKing: boolean;
  leaderLabel: string | null;
  leaderValue: number;
};

export type KingLeader = {
  id: KingId;
  title: string;
  unit: string;
  label: string;
  value: number;
};

function valueOf(player: KingPlayer, id: KingId): number {
  return player[id];
}

function fmtLabel(label: string): string {
  return label.replace(/^#\s*/, "#");
}

export function seasonKingLeaders(players: KingPlayer[]): KingLeader[] {
  return KING_DEFS.flatMap((def) => {
    const scored = [...players]
      .map((p) => ({ p, value: valueOf(p, def.id) }))
      .filter((x) => x.value > 0)
      .sort((a, b) => b.value - a.value || a.p.label.localeCompare(b.p.label, "he"));
    const top = scored[0];
    if (!top) return [];
    return [
      {
        id: def.id,
        title: def.title,
        unit: def.unit,
        label: fmtLabel(top.p.label),
        value: top.value,
      },
    ];
  });
}

/**
 * דירוג תחרותי (1,1,3). אפס בכל הקבוצה — אין מלך.
 * מדרגים רק שחקנים עם ערך > 0, חוץ מדקות שבהן 0 נשאר מחוץ לדירוג.
 */
export function rankSeasonKings(players: KingPlayer[], playerKey: string): KingRank[] {
  const me = players.find((p) => p.key === playerKey) ?? null;
  return KING_DEFS.map((def) => {
    const scored = [...players]
      .map((p) => ({ p, value: valueOf(p, def.id) }))
      .filter((x) => x.value > 0)
      .sort((a, b) => b.value - a.value || a.p.label.localeCompare(b.p.label, "he"));

    if (scored.length === 0) {
      return {
        id: def.id,
        title: def.title,
        unit: def.unit,
        value: me ? valueOf(me, def.id) : 0,
        rank: null,
        tied: false,
        isKing: false,
        leaderLabel: null,
        leaderValue: 0,
      };
    }

    const leader = scored[0];
    const myValue = me ? valueOf(me, def.id) : 0;
    let rank: number | null = null;
    let tied = false;
    if (me && myValue > 0) {
      const better = scored.filter((x) => x.value > myValue).length;
      rank = better + 1;
      tied = scored.filter((x) => x.value === myValue).length > 1;
    }

    return {
      id: def.id,
      title: def.title,
      unit: def.unit,
      value: myValue,
      rank,
      tied,
      isKing: rank === 1 && myValue > 0,
      leaderLabel: fmtLabel(leader.p.label),
      leaderValue: leader.value,
    };
  });
}
