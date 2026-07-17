"use client";

import { useEffect, useState } from "react";
import {
  ClockState,
  Half,
  clockDisplay,
  elapsedSeconds,
  readClockState,
  writeClockState,
} from "@/lib/matchClock";

interface Props {
  matchId: string;
  onChange: (half: Half, minute: number) => void;
}

export function MatchClock({ matchId, onChange }: Props) {
  // קריאה סינכרונית — מונעת דריסת שעון רץ ב-localStorage בטעינה מחדש
  const [state, setState] = useState<ClockState>(() => readClockState(matchId));
  const [, forceTick] = useState(0);

  // אם עברו ל-match אחר באותו קומפוננטה
  useEffect(() => {
    setState(readClockState(matchId));
  }, [matchId]);

  useEffect(() => {
    writeClockState(matchId, state);
  }, [matchId, state]);

  // טיק לתצוגה — הזמן עצמו מחושב משעון קיר, אז גם אחרי ניווט הוא ממשיך
  useEffect(() => {
    if (state.startedAt === null) return;
    const id = setInterval(() => forceTick((t) => t + 1), 1000);
    return () => clearInterval(id);
  }, [state.startedAt]);

  const { minute, seconds, running } = clockDisplay(state);

  useEffect(() => {
    onChange(state.half, minute);
  }, [state.half, minute, onChange]);

  const toggleRun = () => {
    setState((s) => {
      if (s.startedAt === null) {
        return { ...s, startedAt: Date.now() };
      }
      const add = Math.floor((Date.now() - s.startedAt) / 1000);
      return { ...s, accumulated: s.accumulated + add, startedAt: null };
    });
  };

  const adjust = (deltaSec: number) => {
    setState((s) => {
      const current = elapsedSeconds(s);
      const next = Math.max(0, current + deltaSec);
      return {
        ...s,
        accumulated: next,
        startedAt: s.startedAt ? Date.now() : null,
      };
    });
  };

  const setHalf = (half: Half) => {
    // מעבר מחצית מאפס את מונה הדקות של המחצית; אם רץ — ממשיך לרוץ
    setState((s) => ({
      half,
      accumulated: 0,
      startedAt: s.startedAt ? Date.now() : null,
    }));
  };

  return (
    <div className="card p-3">
      <div className="flex items-center justify-between">
        <div className="flex gap-1">
          {([1, 2] as Half[]).map((h) => (
            <button
              key={h}
              type="button"
              onClick={() => setHalf(h)}
              className={`rounded-xl px-3 py-2 text-sm font-bold transition ${
                state.half === h
                  ? "bg-[var(--accent)] text-[#04150e]"
                  : "bg-[var(--panel-strong)] text-[var(--muted)]"
              }`}
            >
              מחצית {h}
            </button>
          ))}
        </div>
        <div className="text-center">
          <div className="text-4xl font-black tabular leading-none">
            {minute}
            <span className="text-lg font-bold text-[var(--muted-2)]">
              ׳{String(seconds).padStart(2, "0")}
            </span>
          </div>
          {running && (
            <p className="mt-0.5 text-[10px] font-bold text-[var(--accent)]">רץ ברקע גם בדוח</p>
          )}
        </div>
        <button
          type="button"
          onClick={toggleRun}
          className={`btn h-11 px-5 text-sm ${
            running ? "bg-amber-400 text-[#241a00]" : "btn-primary"
          }`}
        >
          {running ? "השהה" : "הפעל"}
        </button>
      </div>
      <div className="mt-2.5 flex justify-center gap-2">
        <button type="button" onClick={() => adjust(-60)} className="btn btn-ghost h-8 px-5 text-sm">
          −1׳
        </button>
        <button type="button" onClick={() => adjust(60)} className="btn btn-ghost h-8 px-5 text-sm">
          +1׳
        </button>
      </div>
    </div>
  );
}
