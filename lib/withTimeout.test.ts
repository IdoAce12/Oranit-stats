import { describe, expect, it } from "vitest";
import { withTimeout } from "./withTimeout";

describe("withTimeout", () => {
  it("מחזיר את הערך כשה-Promise מסתיים בזמן", async () => {
    await expect(withTimeout(Promise.resolve(42), 1000)).resolves.toBe(42);
  });

  it("דוחה עם הודעה כשעברה המכסה", async () => {
    const never = new Promise<number>(() => {});
    await expect(withTimeout(never, 10, "יותר מדי זמן")).rejects.toThrow("יותר מדי זמן");
  });

  it("מעביר הלאה שגיאה מקורית של ה-Promise", async () => {
    const failing = Promise.reject(new Error("נפל"));
    await expect(withTimeout(failing, 1000)).rejects.toThrow("נפל");
  });
});
