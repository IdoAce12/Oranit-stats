"use client";

import { useEffect, useState } from "react";
import { clockDisplay, readClockState } from "@/lib/matchClock";

/** תצוגת שעון חיה (לקריאה בלבד) — ממשיכה לזוז גם מחוץ למסך הלייב */
export function LiveClockBadge({ matchId }: { matchId: string }) {
  const [now, setNow] = useState(() => Date.now());
  const state = readClockState(matchId);
  const { minute, seconds, running, half } = clockDisplay(state, now);

  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, []);

  if (!running && state.accumulated === 0) return null;

  return (
    <div className="mb-4 flex items-center justify-between rounded-2xl border border-[var(--accent)]/30 bg-[var(--accent)]/10 px-4 py-3">
      <div>
        <p className="text-[11px] font-bold text-[var(--accent)]">
          {running ? "שעון רץ" : "שעון מושהה"} · מחצית {half}
        </p>
        <p className="text-xs text-[var(--muted)]">ממשיך גם כשאתה בדוח</p>
      </div>
      <div className="tabular text-3xl font-black leading-none">
        {minute}
        <span className="text-base font-bold text-[var(--muted)]">
          ׳{String(seconds).padStart(2, "0")}
        </span>
      </div>
    </div>
  );
}
