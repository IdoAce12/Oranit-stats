const WEEKDAYS_HE = ["א", "ב", "ג", "ד", "ה", "ו", "ש"] as const;

export function localISODate(d = new Date()): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

export function parseISODate(iso: string): { year: number; month: number; day: number } | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso.trim());
  if (!m) return null;
  const year = Number(m[1]);
  const month = Number(m[2]);
  const day = Number(m[3]);
  if (!year || month < 1 || month > 12 || day < 1 || day > 31) return null;
  return { year, month, day };
}

export function isoFromParts(year: number, month: number, day: number): string {
  return `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

export function shiftMonth(year: number, month: number, delta: number): { year: number; month: number } {
  const d = new Date(year, month - 1 + delta, 1);
  return { year: d.getFullYear(), month: d.getMonth() + 1 };
}

export function monthTitle(year: number, month: number): { month: string; year: string } {
  const d = new Date(year, month - 1, 1);
  return {
    month: d.toLocaleDateString("he-IL", { month: "long" }),
    year: String(year),
  };
}

export function weekdayLabels(): readonly string[] {
  return WEEKDAYS_HE;
}

export type MonthCell = {
  iso: string | null;
  day: number | null;
};

/** רשת חודש שמתחילה ביום ראשון (א׳), כמו ביומן ישראלי. */
export function monthCells(year: number, month: number): MonthCell[] {
  const first = new Date(year, month - 1, 1);
  const startPad = first.getDay();
  const daysInMonth = new Date(year, month, 0).getDate();
  const cells: MonthCell[] = [];
  for (let i = 0; i < startPad; i++) cells.push({ iso: null, day: null });
  for (let day = 1; day <= daysInMonth; day++) {
    cells.push({ iso: isoFromParts(year, month, day), day });
  }
  while (cells.length % 7 !== 0) cells.push({ iso: null, day: null });
  return cells;
}
