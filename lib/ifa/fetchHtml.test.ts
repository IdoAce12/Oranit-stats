import { describe, expect, it } from "vitest";
import { isBlockedIfaPage } from "./fetchHtml";

describe("isBlockedIfaPage", () => {
  it("מזהה דף Cloudflare", () => {
    expect(isBlockedIfaPage("<title>Attention Required! | Cloudflare</title>", 200)).toBe(true);
    expect(isBlockedIfaPage("<html>רשימת המשחקים</html>", 200)).toBe(false);
    expect(isBlockedIfaPage("hello", 403)).toBe(true);
  });
});
