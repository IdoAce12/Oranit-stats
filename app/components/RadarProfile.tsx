"use client";

import {
  Legend,
  PolarAngleAxis,
  PolarGrid,
  PolarRadiusAxis,
  Radar,
  RadarChart,
  ResponsiveContainer,
} from "recharts";
import type { RadarDatum } from "@/lib/advancedMetrics";

interface Props {
  data: RadarDatum[];
  aLabel: string;
  bLabel?: string;
}

export function RadarProfile({ data, aLabel, bLabel }: Props) {
  return (
    <div className="h-72 w-full" dir="ltr">
      <ResponsiveContainer width="100%" height="100%">
        <RadarChart data={data} cx="50%" cy="50%" outerRadius="70%">
          <PolarGrid stroke="var(--border-strong)" />
          <PolarAngleAxis dataKey="axis" tick={{ fill: "var(--muted)", fontSize: 11 }} />
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
          <Legend wrapperStyle={{ fontSize: 12, color: "var(--muted)" }} />
        </RadarChart>
      </ResponsiveContainer>
    </div>
  );
}
