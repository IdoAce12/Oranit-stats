/** שעון משחק משותף — נשמר ב-localStorage לפי matchId */

export type Half = 1 | 2;

export interface ClockState {
  half: Half;
  /** שניות שנצברו כשהשעון לא רץ (או עד ההפעלה האחרונה) */
  accumulated: number;
  /** חותמת זמן (ms) של תחילת הריצה הנוכחית — null = מושהה */
  startedAt: number | null;
}

export function clockStorageKey(matchId: string) {
  return `scout_clock_${matchId}`;
}

export function defaultClockState(): ClockState {
  return { half: 1, accumulated: 0, startedAt: null };
}

export function readClockState(matchId: string): ClockState {
  if (typeof window === "undefined") return defaultClockState();
  try {
    const raw = localStorage.getItem(clockStorageKey(matchId));
    if (!raw) return defaultClockState();
    const parsed = JSON.parse(raw) as ClockState;
    if (parsed.half !== 1 && parsed.half !== 2) return defaultClockState();
    if (typeof parsed.accumulated !== "number") return defaultClockState();
    if (parsed.startedAt !== null && typeof parsed.startedAt !== "number") {
      return defaultClockState();
    }
    return parsed;
  } catch {
    return defaultClockState();
  }
}

export function writeClockState(matchId: string, state: ClockState) {
  if (typeof window === "undefined") return;
  localStorage.setItem(clockStorageKey(matchId), JSON.stringify(state));
}

export function baseMinute(half: Half) {
  return half === 1 ? 0 : 45;
}

/** שניות שחלפו במחצית הנוכחית (כולל זמן ריצה נוכחי לפי שעון קיר) */
export function elapsedSeconds(state: ClockState, now = Date.now()) {
  const running = state.startedAt !== null ? Math.floor((now - state.startedAt) / 1000) : 0;
  return Math.max(0, state.accumulated + running);
}

export function clockDisplay(state: ClockState, now = Date.now()) {
  const elapsed = elapsedSeconds(state, now);
  return {
    half: state.half,
    minute: baseMinute(state.half) + Math.floor(elapsed / 60),
    seconds: elapsed % 60,
    running: state.startedAt !== null,
    elapsed,
  };
}
