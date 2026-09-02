/** פורמציות לשחקני שדה בלבד (בלי שוער) — 10 עמדות */

export const LINEUP_SIZE = 10;

export type PitchZone = "def" | "mid" | "att";

export interface FormationSlot {
  slot: number;
  x: number;
  y: number;
  label: string;
  zone: PitchZone;
}

export type FormationId = "4-3-3" | "4-4-2" | "4-2-3-1" | "3-5-2" | "5-3-2" | "5-4-1";

export interface FormationDef {
  id: FormationId;
  label: string;
  /** כמה שחקנים בקו ההגנה */
  defenders: number;
  slots: FormationSlot[];
}

/** התקפה למעלה, הגנה למטה. x/y באחוזים ממרכז העיגול. */
export const FORMATION_4_3_3: FormationSlot[] = [
  { slot: 0, x: 84, y: 76, label: "ימין הגנה", zone: "def" },
  { slot: 1, x: 62, y: 80, label: "בלם", zone: "def" },
  { slot: 2, x: 38, y: 80, label: "בלם", zone: "def" },
  { slot: 3, x: 16, y: 76, label: "שמאל הגנה", zone: "def" },
  { slot: 4, x: 72, y: 50, label: "קשר", zone: "mid" },
  { slot: 5, x: 50, y: 48, label: "קשר", zone: "mid" },
  { slot: 6, x: 28, y: 50, label: "קשר", zone: "mid" },
  { slot: 7, x: 84, y: 20, label: "ימין התקפה", zone: "att" },
  { slot: 8, x: 50, y: 16, label: "חלוץ", zone: "att" },
  { slot: 9, x: 16, y: 20, label: "שמאל התקפה", zone: "att" },
];

export const FORMATION_4_4_2: FormationSlot[] = [
  { slot: 0, x: 84, y: 76, label: "ימין הגנה", zone: "def" },
  { slot: 1, x: 62, y: 80, label: "בלם", zone: "def" },
  { slot: 2, x: 38, y: 80, label: "בלם", zone: "def" },
  { slot: 3, x: 16, y: 76, label: "שמאל הגנה", zone: "def" },
  { slot: 4, x: 84, y: 48, label: "ימין אמצע", zone: "mid" },
  { slot: 5, x: 62, y: 50, label: "קשר", zone: "mid" },
  { slot: 6, x: 38, y: 50, label: "קשר", zone: "mid" },
  { slot: 7, x: 16, y: 48, label: "שמאל אמצע", zone: "mid" },
  { slot: 8, x: 64, y: 16, label: "חלוץ", zone: "att" },
  { slot: 9, x: 36, y: 16, label: "חלוץ", zone: "att" },
];

export const FORMATION_4_2_3_1: FormationSlot[] = [
  { slot: 0, x: 84, y: 76, label: "ימין הגנה", zone: "def" },
  { slot: 1, x: 62, y: 80, label: "בלם", zone: "def" },
  { slot: 2, x: 38, y: 80, label: "בלם", zone: "def" },
  { slot: 3, x: 16, y: 76, label: "שמאל הגנה", zone: "def" },
  { slot: 4, x: 64, y: 56, label: "קשר אחורי", zone: "mid" },
  { slot: 5, x: 36, y: 56, label: "קשר אחורי", zone: "mid" },
  { slot: 6, x: 82, y: 32, label: "ימין התקפה", zone: "att" },
  { slot: 7, x: 50, y: 34, label: "קשר התקפי", zone: "mid" },
  { slot: 8, x: 18, y: 32, label: "שמאל התקפה", zone: "att" },
  { slot: 9, x: 50, y: 14, label: "חלוץ", zone: "att" },
];

