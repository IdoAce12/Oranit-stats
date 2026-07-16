"use client";

import { useEffect, useRef, useState } from "react";
import { Half } from "@/lib/types";

interface Props {
  matchId: string;
  onChange: (half: Half, minute: number) => void;
}

interface ClockState {
  half: Half;
  accumulated: number; // שניות שנצברו כשהשעון לא רץ
  startedAt: number | null; // חותמת זמן (ms) של תחילת הריצה הנוכחית
}

function baseMinute(half: Half) {
  return half === 1 ? 0 : 45;
}

export function MatchClock({ matchId, onChange }: Props) {
  const key = `scout_clock_${matchId}`;
  const [state, setState] = useState<ClockState>({ half: 1, accumulated: 0, startedAt: null });
  const [, forceTick] = useState(0);
  const loaded = useRef(false);

  // טעינה מ-localStorage פעם אחת
  useEffect(() => {
    try {
      const raw = localStorage.getItem(key);
      if (raw) setState(JSON.parse(raw));
    } catch {
      /* מתעלמים */
    }
    loaded.current = true;
  }, [key]);

  // שמירה
  useEffect(() => {
    if (!loaded.current) return;
    localStorage.setItem(key, JSON.stringify(state));
  }, [key, state]);

  // טיק כל שנייה כשהשעון רץ
  useEffect(() => {
    if (state.startedAt === null) return;
    const id = setInterval(() => forceTick((t) => t + 1), 1000);
    return () => clearInterval(id);
  }, [state.startedAt]);

  const running = state.startedAt !== null;
  const elapsed =
    state.accumulated + (running ? Math.floor((Date.now() - (state.startedAt as number)) / 1000) : 0);
  const minute = baseMinute(state.half) + Math.floor(elapsed / 60);
  const seconds = elapsed % 60;

  // דיווח להורה על דקה/מחצית
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
      const current =
        s.accumulated + (s.startedAt ? Math.floor((Date.now() - s.startedAt) / 1000) : 0);
      const next = Math.max(0, current + deltaSec);
      return { ...s, accumulated: next, startedAt: s.startedAt ? Date.now() : null };
    });
  };

  const setHalf = (half: Half) => {
    // מעבר מחצית מאפס את מונה הדקות של המחצית (הבסיס מטופל אוטומטית)
    setState({ half, accumulated: 0, startedAt: null });
  };

  return (
    <div className="rounded-2xl border border-white/10 bg-white/5 p-3">
      <div className="flex items-center justify-between">
        <div className="flex gap-1">
          {([1, 2] as Half[]).map((h) => (
            <button
              key={h}
              onClick={() => setHalf(h)}
              className={`rounded-lg px-3 py-1.5 text-sm font-semibold ${
                state.half === h ? "bg-green-500 text-black" : "bg-white/10 text-white/70"
              }`}
            >
              מחצית {h}
            </button>
          ))}
        </div>
        <div className="text-center">
          <div className="text-3xl font-bold tabular-nums">
            {minute}
            <span className="text-lg text-white/50">׳{String(seconds).padStart(2, "0")}</span>
          </div>
        </div>
        <button
          onClick={toggleRun}
          className={`rounded-lg px-4 py-2 text-sm font-bold ${
            running ? "bg-amber-400 text-black" : "bg-green-500 text-black"
          }`}
        >
          {running ? "השהה" : "הפעל"}
        </button>
      </div>
      <div className="mt-2 flex justify-center gap-2">
        <button onClick={() => adjust(-60)} className="rounded-lg bg-white/10 px-4 py-1 text-sm active:scale-95">
          −1׳
        </button>
        <button onClick={() => adjust(60)} className="rounded-lg bg-white/10 px-4 py-1 text-sm active:scale-95">
          +1׳
        </button>
      </div>
    </div>
  );
}
