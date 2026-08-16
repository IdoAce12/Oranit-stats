/** פורמציית 4-3-3 לשחקני שדה בלבד (בלי שוער) — 10 עמדות */

export const LINEUP_SIZE = 10;

export type PitchZone = "def" | "mid" | "att";

export interface FormationSlot {
  slot: number;
  x: number;
  y: number;
  label: string;
  zone: PitchZone;
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

const GROUP_SLOTS: Record<PitchZone, number[]> = {
  def: [0, 1, 2, 3],
  mid: [4, 5, 6],
  att: [7, 8, 9],
};

export function inferSlotGroup(position: string | null | undefined): PitchZone | null {
  if (!position) return null;
  const p = position.toLowerCase();
  if (/בלם|הגנ|מגן|cb|lb|rb|wb|def|back|stopper/.test(p)) return "def";
  if (/קשר|אמצע|cm|dm|am|mid/.test(p)) return "mid";
  if (/חלוץ|התקפ|אגף|כנף|st|lw|rw|att|wing|forward|striker/.test(p)) return "att";
  return null;
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
export function autoAssignSlots(players: SlotCandidate[]): (string | null)[] {
  const slots: (string | null)[] = Array(LINEUP_SIZE).fill(null);
  const taken = new Set<number>();
  const placed = new Set<string>();

  for (const p of players) {
    const group = inferSlotGroup(p.position);
    if (!group) continue;
    const slot = firstFree(GROUP_SLOTS[group], taken);
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
