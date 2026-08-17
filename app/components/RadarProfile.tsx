"use client";

import { PolarAngleAxis, PolarGrid, PolarRadiusAxis, Radar, RadarChart, ResponsiveContainer } from "recharts";
import type { RadarDatum } from "@/lib/advancedMetrics";

interface Props {
  data: RadarDatum[];
  aLabel: string;
  bLabel?: string;
}

export function RadarProfile({ data, aLabel, bLabel }: Props) {
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
              <Radar
                name={aLabel}
                dataKey="a"
                stroke="#34d399"
                fill="#34d399"
                fillOpacity={0.28}
                strokeWidth={2}
              />
              {bLabel && (
                <Radar
                  name={bLabel}
                  dataKey="b"
                  stroke="#60a5fa"
                  fill="#60a5fa"
                  fillOpacity={0.2}
                  strokeWidth={2}
                />
              )}
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
        <span className="flex items-center gap-1.5">
          <span className="h-2 w-2 rounded-full bg-[#34d399]" />
          {aLabel}
        </span>
        {bLabel && (
          <span className="flex items-center gap-1.5">
            <span className="h-2 w-2 rounded-full bg-[#60a5fa]" />
            {bLabel}
          </span>
        )}
      </div>
    </div>
  );
}
