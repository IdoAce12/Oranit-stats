/** עוטף Promise עם דד-ליין; דוחה עם הודעת שגיאה קריאה אם עברה המכסה. */
export function withTimeout<T>(
  promise: Promise<T>,
  ms: number,
  message = "הטעינה ארכה יותר מדי. נסה שוב."
): Promise<T> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error(message)), ms);
    promise.then(
      (value) => {
        clearTimeout(timer);
        resolve(value);
      },
      (err) => {
        clearTimeout(timer);
        reject(err);
      }
    );
  });
}
