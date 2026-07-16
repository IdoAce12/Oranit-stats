import { EventRow } from "./types";
import { getSupabase } from "./supabaseClient";

const QUEUE_KEY = "scout_pending_events";

function read(): EventRow[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(QUEUE_KEY);
    return raw ? (JSON.parse(raw) as EventRow[]) : [];
  } catch {
    return [];
  }
}

function write(rows: EventRow[]) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(QUEUE_KEY, JSON.stringify(rows));
}

export function getPending(): EventRow[] {
  return read();
}

export function pendingCount(): number {
  return read().length;
}

// מוסיף אירוע לתור המקומי (תמיד מצליח, גם בלי רשת)
export function enqueue(event: EventRow) {
  const rows = read();
  rows.push(event);
  write(rows);
}

// מסיר אירוע מהתור לפי id (למשל אחרי Undo של אירוע שעוד לא נשלח)
export function removeFromQueue(id: string) {
  write(read().filter((e) => e.id !== id));
}

// שולח את כל האירועים הממתינים ל-Supabase; מחזיר את מספר האירועים שנשלחו בהצלחה
export async function flushQueue(): Promise<number> {
  const supabase = getSupabase();
  if (!supabase) return 0;

  const rows = read();
  if (rows.length === 0) return 0;

  const { error } = await supabase.from("events").upsert(rows, { onConflict: "id" });
  if (error) {
    return 0;
  }

  write([]);
  return rows.length;
}

// מנסה למחוק אירוע מ-Supabase (אם יש רשת). מחזיר true אם הצליח
export async function deleteRemote(id: string): Promise<boolean> {
  const supabase = getSupabase();
  if (!supabase) return false;
  const { error } = await supabase.from("events").delete().eq("id", id);
  return !error;
}
