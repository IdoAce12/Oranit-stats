"use client";

import { PolarAngleAxis, PolarGrid, PolarRadiusAxis, Radar, RadarChart, ResponsiveContainer } from "recharts";
import type { RadarDatum, RadarSeriesKey } from "@/lib/advancedMetrics";
import { COMPARE_PALETTE } from "@/lib/trendMetrics";

export interface RadarSeries {
  key: RadarSeriesKey;
  label: string;
  color: string;
}

interface Props {
  data: RadarDatum[];
  aLabel?: string;
  bLabel?: string;
  series?: RadarSeries[];
}

export function RadarProfile({ data, aLabel, bLabel, series }: Props) {
  const resolved: RadarSeries[] =
    series && series.length > 0
      ? series
      : [
          { key: "a", label: aLabel ?? "שחקן", color: COMPARE_PALETTE[0] },
          ...(bLabel ? [{ key: "b" as const, label: bLabel, color: COMPARE_PALETTE[1] }] : []),
        ];
  const fillOpacity = resolved.length > 2 ? 0.12 : 0.28;

  return (
    <div>
      <div className="relative h-72 w-full">
        <div className="h-full w-full" dir="ltr">
          <ResponsiveContainer width="100%" height="100%">
            <RadarChart data={data} cx="50%" cy="50%" outerRadius="62%">
              <PolarGrid stroke="var(--border-strong)" />
              <PolarAngleAxis dataKey="axis" tick={false} />
              <PolarRadiusAxis
                angle={90}
                domain={[0, 100]}
                tick={{ fill: "var(--muted-2)", fontSize: 10 }}
                axisLine={false}
              />
              {resolved.map((s) => (
                <Radar
                  key={s.key}
                  name={s.label}
                  dataKey={s.key}
                  stroke={s.color}
                  fill={s.color}
                  fillOpacity={fillOpacity}
                  strokeWidth={2}
                />
              ))}
            </RadarChart>
          </ResponsiveContainer>
        </div>
        {data.map((d, i) => {
          const angle = -Math.PI / 2 + (i * 2 * Math.PI) / data.length;
          const r = 46;
          return (
            <span
              key={d.axis}
              className="pointer-events-none absolute -translate-x-1/2 -translate-y-1/2 whitespace-nowrap text-[11px] font-semibold text-[var(--muted)]"
              style={{
                left: `${50 + r * Math.cos(angle)}%`,
                top: `${50 + r * Math.sin(angle)}%`,
              }}
            >
              {d.axis}
            </span>
          );
        })}
      </div>
      <div className="mt-1 flex flex-wrap items-center justify-center gap-4 text-xs text-[var(--muted)]">
        {resolved.map((s) => (
          <span key={s.key} className="flex items-center gap-1.5">
            <span className="h-2 w-2 rounded-full" style={{ background: s.color }} />
            {s.label}
          </span>
        ))}
      </div>
    </div>
  );
}
