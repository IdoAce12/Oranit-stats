"use client";

import { FORMATION_4_3_3, PitchOccupant } from "@/lib/formation";

interface Props {
  occupants: (PitchOccupant | null)[];
  onSlotClick?: (slot: number, player: PitchOccupant | null) => void;
  highlightSlot?: number | null;
  highlightPlayerId?: string | null;
  /** מצב הקמה — מציגים תווית עמדה גם כשהמשבצת תפוסה */
  showSlotLabels?: boolean;
  disabled?: boolean;
}

export function LineupPitch({
  occupants,
  onSlotClick,
  highlightSlot = null,
  highlightPlayerId = null,
  showSlotLabels = false,
  disabled = false,
}: Props) {
  return (
    <div className="relative aspect-[3/4] w-full overflow-hidden rounded-2xl border border-emerald-400/25 bg-gradient-to-b from-emerald-800 via-emerald-900 to-[#042012] shadow-inner">
      <div className="pointer-events-none absolute inset-[5.5%] rounded-lg border border-white/20" />
      <div className="pointer-events-none absolute left-1/2 top-[5.5%] h-[17%] w-[42%] -translate-x-1/2 rounded-b-md border border-white/20" />
      <div className="pointer-events-none absolute bottom-[5.5%] left-1/2 h-[17%] w-[42%] -translate-x-1/2 rounded-t-md border border-white/20" />
      <div className="pointer-events-none absolute left-[5.5%] right-[5.5%] top-1/2 h-px bg-white/20" />
      <div className="pointer-events-none absolute left-1/2 top-1/2 h-[22%] w-[22%] -translate-x-1/2 -translate-y-1/2 rounded-full border border-white/20" />
      <div className="pointer-events-none absolute left-1/2 top-1/2 h-1.5 w-1.5 -translate-x-1/2 -translate-y-1/2 rounded-full bg-white/35" />

      <span className="pointer-events-none absolute left-1/2 top-1.5 -translate-x-1/2 text-[10px] font-extrabold tracking-widest text-white/35">
        התקפה
      </span>
      <span className="pointer-events-none absolute bottom-1.5 left-1/2 -translate-x-1/2 text-[10px] font-extrabold tracking-widest text-white/35">
        הגנה
      </span>

      {FORMATION_4_3_3.map((node) => {
        const player = occupants[node.slot] ?? null;
        const lit =
          highlightSlot === node.slot || (player != null && highlightPlayerId === player.id);
        return (
          <button
            key={node.slot}
            type="button"
            disabled={disabled || !onSlotClick}
            onClick={() => onSlotClick?.(node.slot, player)}
            style={{ left: `${node.x}%`, top: `${node.y}%` }}
            className={`absolute z-10 flex w-[4.35rem] -translate-x-1/2 -translate-y-1/2 flex-col items-center gap-0.5 ${
              disabled ? "opacity-70" : ""
            }`}
            aria-label={player ? `#${player.shirt_number} ${player.name}` : node.label}
          >
            <span
              className={`flex h-11 w-11 items-center justify-center rounded-full border-2 text-lg font-black tabular shadow-lg transition ${
                lit
                  ? "scale-110 border-amber-300 bg-amber-400 text-[#241a00] shadow-[0_0_18px_rgba(251,191,36,0.65)]"
                  : player
                    ? "border-white/80 bg-[#04150e] text-white"
                    : "border-dashed border-white/35 bg-black/25 text-white/50"
              }`}
            >
              {player ? player.shirt_number : "·"}
            </span>
            <span
              className={`max-w-full truncate text-[10px] font-bold leading-tight ${
                player ? "text-white" : "text-white/45"
              }`}
            >
              {player ? player.name : showSlotLabels ? node.label : ""}
            </span>
          </button>
        );
      })}
    </div>
  );
}
