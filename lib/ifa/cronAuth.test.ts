import { describe, expect, it } from "vitest";
import { bearerToken, cronAuthorized } from "./cronAuth";

describe("cronAuthorized", () => {
  it("מקבל רק Bearer עם אותו סוד", () => {
    expect(cronAuthorized("Bearer secret-token", "secret-token")).toBe(true);
    expect(cronAuthorized("Bearer other", "secret-token")).toBe(false);
    expect(cronAuthorized(null, "secret-token")).toBe(false);
    expect(cronAuthorized("Bearer secret-token", "")).toBe(false);
    expect(bearerToken("Bearer abc")).toBe("abc");
  });
});
