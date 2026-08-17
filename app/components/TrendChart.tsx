"use client";

import {
  CartesianGrid,
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
  assists?: number;
  keyPasses?: number;
  tackles?: number;
  losses?: number;
  matchesPlayed?: number;
}

interface Props {
  data: TrendPoint[];
  series?: { key: keyof TrendPoint; label: string; color: string }[];
}

const DEFAULT_SERIES = [
  { key: "score" as const, label: "Impact", color: "#34d399" },
  { key: "xg" as const, label: "xG", color: "#60a5fa" },
];

function RtlTick({
  x = 0,
  y = 0,
  payload,
}: {
  x?: number;
  y?: number;
  payload?: { value?: string };
}) {
  return (
    <g transform={`translate(${x},${y})`}>
      <foreignObject x={-42} y={2} width={84} height={28} overflow="visible">
        <div
          dir="rtl"
          style={{
            width: "84px",
            textAlign: "center",
            fontSize: "10px",
            color: "var(--muted)",
            lineHeight: 1.2,
            overflow: "hidden",
            textOverflow: "ellipsis",
            whiteSpace: "nowrap",
          }}
        >
          {payload?.value}
        </div>
      </foreignObject>
    </g>
  );
}

export function TrendChart({ data, series = DEFAULT_SERIES }: Props) {
  if (data.length === 0) {
    return <p className="py-8 text-center text-sm text-[var(--muted)]">אין מספיק משחקים לטרנד</p>;
  }
  return (
    <div>
      <div className="h-56 w-full" dir="ltr">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={data} margin={{ top: 8, right: 8, left: 0, bottom: 18 }}>
            <CartesianGrid stroke="var(--border)" strokeDasharray="3 3" />
            <XAxis dataKey="label" tick={<RtlTick />} interval={0} tickLine={false} />
            <YAxis tick={{ fill: "var(--muted-2)", fontSize: 10 }} width={28} />
            <Tooltip
              content={({ active, payload, label }) => {
                if (!active || !payload?.length) return null;
                return (
                  <div
                    dir="rtl"
                    className="rounded-xl border border-[var(--border-strong)] bg-[var(--bg)] px-3 py-2 text-xs"
                  >
                    <p className="mb-1 font-bold">{label}</p>
                    {payload.map((p) => (
                      <p key={String(p.dataKey)} style={{ color: String(p.color) }}>
                        {p.name}: {p.value}
                      </p>
                    ))}
                  </div>
                );
              }}
            />
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
      <div className="mt-1 flex flex-wrap items-center justify-center gap-4 text-xs text-[var(--muted)]">
        {series.map((s) => (
          <span key={s.key} className="flex items-center gap-1.5">
            <span className="h-2 w-2 rounded-full" style={{ background: s.color }} />
            {s.label}
          </span>
        ))}
      </div>
    </div>
  );
}
