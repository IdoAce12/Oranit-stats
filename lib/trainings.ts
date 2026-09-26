export type Training = {
  id: string;
  date: string;
  time: string | null;
  venue: string;
};

export function newTrainingId(): string {
  return crypto.randomUUID();
}

export function parseTrainings(raw: unknown): Training[] {
  if (!Array.isArray(raw)) return [];
  const out: Training[] = [];
  const seen = new Set<string>();
  for (const row of raw) {
    if (!row || typeof row !== "object") continue;
    const r = row as Record<string, unknown>;
    const id = typeof r.id === "string" ? r.id.trim() : "";
    const date = typeof r.date === "string" && /^\d{4}-\d{2}-\d{2}$/.test(r.date) ? r.date : "";
    if (!id || !date || seen.has(id)) continue;
    seen.add(id);
    const timeRaw = typeof r.time === "string" ? r.time.trim() : "";
    const time = /^\d{1,2}:\d{2}$/.test(timeRaw) ? (timeRaw.length === 4 ? `0${timeRaw}` : timeRaw) : null;
    const venue = typeof r.venue === "string" ? r.venue.trim() : "";
    out.push({ id, date, time, venue });
  }
  return out.sort((a, b) => a.date.localeCompare(b.date) || (a.time ?? "").localeCompare(b.time ?? ""));
}
