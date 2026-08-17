"use client";

import { ZONE_LABELS, type Zone } from "@/lib/types";

interface Props {
  zones: Record<Zone, number>;
  shotsInBox?: number;
  shotsOutBox?: number;
  title?: string;
}

function intensity(value: number, max: number): string {
  if (max <= 0 || value <= 0) return "rgba(52, 211, 153, 0.06)";
  const t = Math.min(1, value / max);
  return `rgba(52, 211, 153, ${0.12 + t * 0.55})`;
}

export function PitchHeatmap({ zones, shotsInBox = 0, shotsOutBox = 0, title }: Props) {
  const max = Math.max(zones.def, zones.mid, zones.att, 1);
  return (
    <div>
      {title && <p className="label mb-2">{title}</p>}
      <div className="relative aspect-[3/4] w-full overflow-hidden rounded-2xl border border-white/15 bg-[#07142c]">
        <div className="absolute inset-[6%] flex flex-col overflow-hidden rounded-lg border border-white/25">
          <div className="relative flex-[1.1]" style={{ background: intensity(zones.att, max) }}>
            <span className="absolute left-2 top-1 text-[10px] font-bold text-white/70">
              {ZONE_LABELS.att} · {zones.att}
            </span>
            <div className="absolute left-1/2 top-0 h-[42%] w-[46%] -translate-x-1/2 rounded-b-md border border-white/30 bg-white/5" />
            {shotsInBox > 0 && (
              <span className="absolute left-1/2 top-[10%] -translate-x-1/2 rounded-full bg-amber-400 px-2 py-0.5 text-[10px] font-black text-[#241a00]">
                {shotsInBox} ברחבה
              </span>
            )}
            {shotsOutBox > 0 && (
              <span className="absolute bottom-1 left-1/2 -translate-x-1/2 rounded-full bg-white/20 px-2 py-0.5 text-[10px] font-bold text-white">
                {shotsOutBox} מחוץ
              </span>
            )}
          </div>
          <div className="relative flex-1 border-y border-white/20" style={{ background: intensity(zones.mid, max) }}>
            <span className="absolute left-2 top-1 text-[10px] font-bold text-white/70">
              {ZONE_LABELS.mid} · {zones.mid}
            </span>
            <div className="absolute left-1/2 top-1/2 h-16 w-16 -translate-x-1/2 -translate-y-1/2 rounded-full border border-white/25" />
          </div>
          <div className="relative flex-[1.1]" style={{ background: intensity(zones.def, max) }}>
            <span className="absolute left-2 top-1 text-[10px] font-bold text-white/70">
              {ZONE_LABELS.def} · {zones.def}
            </span>
            <div className="absolute bottom-0 left-1/2 h-[42%] w-[46%] -translate-x-1/2 rounded-t-md border border-white/30 bg-white/5" />
          </div>
        </div>
      </div>
      <p className="mt-1.5 text-center text-[10px] text-[var(--muted-2)]">
        חום לפי אירועים באזור (חילוץ / איבוד / מס״מ). איומים מסומנים ברחבה.
      </p>
    </div>
  );
}