export const FORMATION_3_5_2: FormationSlot[] = [
  { slot: 0, x: 70, y: 80, label: "בלם", zone: "def" },
  { slot: 1, x: 50, y: 82, label: "בלם", zone: "def" },
  { slot: 2, x: 30, y: 80, label: "בלם", zone: "def" },
  { slot: 3, x: 88, y: 52, label: "ימין הגנה", zone: "mid" },
  { slot: 4, x: 68, y: 48, label: "קשר", zone: "mid" },
  { slot: 5, x: 50, y: 46, label: "קשר", zone: "mid" },
  { slot: 6, x: 32, y: 48, label: "קשר", zone: "mid" },
  { slot: 7, x: 12, y: 52, label: "שמאל הגנה", zone: "mid" },
  { slot: 8, x: 64, y: 16, label: "חלוץ", zone: "att" },
  { slot: 9, x: 36, y: 16, label: "חלוץ", zone: "att" },
];

export const FORMATION_5_3_2: FormationSlot[] = [
  { slot: 0, x: 88, y: 70, label: "ימין הגנה", zone: "def" },
  { slot: 1, x: 68, y: 80, label: "בלם", zone: "def" },
  { slot: 2, x: 50, y: 82, label: "בלם", zone: "def" },
  { slot: 3, x: 32, y: 80, label: "בלם", zone: "def" },
  { slot: 4, x: 12, y: 70, label: "שמאל הגנה", zone: "def" },
  { slot: 5, x: 72, y: 46, label: "קשר", zone: "mid" },
  { slot: 6, x: 50, y: 44, label: "קשר", zone: "mid" },
  { slot: 7, x: 28, y: 46, label: "קשר", zone: "mid" },
  { slot: 8, x: 64, y: 16, label: "חלוץ", zone: "att" },
  { slot: 9, x: 36, y: 16, label: "חלוץ", zone: "att" },
];

export const FORMATION_5_4_1: FormationSlot[] = [
  { slot: 0, x: 88, y: 70, label: "ימין הגנה", zone: "def" },
  { slot: 1, x: 68, y: 80, label: "בלם", zone: "def" },
  { slot: 2, x: 50, y: 82, label: "בלם", zone: "def" },
  { slot: 3, x: 32, y: 80, label: "בלם", zone: "def" },
  { slot: 4, x: 12, y: 70, label: "שמאל הגנה", zone: "def" },
  { slot: 5, x: 84, y: 46, label: "ימין אמצע", zone: "mid" },
  { slot: 6, x: 62, y: 48, label: "קשר", zone: "mid" },
  { slot: 7, x: 38, y: 48, label: "קשר", zone: "mid" },
  { slot: 8, x: 16, y: 46, label: "שמאל אמצע", zone: "mid" },
  { slot: 9, x: 50, y: 16, label: "חלוץ", zone: "att" },
];

export const FORMATIONS: FormationDef[] = [
  { id: "4-3-3", label: "4-3-3", defenders: 4, slots: FORMATION_4_3_3 },
  { id: "4-4-2", label: "4-4-2", defenders: 4, slots: FORMATION_4_4_2 },
  { id: "4-2-3-1", label: "4-2-3-1", defenders: 4, slots: FORMATION_4_2_3_1 },
  { id: "3-5-2", label: "3-5-2", defenders: 3, slots: FORMATION_3_5_2 },
  { id: "5-3-2", label: "5-3-2", defenders: 5, slots: FORMATION_5_3_2 },
  { id: "5-4-1", label: "5-4-1", defenders: 5, slots: FORMATION_5_4_1 },
];

export const DEFAULT_FORMATION_ID: FormationId = "4-3-3";

export function formationById(id: FormationId): FormationDef {
  return FORMATIONS.find((f) => f.id === id) ?? FORMATIONS[0];
}

export function groupSlotsOf(slots: FormationSlot[]): Record<PitchZone, number[]> {
  const groups: Record<PitchZone, number[]> = { def: [], mid: [], att: [] };
  for (const s of slots) groups[s.zone].push(s.slot);
  return groups;
}

