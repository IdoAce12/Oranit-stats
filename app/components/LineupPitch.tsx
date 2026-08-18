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
    <div
      className="relative aspect-[3/4] w-full overflow-hidden rounded-2xl border border-white/15 bg-[#0a2f1e] bg-cover bg-center shadow-[0_16px_40px_-18px_rgba(8,24,90,0.85)]"
      style={{ backgroundImage: "url('/pitch-grass.jpg')" }}
    >
      {/* הכהיה עדינה לניגודיות הקווים והשחקנים */}
      <div className="pointer-events-none absolute inset-0 bg-black/25" />
      {/* וינייטה לעומק */}
      <div className="pointer-events-none absolute inset-0 shadow-[inset_0_0_70px_rgba(0,0,0,0.55)]" />

      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src="/hapoel-oranit.png"
        alt=""
        className="pointer-events-none absolute left-1/2 top-[46%] w-[88%] max-w-none -translate-x-1/2 -translate-y-1/2 object-contain opacity-[0.16]"
      />

      <div className="pointer-events-none absolute inset-[5.5%] rounded-lg border border-white/35" />
      <div className="pointer-events-none absolute left-1/2 top-[5.5%] h-[17%] w-[42%] -translate-x-1/2 rounded-b-md border border-white/30" />
      <div className="pointer-events-none absolute bottom-[5.5%] left-1/2 h-[17%] w-[42%] -translate-x-1/2 rounded-t-md border border-white/30" />
      <div className="pointer-events-none absolute left-[5.5%] right-[5.5%] top-1/2 h-px bg-white/30" />
      <div className="pointer-events-none absolute left-1/2 top-1/2 h-[22%] w-[22%] -translate-x-1/2 -translate-y-1/2 rounded-full border border-white/30" />
      <div className="pointer-events-none absolute left-1/2 top-1/2 h-1.5 w-1.5 -translate-x-1/2 -translate-y-1/2 rounded-full bg-white/50" />

      <span className="pointer-events-none absolute left-1/2 top-1.5 -translate-x-1/2 text-[10px] font-extrabold text-white/55">
        התקפה
      </span>
      <span className="pointer-events-none absolute bottom-1.5 left-1/2 -translate-x-1/2 text-[10px] font-extrabold text-white/55">
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
              className={`flex h-12 w-12 items-center justify-center rounded-xl border-2 text-lg font-black tabular shadow-[0_10px_18px_-4px_rgba(0,0,0,0.75)] transition ${
                lit
                  ? "scale-110 border-amber-300 bg-amber-400 text-[#241a00] shadow-[0_0_20px_rgba(251,191,36,0.7)]"
                  : player
                    ? "border-white/90 bg-gradient-to-b from-[#123a9e] to-[#0a1f5c] text-white"
                    : "border-dashed border-white/50 bg-[#0a246b]/45 text-white/70"
              }`}
            >
              {player ? player.shirt_number : "·"}
            </span>
            <span
              className={`max-w-full truncate rounded-md px-1 text-[10px] font-bold leading-tight ${
                player ? "bg-[#06123a]/70 text-white" : "text-white/70"
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
