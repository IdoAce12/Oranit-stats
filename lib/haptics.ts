// רטט קצר לאישור פעולה בלייב (בלי להסתכל על המסך)
export function tapFeedback(pattern: number | number[] = 12) {
  if (typeof navigator === "undefined") return;
  if (typeof navigator.vibrate !== "function") return;
  try {
    navigator.vibrate(pattern);
  } catch {
    /* לא נתמך - מתעלמים */
  }
}
