import type { ActionType, Player, SquadPlayer } from "./types";

export const GK_POSITION = "שוער";

export const SQUAD_POSITIONS = [
  { id: "שוער", label: "שוער" },
  { id: "בלם", label: "בלם" },
  { id: "מגן", label: "מגן" },
  { id: "קשר", label: "קשר" },
  { id: "חלוץ", label: "חלוץ" },
] as const;

export const MAX_GK_STARTERS = 1;

export const GK_SAVE_ACTION: ActionType = "gk_save";

export type GkOutcomeGroup = {
  id: "pass" | "aerial" | "exit";
  label: string;
  ok: ActionType;
  miss: ActionType;
  okLabel: string;
  missLabel: string;
};

export const GK_OUTCOME_GROUPS: GkOutcomeGroup[] = [
  {
    id: "pass",
    label: "מסירה",
    ok: "gk_pass_ok",
    miss: "gk_pass_miss",
    okLabel: "הגיע",
    missLabel: "לא הגיע",
  },
  {
    id: "aerial",
    label: "כדור גובה",
    ok: "gk_aerial_ok",
    miss: "gk_aerial_miss",
    okLabel: "הגיע",
    missLabel: "לא הגיע",
  },
  {
    id: "exit",
    label: "יציאה מהשער",
    ok: "gk_exit_ok",
    miss: "gk_exit_bad",
    okLabel: "טובה",
    missLabel: "לא טובה",
  },
];

export interface GkCountBag {
  gkSaves: number;
  gkPassOk: number;
  gkPassMiss: number;
  gkAerialOk: number;
  gkAerialMiss: number;
  gkExitOk: number;
  gkExitBad: number;
}

export function emptyGkCounts(): GkCountBag {
  return {
    gkSaves: 0,
    gkPassOk: 0,
    gkPassMiss: 0,
    gkAerialOk: 0,
    gkAerialMiss: 0,
    gkExitOk: 0,
    gkExitBad: 0,
  };
}

export function addGkCount(bag: GkCountBag, action: ActionType): boolean {
  switch (action) {
    case "gk_save":
      bag.gkSaves += 1;
      return true;
    case "gk_pass_ok":
    case "gk_accurate_pass":
      bag.gkPassOk += 1;
      return true;
    case "gk_pass_miss":
      bag.gkPassMiss += 1;
      return true;
    case "gk_aerial_ok":
    case "gk_aerial":
      bag.gkAerialOk += 1;
      return true;
    case "gk_aerial_miss":
      bag.gkAerialMiss += 1;
      return true;
    case "gk_exit_ok":
    case "gk_exit":
      bag.gkExitOk += 1;
      return true;
    case "gk_exit_bad":
      bag.gkExitBad += 1;
      return true;
    default:
      return false;
  }
}

export function gkCountsTotal(bag: GkCountBag): number {
  return (
    bag.gkSaves +
    bag.gkPassOk +
    bag.gkPassMiss +
    bag.gkAerialOk +
    bag.gkAerialMiss +
    bag.gkExitOk +
    bag.gkExitBad
  );
}

export function isGoalkeeper(position?: string | null): boolean {
  if (!position) return false;
  const p = position.trim().toLowerCase();
  return /שוער|gk\b|goalkeeper|goalie|\bkeeper\b/.test(p);
}

export function isGkAction(action: ActionType): boolean {
  return addGkCount(emptyGkCounts(), action);
}

export function playerIsGoalkeeper(
  player: { position?: string | null; squad_player_id?: string | null },
  squad: SquadPlayer[] = []
): boolean {
  if (isGoalkeeper(player.position)) return true;
  const sid = player.squad_player_id?.trim();
  if (!sid) return false;
  return isGoalkeeper(squad.find((s) => s.id === sid)?.position);
}

export function isGkSeasonIdentity(
  row: { key: string; squadPlayerId: string | null } & Partial<GkCountBag>,
  squad: SquadPlayer[],
  players: Player[] = []
): boolean {
  const sp = squad.find((s) => s.id === row.squadPlayerId);
  if (isGoalkeeper(sp?.position)) return true;
  if (
    players.some(
      (p) =>
        playerIsGoalkeeper(p, squad) &&
        (p.squad_player_id === row.squadPlayerId || p.id === row.key)
    )
  ) {
    return true;
  }
  return (
    (row.gkSaves ?? 0) +
      (row.gkPassOk ?? 0) +
      (row.gkPassMiss ?? 0) +
      (row.gkAerialOk ?? 0) +
      (row.gkAerialMiss ?? 0) +
      (row.gkExitOk ?? 0) +
      (row.gkExitBad ?? 0) >
    0
  );
}

export function seasonProfileHref(
  row: { key: string; squadPlayerId: string | null },
  squad: SquadPlayer[],
  players: Player[] = []
): string {
  const encoded = encodeURIComponent(row.key);
  return isGkSeasonIdentity(row, squad, players) ? `/season/gk/${encoded}` : `/season/player/${encoded}`;
}

export function filterFieldSeasonRows<T extends { key: string; squadPlayerId: string | null }>(
  rows: T[],
  squad: SquadPlayer[],
  players: Player[] = []
): T[] {
  return rows.filter((row) => !isGkSeasonIdentity(row, squad, players));
}

export function pct(part: number, whole: number): string {
  if (whole <= 0) return "—";
  return `${Math.round((part / whole) * 100)}%`;
}