export function inferSlotGroup(position: string | null | undefined): PitchZone | null {
  if (!position) return null;
  const p = position.toLowerCase();
  if (/חלוץ|אגף|כנף|\bst\b|lw|rw|cf|ss|wing|forward|striker/.test(p)) return "att";
  if (/קשר התקפ|\bam\b|\bcam\b/.test(p)) return "att";
  if (/בלם|הגנ|מגן|cb|lb|rb|wb|def|back|stopper/.test(p)) return "def";
  if (/קשר|אמצע|cm|dm|mid/.test(p)) return "mid";
  if (/התקפ|\batt\b/.test(p)) return "att";
  return null;
}

/** קו התקפה בהרכב: עמדה במשחק / בסגל, או משבצת התקפית ב־4-3-3 (ברירת המחדל). */
export function isAttackingRole(
  player: { position?: string | null; lineup_slot?: number | null },
  squadPosition?: string | null
): boolean {
  if (inferSlotGroup(player.position) === "att") return true;
  if (inferSlotGroup(squadPosition) === "att") return true;
  const slot = player.lineup_slot;
  if (typeof slot === "number" && FORMATION_4_3_3[slot]?.zone === "att") return true;
  return false;
}

function firstFree(order: number[], taken: Set<number>): number | null {
  for (const s of order) {
    if (!taken.has(s)) return s;
  }
  return null;
}

export interface SlotCandidate {
  id: string;
  position?: string | null;
}

/** ממקם עד 10 שחקנים לפי עמדה טקסטואלית, ואז ממלא את השאר. */
export function autoAssignSlots(
  players: SlotCandidate[],
  formation: FormationSlot[] = FORMATION_4_3_3
): (string | null)[] {
  const slots: (string | null)[] = Array(LINEUP_SIZE).fill(null);
  const taken = new Set<number>();
  const placed = new Set<string>();
  const groups = groupSlotsOf(formation);

  for (const p of players) {
    const group = inferSlotGroup(p.position);
    if (!group) continue;
    const slot = firstFree(groups[group], taken);
    if (slot == null) continue;
    slots[slot] = p.id;
    taken.add(slot);
    placed.add(p.id);
    if (taken.size >= LINEUP_SIZE) return slots;
  }

  const all = Array.from({ length: LINEUP_SIZE }, (_, i) => i);
  for (const p of players) {
    if (placed.has(p.id)) continue;
    const slot = firstFree(all, taken);
    if (slot == null) break;
    slots[slot] = p.id;
    taken.add(slot);
    placed.add(p.id);
  }
  return slots;
}

export interface PitchOccupant {
  id: string;
  shirt_number: number;
  name: string;
  lineup_slot?: number | null;
  on_pitch?: boolean;
}

function validSlot(n: number | null | undefined): n is number {
  return typeof n === "number" && Number.isInteger(n) && n >= 0 && n < LINEUP_SIZE;
}

/** ממקם שחקנים על המגרש לפי lineup_slot; מי בלי עמדה ממלא משבצות פנויות. */
export function resolveOccupants(players: PitchOccupant[]): (PitchOccupant | null)[] {
  const occupants: (PitchOccupant | null)[] = Array(LINEUP_SIZE).fill(null);
  const onPitch = players.filter((p) => p.on_pitch !== false);
  const overflow: PitchOccupant[] = [];

  for (const p of onPitch) {
    if (validSlot(p.lineup_slot) && !occupants[p.lineup_slot]) {
      occupants[p.lineup_slot] = p;
    } else {
      overflow.push(p);
    }
  }

  let i = 0;
  for (const p of overflow) {
    while (i < LINEUP_SIZE && occupants[i]) i += 1;
    if (i >= LINEUP_SIZE) break;
    occupants[i] = p;
    i += 1;
  }
  return occupants;
}

export function slotOfPlayer(
  occupants: (PitchOccupant | null)[],
  playerId: string
): number | null {
  const idx = occupants.findIndex((p) => p?.id === playerId);
  return idx >= 0 ? idx : null;
}
