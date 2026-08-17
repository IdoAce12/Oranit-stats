"use client";

import {
  CartesianGrid,
  Legend,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

export interface TrendPoint {
  label: string;
  score?: number;
  xg?: number;
  goals?: number;
  tackles?: number;
}

interface Props {
  data: TrendPoint[];
  series?: { key: keyof TrendPoint; label: string; color: string }[];
}

const DEFAULT_SERIES = [
  { key: "score" as const, label: "Impact", color: "#34d399" },
  { key: "xg" as const, label: "xG", color: "#60a5fa" },
];

export function TrendChart({ data, series = DEFAULT_SERIES }: Props) {
  if (data.length === 0) {
    return <p className="py-8 text-center text-sm text-[var(--muted)]">אין מספיק משחקים לטרנד</p>;
  }
  return (
    <div className="h-56 w-full" dir="ltr">
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={data} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
          <CartesianGrid stroke="var(--border)" strokeDasharray="3 3" />
          <XAxis dataKey="label" tick={{ fill: "var(--muted)", fontSize: 10 }} interval={0} />
          <YAxis tick={{ fill: "var(--muted-2)", fontSize: 10 }} width={28} />
          <Tooltip
            contentStyle={{
              background: "var(--bg)",
              border: "1px solid var(--border-strong)",
              borderRadius: 12,
              fontSize: 12,
            }}
          />
          <Legend wrapperStyle={{ fontSize: 12 }} />
          {series.map((s) => (
            <Line
              key={s.key}
              type="monotone"
              dataKey={s.key}
              name={s.label}
              stroke={s.color}
              strokeWidth={2}
              dot={{ r: 3 }}
              connectNulls
            />
          ))}
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}
