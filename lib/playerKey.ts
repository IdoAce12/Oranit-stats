import { Player, SquadPlayer } from "./types";

export function playerKeyOf(player: Player, squad: SquadPlayer[] = []): string {
  const squadId = player.squad_player_id?.trim() || "";
  if (squadId) return `sq:${squadId}`;

  const name = player.name.trim();
  const shirt = player.shirt_number;
  const byShirtAndName = squad.find(
    (s) => s.shirt_number === shirt && s.name.trim() === name
  );
  if (byShirtAndName) return `sq:${byShirtAndName.id}`;

  const byName = squad.filter((s) => s.name.trim() === name);
  if (byName.length === 1) return `sq:${byName[0].id}`;

  return `nm:${player.name}`;
}

export function playerMatchesKey(
  player: Player,
  key: string,
  squad: SquadPlayer[] = []
): boolean {
  if (playerKeyOf(player, squad) === key) return true;
  if (key.startsWith("sq:") && player.squad_player_id === key.slice(3)) return true;
  if (key.startsWith("nm:") && player.name === key.slice(3)) return true;
  return false;
}

function aliasKeysFor(key: string, players: Player[], squad: SquadPlayer[]): Set<string> {
  const aliases = new Set<string>([key]);
  if (key.startsWith("sq:")) {
    const id = key.slice(3);
    const sp = squad.find((s) => s.id === id);
    aliases.add(`sq:${id}`);
    if (sp) aliases.add(`nm:${sp.name}`);
  } else if (key.startsWith("nm:")) {
    const name = key.slice(3);
    aliases.add(`nm:${name}`);
    for (const s of squad) {
      if (s.name.trim() === name) aliases.add(`sq:${s.id}`);
    }
  }
  for (const p of players) {
    if (playerMatchesKey(p, key, squad)) aliases.add(playerKeyOf(p, squad));
  }
  return aliases;
}

export function findRowByPlayerKey<T extends { key: string }>(
  rows: T[],
  key: string,
  players: Player[],
  squad: SquadPlayer[]
): T | null {
  if (!key) return null;
  const direct = rows.find((r) => r.key === key);
  if (direct) return direct;
  const aliases = aliasKeysFor(key, players, squad);
  return rows.find((r) => aliases.has(r.key)) ?? null;
}