import { describe, expect, it } from "vitest";
import { isBlockedIfaPage, looksLikeIfaHtml } from "./fetchHtml";

describe("isBlockedIfaPage", () => {
  it("מזהה דף Cloudflare", () => {
    expect(isBlockedIfaPage("<title>Attention Required! | Cloudflare</title>", 200)).toBe(true);
    expect(isBlockedIfaPage("<html>רשימת המשחקים</html>", 200)).toBe(false);
    expect(isBlockedIfaPage("hello", 403)).toBe(true);
  });
});

describe("looksLikeIfaHtml", () => {
  it("מזהה HTML אמיתי של ההתאחדות", () => {
    const html = `<!doctype html>${"x".repeat(800)}<h1>רשימת המשחקים</h1>`;
    expect(looksLikeIfaHtml(html)).toBe(true);
    expect(looksLikeIfaHtml("<title>Attention Required! | Cloudflare</title>")).toBe(false);
    expect(looksLikeIfaHtml("short")).toBe(false);
  });
});
